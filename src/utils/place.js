// utils/place.js
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  GUTTER_WIDTH,
  TOWER_WIDTH,
  GRID_SIZE,
  CUT_OFF_ROW,
  BUFFER_ROWS,
  VISIBLE_ROWS,
} from "./constants.js";
import { isCellOccupied, findCompleteRows } from "./boardHelpers.js";
import { updateText } from "./uiHelpers.js";
import { animateBlockPlacement, animateScoreChange, shakeScreen } from "./animHelpers.js";
import { sendRoomMessage } from "./networkHelpers.js";
import { checkTowerHeight } from "./towerHelpers.js";
import { getPlacementCharge, addCharge } from "./chargeHelpers.js";
import { calculateScore } from "./levelHelpers.js";
import { isRowComplete } from "./boardHelpers.js";
import { updateStabilityAfterPlacement } from "./instabilityHelpers.js";

export function lockPiece(scene) {
  const { shape, x, y } = scene.activePiece;
  let towerContact = 0;
  let gutterFloorContact = 0;
  let gutterOverhangBlocks = []; // Track blocks hanging in gutters
  
  // Keep track of the rows this piece occupies
  const affectedRows = new Set();

  // First pass: identify all blocks and their positions
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const newX = x + col;
      const newY = y + row;
      
      // Add to affected rows
      affectedRows.add(newY);
      
      const inTower = newX >= GUTTER_WIDTH && newX < GUTTER_WIDTH + TOWER_WIDTH;
      const atFloor = newY === BOARD_HEIGHT - 1;
      const inGutter = newX < GUTTER_WIDTH || newX >= GUTTER_WIDTH + TOWER_WIDTH;

      if (inTower) {
        towerContact++;
      } else if (inGutter && atFloor) {
        gutterFloorContact++;
      } else if (inGutter && !atFloor) {
        // Track blocks hanging in the gutter
        gutterOverhangBlocks.push({ row, col, newX, newY });
      }
    }
  }

  // Special case: If the entire piece is in the gutter floor
  if (towerContact === 0 && gutterFloorContact > 0) {
    scene.clearActiveBlocks();
    scene.activePiece = null;
    if (scene.fallTimer) scene.fallTimer.remove();
    scene.spawnTetromino();
    return false;
  }
  
  // Second pass: place blocks that aren't in gutters
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const newX = x + col;
        const newY = y + row;
        
        // Skip blocks hanging in gutters
        const inGutter = newX < GUTTER_WIDTH || newX >= GUTTER_WIDTH + TOWER_WIDTH;
        if (inGutter && newY !== BOARD_HEIGHT - 1) continue;
        
        if (newY >= 0 && newY < BOARD_HEIGHT) {
          if (newY >= CUT_OFF_ROW) {
            const historyY = newY - (BUFFER_ROWS + VISIBLE_ROWS);
            scene.historyGrid[historyY][newX] = 1;
          } else {
            scene.board[newY][newX] = 1;
          }
          const block = scene.add
            .image(newX * GRID_SIZE, newY * GRID_SIZE, "block")
            .setOrigin(0);
          scene.lockedBlocks.add(block);
          
          // Use animation helper
          animateBlockPlacement(scene, block);
        }
      }
    }
  }
  
  // Handle gutter overhanging blocks if any
  if (gutterOverhangBlocks.length > 0) {
    animateGutterOverhang(scene, gutterOverhangBlocks);
    
    // Apply penalty for each overhanging block
    const overhangPenalty = gutterOverhangBlocks.length * 5; // 5 points per block
    scene.score = Math.max(0, scene.score - overhangPenalty);
    updateText(scene.scoreText, scene.score, "Score: ");
    
    // Show penalty message
    const penaltyText = scene.add.text(
      scene.game.config.width / 2, 
      150,
      `-${overhangPenalty} POINTS (OVERHANG PENALTY)`,
      { fontSize: '18px', fill: '#ff4444', fontStyle: 'bold' }
    ).setOrigin(0.5);
    
    // Fade out message
    scene.tweens.add({
      targets: penaltyText,
      alpha: 0,
      y: 120,
      duration: 1500,
      onComplete: () => penaltyText.destroy()
    });
  }

  // Check only the affected rows for completed lines
  const completeRows = [];
  affectedRows.forEach(rowIndex => {
    if (rowIndex < scene.board.length && isRowComplete(scene.board, rowIndex, GUTTER_WIDTH, TOWER_WIDTH)) {
      completeRows.push(rowIndex);
    }
  });
  
  // Track total lines cleared (for stats only)
  if (completeRows.length > 0) {
    scene.linesCleared = (scene.linesCleared || 0) + completeRows.length;
    
    // Show temporary highlight effect
    highlightCompleteRows(scene, completeRows);
  }

  scene.towerHeight++;
  
  // Update score based on current level and complete lines from this drop only
  const scoreIncrease = calculateScore(scene.level, completeRows.length);
  scene.score += scoreIncrease;
  updateText(scene.scoreText, scene.score, "Score: ");
  
  // Also update a lines cleared counter in the UI
  if (scene.linesText) {
    updateText(scene.linesText, scene.linesCleared, "Lines: ");
  }
  
  // Add charge based on placement
  const chargeAmount = getPlacementCharge(scene, scene.activePiece.type);
  addCharge(scene, chargeAmount);
  
  // Add score animation - only show the score from this drop
  const centerX = (x + shape[0].length / 2) * GRID_SIZE;
  const centerY = (y + shape.length / 2) * GRID_SIZE;
  animateScoreChange(scene, scoreIncrease, centerX, centerY);
  
  // Update stability after placing a piece
  updateStabilityAfterPlacement(scene, {
    shape: shape,
    x: x,
    y: y
  });
  
  // If stability is low (instability is high), add slight shake effect
  if (scene.instability > 70) {
    const intensity = Math.min(0.005, scene.instability * 0.0001);
    shakeScreen(scene, 300, intensity);
  }
  
  // Use network helper
  sendRoomMessage(scene.room, "blockPlaced", { x, y, shape });
  
  scene.clearActiveBlocks();
  scene.activePiece = null;
  if (scene.fallTimer) scene.fallTimer.remove();
  
  // Check tower height after locking a piece
  checkTowerHeight(scene);
  
  return true;
}

