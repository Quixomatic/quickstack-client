// utils/collision.js
import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants.js";
import { isCellOccupied } from "./boardHelpers.js";

export function checkCollision(scene) {
  return checkCollisionAt(scene, scene.activePiece.x, scene.activePiece.y, scene.activePiece.shape);
}

export function checkCollisionAt(scene, x, y, shape) {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;

      const newX = x + col;
      const newY = y + row;

      // Check boundary collision
      if (newX < 0 || newX >= BOARD_WIDTH || newY < 0 || newY >= BOARD_HEIGHT) return true;
      
      // Check collision with blocks using our helper
      if (isCellOccupied(scene, newX, newY)) return true;
    }
  }
  return false;
}