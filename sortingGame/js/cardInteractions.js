// js/cardInteractions.js
"use strict";

/**
 * Adds necessary event listeners (click, drag) to a card element.
 * @param {HTMLElement} cardEl The card element.
 */
function addCardEventListeners(cardEl) {
    // Click to Reveal
    cardEl.addEventListener('click', handleCardClick);
    // Drag Start (Mouse & Touch)
    cardEl.addEventListener('mousedown', onCardMouseDown);
    cardEl.addEventListener('touchstart', onCardTouchStart, { passive: false });
}

/**
 * Handles clicks on cards (potential reveal trigger).
 * @param {Event} e The click event.
 */
function handleCardClick(e) {
    const cardEl = e.currentTarget;
    // Allow reveal only if not locked, no card already revealed, and game/test started
    if (inputLocked || currentRevealedCard || (currentRound === 0 && !isTestSession)) {
        console.log("Card click blocked: locked, revealed, or game not started.");
        return;
    }
    revealCard(cardEl);
}


/**
 * Handles revealing a card: fetches question, updates UI, sends message, manages lock state.
 * @param {HTMLElement} cardEl The card element that was clicked.
 */
function revealCard(cardEl) {
    // Double-check conditions
    if (inputLocked || currentRevealedCard || (currentRound === 0 && !isTestSession)) {
         console.warn("Reveal attempted when blocked.");
        return;
    }

    // --- Lock Input ---
    inputLocked = true;
    console.log("Input LOCKED on reveal");

    // --- Get Question Data ---
    let selectedQuestion;
    let questionSourceIndex; // 0-based index from the source array

    if (isTestSession) {
        if (testQuestionIndex >= testQuestions.length) {
            console.warn("No more test questions left.");
            inputLocked = false; // Unlock if nothing to reveal
            console.log("Input UNLOCKED (no more test questions)");
            return;
        }
        selectedQuestion = testQuestions[testQuestionIndex];
        questionSourceIndex = testQuestionIndex;
        testQuestionIndex++; // Increment index for next test question
    } else { // Regular round
        if (questionIndexThisRound >= questionsThisRound.length) {
            console.warn("No more questions left in this round.");
            inputLocked = false; // Unlock if nothing to reveal
            console.log("Input UNLOCKED (no more round questions)");
            return;
        }
        selectedQuestion = questionsThisRound[questionIndexThisRound];
        questionSourceIndex = questionIndexThisRound;
        questionIndexThisRound++; // Increment index for next round question
    }

    // --- Update State ---
    currentRevealedCard = cardEl; // Set global reference

    // Store comprehensive data about the current question/card state
    const answerBool = (selectedQuestion.correct_answer.trim().toUpperCase() === "TRUE"); // Determine boolean answer
    const correctSide = answerBool ? "left" : "right"; // Determine correct drop side
    currentQuestionData = {
        cardId: cardEl.dataset.id, // Use the visual card's ID
        question: selectedQuestion.question,
        difficulty: selectedQuestion.difficulty,
        answer: answerBool, // Store boolean answer
        side: correctSide, // Store 'left' or 'right' based on answer
        round: isTestSession ? "test" : currentRound, // Mark round as 'test' or the actual number
        questionIndexInSource: questionSourceIndex + 1, // 1-based index for logging/tracking
    };
    console.log("Revealed Card Data:", JSON.stringify(currentQuestionData));


    // --- Visual Reveal ---
    const rect = cardEl.getBoundingClientRect();
    document.body.appendChild(cardEl); // Move card to body for absolute positioning
    cardEl.style.position = 'absolute';
    cardEl.style.left = rect.left + 'px';
    cardEl.style.top = rect.top + 'px';
    cardEl.classList.add('revealed');
    cardEl.style.zIndex = 1001; // Ensure it's on top

    // Display question text and adjust font size
    const questionEl = document.createElement('div');
    questionEl.innerHTML = currentQuestionData.question; // Use innerHTML for entities
    questionEl.classList.add('question-text');
    cardEl.innerHTML = ""; // Clear card before adding text
    cardEl.appendChild(questionEl);
    requestAnimationFrame(() => adjustFontSize(questionEl)); // Adjust font after render

    // --- Send Message (if not test session) ---
    if (!isTestSession && typeof sendMessage === 'function') {
        const messageData = {
            action: "logGame", // Or a more specific action if your server expects it
            event: "cardReveal",
            participant: participantId,
            cardId: currentQuestionData.cardId,
            round: currentQuestionData.round,
            questionIndex: currentQuestionData.questionIndexInSource, // Use 1-based index
            turn: "participant", // Assuming participant revealed
            question: currentQuestionData.question,
            difficulty: currentQuestionData.difficulty,
            answer: currentQuestionData.answer, // Send boolean answer
            side: currentQuestionData.side // Send correct side ('left'/'right')
        };
        console.log(">>> Sending cardReveal data:", JSON.stringify(messageData));
        sendMessage(messageData);
    } else if (!isTestSession) {
        console.warn("sendMessage function not found. Skipping cardReveal event log.");
    } else {
         console.log("Skipping sendMessage for cardReveal (Test Session)");
    }

    // --- Unlock Input After Delay ---
    setTimeout(() => {
        // Only unlock if this card is *still* the currently revealed one
        if (currentRevealedCard === cardEl) {
            inputLocked = false;
            console.log(`Input UNLOCKED after ${REVEAL_DELAY_MS}ms reveal delay`);
        } else {
            console.log("Input remained locked (state changed during reveal delay - e.g., card dropped quickly?)");
        }
    }, REVEAL_DELAY_MS);
}