/**
 * Animate gutter overhang blocks falling away
 * @param {object} scene - The game scene
 * @param {Array} overhangBlocks - Array of overhanging block data
 */
function animateGutterOverhang(scene, overhangBlocks) {
  // Create temporary blocks for animation
  const fallingBlocks = [];
  
  overhangBlocks.forEach(block => {
    const tempBlock = scene.add.image(
      block.newX * GRID_SIZE, 
      block.newY * GRID_SIZE, 
      "block"
    ).setOrigin(0);
    
    fallingBlocks.push(tempBlock);
    
    // Animate falling and fading
    scene.tweens.add({
      targets: tempBlock,
      y: '+=' + (Math.random() * 100 + 200),
      angle: Math.random() * 360,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        tempBlock.destroy();
      }
    });
  });
  
  // Play falling sound effect if available
  if (scene.sound && scene.sound.play && scene.sound.fallingSound) {
    scene.sound.play('fallingSound', { volume: 0.5 });
  }
}

// Function to temporarily highlight complete rows
function highlightCompleteRows(scene, rowIndices) {
  // If no rows, do nothing
  if (!rowIndices.length) return;
  
  // Create temporary highlight effects
  const highlights = [];
  
  for (const rowIndex of rowIndices) {
    // Create a highlight rectangle for the row
    const highlight = scene.add.rectangle(
      GUTTER_WIDTH * GRID_SIZE,
      rowIndex * GRID_SIZE,
      TOWER_WIDTH * GRID_SIZE,
      GRID_SIZE,
      0xffff00, // Yellow highlight
      0.5 // Alpha
    ).setOrigin(0, 0);
    
    highlights.push(highlight);
    
    // Make it pulse
    scene.tweens.add({
      targets: highlight,
      alpha: { from: 0.5, to: 0.2 },
      duration: 500,
      yoyo: true,
      repeat: 3 // Just a few pulses
    });
  }
  
  // Remove highlights after a short time
  scene.time.delayedCall(2000, () => {
    highlights.forEach(h => h.destroy());
  });
}