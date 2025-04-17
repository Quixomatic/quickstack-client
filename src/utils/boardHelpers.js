// utils/boardHelpers.js
import { BOARD_WIDTH, BUFFER_ROWS, VISIBLE_ROWS, CUT_OFF_ROW, GUTTER_WIDTH, TOWER_WIDTH } from "./constants.js";

// Create a clean empty board of specified dimensions
export function createEmptyBoard(rows, cols = BOARD_WIDTH) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

// Check if a cell is occupied (works for both board and history grid)
export function isCellOccupied(scene, x, y) {
  // Check for out of bounds
  if (x < 0 || x >= BOARD_WIDTH || y < 0) {
    return true;
  }
  
  // Check history grid if we're below the cut-off
  if (y >= CUT_OFF_ROW) {
    const historyY = y - (BUFFER_ROWS + VISIBLE_ROWS);
    // Make sure we're not accessing beyond the history grid bounds
    if (historyY >= 0 && historyY < scene.historyGrid.length && scene.historyGrid[historyY]) {
      return Boolean(scene.historyGrid[historyY][x]);
    }
    return false;
  } 
  // Otherwise check the main board
  else if (y < scene.board.length) {
    return Boolean(scene.board[y][x]);
  }
  
  return false;
}

// Find the topmost occupied row in a board
export function findTopRow(board) {
  for (let y = 0; y < board.length; y++) {
    if (board[y].some(cell => cell === 1)) {
      return y;
    }
  }
  return -1; // No occupied cells found
}

// Copy a portion of the board (useful for history operations)
export function copyBoardSection(board, startRow, endRow) {
  const rows = [];
  for (let y = startRow; y < endRow; y++) {
    if (y >= 0 && y < board.length) {
      rows.push([...board[y]]);
    }
  }
  return rows;
}

// Check if a row is completely filled (a Tetris line)
export function isRowComplete(board, rowIndex, gutterWidth, towerWidth) {
  // Only check the tower area (excluding gutters)
  for (let x = gutterWidth; x < gutterWidth + towerWidth; x++) {
    if (!board[rowIndex][x]) {
      return false;
    }
  }
  return true;
}

// Find all complete rows in the tower
export function findCompleteRows(scene) {
  const completeRows = [];
  
  // Check entire board for complete rows
  for (let y = 0; y < scene.board.length; y++) {
    if (isRowComplete(scene.board, y, GUTTER_WIDTH, TOWER_WIDTH)) {
      completeRows.push(y);
    }
  }
  
  return completeRows;
}