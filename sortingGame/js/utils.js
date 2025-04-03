// js/utils.js
"use strict";

/**
 * Parses a single line of CSV text, respecting quoted fields.
 * Handles commas within quotes and escaped double quotes ("").
 * @param {string} line The CSV line string.
 * @returns {string[]} An array of column strings.
 */
function parseCsvLine(line) {
    const columns = [];
    let currentColumn = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            currentColumn += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            columns.push(currentColumn.trim());
            currentColumn = '';
        } else {
            currentColumn += char;
        }
    }
    columns.push(currentColumn.trim());
    return columns;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param {Array} array The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Decodes HTML entities in a string (e.g., &amp; becomes &).
 * @param {string} text The text to decode.
 * @returns {string} The decoded text.
 */
function decodeHTMLEntities(text) {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

/**
 * Checks for geometric overlap between two elements using their bounding rectangles.
 * @param {HTMLElement} el1 First element.
 * @param {HTMLElement} el2 Second element.
 * @returns {boolean} True if the elements overlap, false otherwise.
 */
function isInside(el1, el2) {
    if (!el1 || !el2) return false;
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();

    return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
    );
}