// utils/move.js
import { drawPiece } from "./draw.js";
import { clearActiveBlocks } from "./draw.js";

export function movePiece(scene, dx) {
  scene.activePiece.x += dx;
  if (scene.checkCollision()) {
    scene.activePiece.x -= dx;
  } else {
    drawPiece(scene);
  }
}

export function rotatePiece(scene) {
  const shape = scene.activePiece.shape;
  const rotated = shape[0].map((_, i) => shape.map(row => row[i]).reverse());
  const oldRotation = scene.activePiece.rotationIndex;
  const newRotation = (oldRotation + 1) % 4;
  const kicks = scene.kicks?.[`${oldRotation}>${newRotation}`] || [[0, 0]];
  const oldX = scene.activePiece.x;
  const oldY = scene.activePiece.y;

  for (const [dx, dy] of kicks) {
    scene.activePiece.shape = rotated;
    scene.activePiece.x = oldX + dx;
    scene.activePiece.y = oldY + dy;
    if (!scene.checkCollision()) {
      scene.activePiece.rotationIndex = newRotation;
      drawPiece(scene);
      return;
    }
  }

  scene.activePiece.shape = shape;
  scene.activePiece.x = oldX;
  scene.activePiece.y = oldY;
  scene.activePiece.rotationIndex = oldRotation;
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
