// js/gaze-behaviors.js
"use strict";

/************************************************************
 * High-Level Gaze Behavior Classes
 * Requires gaze-mechanics.js to be loaded first for setPupilTransform
 * Relies on global 'context' object from gaze-controller.js
 * Relies on global 'currentBehavior' from gaze-controller.js (for initial pos)
 ************************************************************/

// GazeAversion: looks away briefly.
class GazeAversion {
  constructor(aversionDuration = 300, intervalMin = 1000, intervalMax = 3000) {
    this.aversionDuration = aversionDuration;
    this.intervalMin = intervalMin;
    this.intervalMax = intervalMax;
    this.scheduleNextAversion();
    this.aversionFixation = null;
    this.name = "GazeAversion";
    // Store position for other behaviors
    this.currentX = 0.5;
    this.currentY = 0.5;
  }

  scheduleNextAversion() {
    const interval = this.intervalMin + Math.random() * (this.intervalMax - this.intervalMin);
    this.nextAversionTime = Date.now() + interval;
  }

  // Needs to be called periodically by the main behavior (e.g., MutualGaze)
  // Returns true if aversion is currently active, false otherwise.
  update() {
    const now = Date.now();

    // If aversion is currently happening
    if (this.aversionFixation) {
      if (this.aversionFixation.apply()) {
        this.currentX = this.aversionFixation.currentX;
        this.currentY = this.aversionFixation.currentY;
        return true; // Aversion still active
      } else {
        // Aversion finished
        this.aversionFixation = null;
        this.scheduleNextAversion();
        return false; // Aversion just ended
      }
    }

    // Check if it's time to start a new aversion
    if (now >= this.nextAversionTime) {
      const randomOffsetX = (Math.random() - 0.5) * 0.8; // Wider aversion range
      const randomOffsetY = (Math.random() - 0.5) * 0.6;
      // Ensure aversion target is sufficiently different from center
      const aversionTargetX = 0.5 + (randomOffsetX > 0 ? Math.max(0.2, randomOffsetX) : Math.min(-0.2, randomOffsetX));
      const aversionTargetY = 0.5 + randomOffsetY;

      this.aversionFixation = new Fixation(aversionTargetX, aversionTargetY, this.aversionDuration);
      // Start applying immediately
      if (this.aversionFixation.apply()) {
         this.currentX = this.aversionFixation.currentX;
         this.currentY = this.aversionFixation.currentY;
         return true; // Aversion started and is active
      } else {
         // Should not happen if duration > 0
         this.aversionFixation = null;
         this.scheduleNextAversion();
         return false;
      }
    }

    // No aversion active or starting this frame
    return false;
  }

  // Simple apply for compatibility if needed, less accurate
  apply() {
      return this.update();
  }
}


// MutualGaze: looks at the detected face, incorporates aversion.
class MutualGaze {
  constructor(smoothness = 0.1) { // Added smoothness parameter
    this.name = "MutualGaze";
    // Use SmoothPursuit for smoother tracking instead of Fixation/Microsaccades
    this.pursuit = new SmoothPursuit(0.5, 0.5, smoothness);
    this.gazeAversion = new GazeAversion();
    // Store current position
    this.currentX = 0.5;
    this.currentY = 0.5;
  }

  apply() {
    // Check and apply aversion first
    const aversionActive = this.gazeAversion.update();
    if (aversionActive) {
        // If aversion is active, its apply method already called setPupilTransform
        this.currentX = this.gazeAversion.currentX;
        this.currentY = this.gazeAversion.currentY;
        return true; // Behavior is active (during aversion)
    }

    // If no aversion, perform smooth pursuit towards the face
    // Assumes 'context' is a globally accessible object with faceX, faceY
    if (context.userInFront) {
      const targetX = 1.0 - context.faceX; // Mirror X
      const targetY = context.faceY;
      // Update the pursuit target
      this.pursuit.updateTarget(targetX, targetY);
    } else {
      // If user disappears, smoothly return to center
      this.pursuit.updateTarget(0.5, 0.5);
    }

    // Apply the pursuit movement
    this.pursuit.apply(); // apply calls setPupilTransform
    this.currentX = this.pursuit.currentX;
    this.currentY = this.pursuit.currentY;

    return true; // Mutual gaze (or return to center) is always 'active' until switched
  }
}


// dynamicGaze: alternating gaze between two faces.
class dynamicGaze {
  constructor(dwellDuration = 2000, saccadeSpeed = 0.15) {
    this.name = "dynamicGaze";
    this.activeFace = 1; // Start with face 1
    this.dwellDuration = dwellDuration;
    this.saccadeSpeed = saccadeSpeed;
    this.state = "dwelling"; // "dwelling" or "saccading"
    this.stateStartTime = Date.now();
    this.saccade = null;
    // Store current position
    this.currentX = 0.5;
    this.currentY = 0.5;
  }

