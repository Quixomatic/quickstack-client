// stability/stabilityEffects.js
import { GRID_SIZE, GUTTER_WIDTH, TOWER_WIDTH } from "../constants.js";
import { findTopRow } from "../boardHelpers.js";
import { shakeScreen, flashScreen } from "../animHelpers.js";
import { sendRoomMessage } from "../networkHelpers.js";
import { renderDebugOverlay } from "./debugVisualization.js";
import { updateStabilityAfterPlacement } from "./instabilityCore.js";

/**
 * Update stability visuals and effects
 * @param {object} scene - The game scene
 */
export function updateStabilityEffects(scene) {
  const instability = scene.instability;

  // Calculate stability percentage (inverse of instability)
  const stabilityPercentage = Math.max(0, 100 - Math.floor(instability));

  // For UI display, use the raw section stability if available
  const displayStability =
    scene.rawSectionStability !== undefined
      ? Math.floor(scene.rawSectionStability)
      : stabilityPercentage;

  // Update stability text
  if (scene.instabilityText) {
    scene.instabilityText.setText(`Stability: ${displayStability}%`);

    // Update text color
    scene.instabilityText.setColor(getStabilityTextColor(displayStability));
  }

  // Visual effect: Tint blocks based on cell stability
  if (scene.cellStability) {
    scene.lockedBlocks.getChildren().forEach((block) => {
      const gridX = Math.floor(block.x / GRID_SIZE);
      const gridY = Math.floor(block.y / GRID_SIZE);

      // Use cell stability if available for precise tinting
      if (
        gridY < scene.cellStability.length &&
        gridX < scene.cellStability[0].length
      ) {
        const cellStability = scene.cellStability[gridY][gridX];
        block.setTint(getStabilityTint(cellStability));
      } else {
        // Fallback to overall stability
        block.setTint(getStabilityTint(stabilityPercentage / 100));
      }
    });
  } else {
    // Fallback if cell stability isn't available
    scene.lockedBlocks.getChildren().forEach((block) => {
      block.setTint(getStabilityTint(stabilityPercentage / 100));
    });
  }

  // Shake effect based on instability (subtle)
  if (instability > 50 && !scene.isShaking) {
    const intensity = Math.min(0.005, instability * 0.0001);
    shakeScreen(scene, 500, intensity);
    scene.time.delayedCall(1000, () => {
      scene.isShaking = false;
    });
    scene.isShaking = true;
  }

  // Check for different collapse levels
  if (instability >= 80 && !scene.isCollapsing) {
    // Critical instability - full tower collapse
    initiateFullCollapse(scene);
  } else if (instability >= 60 && !scene.isCollapsing) {
    // Severe instability - partial collapse from the top
    initiatePartialCollapse(scene);
  }

  // Update debug overlay if in debug mode
  if (scene.debugMode) {
    renderDebugOverlay(scene);
  }
}

/**
 * Get color tint based on cell stability
 * @param {number} stability - Cell stability value (0-1)
 * @returns {number} - Color tint for the block
 */
export function getStabilityTint(stability) {
  if (stability > 0.85) {
    return 0x4488ff; // Very stable - blue
  } else if (stability > 0.7) {
    return 0x99ff99; // Stable - green
  } else if (stability > 0.5) {
    return 0xffffaa; // Moderately stable - yellow
  } else if (stability > 0.3) {
    return 0xffaa66; // Unstable - orange
  } else {
    return 0xff4444; // Very unstable - red
  }
}

/**
 * Get text color based on stability percentage
 * @param {number} stability - Stability percentage (0-100)
 * @returns {string} - Hex color string
 */
export function getStabilityTextColor(stability) {
  if (stability > 85) {
    return "#4488ff"; // Blue
  } else if (stability > 70) {
    return "#99ff99"; // Green
  } else if (stability > 50) {
    return "#ffffaa"; // Yellow
  } else if (stability > 30) {
    return "#ffaa66"; // Orange
  } else {
    return "#ff4444"; // Red
  }
}

/**
 * Initiate full tower collapse when stability is too low
 * @param {object} scene - The game scene
 */
