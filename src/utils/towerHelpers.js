// utils/towerHelpers.js
import { BUFFER_ROWS, VISIBLE_ROWS, BOARD_HEIGHT } from "./constants.js";
import { lockTowerSection } from "./lock.js";
import { findTopRow } from "./boardHelpers.js";
import { updateText } from "./uiHelpers.js";
import { flashScreen } from "./animHelpers.js";

// Define the emergency threshold (2 rows from buffer zone)
const EMERGENCY_THRESHOLD = 2;

// Check if tower is too high and start auto-lock countdown
export function checkTowerHeight(scene) {
  if (!scene.autoLockEnabled) return;
  
  const topRow = findTopRow(scene.board);
  if (topRow === -1) return; // No blocks found
  
  // Calculate how close we are to the top and buffer zone
  const blocksFromTop = topRow;
  const blocksFromBuffer = Math.max(0, topRow - BUFFER_ROWS);
  
  // Emergency auto-lock if we're too close to buffer zone
  if (blocksFromBuffer <= EMERGENCY_THRESHOLD) {
    // Cancel any existing countdown
    cancelAutoLockCountdown(scene);
    
    // Store original lock ready state
    const originalLockReady = scene.lockReady;
    
    // Force lock ready to true for emergency lock
    scene.lockReady = true;
    
    // Perform emergency lock immediately
    lockTowerSection(scene);
    
    // If lock wasn't ready before, make sure it stays false
    if (!originalLockReady) {
      scene.lockReady = false;
    }
    
    return;
  }
  
  // Regular auto-lock threshold check
  if (blocksFromTop <= scene.autoLockThreshold && !scene.autoLockTimer) {
    startAutoLockCountdown(scene);
  } 
  // If tower is no longer above threshold, cancel countdown
  else if (blocksFromTop > scene.autoLockThreshold && scene.autoLockTimer) {
    cancelAutoLockCountdown(scene);
  }
}

// Start the auto-lock countdown
export function startAutoLockCountdown(scene) {
  // Create warning text if it doesn't exist
  if (!scene.autoLockWarning) {
    scene.autoLockWarning = scene.add.text(
      scene.game.config.width / 2, 
      100, 
      `AUTO-LOCK IN ${scene.autoLockCountdown}`, 
      { fontSize: '24px', fill: '#ff0000', fontStyle: 'bold' }
    ).setOrigin(0.5);
  } else {
    updateText(scene.autoLockWarning, scene.autoLockCountdown, "AUTO-LOCK IN ");
    scene.autoLockWarning.setVisible(true);
  }
  
  // Flash the screen to alert the player
  flashScreen(scene, 200, 0xffff00);
  
  // Set the countdown timer
  let remainingTime = scene.autoLockCountdown;
  
  scene.autoLockTimer = scene.time.addEvent({
    delay: 1000,
    callback: () => {
      remainingTime--;
      
      if (remainingTime <= 0) {
        // Time's up - lock the tower
        performAutoLock(scene);
      } else {
        // Update the countdown text
        updateText(scene.autoLockWarning, remainingTime, "AUTO-LOCK IN ");
        
        // Flash more intensely as time runs out
        const flashIntensity = Math.min(500, 200 + (scene.autoLockCountdown - remainingTime) * 100);
        flashScreen(scene, flashIntensity, 0xffff00);
      }
    },
    repeat: scene.autoLockCountdown - 1
  });
}

// Cancel the auto-lock countdown
export function cancelAutoLockCountdown(scene) {
  if (scene.autoLockTimer) {
    scene.autoLockTimer.remove();
    scene.autoLockTimer = null;
  }
  
  if (scene.autoLockWarning) {
    scene.autoLockWarning.setVisible(false);
  }
}

// Perform the automatic tower lock
export function performAutoLock(scene) {
  // Override the charge check for auto-locking
  const originalLockReady = scene.lockReady;
  scene.lockReady = true; // Force to true temporarily
  
  // Execute the lock
  lockTowerSection(scene);
  
  // Restore the original lock ready state if it wasn't consumed
  if (originalLockReady === false) {
    scene.lockReady = false;
  }
  
  // Clean up the timer and warning
  scene.autoLockTimer = null;
  if (scene.autoLockWarning) {
    scene.autoLockWarning.setVisible(false);
  }
}