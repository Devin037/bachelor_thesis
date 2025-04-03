// js/config.js
"use strict";

// --- Configuration Constants ---
const QUESTIONS_PER_ROUND = 20; // Target number of questions per round
const CSV_FILENAME = 'data/quiz_question.csv'; // Path relative to game.html
const WEBSOCKET_URL = 'ws://localhost:8765'; // Your WebSocket server URL
const REVEAL_DELAY_MS = 2000; // Delay (in ms) after reveal before interaction is allowed