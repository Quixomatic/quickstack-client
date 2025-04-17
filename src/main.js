// main.js
import Phaser from "phaser";
import { setupBoard } from "./utils/create.js";
import { lockTowerSection } from "./utils/lock.js";
import { updateAbilityText, updateSidebarText } from "./utils/ui.js";
import { spawnTetromino } from "./utils/spawn.js";
import { drawPiece, drawGhostPiece, clearActiveBlocks } from "./utils/draw.js";
import { movePiece, rotatePiece, dropPiece } from "./utils/move.js";
import { checkCollision, checkCollisionAt } from "./utils/collision.js";
import { lockPiece } from "./utils/place.js";
import { TETROMINO_SHAPES, JLSTZ_KICKS, GRID_SIZE, BOARD_WIDTH, BOARD_HEIGHT } from "./utils/constants.js";
import { shakeScreen, flashScreen } from "./utils/animHelpers.js";
import { createClient, joinRoom, setupMessageHandlers, sendRoomMessage, useAbility } from "./utils/networkHelpers.js";
import { checkTowerHeight } from "./utils/towerHelpers.js";
import { initializePreviewQueue } from "./utils/pieceHelpers.js";

let client, room;

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("block", "./assets/block-v1.png");
  }

  async create() {
    setupBoard(this);
    this.kicks = JLSTZ_KICKS;
    
    // Setup networking
    client = createClient();
    room = await joinRoom(client, "normal", { userId: "u123", username: "PlayerOne" });
    this.room = room;
    
    // Setup message handlers
    setupMessageHandlers(room, this, TETROMINO_SHAPES);
    
    // Initialize preview queue
    initializePreviewQueue(this, TETROMINO_SHAPES, this.previewSize);

    this.input.keyboard.on("keydown", (event) => {
      const ability = this.abilityKeys[event.key];
      if (ability === "lockNow" && this.lockReady) {
        lockTowerSection(this);
        // lockReady will be set to false by resetCharge
        updateSidebarText(this);
        return;
      }
      if (ability && this.abilities.includes(ability)) {
        // Use ability helper instead of inline code
        useAbility(this, ability);
        updateAbilityText(this);
      }
      if (!this.activePiece) return;

      if (event.key === "ArrowLeft" || event.key === "a") movePiece(this, -1);
      else if (event.key === "ArrowRight" || event.key === "d") movePiece(this, 1);
      else if (event.key === "ArrowDown" || event.key === "s") dropPiece(this);
      else if (event.key === "ArrowUp" || event.key === "w") rotatePiece(this);
      else if (event.key === " ") {
        let dropY = this.activePiece.y;
        while (!checkCollisionAt(this, this.activePiece.x, dropY + 1, this.activePiece.shape)) dropY++;
        this.activePiece.y = dropY;
        drawPiece(this);
        const locked = lockPiece(this);
        if (locked) spawnTetromino(this, TETROMINO_SHAPES);
      }
    });

    this.time.delayedCall(3000, () => {
      //this.abilities.push("windGust", "earthShake");
      updateAbilityText(this);
      updateSidebarText(this);
    });
  }
  
  // Add update method to continuously check tower height
  update() {
    // Check tower height periodically
    if (this.activePiece) {
      checkTowerHeight(this);
    }
  }

  checkCollision() {
    return checkCollision(this);
  }

  checkCollisionAt(x, y, shape) {
    return checkCollisionAt(this, x, y, shape);
  }

  clearActiveBlocks() {
    clearActiveBlocks(this);
  }

  drawGhostPiece() {
    drawGhostPiece(this);
  }

  drawPiece() {
    drawPiece(this);
  }

  lockPiece() {
    return lockPiece(this);
  }

  spawnTetromino() {
    spawnTetromino(this, TETROMINO_SHAPES);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GRID_SIZE * BOARD_WIDTH + 200,
  height: GRID_SIZE * BOARD_HEIGHT,
  backgroundColor: "#1e1e1e",
  scene: [GameScene]
};

const game = new Phaser.Game(config);