export function initiateFullCollapse(scene) {
  // Set collapse flag
  scene.isCollapsing = true;

  // Cancel any active piece movement
  if (scene.fallTimer) scene.fallTimer.remove();
  if (scene.activePiece) {
    scene.clearActiveBlocks();
    scene.activePiece = null;
  }

  // Visual and audio effects for collapse
  flashScreen(scene, 500, 0xff0000);
  shakeScreen(scene, 1000, 0.01);

  // Find how many rows to collapse based on instability
  const collapseRows = Math.min(
    10,
    Math.max(1, Math.floor(scene.instability / 10))
  );

  // Apply large score penalty for full collapse
  const scorePenalty = Math.min(scene.score, 500);
  scene.score = Math.max(0, scene.score - scorePenalty);

  // Update score text
  if (scene.scoreText) {
    scene.scoreText.setText("Score: " + scene.score);
  }

  // Show penalty message
  if (scorePenalty > 0) {
    const penaltyText = scene.add
      .text(
        scene.game.config.width / 2,
        150,
        `TOWER COLLAPSE! -${scorePenalty} POINTS`,
        {
          fontSize: "24px",
          fill: "#ff0000",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5);

    scene.tweens.add({
      targets: penaltyText,
      y: 100,
      alpha: 0,
      duration: 2000,
      onComplete: () => penaltyText.destroy(),
    });
  }

  // Animation for collapse
  animateCollapse(scene, collapseRows, () => {
    // After collapse finishes
    scene.isCollapsing = false;

    // Reduce instability after collapse
    scene.instability = Math.max(0, scene.instability - 50);

    // Optional: Notify other players of the collapse
    if (scene.room) {
      sendRoomMessage(scene.room, "towerCollapse", {
        rows: collapseRows,
        newInstability: scene.instability,
        penalty: scorePenalty,
      });
    }

    // Spawn a new piece if there isn't one
    if (!scene.activePiece) {
      scene.time.delayedCall(500, () => {
        scene.spawnTetromino();
      });
    }
  });
}

/**
 * Initiate a partial collapse of the tower (just the top portion)
 * @param {object} scene - The game scene
 */
export function initiatePartialCollapse(scene) {
  // Set collapse flag
  scene.isCollapsing = true;

  // Cancel any active piece movement
  if (scene.fallTimer) scene.fallTimer.remove();
  if (scene.activePiece) {
    scene.clearActiveBlocks();
    scene.activePiece = null;
  }

  // Visual and audio effects for collapse (less intense than full collapse)
  flashScreen(scene, 300, 0xff6600);
  shakeScreen(scene, 500, 0.005);

  // Find the top row of the tower
  const topRow = findTopRow(scene.board);
  if (topRow === -1) {
    scene.isCollapsing = false;
    return;
  }

  // Calculate how many rows to collapse based on instability
  // For partial collapse, use fewer rows than full collapse
  const rowsToCollapse = Math.max(
    1,
    Math.min(5, Math.floor((scene.instability - 60) / 5))
  );

  // Apply moderate score penalty for partial collapse
  const scorePenalty = Math.min(scene.score, rowsToCollapse * 50);
  scene.score = Math.max(0, scene.score - scorePenalty);

  // Update score text
  if (scene.scoreText) {
    scene.scoreText.setText("Score: " + scene.score);
  }

  // Show penalty message
  if (scorePenalty > 0) {
    const penaltyText = scene.add
      .text(
        scene.game.config.width / 2,
        150,
        `PARTIAL COLLAPSE! -${scorePenalty} POINTS`,
        {
          fontSize: "20px",
          fill: "#ff6600",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5);

    scene.tweens.add({
      targets: penaltyText,
      y: 100,
      alpha: 0,
      duration: 1500,
      onComplete: () => penaltyText.destroy(),
    });
  }

  // Animation for collapse
  animatePartialCollapse(scene, topRow, rowsToCollapse, () => {
    // After collapse finishes
    scene.isCollapsing = false;

    // Reduce instability after partial collapse
    scene.instability = Math.max(0, scene.instability - 20);

    // Spawn a new piece if there isn't one
    if (!scene.activePiece) {
      scene.time.delayedCall(500, () => {
        scene.spawnTetromino();
      });
    }
  });
}

/**
 * Animate the tower collapse
 * @param {object} scene - The game scene
 * @param {number} rows - Number of rows to collapse
 * @param {function} onComplete - Callback when animation completes
 */
function animateCollapse(scene, rows, onComplete) {
  // Find the top row of the tower
  const topRow = findTopRow(scene.board);
  if (topRow === -1) {
    if (onComplete) onComplete();
    return;
  }

  // Collect blocks to destroy in the collapsing rows
  const blocksToDestroy = [];
  const rowsToCollapse = [];

  // Determine which rows will collapse
  for (let i = 0; i < rows; i++) {
    const rowIndex = topRow + i;
    if (rowIndex >= scene.board.length) break;
    rowsToCollapse.push(rowIndex);
  }

  // Find all blocks in these rows
  scene.lockedBlocks.getChildren().forEach((block) => {
    const gridY = Math.floor(block.y / GRID_SIZE); // Calculate grid position using GRID_SIZE
    if (rowsToCollapse.includes(gridY)) {
      blocksToDestroy.push(block);
    }
  });

  // Animate blocks falling away
  blocksToDestroy.forEach((block) => {
    // Random rotation and fall animation
    scene.tweens.add({
      targets: block,
      y: "+=" + (Math.random() * 100 + 100),
      angle: Math.random() * 360,
      alpha: 0,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        block.destroy();
      },
    });

    // Remove from board data
    const gridX = Math.floor(block.x / GRID_SIZE);
    const gridY = Math.floor(block.y / GRID_SIZE);
    scene.board[gridY][gridX] = 0;
  });

  // Wait for animations to complete
  scene.time.delayedCall(1100, () => {
    // Compact the tower (move blocks down to fill gaps)
    compactTowerAfterCollapse(scene);

    // Run completion callback
    if (onComplete) onComplete();
  });
}

/**
 * Animate a partial collapse of the tower (just top rows)
 * @param {object} scene - The game scene
 * @param {number} topRow - The topmost row with blocks
 * @param {number} rowCount - Number of rows to collapse
 * @param {function} onComplete - Callback when animation completes
 */
function animatePartialCollapse(scene, topRow, rowCount, onComplete) {
  // Collect blocks to destroy in the collapsing rows
  const blocksToDestroy = [];
  const rowsToCollapse = [];

  // Determine which rows will collapse (only from the top)
  for (let i = 0; i < rowCount; i++) {
    const rowIndex = topRow + i;
    if (rowIndex >= scene.board.length) break;
    rowsToCollapse.push(rowIndex);
  }

  // Find all blocks in these rows
  scene.lockedBlocks.getChildren().forEach((block) => {
    const gridY = Math.floor(block.y / GRID_SIZE);
    if (rowsToCollapse.includes(gridY)) {
      blocksToDestroy.push(block);
    }
  });

  // Animate blocks falling away
  blocksToDestroy.forEach((block) => {
    // For partial collapse, make blocks fall to the sides as well
    const fallDirection = Math.random() > 0.5 ? 1 : -1;

    // Random rotation and fall animation
    scene.tweens.add({
      targets: block,
      y: "+=" + (Math.random() * 80 + 80),
      x: "+=" + Math.random() * 60 * fallDirection,
      angle: Math.random() * 180 * fallDirection,
      alpha: 0,
      duration: 800,
      ease: "Power2",
      onComplete: () => {
        block.destroy();
      },
    });

    // Remove from board data
    const gridX = Math.floor(block.x / GRID_SIZE);
    const gridY = Math.floor(block.y / GRID_SIZE);
    scene.board[gridY][gridX] = 0;
  });

  // Wait for animations to complete
  scene.time.delayedCall(900, () => {
    // No need to compact the tower for partial collapse
    // Just recalculate stability
    updateStabilityAfterPlacement(scene, {
      shape: [[1]],
      x: GUTTER_WIDTH,
      y: findTopRow(scene.board) || 0,
    });

    // Run completion callback
    if (onComplete) onComplete();
  });
}

/**
 * Compact the tower by moving blocks down after a collapse
 * @param {object} scene - The game scene
 */
function compactTowerAfterCollapse(scene) {
  // Initialize new board with fixed bottom row
  const newBoard = createEmptyBoard(scene.board.length);

  // Preserve the bottom row (foundation)
  for (let x = 0; x < scene.board[0].length; x++) {
    newBoard[scene.board.length - 1][x] =
      scene.board[scene.board.length - 1][x];
  }

  // For each column, move blocks down
  for (let x = 0; x < scene.board[0].length; x++) {
    let newY = scene.board.length - 2; // Start above foundation

    // Scan from bottom to top
    for (let y = scene.board.length - 2; y >= 0; y--) {
      if (scene.board[y][x] === 1) {
        newBoard[newY][x] = 1;
        newY--;
      }
    }
  }

  // Replace board data
  scene.board = newBoard;

  // Clear and redraw all blocks
  scene.lockedBlocks.clear(true, true);

  // Redraw blocks based on new board
  for (let y = 0; y < scene.board.length; y++) {
    for (let x = 0; x < scene.board[y].length; x++) {
      if (scene.board[y][x]) {
        const block = scene.add
          .image(x * GRID_SIZE, y * GRID_SIZE, "block")
          .setOrigin(0);
        scene.lockedBlocks.add(block);

        // Calculate new stability for proper tinting
        const stabilityPercentage = Math.max(
          0,
          100 - Math.floor(scene.instability)
        );
        block.setTint(getStabilityTint(stabilityPercentage / 100));
      }
    }
  }

  // Recalculate stability after compaction
  updateStabilityAfterPlacement(scene, {
    shape: [[1]],
    x: GUTTER_WIDTH,
    y: findTopRow(scene.board) || 0,
  });
}

/**
 * Create a clean empty board of specified dimensions
 * @param {number} rows - Number of rows
 * @returns {Array} Empty board array
 */
function createEmptyBoard(rows) {
  return Array.from({ length: rows }, () =>
    Array(TOWER_WIDTH + 2 * GUTTER_WIDTH).fill(0)
  );
}
