// js/state.js
"use strict";

// --- Global Game State Variables ---
// (Accessible globally because they are declared outside functions in the global scope)

let questionsByRound = { 1: [], 2: [], 3: [] }; // Stores questions grouped by round from CSV
let testQuestions = []; // Stores questions for the practice session
let currentRound = 0; // Current active round (0=initial, 1, 2, or 3)
let questionsThisRound = []; // Holds the shuffled questions for the current round/test
let questionIndexThisRound = 0; // Index for the current question within the round's array
let testQuestionIndex = 0; // Index for the current question within the test session
let currentQuestionData = null; // Stores data of the currently revealed card/question
let participantId = ''; // Stores the Participant ID entered at the start
let leftCount = 0; // Counter for cards dropped on the left
let rightCount = 0; // Counter for cards dropped on the right
let currentRevealedCard = null; // The DOM element of the card currently revealed
let inputLocked = false; // Flag to prevent interactions during certain phases (reveal delay, transitions)
let isTestSession = false; // Flag to indicate if we are in a test session
let isDragging = false; // Flag for drag/drop state
let dragOffsetX = 0; // X offset during drag
let dragOffsetY = 0; // Y offset during drag
let draggedCard = null; // Reference to the card being dragged