// utils/spawn.js
import { GUTTER_WIDTH, TOWER_WIDTH, BUFFER_ROWS } from "./constants.js";
import { drawPiece } from "./draw.js";
import { dropPiece } from "./move.js";
import { getSpawnPosition } from "./tetrominoHelpers.js";
import { getNextPiece } from "./pieceHelpers.js";
import { getDropSpeed } from "./levelHelpers.js";

export function spawnTetromino(scene, TETROMINO_SHAPES) {
  // Get the next piece from the queue
  const { type, shape } = getNextPiece(scene, TETROMINO_SHAPES);
  
  // Use spawn position helper
  const spawnPos = getSpawnPosition(shape);
  
  scene.activePiece = {
    shape,
    blocks: [],
    x: spawnPos.x,
    y: spawnPos.y,
    type,
    rotationIndex: 0
  };
  
  drawPiece(scene);
  
  // Calculate drop speed based on current level
  const dropSpeed = getDropSpeed(scene.level);
  
  scene.fallTimer = scene.time.addEvent({ 
    delay: dropSpeed, 
    callback: () => dropPiece(scene), 
    loop: true 
  });
}