// gcs/js/gaze-controller.js
"use strict";

/************************************************************
 * Gaze Controller
 * - Manages gaze state and behavior selection.
 * - Runs the main update loop.
 * - Handles game events affecting gaze.
 * - Implements random condition switching on question completion.
 * Requires gaze-mechanics.js and gaze-behaviors.js loaded first.
 * Requires messaging.js for context updates and logging.
 * Relies on ui-handler.js for toggle state information (by reading element state).
 ************************************************************/

// --- Core State ---
const context = {
    userInFront: false,
    faceX: 0.5,
    faceY: 0.5,
    secondFaceX: null,
    secondFaceY: null,
    headDirection: "none" // Updated by messaging.js
};
// Expose context globally if needed (use window.gazeContext instead of just context elsewhere if necessary)
window.gazeContext = context;

// --- Behavior Control State ---
let currentBehavior = null; // Instance of an active high-level behavior
let lastHandledCardId = null; // Prevent double handling cardReveal
let lastRespondingJointAttentionTime = 0;
const respondingCooldown = 7000; // ms

// --- Make condition state explicitly global ---
window.initialCondition = null; // Stores 'ryan', 'ivan', or 'carl' (set by ui-handler.js)
window.secondCondition = null;  // No longer used by random logic, but keep if needed elsewhere
window.conditionSequence = [];  // Optional: array to track full sequence (set by ui-handler.js)
// =====================================================


// --- Main Update Loop ---
let gazeLoopInterval = null;

function startGazeLoop() {
    if (gazeLoopInterval) {
        console.warn("gaze-controller: Gaze loop already running.");
        return;
    }
    console.log("gaze-controller: Starting gaze loop.");
    // Ensure DOM elements needed by mechanics/status are likely ready
    setTimeout(() => {
        gazeLoopInterval = setInterval(() => {
            try {
                updateGaze();
            } catch (error) {
                console.error("Error in gaze loop:", error);
            }
        }, 50); // ~20 FPS update rate
    }, 100); // Small delay after DOM ready
}

// --- Behavior Selection & Update ---
function updateGaze() {
    const now = Date.now();

    // --- Get UI State (Toggles) ---
    const ryanToggle = document.getElementById('ryanConditionToggle');
    const ivanToggle = document.getElementById('ivanConditionToggle');
    const carlToggle = document.getElementById('carlConditionToggle');
    const jointAttentionToggle = document.getElementById('jointAttentionToggle');
    const respondingJointAttentionToggle = document.getElementById('respondingJointAttentionToggle');

    const isRyanActive = ryanToggle && ryanToggle.checked;
    const isIvanActive = ivanToggle && ivanToggle.checked;
    const isCarlActive = carlToggle && carlToggle.checked;
    const isRespondingJAEnabled = respondingJointAttentionToggle && respondingJointAttentionToggle.checked;

    // --- Handle Completion of Active Behavior ---
    if (currentBehavior) {
        // Add detailed log for JA behaviors
        if(currentBehavior instanceof InitiatingJointAttention) {
            console.log(`[Ctrl] updateGaze: Applying IJA - Phase: ${currentBehavior.phase}`); // Added Log
        } else if (currentBehavior instanceof RespondingJointAttention) {
             console.log(`[Ctrl] updateGaze: Applying RJA - Phase: ${currentBehavior.phase}`); // Added Log
        } // Can add logs for other behaviors if needed

        const behaviorIsStillActive = currentBehavior.apply(); // Run the behavior's logic
        if (behaviorIsStillActive) {
            updateGazeStatus(); // Update UI text
            return; // Keep running current behavior
        } else {
            // Behavior just finished
            console.log(`gaze-controller: Behavior ${currentBehavior.name} finished.`);
            currentBehavior = null; // Ready for a new behavior
        }
    }

    // --- Select New Behavior if Idle ---
    if (!currentBehavior) {
        if (context.userInFront) {
            // Priority: Responding JA (if enabled, not on cooldown, head turned, and Carl not active)
            if (!isCarlActive && isRespondingJAEnabled &&
                (context.headDirection === "Looking Left" || context.headDirection === "Looking Right") &&
                (now - lastRespondingJointAttentionTime >= respondingCooldown))
            {
                const dir = context.headDirection.split(" ")[1].toLowerCase();
                console.log("gaze-controller: Triggering Responding JA towards:", dir);
                currentBehavior = new RespondingJointAttention(dir);
                lastRespondingJointAttentionTime = now; // Reset cooldown
            }
            // Else: Dynamic Gaze (if multiple faces)
            else if (context.secondFaceX !== null && context.secondFaceY !== null) {
                 console.log("gaze-controller: Starting/Continuing Dynamic Gaze");
                 currentBehavior = new dynamicGaze();
            }
            // Else: Mutual Gaze (if single face)
            else {
                 console.log("gaze-controller: Starting/Continuing Mutual Gaze");
                 currentBehavior = new MutualGaze(); // MutualGaze handles aversion internally
            }
        } else {
            // No user in front: Idle (look center)
            setPupilTransform(0.5, 0.5, 1.0); // Look forward explicitly
        }
    }

    // Apply the newly selected behavior (if any) for the first time
    if (currentBehavior) {
        currentBehavior.apply();
    }

    updateGazeStatus(); // Update UI text
}


