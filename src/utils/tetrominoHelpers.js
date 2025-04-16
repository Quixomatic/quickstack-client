// utils/tetrominoHelpers.js
import { GRID_SIZE, GUTTER_WIDTH, TOWER_WIDTH, BUFFER_ROWS } from "./constants.js";
import { checkCollisionAt } from "./collision.js";

// Rotate a tetromino shape clockwise
export function rotateTetromino(shape) {
  return shape[0].map((_, i) => shape.map(row => row[i]).reverse());
}

// Calculate the ghost piece position (the place where piece would land)
export function calculateGhostPosition(scene, activePiece) {
  if (!activePiece) return null;
  
  const { shape, x } = activePiece;
  let ghostY = activePiece.y;
  
  while (!checkCollisionAt(scene, x, ghostY + 1, shape)) {
    ghostY++;
  }
  
  return { x, y: ghostY, shape };
}

// Get spawn position for a tetromino shape
export function getSpawnPosition(shape, gutterWidth = GUTTER_WIDTH, towerWidth = TOWER_WIDTH, bufferRows = BUFFER_ROWS) {
  return {
    x: gutterWidth + Math.floor((towerWidth - shape[0].length) / 2),
    y: bufferRows - shape.length
  };
}

// Render blocks for a piece (can be used for active piece, ghost, etc.)
export function renderBlocks(scene, x, y, shape, spriteKey = "block", alpha = 1) {
  const blocks = [];
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const block = scene.add.image(
          (x + col) * GRID_SIZE, 
          (y + row) * GRID_SIZE, 
          spriteKey
        ).setOrigin(0).setAlpha(alpha);
        blocks.push(block);
      }
    }
  }
  return blocks;
}

// Try to apply rotation with wall kicks
export function tryRotation(scene, piece, kicks) {
  const oldShape = piece.shape;
  const rotated = rotateTetromino(oldShape);
  const oldRotation = piece.rotationIndex;
  const newRotation = (oldRotation + 1) % 4;
  const kickData = kicks[`${oldRotation}>${newRotation}`] || [[0, 0]];
  const oldX = piece.x;
  const oldY = piece.y;

  for (const [dx, dy] of kickData) {
    piece.shape = rotated;
    piece.x = oldX + dx;
    piece.y = oldY + dy;
    
    if (!checkCollisionAt(scene, piece.x, piece.y, piece.shape)) {
      piece.rotationIndex = newRotation;
      return true; // Rotation successful
    }
  }

  // If all kick tests failed, revert to original position and shape
  piece.shape = oldShape;
  piece.x = oldX;
  piece.y = oldY;
  piece.rotationIndex = oldRotation;
  return false; // Rotation failed
}

// Create a deep copy of a tetromino piece
export function clonePiece(piece) {
  return {
    shape: piece.shape.map(row => [...row]),
    x: piece.x,
    y: piece.y,
    type: piece.type,
    rotationIndex: piece.rotationIndex,
    blocks: [] // Blocks aren't cloned since they're visual elements
  };
}