// utils/draw.js
import { GRID_SIZE } from "./constants.js";
import { calculateGhostPosition, renderBlocks } from "./tetrominoHelpers.js";

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
  
  const ghostPosition = calculateGhostPosition(scene, scene.activePiece);
  if (ghostPosition) {
    scene.ghostBlocks = renderBlocks(
      scene, 
      ghostPosition.x, 
      ghostPosition.y, 
      ghostPosition.shape, 
      "block", 
      0.3
    );
  }
}

export function drawPiece(scene) {
  clearActiveBlocks(scene);
  
  if (!scene.activePiece) return;
  
  const { shape, x, y } = scene.activePiece;
  scene.activePiece.blocks = renderBlocks(scene, x, y, shape);
  
  drawGhostPiece(scene);
}