// --- Handle Game Events ---
// This function is intended to be called by messaging.js when a cardReveal event is received.
function handleCardRevealed(data) {
    // Log Entry
    console.log(`%c[Ctrl] handleCardRevealed called for card ${data?.cardId}`, 'color: green; font-weight: bold;');

    // Validate data needed
    if (!data || !data.cardId || !data.side) {
         console.error("gaze-controller: Invalid cardReveal data received.", data);
         return;
    }

    // Prevent double handling
    if (lastHandledCardId === data.cardId) {
        console.log("gaze-controller: Card ID", data.cardId, "already handled. Ignoring.");
        return;
    }
    lastHandledCardId = data.cardId;

    // --- Get UI State (Toggles) ---
    const ryanToggle = document.getElementById('ryanConditionToggle');
    const ivanToggle = document.getElementById('ivanConditionToggle');
    const carlToggle = document.getElementById('carlConditionToggle');
    const jointAttentionToggle = document.getElementById('jointAttentionToggle');
    const knowledge80Toggle = document.getElementById('knowledge80Toggle');
    const knowledge20Toggle = document.getElementById('knowledge20Toggle');

    const isCarlActive = carlToggle && carlToggle.checked;
    const isInitiatingJAEnabled = jointAttentionToggle && jointAttentionToggle.checked;
    const isKnowledge80Active = knowledge80Toggle && knowledge80Toggle.checked;
    const isKnowledge20Active = knowledge20Toggle && knowledge20Toggle.checked;
    const isRyanActive = ryanToggle && ryanToggle.checked;
    const isIvanActive = ivanToggle && ivanToggle.checked;

    // Log the conditions checked
    console.log(`[Ctrl] CHECKING IJA Trigger: Carl Active=${isCarlActive}, IJA Toggle Enabled=${isInitiatingJAEnabled}`); // Added Log

    // --- Determine Robot Action based on Conditions/Toggles ---
    let direction = data.side;
    let knowledgeFactor = 1.0;
    let gazeTriggered = false;
    let robotCondition = "default";

    if (isRyanActive) robotCondition = "Ryan condition";
    else if (isIvanActive) robotCondition = "Ivan condition";

    if (!isCarlActive && isInitiatingJAEnabled) {
        gazeTriggered = true;
        if (isKnowledge80Active) knowledgeFactor = 0.8;
        else if (isKnowledge20Active) knowledgeFactor = 0.2;
        if (knowledgeFactor < 1.0 && Math.random() > knowledgeFactor) {
            direction = (direction === "left") ? "right" : "left";
            console.log(`[Ctrl] Knowledge applied: Robot looks ${direction} (INCORRECT)`);
        } else {
            console.log(`[Ctrl] Knowledge applied: Robot looks ${direction} (CORRECT)`);
        }
    } else {
         if (isCarlActive) console.log("[Ctrl] Automatic gaze NOT triggered (Carl Condition active).");
         else if (!isInitiatingJAEnabled) console.log("[Ctrl] Automatic gaze NOT triggered (Initiating JA toggle off).");
         else console.log("[Ctrl] Automatic gaze NOT triggered (Unknown reason - check toggles).");
    }
    // Log decision outcome
    console.log(`[Ctrl] gazeTriggered = ${gazeTriggered}, final direction = ${direction}`); // Added Log

    // --- Schedule Gaze Action and Logging ---
    const gazeDecisionForLog = gazeTriggered ? direction : "none";
    const reasonForNoGaze = isCarlActive ? "Carl condition active" : (!isInitiatingJAEnabled ? "Initiating JA toggle off" : "");

    if(gazeTriggered) {
        // Log scheduling
        console.log(`%c[Ctrl] Scheduling IJA towards ${direction} in 2s`, 'color: green; font-weight: bold;');
        setTimeout(() => {
             // Log callback execution
             console.log(`%c[Ctrl] setTimeout CALLBACK executing for IJA -> ${direction}`, 'color: purple; font-weight: bold;');
             if (currentBehavior instanceof InitiatingJointAttention || currentBehavior instanceof RespondingJointAttention) {
                 console.log("[Ctrl] setTimeout: Another JA already running, skipping.");
                 return;
             }
             try {
                 // Log attempt to set behavior
                 console.log(`[Ctrl] setTimeout: Setting currentBehavior = new InitiatingJointAttention(${direction})`);
                 currentBehavior = new InitiatingJointAttention(direction); // Start the behavior
                 // Log success
                 console.log("[Ctrl] setTimeout: currentBehavior set to:", currentBehavior);
             } catch (error) {
                 // Log error if behavior creation fails
                 console.error("[Ctrl] setTimeout: Error creating InitiatingJointAttention:", error);
             }
        }, 2000); // 2-second delay
    }

    // --- Send RobotsMove Log ---
    const robotMoveMessage = {
        action: "logEvent",
        event: "RobotsMove",
        cardId: data.cardId,
        gazeDecision: gazeDecisionForLog,
        Robot: isCarlActive ? "Carl condition" : robotCondition,
        reason: gazeTriggered ? "" : reasonForNoGaze,
        timestamp: Date.now()
    };
    console.log("[Ctrl] Sending RobotsMove log:", robotMoveMessage);
    if (typeof sendGCSLogMessage === 'function') {
        sendGCSLogMessage(robotMoveMessage);
    } else {
        console.error("gaze-controller: sendGCSLogMessage function not found!");
    }
}


