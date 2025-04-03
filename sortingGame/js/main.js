// js/main.js
"use strict";

// --- Entry Point ---
// Waits for the DOM to be fully loaded before initializing the game.
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    // Call the main initialization function from gameFlow.js
    // This assumes gameFlow.js has been loaded and initGame is globally available.
    initGame();
});