  getTargetCoords() {
    if (this.activeFace === 1 && context.faceX !== null && context.faceY !== null) {
      return { x: 1.0 - context.faceX, y: context.faceY }; // Mirrored X
    } else if (this.activeFace === 2 && context.secondFaceX !== null && context.secondFaceY !== null) {
      return { x: 1.0 - context.secondFaceX, y: context.secondFaceY }; // Mirrored X
    }
    return null; // No valid target for the active face index
  }

  apply() {
    const now = Date.now();
    const target = this.getTargetCoords();

    if (!target) {
      // If current target face disappears, maybe switch immediately or dwell on other?
      // For now, let's try switching. If other also invalid, will idle.
      console.log(`Dynamic Gaze: Target face ${this.activeFace} lost.`);
      // If we were saccading towards it, stop the saccade
      this.saccade = null;
      this.state = "dwelling"; // Reset state
      this.activeFace = this.activeFace === 1 ? 2 : 1; // Switch target
      const newTarget = this.getTargetCoords();
      if (!newTarget) { // If other face also missing, signal behavior end/idle
          this.currentX = 0.5; // Go center
          this.currentY = 0.5;
          setPupilTransform(0.5, 0.5, 1.0);
          return false; // Indicate idle/end
      }
      // If new target is valid, reset timer and dwell there
      this.stateStartTime = now;
      setPupilTransform(newTarget.x, newTarget.y, 1.0); // Look at new target
      this.currentX = newTarget.x;
      this.currentY = newTarget.y;
      return true;
    }

    // --- State Machine ---
    if (this.state === "dwelling") {
      // Look at the current target
      setPupilTransform(target.x, target.y, 1.0);
      this.currentX = target.x;
      this.currentY = target.y;

      // Check if dwell time is over
      if (now - this.stateStartTime >= this.dwellDuration) {
        // Time to switch: initiate saccade
        const nextFaceIndex = this.activeFace === 1 ? 2 : 1;
        let nextTarget = null;
         // Temporarily switch activeFace to get coords, switch back if invalid
         const originalFace = this.activeFace;
         this.activeFace = nextFaceIndex;
         nextTarget = this.getTargetCoords();
         this.activeFace = originalFace; // Switch back


        if (nextTarget) {
          console.log(`Dynamic Gaze: Saccading from face ${this.activeFace} to ${nextFaceIndex}`);
          this.saccade = new Saccade(this.currentX, this.currentY, nextTarget.x, nextTarget.y, this.saccadeSpeed);
          this.state = "saccading";
          // Active face index changes *after* saccade completes
        } else {
          // Other face not visible, just continue dwelling on current face
          console.log(`Dynamic Gaze: Next face ${nextFaceIndex} not visible, continue dwelling.`);
          this.stateStartTime = now; // Reset dwell timer
        }
      }
    } else if (this.state === "saccading") {
      if (this.saccade && this.saccade.apply()) {
        // Saccade in progress
        this.currentX = this.saccade.currentX;
        this.currentY = this.saccade.currentY;
      } else {
        // Saccade finished
        this.activeFace = this.activeFace === 1 ? 2 : 1; // Officially switch target face
        this.state = "dwelling";
        this.stateStartTime = Date.now();
        this.saccade = null;
        // currentX/Y should be at target from saccade completion
        const finalTarget = this.getTargetCoords(); // Get coords just to be sure
        if (finalTarget) {
            this.currentX = finalTarget.x;
            this.currentY = finalTarget.y;
            setPupilTransform(this.currentX, this.currentY, 1.0); // Ensure final position
        } else {
             // Target disappeared right at the end? Go center.
             console.warn("Dynamic Gaze: Target disappeared at end of saccade.");
             this.currentX = 0.5;
             this.currentY = 0.5;
             setPupilTransform(0.5, 0.5, 1.0);
             return false; // Idle
        }

      }
    }
    return true; // Behavior is active
  }
}

// RespondingJointAttention: triggered by perception events.
class RespondingJointAttention {
  constructor(direction) { // direction is where USER looked ("left" or "right")
    this.name = "RespondingJointAttention";
    this.userLookDirection = direction;
    this.phase = "transitionToSide";
    this.startTime = Date.now();
    this.transitionDuration = 300;
    this.holdDuration = 2000;
    this.returnDuration = 300;
    // Start from current gaze position
    this.initialX = window.currentGazeX || 0.5;
    this.initialY = window.currentGazeY || 0.5;

    // Robot looks opposite to user's look direction
    // User looks left (e.g., < 0.5) -> Robot looks right (e.g., 0.8)
    // User looks right (e.g., > 0.5) -> Robot looks left (e.g., 0.2)
    this.targetX = (this.userLookDirection === "left") ? 0.8 : 0.2;
    this.targetY = 0.5; // Look horizontally

    this.completed = false;
    // Store current position
    this.currentX = this.initialX;
    this.currentY = this.initialY;
  }

