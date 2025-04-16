// utils/spawn.js
import { GUTTER_WIDTH, TOWER_WIDTH, BUFFER_ROWS } from "./constants.js";
import { drawPiece } from "./draw.js";
import { dropPiece } from "./move.js";
import { getSpawnPosition } from "./tetrominoHelpers.js";

export function spawnTetromino(scene, TETROMINO_SHAPES) {
  const keys = Object.keys(TETROMINO_SHAPES);
  const shapeKey = keys[Math.floor(Math.random() * keys.length)];
  const shape = TETROMINO_SHAPES[shapeKey];
  
  // Use spawn position helper
  const spawnPos = getSpawnPosition(shape);
  
  scene.activePiece = {
    shape,
    blocks: [],
    x: spawnPos.x,
    y: spawnPos.y,
    type: shapeKey,
    rotationIndex: 0
  };
  
  drawPiece(scene);
  scene.fallTimer = scene.time.addEvent({ delay: 1000, callback: () => dropPiece(scene), loop: true });
}