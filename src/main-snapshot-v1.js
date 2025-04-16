// client/src/main.js
import Phaser from "phaser";
import * as Colyseus from "colyseus.js";

let client = new Colyseus.Client("ws://localhost:2567");
let room;

const GRID_SIZE = 20;
const GUTTER_WIDTH = 4;
const TOWER_WIDTH = 10;
const BOARD_WIDTH = TOWER_WIDTH + 2 * GUTTER_WIDTH;

const BUFFER_ROWS = 4;
const VISIBLE_ROWS = 30;
const HISTORY_ROWS = 30;
const BOARD_HEIGHT = BUFFER_ROWS + VISIBLE_ROWS + HISTORY_ROWS;
const CUT_OFF_ROW = BOARD_HEIGHT - HISTORY_ROWS;

const TETROMINO_SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const JLSTZ_KICKS = {
  "0>1": [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
  "1>0": [[0,0], [1,0], [1,-1], [0,2], [1,2]],
  "1>2": [[0,0], [1,0], [1,-1], [0,2], [1,2]],
  "2>1": [[0,0], [-1,0], [-1,1], [0,-2], [-1,-2]],
  "2>3": [[0,0], [1,0], [1,1], [0,-2], [1,-2]],
  "3>2": [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
  "3>0": [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]],
  "0>3": [[0,0], [1,0], [1,1], [0,-2], [1,-2]]
};

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("block", "./assets/block.png");
  }

  async create() {
    this.abilities = [];
    this.activePiece = null;
    this.ghostBlocks = [];
    this.lockedBlocks = this.add.group();
    this.board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
    this.historyGrid = Array.from({ length: HISTORY_ROWS }, () => Array(BOARD_WIDTH).fill(0));
    this.historyBlocks = this.add.group();
    this.adjacentTowers = {};
    this.chargeLevel = 0;
    this.lockReady = true;

    // Build foundation
    for (let i = GUTTER_WIDTH; i < GUTTER_WIDTH + TOWER_WIDTH; i++) {
      this.board[BOARD_HEIGHT - HISTORY_ROWS - 1][i] = 1;
      const block = this.add.image(i * GRID_SIZE, (BOARD_HEIGHT - HISTORY_ROWS - 1) * GRID_SIZE, "block").setOrigin(0);
      this.lockedBlocks.add(block);
    }

    this.sidebar = this.add.rectangle(GRID_SIZE * BOARD_WIDTH, 0, 200, GRID_SIZE * BOARD_HEIGHT, 0x222222)
      .setOrigin(0, 0).setAlpha(0.85);

    // Shade gutters
    this.add.rectangle(0, 0, GRID_SIZE * GUTTER_WIDTH, GRID_SIZE * BOARD_HEIGHT, 0xffffff).setOrigin(0, 0).setAlpha(0.05);
    this.add.rectangle(GRID_SIZE * (GUTTER_WIDTH + TOWER_WIDTH), 0, GRID_SIZE * GUTTER_WIDTH, GRID_SIZE * BOARD_HEIGHT, 0xffffff).setOrigin(0, 0).setAlpha(0.05);

    // Shade buffer zone
    this.add.rectangle(0, 0, GRID_SIZE * BOARD_WIDTH, GRID_SIZE * BUFFER_ROWS, 0xffffff).setOrigin(0, 0).setAlpha(0.07);

    // Line to show foundation separation
    this.add.rectangle(0, (BUFFER_ROWS + VISIBLE_ROWS) * GRID_SIZE, GRID_SIZE * BOARD_WIDTH, 2, 0xffffff)
      .setOrigin(0, 0).setAlpha(0.2);

    this.abilityKeys = {
      1: "windGust",
      2: "earthShake",
      3: "gravityWell",
      4: "wobbleCurse",
      l: "lockNow"
    };

    this.score = 0;
    this.towerHeight = 0;
    this.instability = 0;
    this.scoreText = this.add.text(GRID_SIZE * BOARD_WIDTH + 10, 10, "Score: 0", { fontSize: "16px", fill: "#fff" });
    this.abilityText = this.add.text(GRID_SIZE * BOARD_WIDTH + 10, 30, "Abilities: none", { fontSize: "16px", fill: "#fff" });

    this.cameras.main.setBounds(0, 0, this.game.config.width, GRID_SIZE * BOARD_HEIGHT);
    this.cameras.main.scrollY = 0;

    room = await client.joinOrCreate("normal", { userId: "u123", username: "PlayerOne" });

    room.onMessage("gameStart", () => this.spawnTetromino());
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
        const block = this.add.image(250 + Object.keys(this.adjacentTowers).indexOf(from) * 60, 580 - i * GRID_SIZE, "block").setScale(0.5);
        tower.add(block);
        if (instability > 20) block.setTint(0xff5555);
      }
    });

    this.input.keyboard.on("keydown", (event) => {
      const ability = this.abilityKeys[event.key];
      if (ability === "lockNow" && this.lockReady) {
        this.lockTowerSection();
        this.lockReady = true;
        return;
      }
      if (ability && this.abilities.includes(ability)) {
        room.send("useAbility", { type: ability });
        this.abilities = this.abilities.filter(a => a !== ability);
        this.updateAbilityText();
      }
      if (!this.activePiece) return;

      if (event.key === "ArrowLeft" || event.key === "a") this.movePiece(-1);
      else if (event.key === "ArrowRight" || event.key === "d") this.movePiece(1);
      else if (event.key === "ArrowDown" || event.key === "s") this.dropPiece();
      else if (event.key === "ArrowUp" || event.key === "w") this.rotatePiece();
      else if (event.key === " ") {
        let dropY = this.activePiece.y;
        while (!this.checkCollisionAt(this.activePiece.x, dropY + 1, this.activePiece.shape)) {
          dropY++;
        }
        this.activePiece.y = dropY;
        this.drawPiece();
        const locked = this.lockPiece();
        if (locked) this.spawnTetromino();
      }
    });

    this.time.delayedCall(3000, () => {
      this.abilities.push("windGust", "earthShake");
      this.updateAbilityText();
    });
  }

  lockTowerSection() {
    // Find topmost filled row
    let topRow = 0;
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (this.board[y].indexOf(1) != -1) {
        topRow = y;
        break;
      }
    }

    // Move rows up to topRow - 1 into history
    const newHistoryRows = [];

    for (let y = topRow; y < CUT_OFF_ROW; y++) {
      newHistoryRows.push([...this.board[y]]);
    }

    this.historyGrid = [...newHistoryRows, ...this.historyGrid].slice(0, HISTORY_ROWS);

    // Clear board and set topRow as new foundation
    const newBaseY = BOARD_HEIGHT - HISTORY_ROWS - 1;
    this.board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      this.board[newBaseY][x] = 1;
    }

    // Re-render
    this.lockedBlocks.clear(true, true);
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (this.board[y][x]) {
          const block = this.add.image(x * GRID_SIZE, y * GRID_SIZE, "block").setOrigin(0);
          this.lockedBlocks.add(block);
        }
      }
    }

    this.historyBlocks.clear(true, true);
    const baseY = BUFFER_ROWS + VISIBLE_ROWS;

    const visibleRows = this.historyGrid.filter(row => row.some(cell => cell !== 0));

    for (let y = 0; y < visibleRows.length; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (visibleRows[y][x]) {
          const block = this.add.image(
            x * GRID_SIZE,
            (baseY + y) * GRID_SIZE,
            "block"
          ).setOrigin(0).setAlpha(0.5);
          this.historyBlocks.add(block);
        }
      }
    }
  }

  updateAbilityText() {
    this.abilityText.setText(`Abilities: ${this.abilities.join(", ") || "none"}`);
  }

  spawnTetromino() {
    const keys = Object.keys(TETROMINO_SHAPES);
    const shapeKey = keys[Math.floor(Math.random() * keys.length)];
    const shape = TETROMINO_SHAPES[shapeKey];
    this.activePiece = {
      shape,
      blocks: [],
      x: GUTTER_WIDTH + Math.floor((TOWER_WIDTH - shape[0].length) / 2),
      y: BUFFER_ROWS - shape.length,
      type: shapeKey,
      rotationIndex: 0
    };
    this.drawPiece();
    this.fallTimer = this.time.addEvent({ delay: 1000, callback: () => this.dropPiece(), loop: true });
  }


  drawGhostPiece() {
    this.ghostBlocks.forEach(b => b.destroy());
    this.ghostBlocks = [];
    if (!this.activePiece) return;
    const { shape, x } = this.activePiece;
    let ghostY = this.activePiece.y;
    while (!this.checkCollisionAt(x, ghostY + 1, shape)) ghostY++;
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const block = this.add.image((x + col) * GRID_SIZE, (ghostY + row) * GRID_SIZE, "block").setOrigin(0).setAlpha(0.3);
          this.ghostBlocks.push(block);
        }
      }
    }
  }

  drawPiece() {
    this.clearActiveBlocks();
    const { shape, x, y } = this.activePiece;
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const block = this.add.image((x + col) * GRID_SIZE, (y + row) * GRID_SIZE, "block").setOrigin(0);
          this.activePiece.blocks.push(block);
        }
      }
    }
    this.drawGhostPiece();
  }

  clearActiveBlocks() {
    this.ghostBlocks.forEach(b => b.destroy());
    if (this.activePiece?.blocks?.length) {
      this.activePiece.blocks.forEach(b => b.destroy());
      this.activePiece.blocks = [];
    }
  }

  movePiece(dx) {
    this.activePiece.x += dx;
    if (this.checkCollision()) this.activePiece.x -= dx;
    else this.drawPiece();
  }

  rotatePiece() {
    const shape = this.activePiece.shape;
    const rotated = shape[0].map((_, i) => shape.map(row => row[i]).reverse());
    const oldRotation = this.activePiece.rotationIndex;
    const newRotation = (oldRotation + 1) % 4;
    const kicks = JLSTZ_KICKS[`${oldRotation}>${newRotation}`] || [[0, 0]];
    const oldX = this.activePiece.x;
    const oldY = this.activePiece.y;

    for (const [dx, dy] of kicks) {
      this.activePiece.shape = rotated;
      this.activePiece.x = oldX + dx;
      this.activePiece.y = oldY + dy;
      if (!this.checkCollision()) {
        this.activePiece.rotationIndex = newRotation;
        this.drawPiece();
        return;
      }
    }

    this.activePiece.shape = shape;
    this.activePiece.x = oldX;
    this.activePiece.y = oldY;
    this.activePiece.rotationIndex = oldRotation;
  }

  dropPiece() {
    this.activePiece.y++;
    if (this.checkCollision()) {
      this.activePiece.y--;
      const locked = this.lockPiece();
      if (locked) this.spawnTetromino();
    } else {
      this.drawPiece();
    }
  }

  checkCollision() {
    return this.checkCollisionAt(this.activePiece.x, this.activePiece.y, this.activePiece.shape);
  }

  checkCollisionAt(x, y, shape) {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (!shape[row][col]) continue;
        const newX = x + col;
        const newY = y + row;
        if (newX < 0 || newX >= BOARD_WIDTH || newY < 0 || newY >= BOARD_HEIGHT) return true;
        if (this.board[newY][newX]) return true;
      }
    }
    return false;
  }

  lockPiece() {
    const { shape, x, y } = this.activePiece;
    let towerContact = 0;
    let gutterFloorContact = 0;

    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (!shape[row][col]) continue;
        const newX = x + col;
        const newY = y + row;
        const inTower = newX >= GUTTER_WIDTH && newX < GUTTER_WIDTH + TOWER_WIDTH;
        const atFloor = newY === BOARD_HEIGHT - 1;
        const inGutter = newX < GUTTER_WIDTH || newX >= GUTTER_WIDTH + TOWER_WIDTH;

        if (inTower) {
          towerContact++;
        } else if (inGutter && atFloor) {
          gutterFloorContact++;
        }
      }
    }

    if (towerContact === 0 && gutterFloorContact > 0) {
      this.clearActiveBlocks();
      this.activePiece = null;
      if (this.fallTimer) this.fallTimer.remove(false);
      this.spawnTetromino();
      return false;
    }

    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const newX = x + col;
          const newY = y + row;
          if (newY >= 0 && newY < BOARD_HEIGHT) {
            this.board[newY][newX] = 1;
            const block = this.add.image(newX * GRID_SIZE, newY * GRID_SIZE, "block").setOrigin(0);
            this.lockedBlocks.add(block);
            this.tweens.add({ targets: block, scale: { from: 1.3, to: 1 }, duration: 200, ease: "Back" });
          }
        }
      }
    }

    this.towerHeight++;
    this.score = this.towerHeight * 10;
    this.scoreText.setText("Score: " + this.score);
    room.send("blockPlaced", { x, y, shape });
    this.clearActiveBlocks();
    this.activePiece = null;
    if (this.fallTimer) this.fallTimer.remove(false);
    return true;
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
