// gcs/js/ui-handler.js
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  console.log("ui-handler.js: DOMContentLoaded"); // Log DOM ready

  // --- Call Gaze Loop Start ---
  // Assumes gaze-controller.js loaded and exposed startGazeLoop globally
  if (typeof startGazeLoop === 'function') {
      startGazeLoop(); // Start the gaze update loop
      console.log("ui-handler.js: startGazeLoop() called.");
  } else {
      console.error("ui-handler.js: startGazeLoop function not found! Ensure gaze-controller.js is loaded first.");
  }

  // --- Collapsible Control Panel ---
  const controlPanelHeader = document.getElementById('controlPanelHeader');
  const controlPanelContent = document.getElementById('controlPanelContent');
  let panelOpen = true; // Assume panel starts open

  if(controlPanelHeader && controlPanelContent) {
    controlPanelHeader.addEventListener('click', () => {
      panelOpen = !panelOpen;
      if (panelOpen) {
        controlPanelContent.style.display = 'block';
        controlPanelHeader.innerHTML = 'Controls &#9660;'; // Down arrow
      } else {
        controlPanelContent.style.display = 'none';
        controlPanelHeader.innerHTML = 'Controls &#9650;'; // Up arrow
      }
    });
  } else {
      console.error("ui-handler.js: Control panel header or content element not found!");
  }


  // --- Get References to Elements ---
  const ryanToggle = document.getElementById('ryanConditionToggle');     // Ryan Condition
  const ivanToggle = document.getElementById('ivanConditionToggle');     // Ivan Condition
  const carlToggle = document.getElementById('carlConditionToggle');     // Carl Condition
  const jointAttentionToggle = document.getElementById('jointAttentionToggle'); // Initiating JA
  const respondingJointAttentionToggle = document.getElementById('respondingJointAttentionToggle'); // Responding JA
  const knowledge80Toggle = document.getElementById('knowledge80Toggle'); // Knowledge 80%
  const knowledge20Toggle = document.getElementById('knowledge20Toggle'); // Knowledge 20%
  const activationPromptModal = document.getElementById('activationPromptModal'); // Get prompt modal

  // Check if all elements were found
  if (!ryanToggle || !ivanToggle || !carlToggle || !jointAttentionToggle || !respondingJointAttentionToggle || !knowledge80Toggle || !knowledge20Toggle || !activationPromptModal) {
      console.error("ui-handler.js: One or more elements (toggles or activation prompt modal) could not be found by ID!");
  } else {
      console.log("ui-handler.js: All toggle and modal elements found.");
  }

  // --- Helper Function for Default Styling ---
  function applyDefaultStyles() {
    console.log("ui-handler.js: Applying default styles (no condition active).");
    // Path relative to index.html
    document.body.style.backgroundImage = "url('../gcs/robot_faces/Robot8.png')";
    document.body.style.backgroundSize = "1000px";
    const eyesContainer = document.querySelector('.eyes-container');
    if (eyesContainer) {
        eyesContainer.style.marginBottom = "90px";
        eyesContainer.style.gap = "100px";
    }
    document.querySelectorAll('.eye').forEach(el => {
      el.style.background = "radial-gradient(circle at center, #f5f5f5, #bbb)";
    });
  }

  // --- Helper Function to Hide Prompt ---
  function hideActivationPrompt() {
      if (activationPromptModal && activationPromptModal.style.display !== 'none') {
          activationPromptModal.style.display = 'none';
          console.log("ui-handler.js: Activation prompt hidden.");
      }
  }

  // --- Event Listeners for Behavior Toggles (Interactions with Carl) ---
  if (knowledge80Toggle && knowledge20Toggle && carlToggle) {
      knowledge80Toggle.addEventListener('change', function() {
        if (this.checked) {
          knowledge20Toggle.checked = false;
          console.log("ui-handler.js: 80% Knowledge activated.");
          if(carlToggle.checked) {
            this.checked = false;
            console.log("ui-handler.js: Carl condition active, knowledge toggle blocked.");
          }
        }
      });
      knowledge20Toggle.addEventListener('change', function() {
        if (this.checked) {
          knowledge80Toggle.checked = false;
          console.log("ui-handler.js: 20% Knowledge activated.");
          if(carlToggle.checked) {
            this.checked = false;
            console.log("ui-handler.js: Carl condition active, knowledge toggle blocked.");
          }
        }
      });
  } else {
      console.error("ui-handler.js: Cannot add knowledge toggle listeners - element(s) missing.");
  }

  if (jointAttentionToggle && respondingJointAttentionToggle && carlToggle) {
      jointAttentionToggle.addEventListener('change', function() {
          if(carlToggle.checked && this.checked) {
             this.checked = false;
             console.log("ui-handler.js: Carl condition active, Initiating JA toggle blocked.");
          }
      });
      respondingJointAttentionToggle.addEventListener('change', function() {
          if(carlToggle.checked && this.checked) {
             this.checked = false;
             console.log("ui-handler.js: Carl condition active, Responding JA toggle blocked.");
          }
      });
  } else {
      console.error("ui-handler.js: Cannot add JA toggle listeners - element(s) missing.");
  }


  // --- Condition Toggle Logic (Handling manual clicks - Includes prompt/initial state logic) ---
  if (ryanToggle && ivanToggle && carlToggle && jointAttentionToggle && respondingJointAttentionToggle && knowledge80Toggle && knowledge20Toggle) {

      // --- Ryan Condition Listener ---
      ryanToggle.addEventListener('change', function() {
        // Added diagnostic log
        console.log(`%c[UI] Ryan toggle 'change' listener fired! Checked: ${this.checked}`, 'color: orange; font-weight: bold;');
        if (this.checked) {
          hideActivationPrompt(); // Hide prompt
          // Set initial condition ONCE (accesses global variable from gaze-controller.js)
          if (window.initialCondition === null) {
              window.initialCondition = 'ryan';
              window.conditionSequence = ['ryan'];
              console.log("ui-handler.js: Initial condition set to Ryan.");
          }
          // Uncheck others, set behaviors, apply styles
          ivanToggle.checked = false;
          carlToggle.checked = false;
          jointAttentionToggle.checked = true;
          knowledge80Toggle.checked = true;
          knowledge20Toggle.checked = false;
          respondingJointAttentionToggle.checked = false;
          console.log("ui-handler.js: Ryan Condition activated: IJA/K80 enabled.");
          document.body.style.backgroundImage = "url('../gcs/robot_faces/Robot8.png')";
          document.body.style.backgroundSize = "1000px";
          const eyesContainer = document.querySelector('.eyes-container');
          if (eyesContainer) { eyesContainer.style.marginBottom = "90px"; eyesContainer.style.gap = "100px"; }
          document.querySelectorAll('.eye').forEach(el => { el.style.background = "radial-gradient(circle at center, #f5f5f5, #bbb)"; });
        } else {
          setTimeout(() => { // Check state after event propagation
              if (!ivanToggle.checked && !carlToggle.checked) { applyDefaultStyles(); }
          }, 0);
          console.log("ui-handler.js: Ryan Condition deactivated.");
        }
      });

      // --- Ivan Condition Listener ---
      ivanToggle.addEventListener('change', function() {
        // Added diagnostic log
        console.log(`%c[UI] Ivan toggle 'change' listener fired! Checked: ${this.checked}`, 'color: orange; font-weight: bold;');
        if (this.checked) {
          hideActivationPrompt(); // Hide prompt
          // Set initial condition ONCE
          if (window.initialCondition === null) {
              window.initialCondition = 'ivan';
              window.conditionSequence = ['ivan'];
              console.log("ui-handler.js: Initial condition set to Ivan.");
          }
          // Uncheck others, set behaviors, apply styles
          ryanToggle.checked = false;
          carlToggle.checked = false;
          jointAttentionToggle.checked = true;
          knowledge20Toggle.checked = true;
          knowledge80Toggle.checked = false;
          respondingJointAttentionToggle.checked = false;
          console.log("ui-handler.js: Ivan condition activated: IJA/K20 enabled.");
          document.body.style.backgroundImage = "url('../gcs/robot_faces/Robot6.jpg')";
          document.body.style.backgroundSize = "1000px";
          const eyesContainer = document.querySelector('.eyes-container');
          if (eyesContainer) { eyesContainer.style.marginBottom = "155px"; eyesContainer.style.gap = "100px"; }
          document.querySelectorAll('.eye').forEach(el => { el.style.background = "radial-gradient(circle at center, #f5f5f5, #aaa)"; });
        } else {
           setTimeout(() => { // Check state after event propagation
              if (!ryanToggle.checked && !carlToggle.checked) { applyDefaultStyles(); }
          }, 0);
          console.log("ui-handler.js: Ivan condition deactivated.");
        }
      });

      // --- Carl Condition Listener ---
      carlToggle.addEventListener('change', function() {
        // Added diagnostic log
        console.log(`%c[UI] Carl toggle 'change' listener fired! Checked: ${this.checked}`, 'color: orange; font-weight: bold;');
        if (this.checked) {
          hideActivationPrompt(); // Hide prompt
          // Set initial condition ONCE
          if (window.initialCondition === null) {
              window.initialCondition = 'carl';
              window.conditionSequence = ['carl'];
              console.log("ui-handler.js: Initial condition set to Carl.");
          }
          // Uncheck others, disable behaviors, apply styles
          ryanToggle.checked = false;
          ivanToggle.checked = false;
          jointAttentionToggle.checked = false;
          respondingJointAttentionToggle.checked = false;
          knowledge80Toggle.checked = false;
          knowledge20Toggle.checked = false;
          console.log("ui-handler.js: Carl Condition activated: All other behavior toggles disabled.");
          document.body.style.backgroundImage = "url('../gcs/robot_faces/Robot7.jpg')";
          document.body.style.backgroundSize = "800px";
          const eyesContainer = document.querySelector('.eyes-container');
          if (eyesContainer) { eyesContainer.style.marginBottom = "45px"; eyesContainer.style.gap = "100px"; }
          document.querySelectorAll('.eye').forEach(el => { el.style.background = "radial-gradient(circle at center, #f5f5f5, #bbb)"; });
        } else {
           setTimeout(() => { // Check state after event propagation
             if (!ryanToggle.checked && !ivanToggle.checked) { applyDefaultStyles(); }
          }, 0);
          console.log("ui-handler.js: Carl Condition deactivated.");
        }
      });

      // --- Initial State Check: Show prompt if needed ---
      if (!ryanToggle.checked && !ivanToggle.checked && !carlToggle.checked) {
          applyDefaultStyles(); // Apply visual default
          console.log("ui-handler.js: Initialized. No condition active.");
          // Show the prompt
          if(activationPromptModal) {
              activationPromptModal.style.display = 'flex';
              console.log("ui-handler.js: Activation prompt shown.");
          }
      } else {
          // If loaded with a condition already checked (e.g., browser refresh state)
          hideActivationPrompt(); // Ensure prompt is hidden
          // Set initialCondition if it wasn't already set (use global variable)
           if (window.initialCondition === null) {
              if(ryanToggle.checked) { window.initialCondition = 'ryan'; window.conditionSequence = ['ryan']; }
              else if(ivanToggle.checked) { window.initialCondition = 'ivan'; window.conditionSequence = ['ivan']; }
              else if(carlToggle.checked) { window.initialCondition = 'carl'; window.conditionSequence = ['carl']; }
              console.log(`ui-handler.js: Initial condition set from pre-checked toggle: ${window.initialCondition}`);
              // Ensure styles consistent with checked state by re-triggering change
              if(window.initialCondition === 'ryan') ryanToggle.dispatchEvent(new Event('change'));
              else if(window.initialCondition === 'ivan') ivanToggle.dispatchEvent(new Event('change'));
              else if(window.initialCondition === 'carl') carlToggle.dispatchEvent(new Event('change'));
           }
      }

  } else {
      console.error("ui-handler.js: Cannot add condition toggle listeners - element(s) missing.");
  } // End check for toggle elements before adding listeners

}); // End DOMContentLoaded listener