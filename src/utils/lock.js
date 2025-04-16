// utils/lock.js
import { GRID_SIZE, BOARD_WIDTH, CUT_OFF_ROW, HISTORY_ROWS, BUFFER_ROWS, VISIBLE_ROWS } from "./constants.js";

export function lockTowerSection(scene) {
  let topRow = 0;
  for (let y = 0; y < scene.board.length; y++) {
    if (scene.board[y].indexOf(1) !== -1) {
      topRow = y;
      break;
    }
  }

  const newHistoryRows = [];
  for (let y = topRow; y < CUT_OFF_ROW; y++) {
    newHistoryRows.push([...scene.board[y]]);
  }
  scene.historyGrid = [...newHistoryRows, ...scene.historyGrid].slice(0, HISTORY_ROWS);

  const newBaseY = scene.board.length - HISTORY_ROWS - 1;
  const topRowData = [...scene.board[topRow]];
  scene.board = Array.from({ length: scene.board.length }, () => Array(BOARD_WIDTH).fill(0));
  for (let x = 0; x < BOARD_WIDTH; x++) {
    scene.board[newBaseY][x] = topRowData[x];
  }

  scene.lockedBlocks.clear(true, true);
  for (let y = 0; y < scene.board.length; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (scene.board[y][x]) {
        const block = scene.add.image(x * GRID_SIZE, y * GRID_SIZE, "block").setOrigin(0);
        scene.lockedBlocks.add(block);
      }
    }
  }

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
}