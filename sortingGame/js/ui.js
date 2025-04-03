// js/ui.js
"use strict";

// --- HTML Element References (will be assigned in initUI) ---
let deckContainer, leftDropZone, rightDropZone, leftCounterEl, rightCounterEl;
let instructionsContainer, instructionsTitle, bottomInstructions, roundDisplay;
let roundModal, modalMessage, modalButton, testSessionButton;
let nameEntryModal, participantIdInput, submitNameButton, nameError;

/**
 * Gets references to all necessary DOM elements and stores them globally.
 */
function cacheDOMElements() {
    deckContainer = document.getElementById('deckContainer');
    leftDropZone = document.getElementById('leftDropZone');
    rightDropZone = document.getElementById('rightDropZone');
    leftCounterEl = document.getElementById('leftCounter');
    rightCounterEl = document.getElementById('rightCounter');
    instructionsContainer = document.getElementById('instructionsContainer');
    instructionsTitle = document.querySelector("#instructionsContainer h1");
    bottomInstructions = document.getElementById('bottomInstructions');
    roundDisplay = document.getElementById('roundDisplay');
    roundModal = document.getElementById('roundModal');
    modalMessage = document.getElementById('modalMessage'); // Ensure this ID exists in your h2
    modalButton = document.getElementById('modalButton'); // Ensure this ID exists on the main button
    testSessionButton = document.getElementById('testSessionButton'); // Ensure this ID exists
    nameEntryModal = document.getElementById('nameEntryModal');
    participantIdInput = document.getElementById('participantIdInput');
    submitNameButton = document.getElementById('submitNameButton'); // Ensure this ID exists
    nameError = document.getElementById('nameError');

    // Initial state for some elements
    if(roundDisplay) roundDisplay.style.visibility = 'hidden';
}

/**
 * Sets up and displays the round modal, including the optional test button.
 * @param {string} message The text message to display (in h2).
 * @param {string} buttonText The text for the main round button.
 * @param {function} onClickAction The function for the main round button.
 * @param {function} onTestClickAction The function for the test session button.
 */
function showRoundModal(message, buttonText, onClickAction, onTestClickAction) {
    if (!roundModal || !modalMessage || !modalButton || !testSessionButton) {
        console.error("showRoundModal: Required modal elements not found.");
        return;
    }

    modalMessage.innerText = message;

    // Configure Main Round Button (clone to remove old listeners)
    modalButton.innerText = buttonText;
    modalButton.disabled = false;
    const newMainButton = modalButton.cloneNode(true);
    modalButton.parentNode.replaceChild(newMainButton, modalButton);
    newMainButton.onclick = onClickAction;
    modalButton = newMainButton; // Update global reference

    // Configure Test Session Button (clone to remove old listeners)
    if (testQuestions.length > 0) {
        testSessionButton.style.display = 'block'; // Show the button
        testSessionButton.disabled = false;
        const newTestButton = testSessionButton.cloneNode(true);
        testSessionButton.parentNode.replaceChild(newTestButton, testSessionButton);
        newTestButton.onclick = onTestClickAction;
        testSessionButton = newTestButton; // Update global reference
    } else {
        testSessionButton.style.display = 'none'; // Hide if no test questions
    }

    roundModal.style.display = 'flex'; // Show modal
}

/**
 * Displays a generic modal overlay (like the ID entry).
 * @param {HTMLElement} modalElement The modal overlay element to show.
 * @param {string} message The text message to display (in h2).
 * @param {string} buttonText The text for the button.
 * @param {function} onClickAction The function to execute when the button is clicked.
 */
function showGenericModal(modalElement, message, buttonText, onClickAction) {
     if (!modalElement) {
        console.error("showGenericModal called without modalElement");
        return;
    }
    const messageEl = modalElement.querySelector('h2'); // Assuming h2 for message
    const buttonEl = modalElement.querySelector('button'); // Assuming one primary button

    if (!messageEl || !buttonEl) {
        console.error("Modal elements (h2/button) not found in:", modalElement);
        return;
    }

    messageEl.innerText = message;
    buttonEl.innerText = buttonText;
    buttonEl.disabled = false;

    // Clone button to remove previous listeners
    const newButton = buttonEl.cloneNode(true);
    buttonEl.parentNode.replaceChild(newButton, buttonEl);
    newButton.onclick = onClickAction;

    modalElement.style.display = 'flex'; // Show modal
}


/**
 * Hides a specified modal overlay.
 * @param {HTMLElement} modalElement The modal overlay element to hide.
 */
function hideModal(modalElement) {
    if (!modalElement) {
        console.error("hideModal called without modalElement");
        return;
    }
    modalElement.style.display = 'none';
}

/**
 * Updates the text content of the counter elements.
 */
function updateCounters() {
    if (leftCounterEl) leftCounterEl.textContent = leftCount;
    if (rightCounterEl) rightCounterEl.textContent = rightCount;
}

/**
 * Updates the round display text and visibility.
 */
function updateRoundDisplay() {
    if (!roundDisplay) return;
    if (isTestSession || currentRound === 0) {
         roundDisplay.style.visibility = 'hidden';
    } else if (currentRound > 0 && currentRound <= 3) {
         roundDisplay.innerText = `Round ${currentRound}`;
         roundDisplay.style.visibility = 'visible';
    } else { // Game over state
        roundDisplay.innerText = "Finished";
        roundDisplay.style.visibility = 'visible';
    }
}

