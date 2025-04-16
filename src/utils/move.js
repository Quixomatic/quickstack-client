// utils/move.js
import { drawPiece } from "./draw.js";
import { clearActiveBlocks } from "./draw.js";
import { tryRotation } from "./tetrominoHelpers.js";

export function movePiece(scene, dx) {
  scene.activePiece.x += dx;
  if (scene.checkCollision()) {
    scene.activePiece.x -= dx;
  } else {
    drawPiece(scene);
  }
}

export function rotatePiece(scene) {
  // If rotation is successful, the piece position will already be updated
  if (tryRotation(scene, scene.activePiece, scene.kicks)) {
    drawPiece(scene);
  }
}

export function dropPiece(scene) {
  scene.activePiece.y++;
  clearActiveBlocks(scene);
  if (scene.checkCollision()) {
    scene.activePiece.y--;
    drawPiece(scene); // Ensure it's rendered even if locking immediately
    const locked = scene.lockPiece();
    if (locked) scene.spawnTetromino();
  } else {
    drawPiece(scene);
  }
}