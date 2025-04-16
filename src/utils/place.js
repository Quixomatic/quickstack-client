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
import { isCellOccupied } from "./boardHelpers.js";
import { updateText } from "./uiHelpers.js";
import { animateBlockPlacement, animateScoreChange } from "./animHelpers.js";
import { sendRoomMessage } from "./networkHelpers.js";
import { checkTowerHeight } from "./towerHelpers.js";

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
          
          // Use animation helper
          animateBlockPlacement(scene, block);
        }
      }
    }
  }

  scene.towerHeight++;
  scene.score = scene.towerHeight * 10;
  updateText(scene.scoreText, scene.score, "Score: ");
  
  // Add score animation
  const centerX = (x + shape[0].length / 2) * GRID_SIZE;
  const centerY = (y + shape.length / 2) * GRID_SIZE;
  animateScoreChange(scene, 10, centerX, centerY);
  
  // Use network helper
  sendRoomMessage(scene.room, "blockPlaced", { x, y, shape });
  
  scene.clearActiveBlocks();
  scene.activePiece = null;
  if (scene.fallTimer) scene.fallTimer.remove(false);
  
  // Check tower height after locking a piece
  checkTowerHeight(scene);
  
  return true;
}