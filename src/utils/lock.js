// utils/lock.js
import { GRID_SIZE, BOARD_WIDTH, CUT_OFF_ROW, HISTORY_ROWS, BUFFER_ROWS, VISIBLE_ROWS } from "./constants.js";
import { createEmptyBoard, findTopRow, copyBoardSection } from "./boardHelpers.js";
import { resetCharge } from "./chargeHelpers.js";
import { increaseLevel, calculateScore } from "./levelHelpers.js";
import { updateText } from "./uiHelpers.js";

export function lockTowerSection(scene) {
  // Only allow locking if charge is full (extra safety check)
  if (!scene.lockReady) return;
  
  // Find topmost filled row
  const topRow = findTopRow(scene.board);
  if (topRow === -1) return; // No blocks to lock
  
  // Get rows to move to history, starting from the row BELOW the top row
  const newHistoryRows = copyBoardSection(scene.board, topRow + 1, CUT_OFF_ROW);
  
  // Update history grid
  scene.historyGrid = [...newHistoryRows, ...scene.historyGrid].slice(0, HISTORY_ROWS);

  // Store the top row data
  const topRowData = [...scene.board[topRow]];
  
  // Clear the board completely
  scene.board = createEmptyBoard(scene.board.length);
  
  // Add back the foundation at the new base Y position
  const newBaseY = scene.board.length - HISTORY_ROWS - 1;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    scene.board[newBaseY][x] = topRowData[x];
  }

  // Re-render locked blocks based on the cleared board
  scene.lockedBlocks.clear(true, true);
  for (let y = 0; y < scene.board.length; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (scene.board[y][x]) {
        const block = scene.add.image(x * GRID_SIZE, y * GRID_SIZE, "block").setOrigin(0);
        scene.lockedBlocks.add(block);
      }
    }
  }

  // Update the history visualization
  scene.historyBlocks.clear(true, true);
  const baseY = BUFFER_ROWS + VISIBLE_ROWS;
  const visibleRows = scene.historyGrid.filter(row => row.some(cell => cell !== 0));

  for (let y = 0; y < visibleRows.length; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (visibleRows[y][x]) {
        const block = scene.add.image(
          x * GRID_SIZE,
          (baseY + y) * GRID_SIZE,
          "block"
        ).setOrigin(0).setAlpha(0.5);
        scene.historyBlocks.add(block);
      }
    }
  }
  
  // Increase level and score after tower section lock
  increaseLevel(scene);
  
  // Add bonus score for locking a tower section
  const lockBonus = calculateScore(scene.level, 0, true);
  scene.score += lockBonus;
  updateText(scene.scoreText, scene.score, "Score: ");
  
  // Reset charge after locking
  scene.chargeLevel = 0;
  resetCharge(scene);
  
  // Make sure lockReady is updated properly
  scene.lockReady = false;
}