// js/messaging.js
"use strict";

// This script should run early to establish the connection and define sendMessage globally.

let messagingSocket = null;
let messageQueue = []; // Queue for messages sent before connection is open.

function connectWebSocket() {
    console.log("Attempting to connect WebSocket to:", WEBSOCKET_URL);
    messagingSocket = new WebSocket(WEBSOCKET_URL);

    messagingSocket.onopen = () => {
        console.log("Messaging WebSocket connected");
        // Send any queued messages.
        while (messageQueue.length > 0) {
            const msg = messageQueue.shift();
            if (messagingSocket.readyState === WebSocket.OPEN) {
                 messagingSocket.send(JSON.stringify(msg));
                 console.log("[WS] Sent (queued): ", msg);
            } else {
                 console.warn("[WS] Connection closed while sending queued message:", msg);
                 // Optionally re-queue or handle error
                 messageQueue.unshift(msg); // Put it back at the front
                 break; // Stop processing queue if connection closed
            }
        }
    };

    messagingSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("[WS] Received: ", data);

            // Handle incoming messages if needed by the game logic
            // Example: if (data.event === "someEventFromGCS") { handleGCSUpdate(data); }

        } catch (e) {
            console.error("Error parsing WebSocket message:", e, event.data);
        }
    };

    messagingSocket.onerror = (error) => {
        console.error("Messaging WebSocket error:", error);
        // Optionally attempt to reconnect after a delay
    };

    messagingSocket.onclose = (event) => {
        console.log("Messaging WebSocket closed:", event.code, event.reason);
        messagingSocket = null; // Ensure socket reference is cleared
        // Optionally attempt to reconnect
        // setTimeout(connectWebSocket, 5000); // Example: try reconnecting after 5 seconds
    };
}


/**
 * Sends a message object via the WebSocket connection.
 * Queues the message if the connection is not yet open.
 * @param {object} message The message object to send.
 */
function sendMessage(message) {
    if (messagingSocket && messagingSocket.readyState === WebSocket.OPEN) {
        messagingSocket.send(JSON.stringify(message));
         console.log("[WS] Sent: ", message);
    } else {
        console.warn("Messaging WebSocket not open. Queuing message:", message);
        messageQueue.push(message);
         // Attempt to connect if not already connecting/connected
         if (!messagingSocket) {
             // connectWebSocket(); // Be careful with auto-reconnect logic here
              console.error("WebSocket connection not established. Message queued.");
         }
    }
}

// Expose sendMessage globally (important for non-module setup)
window.sendMessage = sendMessage;

// Initialize connection when the script loads
// Use a condition to prevent multiple connections if script is loaded oddly
// Although DOMContentLoaded in main.js is safer for triggering initial actions.
// Let's initiate connection attempt early.
connectWebSocket();