// --- Drag & Drop Handlers ---

function onCardMouseDown(e) {
    const card = e.currentTarget;
    // Allow drag only if this specific card is revealed and input is not locked
    if (card !== currentRevealedCard || inputLocked) return;

    isDragging = true;
    draggedCard = card; // Reference the card being dragged
    const rect = card.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Add listeners to window for smooth dragging
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    // Optional: Add a visual cue for dragging
    // card.classList.add('dragging');
}

function onMouseMove(e) {
    if (!isDragging || !draggedCard) return;

    // Calculate new position
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    draggedCard.style.left = x + 'px';
    draggedCard.style.top = y + 'px';

    // Highlight drop zones based on current position
    highlightDropZone(draggedCard, leftDropZone);
    highlightDropZone(draggedCard, rightDropZone);
}

function onMouseUp(e) {
    if (!isDragging || !draggedCard) return;

    handleCardDrop(draggedCard); // Process the drop location

    // Clean up drag state
    isDragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if(leftDropZone) leftDropZone.classList.remove('highlight');
    if(rightDropZone) rightDropZone.classList.remove('highlight');
    // Optional: Remove visual cue
    // if (draggedCard) draggedCard.classList.remove('dragging');
    draggedCard = null; // Clear reference
}

// --- Touch Handlers ---

function onCardTouchStart(e) {
    const card = e.currentTarget;
     // Allow drag only if this card is revealed and input is not locked
    if (card !== currentRevealedCard || inputLocked) return;

    e.preventDefault(); // Prevent default touch behavior (like scrolling)

    isDragging = true;
    draggedCard = card;
    const touch = e.touches[0];
    const rect = card.getBoundingClientRect();
    dragOffsetX = touch.clientX - rect.left;
    dragOffsetY = touch.clientY - rect.top;

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    // card.classList.add('dragging');
}

function onTouchMove(e) {
    if (!isDragging || !draggedCard) return;

    e.preventDefault(); // Prevent scrolling while dragging card

    const touch = e.touches[0];
    const x = touch.clientX - dragOffsetX;
    const y = touch.clientY - dragOffsetY;
    draggedCard.style.left = x + 'px';
    draggedCard.style.top = y + 'px';

    highlightDropZone(draggedCard, leftDropZone);
    highlightDropZone(draggedCard, rightDropZone);
}

function onTouchEnd(e) {
     // No preventDefault needed here usually for touchend
    if (!isDragging || !draggedCard) return;

    handleCardDrop(draggedCard); // Process the drop

    // Clean up touch drag state
    isDragging = false;
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
     if(leftDropZone) leftDropZone.classList.remove('highlight');
     if(rightDropZone) rightDropZone.classList.remove('highlight');
    // if (draggedCard) draggedCard.classList.remove('dragging');
    draggedCard = null;
}


/**
 * Processes the drop action: checks zone, updates state/UI, sends message, advances game.
 * @param {HTMLElement} cardEl The card element that was dropped.
 */
