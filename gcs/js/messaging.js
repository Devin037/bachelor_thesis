// gcs/js/messaging.js
"use strict";

/************************************************************
 * WebSocket Communication Handler for GCS
 * Manages connections to Perception (8766) and Logging (8765) servers.
 * Handles receiving perception data, game events, and triggering condition switches.
 ************************************************************/

// --- Configuration ---
const PERCEPTION_WS_URL = 'ws://127.0.0.1:8766';
const LOGGING_WS_URL = 'ws://127.0.0.1:8765';

// --- State ---
let perceptionWs = null;
let loggingWs = null;
let loggingMessageQueue = [];

// --- Perception WebSocket (Port 8766) ---

function connectPerceptionWebSocket() {
    console.log("Attempting to connect Perception WebSocket to:", PERCEPTION_WS_URL);
    perceptionWs = new WebSocket(PERCEPTION_WS_URL);

    perceptionWs.onopen = () => {
        console.log("Perception WebSocket connected (8766).");
    };

    perceptionWs.onmessage = (message) => {
        try {
            const data = JSON.parse(message.data);
            // console.log("[Perception WS] Received:", data);

            // --- Update Shared Context ---
            // Assumes 'context' object is defined globally by gaze-controller.js
            if (data.event === 'faceDetection' && typeof context !== 'undefined') {
                context.userInFront = data.userInFront;
                context.faceX = (data.faceX !== undefined && data.faceX !== null) ? data.faceX : 0.5;
                context.faceY = (data.faceY !== undefined && data.faceY !== null) ? data.faceY : 0.5;
                context.secondFaceX = (data.secondFaceX !== undefined && data.secondFaceX !== null) ? data.secondFaceX : null;
                context.secondFaceY = (data.secondFaceY !== undefined && data.secondFaceY !== null) ? data.secondFaceY : null;
                context.headDirection = (data.headDirection !== undefined && data.headDirection !== null) ? data.headDirection : "none";
            }
            // Not handling game events here anymore

        } catch (err) {
            console.error("Error parsing Perception WebSocket message:", err, message.data);
        }
    };

    perceptionWs.onerror = (error) => {
        console.error("Perception WebSocket error:", error);
    };

    perceptionWs.onclose = (event) => {
        console.log("Perception WebSocket connection closed:", event.code, event.reason);
        perceptionWs = null;
    };
}


// --- Logging WebSocket (Port 8765) ---

function connectLoggingWebSocket() {
    console.log("Attempting to connect Logging WebSocket to:", LOGGING_WS_URL);
    loggingWs = new WebSocket(LOGGING_WS_URL);

    loggingWs.onopen = () => {
        console.log("Logging WebSocket connected (8765).");
        // Send any queued messages
        while (loggingMessageQueue.length > 0) {
            const msg = loggingMessageQueue.shift();
             if (typeof sendGCSLogMessage === 'function') { sendGCSLogMessage(msg); }
             else { /* ... error handling ... */ }
        }
    };

    loggingWs.onmessage = (message) => {
        try {
            const data = JSON.parse(message.data);
            console.log("[Logging WS] Received:", data); // Keep this general log
    
            // --- Handle cardReveal events ---
            if (data.event === 'cardReveal') {
                // Add distinct log for cardReveal processing
                console.log(`%c[Msg] cardReveal received for card ${data.cardId}`, 'color: blue; font-weight: bold;');
                if (typeof handleCardRevealed === 'function') {
                    handleCardRevealed(data);
                } else {
                    console.error("handleCardRevealed function not found when receiving cardReveal event via Logging WS!");
                }
            }
            // --- Handle cardDropped event to trigger random switch ---
            else if (data.event === 'cardDropped') {
                // Add distinct log for cardDropped processing
                console.log(`%c[Msg] cardDropped received for card ${data.cardId} (Triggering random switch)`, 'color: blue; font-weight: bold;');
                if (typeof handleQuestionCompletion === 'function') {
                    handleQuestionCompletion(); // Call the function in gaze-controller
                } else {
                    console.error("handleQuestionCompletion function not found!");
                }
            }
            // --- Other message handling ---
            else {
                if (data.status) {
                    console.log(`[Server Status via Logging WS] ${data.status} ${data.message || ''}`);
                } else {
                    console.log("[Logging WS] Received unhandled message type:", data.event || 'Unknown', data);
                }
            }
    
        } catch (err) {
            console.error("Error parsing Logging WebSocket message:", err, message.data);
        }
    }; // End onmessage

    loggingWs.onerror = (error) => {
        console.error("Logging WebSocket error:", error);
    };

    loggingWs.onclose = (event) => {
        console.log("Logging WebSocket connection closed:", event.code, event.reason);
        loggingWs = null;
    };
} // End connectLoggingWebSocket


/**
 * Sends a message object via the Logging WebSocket connection (8765).
 */
function sendGCSLogMessage(message) {
    if (loggingWs && loggingWs.readyState === WebSocket.OPEN) {
        try {
           loggingWs.send(JSON.stringify(message));
           console.log("[Logging WS] Sent: ", message);
        } catch (e) {
           console.error("Error sending Logging WS message:", e, message);
           loggingMessageQueue.push(message);
        }
    } else {
        console.warn("[Logging WS] Connection not open. Queuing message:", message);
        loggingMessageQueue.push(message);
         if (!loggingWs) { console.error("Logging WebSocket not initiated."); }
    }
}

// --- Initialization ---
window.sendGCSLogMessage = sendGCSLogMessage;
connectPerceptionWebSocket();
connectLoggingWebSocket();