// ==========================================================
// == Handle Question Completion for Random Switching ==
// ==========================================================
// Replace this function in gcs/js/gaze-controller.js

// ==========================================================
// == Handle Question Completion for Random Switching (NON-REPEATING) ==
// ==========================================================
function handleQuestionCompletion() {
    console.log(`%c[Ctrl] handleQuestionCompletion called`, 'color: green; font-weight: bold;'); // Log entry
    const conditions = ['ryan', 'ivan', 'carl'];

    // 1. Determine the currently active condition by checking toggles
    let currentCondition = null;
    // Use optional chaining (?) in case elements aren't found immediately (though they should be)
    if (document.getElementById('ryanConditionToggle')?.checked) currentCondition = 'ryan';
    else if (document.getElementById('ivanConditionToggle')?.checked) currentCondition = 'ivan';
    else if (document.getElementById('carlConditionToggle')?.checked) currentCondition = 'carl';
    console.log(`[Ctrl] Current condition before switch: ${currentCondition}`);

    // 2. Create a list of possible next conditions (excluding the current one)
    const possibleConditions = conditions.filter(c => c !== currentCondition);

    let nextCondition = null;
    if (possibleConditions.length > 0) {
        // 3. Randomly select from the possible (different) conditions
        const randomIndex = Math.floor(Math.random() * possibleConditions.length);
        nextCondition = possibleConditions[randomIndex];
         console.log(`[Ctrl] Possible next conditions: [${possibleConditions.join(', ')}]. Randomly selected: ${nextCondition}`);
    } else {
        // Fallback (e.g., if currentCondition was somehow null or only one option exists)
        console.warn("[Ctrl] Couldn't determine possible different conditions. Defaulting to full random selection.");
        const fallbackIndex = Math.floor(Math.random() * conditions.length);
        nextCondition = conditions[fallbackIndex];
    }

    // 4. Activate the chosen condition
    activateCondition(nextCondition); // Calls the existing helper function
}
// ==========================================================


