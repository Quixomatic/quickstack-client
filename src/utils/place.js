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
import { animateBlockPlacement, animateScoreChange } from "./animHelpers.js";
import { sendRoomMessage } from "./networkHelpers.js";
import { checkTowerHeight } from "./towerHelpers.js";
import { getPlacementCharge, addCharge } from "./chargeHelpers.js";
import { calculateScore } from "./levelHelpers.js";
import { isRowComplete } from "./boardHelpers.js";

export function lockPiece(scene) {
  const { shape, x, y } = scene.activePiece;
  let towerContact = 0;
  let gutterFloorContact = 0;
  
  // Keep track of the rows this piece occupies
  const affectedRows = new Set();

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const newX = x + col;
      const newY = y + row;
      
      // Add to affected rows
      affectedRows.add(newY);
      
      const inTower = newX >= GUTTER_WIDTH && newX < GUTTER_WIDTH + TOWER_WIDTH;
      const atFloor = newY === BOARD_HEIGHT - 1;
      const inGutter =
        newX < GUTTER_WIDTH || newX >= GUTTER_WIDTH + TOWER_WIDTH;

      if (inTower) {
        towerContact++;
      } else if (inGutter && atFloor) {
        gutterFloorContact++;
      }
    }
  }

  if (towerContact === 0 && gutterFloorContact > 0) {
    scene.clearActiveBlocks();
    scene.activePiece = null;
    if (scene.fallTimer) scene.fallTimer.remove(false);
    scene.spawnTetromino();
    return false;
  }

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const newX = x + col;
        const newY = y + row;
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
  
  // Use network helper
  sendRoomMessage(scene.room, "blockPlaced", { x, y, shape });
  
  scene.clearActiveBlocks();
  scene.activePiece = null;
  if (scene.fallTimer) scene.fallTimer.remove(false);
  
  // Check tower height after locking a piece
  checkTowerHeight(scene);
  
  return true;
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