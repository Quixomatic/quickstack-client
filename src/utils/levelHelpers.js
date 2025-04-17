// utils/levelHelpers.js
import { updateText } from "./uiHelpers.js";
import { dropPiece } from "./move.js";

// Define standard drop speeds based on level
export function getDropSpeed(level) {
  // Base speed of 500ms (medium)
  const baseSpeed = 500;
  // Each level reduces the delay by 50ms, with a minimum of 50ms
  const speedReduction = Math.min(level * 50, 450);
  
  return Math.max(baseSpeed - speedReduction, 50);
}

// Increase level and update UI
export function increaseLevel(scene) {
  scene.level++;
  updateText(scene.levelText, scene.level, "Level: ");
  
  // Update fall speed if there's an active piece
  if (scene.activePiece && scene.fallTimer) {
    scene.fallTimer.remove();
    const newSpeed = getDropSpeed(scene.level);
    scene.fallTimer = scene.time.addEvent({
      delay: newSpeed,
      callback: () => dropPiece(scene),
      loop: true
    });
  }
  
  return scene.level;
}

// Calculate score based on level and complete lines
export function calculateScore(level, completeLines = 0, towerSectionLocked = false) {
  // Base points for locking a piece
  let score = 10 * (level + 1);
  
  // Bonus points for complete lines (Tetris scoring)
  if (completeLines > 0) {
    // Classic Tetris-style scoring for lines: 40, 100, 300, 1200 for 1-4 lines
    const linePoints = [40, 100, 300, 1200];
    if (completeLines <= 4) {
      score += linePoints[completeLines - 1] * (level + 1);
    } else {
      // For more than 4 lines (unlikely but possible)
      score += 1200 * completeLines * (level + 1);
    }
  }
  
  // Bonus points for locking a tower section
  if (towerSectionLocked) {
    score += 1000 * (level + 1);
  }
  
  return score;
}