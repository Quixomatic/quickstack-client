// utils/create.js
import { GRID_SIZE, BOARD_WIDTH, BOARD_HEIGHT, GUTTER_WIDTH, TOWER_WIDTH, BUFFER_ROWS, HISTORY_ROWS, VISIBLE_ROWS } from "./constants.js";

export function setupBoard(scene) {
  scene.abilities = [];
  scene.activePiece = null;
  scene.ghostBlocks = [];
  scene.lockedBlocks = scene.add.group();
  scene.board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
  scene.historyGrid = Array.from({ length: HISTORY_ROWS }, () => Array(BOARD_WIDTH).fill(0));
  scene.historyBlocks = scene.add.group();
  scene.adjacentTowers = {};
  scene.chargeLevel = 0;
  scene.lockReady = true;

  // Build foundation
  for (let i = GUTTER_WIDTH; i < GUTTER_WIDTH + TOWER_WIDTH; i++) {
    scene.board[BOARD_HEIGHT - HISTORY_ROWS - 1][i] = 1;
    const block = scene.add.image(i * GRID_SIZE, (BOARD_HEIGHT - HISTORY_ROWS - 1) * GRID_SIZE, "block").setOrigin(0);
    scene.lockedBlocks.add(block);
  }

  // Sidebar background panel
  scene.sidebar = scene.add.rectangle(
    GRID_SIZE * BOARD_WIDTH,
    0,
    200,
    GRID_SIZE * BOARD_HEIGHT,
    0x222222
  ).setOrigin(0, 0).setAlpha(0.85);

  const textStyle = {
    fontSize: "16px",
    fill: "#fff",
    wordWrap: { width: 180 },
    fixedWidth: 180
  };

  scene.scoreText = scene.add.text(GRID_SIZE * BOARD_WIDTH + 10, 10, "Score: 0", textStyle);
  scene.abilityText = scene.add.text(GRID_SIZE * BOARD_WIDTH + 10, 40, "Abilities: none", textStyle);
  scene.lockStatusText = scene.add.text(GRID_SIZE * BOARD_WIDTH + 10, 70, "Lock: Unavailable", textStyle);

  // Shade gutters
  scene.add.rectangle(0, 0, GRID_SIZE * GUTTER_WIDTH, GRID_SIZE * BOARD_HEIGHT, 0xffffff).setOrigin(0, 0).setAlpha(0.05);
  scene.add.rectangle(GRID_SIZE * (GUTTER_WIDTH + TOWER_WIDTH), 0, GRID_SIZE * GUTTER_WIDTH, GRID_SIZE * BOARD_HEIGHT, 0xffffff).setOrigin(0, 0).setAlpha(0.05);

  // Shade buffer zone
  scene.add.rectangle(0, 0, GRID_SIZE * BOARD_WIDTH, GRID_SIZE * BUFFER_ROWS, 0xffffff).setOrigin(0, 0).setAlpha(0.07);

  // Line to show foundation separation
  scene.add.rectangle(0, (BUFFER_ROWS + VISIBLE_ROWS) * GRID_SIZE, GRID_SIZE * BOARD_WIDTH, 2, 0xffffff)
    .setOrigin(0, 0).setAlpha(0.2);

  scene.abilityKeys = {
    1: "windGust",
    2: "earthShake",
    3: "gravityWell",
    4: "wobbleCurse",
    l: "lockNow"
  };

  scene.score = 0;
  scene.towerHeight = 0;
  scene.instability = 0;

  scene.cameras.main.setBounds(0, 0, scene.game.config.width, GRID_SIZE * BOARD_HEIGHT);
  scene.cameras.main.scrollY = 0;
}
