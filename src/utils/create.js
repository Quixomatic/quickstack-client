// utils/create.js
import { GRID_SIZE, BOARD_WIDTH, BOARD_HEIGHT, GUTTER_WIDTH, TOWER_WIDTH, BUFFER_ROWS, HISTORY_ROWS, VISIBLE_ROWS } from "./constants.js";
import { createEmptyBoard } from "./boardHelpers.js";
import { createTextStyle, createShadedRect } from "./uiHelpers.js";
import { cancelAutoLockCountdown } from "./towerHelpers.js";

export function setupBoard(scene) {
  scene.abilities = [];
  scene.activePiece = null;
  scene.ghostBlocks = [];
  scene.lockedBlocks = scene.add.group();
  scene.board = createEmptyBoard(BOARD_HEIGHT);
  scene.historyGrid = createEmptyBoard(HISTORY_ROWS);
  scene.historyBlocks = scene.add.group();
  scene.adjacentTowers = {};
  scene.chargeLevel = 0;
  scene.lockReady = true;
  
  // Add auto-lock variables
  scene.autoLockEnabled = true;
  scene.autoLockThreshold = 10; // Number of blocks from the top to trigger auto-lock
  scene.autoLockCountdown = 5; // Seconds before auto-locking
  scene.autoLockTimer = null;
  scene.autoLockWarning = null;

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

  // Create standard text style
  const textStyle = createTextStyle();

  // Create UI text elements
  scene.scoreText = scene.add.text(GRID_SIZE * BOARD_WIDTH + 10, 10, "Score: 0", textStyle);
  scene.abilityText = scene.add.text(GRID_SIZE * BOARD_WIDTH + 10, 40, "Abilities: none", textStyle);
  scene.lockStatusText = scene.add.text(GRID_SIZE * BOARD_WIDTH + 10, 70, "Lock: Unavailable", textStyle);
  
  // Add auto-lock toggle
  const autoLockToggle = scene.add.text(
    GRID_SIZE * BOARD_WIDTH + 10, 
    100, 
    "Auto-Lock: ON", 
    textStyle
  ).setInteractive();

  autoLockToggle.on('pointerdown', () => {
    scene.autoLockEnabled = !scene.autoLockEnabled;
    autoLockToggle.setText(`Auto-Lock: ${scene.autoLockEnabled ? 'ON' : 'OFF'}`);
    
    // Cancel any existing countdown if turned off
    if (!scene.autoLockEnabled && scene.autoLockTimer) {
      cancelAutoLockCountdown(scene);
    }
  });

  // Shade gutters
  createShadedRect(scene, 0, 0, GRID_SIZE * GUTTER_WIDTH, GRID_SIZE * BOARD_HEIGHT);
  createShadedRect(scene, GRID_SIZE * (GUTTER_WIDTH + TOWER_WIDTH), 0, GRID_SIZE * GUTTER_WIDTH, GRID_SIZE * BOARD_HEIGHT);

  // Shade buffer zone
  createShadedRect(scene, 0, 0, GRID_SIZE * BOARD_WIDTH, GRID_SIZE * BUFFER_ROWS, 0xffffff, 0.07);

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