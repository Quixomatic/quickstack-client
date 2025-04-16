// main.js
import Phaser from "phaser";
import * as Colyseus from "colyseus.js";
import { setupBoard } from "./utils/create.js";
import { lockTowerSection } from "./utils/lock.js";
import { updateAbilityText, updateSidebarText } from "./utils/ui.js";
import { spawnTetromino } from "./utils/spawn.js";
import { drawPiece, drawGhostPiece, clearActiveBlocks } from "./utils/draw.js";
import { movePiece, rotatePiece, dropPiece } from "./utils/move.js";
import { checkCollision, checkCollisionAt } from "./utils/collision.js";
import { lockPiece } from "./utils/place.js";
import { TETROMINO_SHAPES, JLSTZ_KICKS, GRID_SIZE, BOARD_WIDTH, BOARD_HEIGHT } from "./utils/constants.js";

let client = new Colyseus.Client("ws://localhost:2567");
let room;

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("block", "./assets/block.png");
  }

  async create() {
    setupBoard(this);
    this.kicks = JLSTZ_KICKS;
    room = await client.joinOrCreate("normal", { userId: "u123", username: "PlayerOne" });
    this.room = room;

    room.onMessage("gameStart", () => spawnTetromino(this, TETROMINO_SHAPES));
    room.onMessage("incomingAttack", () => {
      this.instability += 10;
      this.cameras.main.shake(300);
      this.cameras.main.flash(300, 255, 0, 0);
    });
    room.onMessage("adjacentTowerUpdate", ({ from, towerHeight, instability }) => {
      if (!this.adjacentTowers[from]) {
        this.adjacentTowers[from] = this.add.group();
      }
      const tower = this.adjacentTowers[from];
      tower.clear(true, true);
      for (let i = 0; i < towerHeight; i++) {
        const block = this.add.image(250 + Object.keys(this.adjacentTowers).indexOf(from) * 60, 580 - i * 20, "block").setScale(0.5);
        tower.add(block);
        if (instability > 20) block.setTint(0xff5555);
      }
    });

    this.input.keyboard.on("keydown", (event) => {
      const ability = this.abilityKeys[event.key];
      if (ability === "lockNow" && this.lockReady) {
        lockTowerSection(this);
        this.lockReady = false;
        updateSidebarText(this);
        return;
      }
      if (ability && this.abilities.includes(ability)) {
        this.room.send("useAbility", { type: ability });
        this.abilities = this.abilities.filter(a => a !== ability);
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
      this.abilities.push("windGust", "earthShake");
      updateAbilityText(this);
      updateSidebarText(this);
    });
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
