// utils/draw.js
import { GRID_SIZE } from "./constants.js";

export function clearActiveBlocks(scene) {
  scene.ghostBlocks.forEach(b => b.destroy());
  if (scene.activePiece?.blocks?.length) {
    scene.activePiece.blocks.forEach(b => b.destroy());
    scene.activePiece.blocks = [];
  }
}

export function drawGhostPiece(scene) {
  scene.ghostBlocks.forEach(b => b.destroy());
  scene.ghostBlocks = [];
  if (!scene.activePiece) return;
  const { shape, x } = scene.activePiece;
  let ghostY = scene.activePiece.y;
  while (!scene.checkCollisionAt(x, ghostY + 1, shape)) ghostY++;
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const block = scene.add.image((x + col) * GRID_SIZE, (ghostY + row) * GRID_SIZE, "block").setOrigin(0).setAlpha(0.3);
        scene.ghostBlocks.push(block);
      }
    }
  }
}

export function drawPiece(scene) {
  clearActiveBlocks(scene);
  const { shape, x, y } = scene.activePiece;
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const block = scene.add.image((x + col) * GRID_SIZE, (y + row) * GRID_SIZE, "block").setOrigin(0);
        scene.activePiece.blocks.push(block);
      }
    }
  }
  drawGhostPiece(scene);
}