/**
 * Updates the main instruction text.
 * @param {string} text The text to display.
 */
function updateInstructions(text) {
    if (instructionsTitle) {
        instructionsTitle.innerText = text;
    }
}


/**
 * Creates the initial visual representation of the card deck (without listeners).
 */
function setupDeckVisuals() {
    if (!deckContainer) return;
    const totalCards = 50; // Visual stack size, less impact now questions drive reveals
    const cardWidth = 150;
    const cardHeight = 225;
    const offsetIncrement = 15;

    const containerWidth = deckContainer.clientWidth;
    const containerHeight = deckContainer.clientHeight;
    const centerX = (containerWidth - cardWidth) / 2;
    const centerY = (containerHeight - cardHeight) / 2;

    deckContainer.innerHTML = ''; // Clear before creating deck

    for(let i = 0; i < totalCards; i++) {
        const cardEl = document.createElement('div');
        cardEl.classList.add('card');
        cardEl.dataset.id = `v${i + 1}`; // Visual ID

        let effectiveOffset = offsetIncrement * Math.min(i, 2);
        cardEl.style.left = `${centerX + effectiveOffset}px`;
        cardEl.style.top = `${centerY + effectiveOffset}px`;
        cardEl.style.zIndex = i;

        // Attach event listeners using the dedicated function from cardInteractions.js
        addCardEventListeners(cardEl);

        deckContainer.appendChild(cardEl);
    }
}


/**
 * Resets the visual appearance of cards in the deck (stacking).
 */
function resetDeckVisuals() {
    if (!deckContainer) return;
    const cards = deckContainer.querySelectorAll('.card');
    if (cards.length === 0) {
        // If deck is empty (e.g., after removing all visual cards), recreate it.
        setupDeckVisuals();
        return;
    };

    const cardWidth = cards[0]?.offsetWidth || 150;
    const cardHeight = cards[0]?.offsetHeight || 225;
    const offsetIncrement = 15;
    const containerWidth = deckContainer.clientWidth;
    const containerHeight = deckContainer.clientHeight;
    const centerX = (containerWidth - cardWidth) / 2;
    const centerY = (containerHeight - cardHeight) / 2;

    const cardsToReset = Array.from(cards).filter(card => card !== currentRevealedCard || card.parentNode === deckContainer);

    cardsToReset.forEach((cardEl, index) => {
        if (cardEl.parentNode !== deckContainer) {
            deckContainer.appendChild(cardEl);
        }
        cardEl.classList.remove('revealed');
        cardEl.style.position = 'absolute';
        cardEl.innerHTML = '';
        cardEl.style.transform = '';
        cardEl.style.fontSize = '';
        cardEl.style.width = `${cardWidth}px`;
        cardEl.style.height = `${cardHeight}px`;
        cardEl.style.pointerEvents = 'auto'; // Ensure clickable

        let effectiveOffset = offsetIncrement * Math.min(index, 2);
        cardEl.style.left = `${centerX + effectiveOffset}px`;
        cardEl.style.top = `${centerY + effectiveOffset}px`;
        cardEl.style.zIndex = index;
    });

     if (currentRevealedCard && currentRevealedCard.parentNode !== deckContainer) {
         currentRevealedCard.style.zIndex = 1001; // Ensure floating revealed card is on top
     }
}

/**
 * Dynamically adjusts font size of question text to fit its container.
 * @param {HTMLElement} questionEl The element containing the question text.
 */
function adjustFontSize(questionEl) {
    if (!questionEl || !questionEl.parentElement) return;

    const cardInnerHeight = questionEl.parentElement.clientHeight - 20; // Approx padding
    const cardInnerWidth = questionEl.parentElement.clientWidth - 10;  // Approx padding

    const maxFontSize = 1.8; // rem
    const minFontSize = 0.8; // rem
    const step = 0.1; // rem

    let currentSizeRem = maxFontSize;
    questionEl.style.fontSize = currentSizeRem + 'rem';
    questionEl.style.overflow = 'hidden'; // Prevent overflow during check

    // Decrease font size until it fits both vertically and horizontally
    while (
        (questionEl.scrollHeight > cardInnerHeight || questionEl.scrollWidth > cardInnerWidth) &&
        currentSizeRem > minFontSize
    ) {
        currentSizeRem -= step;
        questionEl.style.fontSize = currentSizeRem + 'rem';
    }

    // Final check if still overflowing at min size
    if ((questionEl.scrollHeight > cardInnerHeight || questionEl.scrollWidth > cardInnerWidth) && currentSizeRem <= minFontSize) {
        questionEl.style.fontSize = minFontSize + 'rem';
        // Optionally add ellipsis for overflow at minimum size
        // questionEl.style.whiteSpace = 'nowrap'; // If single line ellipsis needed
        // questionEl.style.textOverflow = 'ellipsis';
    }
    // questionEl.style.overflow = 'visible'; // Restore overflow if needed, or keep hidden
}

/**
 * Adds or removes the 'highlight' class from a drop zone based on overlap with a card.
 * @param {HTMLElement} cardEl The card element.
 * @param {HTMLElement} dropZoneEl The drop zone element.
 */
function highlightDropZone(cardEl, dropZoneEl) {
    if (!cardEl || !dropZoneEl) return;
    dropZoneEl.classList.toggle('highlight', isInside(cardEl, dropZoneEl));
}