  apply() {
    const now = Date.now();
    // Where the robot *would* look for mutual gaze (used for return target)
    // Ensure context is available - might need to pass it in or ensure global scope works
    const userTargetX = context.userInFront ? (1.0 - context.faceX) : 0.5;
    const userTargetY = context.userInFront ? context.faceY : 0.5;

    if (this.phase === "transitionToSide") {
      const t = Math.min((now - this.startTime) / this.transitionDuration, 1);
      this.currentX = this.initialX + (this.targetX - this.initialX) * t;
      this.currentY = this.initialY + (this.targetY - this.initialY) * t; // Transition Y too
      setPupilTransform(this.currentX, this.currentY, 1.0);
      if (t >= 1) {
        this.phase = "hold";
        this.holdStartTime = now;
      }
    } else if (this.phase === "hold") {
      // Maintain target position
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      setPupilTransform(this.currentX, this.currentY, 1.0);
      if (now - this.holdStartTime >= this.holdDuration) {
        this.phase = "returnToUser";
        this.returnStartTime = now;
        // Store position just before return starts
        this.initialX = this.currentX;
        this.initialY = this.currentY;
      }
    } else if (this.phase === "returnToUser") {
      const t = Math.min((now - this.returnStartTime) / this.returnDuration, 1);
      // Return towards the current user position
      this.currentX = this.initialX + (userTargetX - this.initialX) * t;
      this.currentY = this.initialY + (userTargetY - this.initialY) * t;
      setPupilTransform(this.currentX, this.currentY, 1.0);
      if (t >= 1) {
        this.phase = "done";
      }
    } else if (this.phase === "done") {
      this.completed = true;
      // Ensure eyes are finally looking at user
      setPupilTransform(userTargetX, userTargetY, 1.0);
      this.currentX = userTargetX;
      this.currentY = userTargetY;
      return false; // Behavior finished
    }
    return true; // Behavior still active
  }
}


// InitiatingJointAttention: triggered by events (keys, card reveal).
class InitiatingJointAttention {
  constructor(direction) { // direction is where ROBOT should look ("left" or "right")
    this.name = "InitiatingJointAttention";
    this.robotLookDirection = direction;
    this.phase = "transitionToSide";
    this.startTime = Date.now();
    this.transitionDuration = 300;
    this.holdDuration = 2000;
    this.returnDuration = 300;
    // Start from current gaze position
    this.initialX = window.currentGazeX || 0.5;
    this.initialY = window.currentGazeY || 0.5;

    // Robot looks in the specified direction
    this.targetX = (this.robotLookDirection === "left") ? 0.2 : 0.8;
    this.targetY = 0.5; // Look horizontally

    this.completed = false;
    // Store current position
    this.currentX = this.initialX;
    this.currentY = this.initialY;
  }

  apply() {
    const now = Date.now();
    // Target for returning to user
    const userTargetX = context.userInFront ? (1.0 - context.faceX) : 0.5;
    const userTargetY = context.userInFront ? context.faceY : 0.5;

    if (this.phase === "transitionToSide") {
      const t = Math.min((now - this.startTime) / this.transitionDuration, 1);
      this.currentX = this.initialX + (this.targetX - this.initialX) * t;
      this.currentY = this.initialY + (this.targetY - this.initialY) * t; // Transition Y too
      setPupilTransform(this.currentX, this.currentY, 1.0);
      if (t >= 1) {
        this.phase = "hold";
        this.holdStartTime = now;
      }
    } else if (this.phase === "hold") {
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      setPupilTransform(this.currentX, this.currentY, 1.0);
      if (now - this.holdStartTime >= this.holdDuration) {
        this.phase = "returnToUser";
        this.returnStartTime = now;
        // Store position just before return starts
        this.initialX = this.currentX;
        this.initialY = this.currentY;
      }
    } else if (this.phase === "returnToUser") {
      const t = Math.min((now - this.returnStartTime) / this.returnDuration, 1);
      // Return towards the current user position
      this.currentX = this.initialX + (userTargetX - this.initialX) * t;
      this.currentY = this.initialY + (userTargetY - this.initialY) * t;
      setPupilTransform(this.currentX, this.currentY, 1.0);
      if (t >= 1) {
        this.phase = "done";
      }
    } else if (this.phase === "done") {
      this.completed = true;
       // Ensure eyes are finally looking at user
      setPupilTransform(userTargetX, userTargetY, 1.0);
      this.currentX = userTargetX;
      this.currentY = userTargetY;
      return false; // Behavior finished
    }
    return true; // Behavior still active
  }
}