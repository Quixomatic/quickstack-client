// utils/pieceHelpers.js
import { GRID_SIZE, BOARD_WIDTH } from "./constants.js";
import { renderBlocks } from "./tetrominoHelpers.js";

// Generate a random piece type
export function getRandomPieceType(TETROMINO_SHAPES) {
  const keys = Object.keys(TETROMINO_SHAPES);
  return keys[Math.floor(Math.random() * keys.length)];
}

// Initialize the preview queue with random pieces
export function initializePreviewQueue(scene, TETROMINO_SHAPES, count) {
  scene.previewQueue = [];
  for (let i = 0; i < count; i++) {
    scene.previewQueue.push(getRandomPieceType(TETROMINO_SHAPES));
  }
  renderPreviewQueue(scene, TETROMINO_SHAPES);
}

// Add a new piece to the preview queue
export function addToPreviewQueue(scene, TETROMINO_SHAPES) {
  scene.previewQueue.push(getRandomPieceType(TETROMINO_SHAPES));
  renderPreviewQueue(scene, TETROMINO_SHAPES);
}

// Get the next piece from the queue and add a new one
export function getNextPiece(scene, TETROMINO_SHAPES) {
  if (scene.previewQueue.length === 0) {
    initializePreviewQueue(scene, TETROMINO_SHAPES, scene.previewSize);
  }
  
  const nextPieceType = scene.previewQueue.shift();
  addToPreviewQueue(scene, TETROMINO_SHAPES);
  
  return {
    type: nextPieceType,
    shape: TETROMINO_SHAPES[nextPieceType]
  };
}

// Render the preview queue in the sidebar
export function renderPreviewQueue(scene, TETROMINO_SHAPES) {
  // Clear existing preview blocks
  scene.previewBlocks.clear(true, true);
  
  // Render each piece in the queue
  const startX = BOARD_WIDTH * GRID_SIZE + 30;
  let startY = 160;
  
  scene.previewQueue.forEach((pieceType, index) => {
    const shape = TETROMINO_SHAPES[pieceType];
    const scale = 0.8; // Slightly smaller than regular pieces
    
    // Calculate center position for the piece
    const pieceWidth = shape[0].length * GRID_SIZE * scale;
    const pieceHeight = shape.length * GRID_SIZE * scale;
    const centerX = startX + 70 - pieceWidth / 2;
    
    // Render the piece
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[0].length; col++) {
        if (shape[row][col]) {
          const block = scene.add.image(
            centerX + col * GRID_SIZE * scale,
            startY + row * GRID_SIZE * scale,
            "block"
          ).setOrigin(0, 0).setScale(scale);
          
          scene.previewBlocks.add(block);
        }
      }
    }
    
    // Move down for the next piece in queue
    startY += pieceHeight + 20;
  });
}