// js/gaze-mechanics.js
"use strict";

/************************************************************
 * Lower-Level Gaze Mechanics & Pupil Control
 ************************************************************/

// --- Mechanics Classes ---

class Fixation {
  constructor(targetX, targetY, duration) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.duration = duration;
    this.startTime = Date.now();
    this.name = "Fixation";
    // Store current position for potential use by other behaviors after completion
    this.currentX = targetX;
    this.currentY = targetY;
  }
  apply() {
    const elapsed = Date.now() - this.startTime;
    if (elapsed < this.duration) {
      setPupilTransform(this.targetX, this.targetY, 1.0);
      // Update current position during fixation
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      return true; // Still active
    }
    return false; // Duration ended
  }
}

class Saccade {
  constructor(startX, startY, endX, endY, speed) {
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.speed = Math.max(0.01, speed); // Ensure speed is positive
    this.progress = 0;
    this.name = "Saccade";
    // Store current position for potential use by other behaviors
    this.currentX = startX;
    this.currentY = startY;
  }
  apply() {
    if (this.progress < 1) {
      this.progress += this.speed;
      this.progress = Math.min(1, this.progress); // Cap progress at 1

      this.currentX = this.startX + (this.endX - this.startX) * this.progress;
      this.currentY = this.startY + (this.endY - this.startY) * this.progress;
      setPupilTransform(this.currentX, this.currentY, 1.0);
      return true; // Still active
    }
    // Ensure final position is set exactly
    this.currentX = this.endX;
    this.currentY = this.endY;
    setPupilTransform(this.currentX, this.currentY, 1.0);
    return false; // Saccade finished
  }
}

class SmoothPursuit {
  constructor(targetX, targetY, smoothness) {
    // Note: SmoothPursuit often needs the *current* position from the previous state.
    // It might be better managed within the gaze controller that knows the current pos.
    // Keeping it simple here assumes it starts from where the eyes currently are.
    this.targetX = targetX;
    this.targetY = targetY;
    this.smoothness = smoothness;
    // Initialize based on CURRENT pupil position if possible, otherwise default to center.
    // This requires gaze-controller to pass the current position or read it somehow.
    // For now, we'll assume it's managed externally or starts near center.
    this.currentX = window.currentGazeX || 0.5; // Relying on a hypothetical global for simplicity here
    this.currentY = window.currentGazeY || 0.5;
    this.name = "SmoothPursuit";
  }
  updateTarget(newTargetX, newTargetY) {
      // Allow external updates of the target smoothly
      this.targetX = newTargetX;
      this.targetY = newTargetY;
  }
  apply() {
    // Update current position based on external state if needed (e.g., face tracking)
    // This depends on how the context/target updates are handled.
    // For now, assume targetX/Y are updated externally via updateTarget.

    this.currentX += (this.targetX - this.currentX) * this.smoothness;
    this.currentY += (this.targetY - this.currentY) * this.smoothness;
    setPupilTransform(this.currentX, this.currentY, 1.0);
    // Smooth pursuit usually runs continuously until switched
    return true; // Always active until changed
  }
}

class Microsaccades {
  constructor(amplitude, frequency) {
    this.amplitude = amplitude;
    this.frequency = frequency; // Target frequency in Hz
    this.interval = 1000 / frequency; // Milliseconds between potential microsaccades
    this.lastUpdateTime = Date.now();
    this.name = "Microsaccades";
    // Store current position (updated externally)
    this.currentX = 0.5;
    this.currentY = 0.5;
  }
  // Call this frequently (e.g., from the main loop)
  update(baseX, baseY) {
      this.currentX = baseX;
      this.currentY = baseY;
      const now = Date.now();
      if (now - this.lastUpdateTime > this.interval) {
          const offsetX = (Math.random() - 0.5) * this.amplitude;
          const offsetY = (Math.random() - 0.5) * this.amplitude;
          setPupilTransform(this.currentX + offsetX, this.currentY + offsetY, 1.0);
          this.lastUpdateTime = now;
          // Return true indicating a microsaccade happened
          return true;
      }
      // No microsaccade this frame, apply base position
      setPupilTransform(this.currentX, this.currentY, 1.0);
      return false;
  }
   // Simple apply for compatibility if needed, less accurate timing
   apply(currentX, currentY) {
      return this.update(currentX, currentY);
   }
}


// --- Pupil Utility ---
const leftPupil = document.getElementById('leftPupil');
const rightPupil = document.getElementById('rightPupil');

// Store last known position to avoid redundant DOM access/warnings if elements aren't ready
let lastSetX = 0.5;
let lastSetY = 0.5;
let pupilsFound = false;

function findPupils() {
    // Try to find pupils if not found yet
    if (!pupilsFound) {
        const lp = document.getElementById('leftPupil');
        const rp = document.getElementById('rightPupil');
        if (lp && rp) {
            // Assign to global scope if needed by other modules directly,
            // but preferably keep controlled within this module.
            // For simplicity, assume they are found once.
            pupilsFound = true;
            console.log("Pupil elements found.");
            return true;
        }
        return false;
    }
    return true;
}


function setPupilTransform(targetX, targetY, scaleFactor) {
  // Attempt to find pupils if not already found (e.g., on first call)
  if (!pupilsFound && !findPupils()) {
      // console.warn("Pupil elements not yet found for transform.");
      return; // Exit if pupils still not available
  }

  // Clamp targetX and targetY to prevent pupils from going too far out
  // Increased range slightly based on observation
  const clampedX = Math.max(0.05, Math.min(0.95, targetX));
  const clampedY = Math.max(0.2, Math.min(0.8, targetY));

  // Map clamped values to pixel offsets
  // These multipliers need tuning based on eye size in CSS
  const maxHorizontalOffset = 45; // Max pixels left/right from center
  const maxVerticalOffset = 25;   // Max pixels up/down from center

  // Map [0.05, 0.95] -> [-maxHorizontalOffset, +maxHorizontalOffset]
  const offsetX = ((clampedX - 0.05) / (0.95 - 0.05)) * (2 * maxHorizontalOffset) - maxHorizontalOffset;
  // Map [0.2, 0.8] -> [-maxVerticalOffset, +maxVerticalOffset]
  const offsetY = ((clampedY - 0.2) / (0.8 - 0.2)) * (2 * maxVerticalOffset) - maxVerticalOffset;

  // Update global state for other components if needed (use with caution)
  window.currentGazeX = clampedX;
  window.currentGazeY = clampedY;

  // Apply transform only if position changed significantly (optional optimization)
  // const threshold = 0.001;
  // if (Math.abs(clampedX - lastSetX) > threshold || Math.abs(clampedY - lastSetY) > threshold) {
      const transformString = `translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px) scale(${scaleFactor})`;
      // Re-fetch elements here OR ensure they are globally accessible if needed outside this file
      const lp = document.getElementById('leftPupil');
      const rp = document.getElementById('rightPupil');
      if(lp && rp) {
          lp.style.transform = transformString;
          rp.style.transform = transformString;
          lastSetX = clampedX;
          lastSetY = clampedY;
      }
  // }
}

// Ensure pupils are looked for once DOM is ready
document.addEventListener('DOMContentLoaded', findPupils);