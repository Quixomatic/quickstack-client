// utils/place.js
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  GUTTER_WIDTH,
  TOWER_WIDTH,
  GRID_SIZE,
  CUT_OFF_ROW,
  BUFFER_ROWS,
  VISIBLE_ROWS,
} from "./constants.js";

export function lockPiece(scene) {
  const { shape, x, y } = scene.activePiece;
  let towerContact = 0;
  let gutterFloorContact = 0;

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const newX = x + col;
      const newY = y + row;
      const inTower = newX >= GUTTER_WIDTH && newX < GUTTER_WIDTH + TOWER_WIDTH;
      const atFloor = newY === BOARD_HEIGHT - 1;
      const inGutter =
        newX < GUTTER_WIDTH || newX >= GUTTER_WIDTH + TOWER_WIDTH;

      if (inTower) {
        towerContact++;
      } else if (inGutter && atFloor) {
        gutterFloorContact++;
      }
    }
  }

  if (towerContact === 0 && gutterFloorContact > 0) {
    scene.clearActiveBlocks();
    scene.activePiece = null;
    if (scene.fallTimer) scene.fallTimer.remove(false);
    scene.spawnTetromino();
    return false;
  }

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const newX = x + col;
        const newY = y + row;
        if (newY >= 0 && newY < BOARD_HEIGHT) {
          if (newY >= CUT_OFF_ROW) {
            const historyY = newY - (BUFFER_ROWS + VISIBLE_ROWS);
            scene.historyGrid[historyY][newX] = 1;
          } else {
            scene.board[newY][newX] = 1;
          }
          const block = scene.add
            .image(newX * GRID_SIZE, newY * GRID_SIZE, "block")
            .setOrigin(0);
          scene.lockedBlocks.add(block);
          scene.tweens.add({
            targets: block,
            scale: { from: 1.3, to: 1 },
            duration: 200,
            ease: "Back",
          });
        }
      }
    }
  }

  scene.towerHeight++;
  scene.score = scene.towerHeight * 10;
  scene.scoreText.setText("Score: " + scene.score);
  scene.room.send("blockPlaced", { x, y, shape });
  scene.clearActiveBlocks();
  scene.activePiece = null;
  if (scene.fallTimer) scene.fallTimer.remove(false);
  return true;
}
