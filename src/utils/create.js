// utils/create.js
import { GRID_SIZE, BOARD_WIDTH, BOARD_HEIGHT, GUTTER_WIDTH, TOWER_WIDTH, BUFFER_ROWS, HISTORY_ROWS, VISIBLE_ROWS } from "./constants.js";
import { createEmptyBoard } from "./boardHelpers.js";
import { createTextStyle, createShadedRect } from "./uiHelpers.js";
import { cancelAutoLockCountdown } from "./towerHelpers.js";
import { renderDebugOverlay } from "./instabilityHelpers.js";

export function setupBoard(scene) {
  scene.abilities = [];
  scene.activePiece = null;
  scene.ghostBlocks = [];
  scene.lockedBlocks = scene.add.group();
  scene.board = createEmptyBoard(BOARD_HEIGHT);
  scene.historyGrid = createEmptyBoard(HISTORY_ROWS);
  scene.historyBlocks = scene.add.group();
  scene.adjacentTowers = {};
  
  // Update charge-related variables
  scene.chargeLevel = 0;
  scene.maxChargeLevel = 100;
  scene.chargeMeter = null;
  scene.chargeText = null;
  scene.lockReady = false; // Start with lock not ready
  
  // Add stability-related variables
  scene.instability = 0;
  scene.externalInstability = 0;
  scene.isShaking = false;
  scene.isCollapsing = false;
  scene.cellStability = null; // Will be initialized on first piece placement
  scene.rowStability = null; // Will be initialized on first piece placement
  scene.historicalStability = 100; // Start with perfect historical stability
  scene.lockedSectionCount = 0; // Initialize locked section counter
  scene.rawSectionStability = 100; // Raw stability of current section
  
  // Add debug mode variables
  scene.debugMode = false; // Start with debug off
  scene.debugGraphics = null; // Will hold debug visualization
  scene.debugText = []; // Will hold debug text objects
  
  // Add auto-lock variables
  scene.autoLockEnabled = true;
  scene.autoLockThreshold = 10; // Number of blocks from the top to trigger auto-lock
  scene.autoLockCountdown = 5; // Seconds before auto-locking
  scene.autoLockTimer = null;
  scene.autoLockWarning = null;
  
  // Add piece preview queue
  scene.previewQueue = [];
  scene.previewBlocks = scene.add.group();
  scene.previewSize = 3; // Number of pieces to show in preview
  
  // Add level and scoring related variables
  scene.level = 0;
  scene.linesCleared = 0;
  scene.score = 0;
  scene.towerHeight = 0;

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
  scene.lockStatusText = scene.add.text(GRID_SIZE * BOARD_WIDTH + 10, 70, "Lock: Charging...", textStyle);
  
  // Add stability text display
  scene.instabilityText = scene.add.text(
    GRID_SIZE * BOARD_WIDTH + 10, 
    440, 
    "Stability: 100%", 
    textStyle
  );
  
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
  
  // Add level text display to sidebar
  scene.levelText = scene.add.text(
    GRID_SIZE * BOARD_WIDTH + 10, 
    380, 
    "Level: 0", 
    textStyle
  );
  
  // Add lines cleared counter
  scene.linesText = scene.add.text(
    GRID_SIZE * BOARD_WIDTH + 10, 
    410, 
    "Lines: 0", 
    textStyle
  );
  
  // Add preview queue label to sidebar
  const previewLabel = scene.add.text(
    GRID_SIZE * BOARD_WIDTH + 10, 
    130, 
    "Next Pieces:", 
    textStyle
  );
  
  // Add charge meter to sidebar
  const chargeLabel = scene.add.text(
    GRID_SIZE * BOARD_WIDTH + 10, 
    350, 
    "Lock Charge:", 
    textStyle
  );
  
  // Create the empty charge meter background
  scene.add.rectangle(
    GRID_SIZE * BOARD_WIDTH + 10,
    380,
    180,
    20,
    0x333333
  ).setOrigin(0, 0);
  
  // Create the charge meter fill (starts empty)
  scene.chargeMeter = scene.add.rectangle(
    GRID_SIZE * BOARD_WIDTH + 10,
    380,
    0, // Width will be updated based on charge level
    20,
    0x00ff00
  ).setOrigin(0, 0);
  
  // Charge level text
  scene.chargeText = scene.add.text(
    GRID_SIZE * BOARD_WIDTH + 100,
    380,
    "0%",
    { fontSize: "14px", fill: "#fff" }
  ).setOrigin(0.5, 0);

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

  scene.cameras.main.setBounds(0, 0, scene.game.config.width, GRID_SIZE * BOARD_HEIGHT);
  scene.cameras.main.scrollY = 0;
  
  // Add debug mode toggle (G key)
  scene.input.keyboard.on('keydown-G', () => {
    scene.debugMode = !scene.debugMode;
    
    // Remove previous debug graphics if any
    if (scene.debugGraphics) {
      scene.debugGraphics.clear();
      scene.debugText.forEach(text => text.destroy());
      scene.debugText = [];
    }
    
    // Create new debug graphics if enabling
    if (scene.debugMode) {
      scene.debugGraphics = scene.add.graphics();
      // Initial render of debug overlay
      renderDebugOverlay(scene);
    }
  });
}