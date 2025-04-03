// js/csvLoader.js
"use strict";

/**
 * Fetches and initiates parsing of the quiz questions CSV file.
 * @param {function} callback Function to execute after successful loading and parsing.
 */
function loadCSVQuestions(callback) {
    console.log(`Workspaceing CSV from: ${CSV_FILENAME}`);
    fetch(CSV_FILENAME)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, Failed to fetch ${response.url}`);
            }
            return response.text();
        })
        .then(csvText => {
            parseCSV(csvText); // Parse the text content using the function below
            console.log("CSV Parsed. Questions by round:", questionsByRound);
            console.log("CSV Parsed. Test questions:", testQuestions);
            if (callback && typeof callback === 'function') {
                 callback(); // Execute the callback function (proceed to game setup)
            }
        })
        .catch(err => {
            console.error('Error loading or parsing CSV file:', err);
            // Use the UI function to show an error message
            showGenericModal(roundModal, `Error loading questions: ${err.message}. Check file path ('${CSV_FILENAME}') and format.`, "Refresh", () => window.location.reload());
        });
}

/**
 * Parses CSV text data into the questionsByRound object and testQuestions array.
 * Assumes specific headers: 'question', 'correct_answer', 'round', and optionally 'difficulty'.
 * Rows with 'test' (case-insensitive) in the 'round' column go to testQuestions.
 * Uses the parseCsvLine utility function.
 * @param {string} text The raw CSV text content.
 */
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim()); // Split and remove empty lines

    if (lines.length < 2) {
        console.error("CSV Error: Requires a header row and at least one data row.");
        questionsByRound = { 1: [], 2: [], 3: [] }; // Reset state
        testQuestions = [];
        return; // Stop processing
    }

    // Use parseCsvLine for robust header parsing (handles quotes in headers, though unlikely)
    const headers = parseCsvLine(lines[0]).map(col => col.trim().toLowerCase());
    const questionIndex = headers.indexOf('question');
    const answerIndex = headers.indexOf('correct_answer');
    const roundIndex = headers.indexOf('round');
    const difficultyIndex = headers.indexOf('difficulty'); // Optional

    // Validate required headers
    const requiredHeaders = ['question', 'correct_answer', 'round'];
    const missingHeaders = requiredHeaders.filter(h => headers.indexOf(h) === -1);
    if (missingHeaders.length > 0) {
        console.error(`CSV Header Error: Missing required headers: ${missingHeaders.join(', ')}. Found: ${headers.join(',')}`);
        // Consider throwing an error or stopping the game load
        return; // Stop processing if critical headers are missing
    }

    // Reset question stores before parsing
    questionsByRound = { 1: [], 2: [], 3: [] };
    testQuestions = [];

    // Process data rows (starting from the second line)
    lines.slice(1).forEach((line, idx) => {
         if (!line.trim()) return; // Skip empty lines just in case

         const cols = parseCsvLine(line); // Use the utility function here

         // Basic check for column count consistency
         if (cols.length === headers.length) {
             // Extract data using header indices (safe checks included)
             const roundValue = (roundIndex >= 0 && roundIndex < cols.length) ? cols[roundIndex].trim().toLowerCase() : '';
             const questionText = (questionIndex >= 0 && questionIndex < cols.length) ? decodeHTMLEntities(cols[questionIndex]) : 'Error: Missing Question';
             const answerText = (answerIndex >= 0 && answerIndex < cols.length) ? decodeHTMLEntities(cols[answerIndex]) : 'Error: Missing Answer';
             const difficultyValue = (difficultyIndex !== -1 && difficultyIndex < cols.length) ? decodeHTMLEntities(cols[difficultyIndex]) : 'N/A';

            const questionData = {
                question: questionText,
                correct_answer: answerText, // Store the raw answer text for now
                difficulty: difficultyValue
            };

            // Categorize question based on round value
            if (roundValue === 'test') {
                testQuestions.push(questionData);
            } else {
                const roundNum = parseInt(roundValue, 10);
                if (!isNaN(roundNum) && questionsByRound.hasOwnProperty(roundNum)) {
                    questionsByRound[roundNum].push(questionData);
                } else {
                     console.warn(`Skipping row ${idx + 2}: Invalid or unrecognised round number ('${cols[roundIndex]}') in line: ${line}`);
                }
            }
        } else {
             console.warn(`Skipping malformed CSV row ${idx + 2} (Expected ${headers.length} columns, found ${cols.length}): ${line}`);
         }
    });

     // Log final counts
     console.log(`Loaded ${testQuestions.length} test questions.`);
     console.log("Loaded questions per round:",
        `1: ${questionsByRound[1].length}`,
        `2: ${questionsByRound[2].length}`,
        `3: ${questionsByRound[3].length}`
     );

     // Add warnings if rounds have too few questions?
     if (questionsByRound[1].length < QUESTIONS_PER_ROUND || questionsByRound[2].length < QUESTIONS_PER_ROUND || questionsByRound[3].length < QUESTIONS_PER_ROUND) {
         console.warn(`One or more rounds have fewer than the target ${QUESTIONS_PER_ROUND} questions.`);
     }
     if (testQuestions.length === 0) {
         console.warn("No 'test' questions found in the CSV. Practice session button will be hidden.");
     }
}