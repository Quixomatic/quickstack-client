// utils/spawn.js
import { GUTTER_WIDTH, TOWER_WIDTH, BUFFER_ROWS } from "./constants.js";
import { drawPiece } from "./draw.js";
import { dropPiece } from "./move.js";

export function spawnTetromino(scene, TETROMINO_SHAPES) {
  const keys = Object.keys(TETROMINO_SHAPES);
  const shapeKey = keys[Math.floor(Math.random() * keys.length)];
  const shape = TETROMINO_SHAPES[shapeKey];
  scene.activePiece = {
    shape,
    blocks: [],
    x: GUTTER_WIDTH + Math.floor((TOWER_WIDTH - shape[0].length) / 2),
    y: BUFFER_ROWS - shape.length,
    type: shapeKey,
    rotationIndex: 0
  };
  drawPiece(scene);
  scene.fallTimer = scene.time.addEvent({ delay: 1000, callback: () => dropPiece(scene), loop: true });
}