// Helper function to activate a specific condition toggle
function activateCondition(conditionName) {
    // Log entry
    console.log(`%c[Ctrl] activateCondition called for "${conditionName}"`, 'color: green; font-weight: bold;');
    let targetToggle = null;
    if (conditionName === 'ryan') targetToggle = document.getElementById('ryanConditionToggle');
    else if (conditionName === 'ivan') targetToggle = document.getElementById('ivanConditionToggle');
    else if (conditionName === 'carl') targetToggle = document.getElementById('carlConditionToggle');

    // Log if element found
    console.log(`[Ctrl] Target toggle element for ${conditionName}:`, targetToggle);

    if (targetToggle) {
         // Log activation attempt
         console.log(`[Ctrl] Activating ${conditionName} toggle programmatically. Current checked: ${targetToggle.checked}`);
         targetToggle.checked = true;
         targetToggle.dispatchEvent(new Event('change', { bubbles: true }));
         // Log dispatch
         console.log(`[Ctrl] Dispatched 'change' event for ${conditionName} toggle.`);
    } else {
        console.error(`gaze-controller: Could not find toggle for condition "${conditionName}"! Check element IDs.`);
    }
}
// ==========================================================


// --- UI Status Update ---
function updateGazeStatus() {
    const statusElement = document.getElementById('gazeStatus');
    if (!statusElement) return; // Element not ready yet

    // Get toggle states safely using NEW IDs
    const isRyanActive = document.getElementById('ryanConditionToggle')?.checked;
    const isIvanActive = document.getElementById('ivanConditionToggle')?.checked;
    const isCarlActive = document.getElementById('carlConditionToggle')?.checked;
    const isInitiatingJAActive = document.getElementById('jointAttentionToggle')?.checked;
    const isRespondingJAActive = document.getElementById('respondingJointAttentionToggle')?.checked;
    const isKnowledge80Active = document.getElementById('knowledge80Toggle')?.checked;
    const isKnowledge20Active = document.getElementById('knowledge20Toggle')?.checked;

    // Construct status text using NEW condition names
    let statusText = "Cond: ";
    if (isRyanActive) statusText += "Ryan | "; // Updated Name
    else if (isIvanActive) statusText += "Ivan | "; // Updated Name
    else if (isCarlActive) statusText += "Carl | ";
    else statusText += "None | ";

    statusText += "Behav: ";
    if (currentBehavior) {
      statusText += `${currentBehavior.name} `;
      if (currentBehavior instanceof MutualGaze && currentBehavior.gazeAversion?.aversionFixation) {
         statusText += "(Averting) ";
      } else if (currentBehavior.phase) { // For JA behaviors
         statusText += `(${currentBehavior.phase}) `;
      }
    } else {
      statusText += context.userInFront ? "Idle (User)" : "Idle ";
    }

    statusText += "| IJA:" + (isInitiatingJAActive ? 'ON' : 'OFF');
    statusText += " RJA:" + (isRespondingJAActive ? 'ON' : 'OFF');

    if (isKnowledge80Active) statusText += " K:80%";
    else if (isKnowledge20Active) statusText += " K:20%";
    else statusText += " K:---";

    statusText += " | User:" + (context.userInFront ? 'Y' : 'N');
    statusText += " Faces:" + (context.secondFaceX !== null ? '2' : (context.userInFront ? '1' : '0'));
    statusText += " Head:" + context.headDirection;

    statusElement.innerText = statusText;
}

// --- Keyboard Input Listener ---
// (Remains the same)
document.addEventListener('keydown', (e) => {
    const jointAttentionToggle = document.getElementById('jointAttentionToggle');
    const carlToggle = document.getElementById('carlConditionToggle');

    if (!jointAttentionToggle || !jointAttentionToggle.checked || (carlToggle && carlToggle.checked)) {
        return;
    }
    if (currentBehavior instanceof InitiatingJointAttention || currentBehavior instanceof RespondingJointAttention) {
        console.log("gaze-controller: Ignoring keydown, JA already in progress.");
        return;
    }
    let direction = null;
    if (e.key === 'ArrowLeft') direction = "left";
    else if (e.key === 'ArrowRight') direction = "right";

    if (direction) {
        console.log(`gaze-controller: Keydown ${e.key} - Triggering Initiating JA ${direction}`);
        currentBehavior = new InitiatingJointAttention(direction);
        // Optional: Send log via sendGCSLogMessage(...)
    }
});


// --- Global Exports ---
// Expose globally the function that messaging.js needs to call
window.handleCardRevealed = handleCardRevealed;
window.startGazeLoop = startGazeLoop;
// === NEW: Expose the question completion handler ===
window.handleQuestionCompletion = handleQuestionCompletion;
// ==================================================

console.log("gaze-controller.js loaded");