// utils/collision.js
import { BOARD_WIDTH, BOARD_HEIGHT, BUFFER_ROWS, VISIBLE_ROWS, CUT_OFF_ROW } from "./constants.js";

export function checkCollision(scene) {
  return checkCollisionAt(scene, scene.activePiece.x, scene.activePiece.y, scene.activePiece.shape);
}

export function checkCollisionAt(scene, x, y, shape) {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;

      const newX = x + col;
      const newY = y + row;

      if (newX < 0 || newX >= BOARD_WIDTH || newY < 0 || newY >= BOARD_HEIGHT) return true;

      if (newY >= CUT_OFF_ROW) {
        const historyY = newY - (BUFFER_ROWS + VISIBLE_ROWS);
        if (scene.historyGrid[historyY]?.[newX]) return true;
      } else {
        if (scene.board[newY][newX]) return true;
      }
    }
  }
  return false;
}