function handleCardDrop(cardEl) {
    let droppedZoneId = null; // 'left', 'right', or null
    let choiceMade = false;

    // Check which zone (if any) the card was dropped into
    if (isInside(cardEl, leftDropZone)) {
        droppedZoneId = "left";
        leftCount++;
        choiceMade = true;
    } else if (isInside(cardEl, rightDropZone)) {
        droppedZoneId = "right";
        rightCount++;
        choiceMade = true;
    }

    // Remove highlights immediately after checking drop
    if(leftDropZone) leftDropZone.classList.remove('highlight');
    if(rightDropZone) rightDropZone.classList.remove('highlight');


    if (choiceMade) { // --- SUCCESSFUL DROP ---
        console.log(`Card dropped in zone: ${droppedZoneId}`);
        updateCounters(); // Update UI counters

        // Send drop message (only if not in test session and data is available)
        if (!isTestSession && currentQuestionData && typeof sendMessage === 'function') {
            const messageData = {
                action: "logGameChoice", // Or your specific action
                event: "cardDropped",
                participant: participantId,
                cardId: currentQuestionData.cardId,
                round: currentQuestionData.round,
                questionIndex: currentQuestionData.questionIndexInSource,
                question: currentQuestionData.question,
                difficulty: currentQuestionData.difficulty,
                answer: currentQuestionData.answer, // Correct answer (bool)
                side: currentQuestionData.side,     // Correct side ('left'/'right')
                side_choice: droppedZoneId          // Participant's choice ('left'/'right')
            };
            console.log(">>> Sending cardDropped data:", JSON.stringify(messageData));
            sendMessage(messageData);
        } else if (!isTestSession) {
             console.warn("Could not send cardDropped message: Missing data, sendMessage fn, or in test session.");
        } else {
             console.log("Skipping sendMessage for cardDropped (Test Session)");
        }

        // --- Clean Up Card State ---
        removeCardDOM(cardEl); // Remove the card element from the DOM
        currentRevealedCard = null; // Clear the global reference
        currentQuestionData = null; // Clear the data for the completed card


        // --- Check Session/Round End ---
        let sessionEnded = false;
        if (isTestSession) {
            // Test session ends when all test questions are answered
            sessionEnded = (testQuestionIndex >= testQuestions.length);
        } else {
            // Regular round ends when all questions for that round are answered
            sessionEnded = (questionIndexThisRound >= questionsThisRound.length);
        }

        if (sessionEnded) {
            inputLocked = true; // Keep input locked during transition

            if (isTestSession) { // --- Test Session Finished ---
                console.log("Test Session Finished.");
                isTestSession = false; // Exit test mode
                // Immediately show the round modal to proceed to the actual game/next round
                triggerNextPhaseModal(); // Function in gameFlow.js
            } else { // --- Regular Round Finished ---
                console.log(`Round ${currentRound} finished.`);
                // Advance to the next round or game over sequence
                advanceToNextRound(); // Function in gameFlow.js
            }
        } else {
            // Session/Round continues, unlock input for the next reveal
            inputLocked = false;
            console.log("Input UNLOCKED after successful drop (session continues)");
            // Optionally, reset deck visuals slightly sooner?
            // resetDeckVisuals(); // Could make it feel snappier
        }

    } else { // --- INVALID DROP (outside zones) ---
        console.log("Card dropped outside target zones.");
        // Input remains locked (it was locked during reveal/drag).
        // The currentRevealedCard reference remains.
        // The user must try dragging and dropping the same card again.
        // Optionally, provide feedback or snap the card back slightly?
        // Example: Snap back towards center (adjust calculation as needed)
        // const viewportCenterX = window.innerWidth / 2;
        // const viewportCenterY = window.innerHeight / 2;
        // cardEl.style.transition = 'left 0.3s ease-out, top 0.3s ease-out';
        // cardEl.style.left = `${viewportCenterX - cardEl.offsetWidth / 2}px`;
        // cardEl.style.top = `${viewportCenterY - cardEl.offsetHeight / 2}px`;
        // setTimeout(() => cardEl.style.transition = '', 300); // Remove transition after move
    }
}

/**
 * Removes the card element from the DOM.
 * @param {HTMLElement} cardEl The card element to remove.
 */
function removeCardDOM(cardEl) {
    if (cardEl && cardEl.parentNode) {
        cardEl.parentNode.removeChild(cardEl);
         console.log("Card element removed from DOM.");
    }
}