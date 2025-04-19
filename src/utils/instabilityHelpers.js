// utils/instabilityHelpers.js
import { GUTTER_WIDTH, TOWER_WIDTH, GRID_SIZE } from "./constants.js";
import { findTopRow } from "./boardHelpers.js";
import { shakeScreen, flashScreen } from "./animHelpers.js";
import { sendRoomMessage } from "./networkHelpers.js";

// Constants for stability calculations
const MAX_INSTABILITY = 100;
const SUPPORT_WEIGHT = 0.7;         // Weight for support from below
const NEIGHBOR_WEIGHT = 0.15;       // Weight for lateral support
const OVERHANG_PENALTY = 0.25;      // Penalty for blocks with no direct support
const VOID_STABILITY = -0.5;        // Negative stability value for void cells
const CAPPING_PENALTY = 0.4;        // Penalty for blocks directly capping voids
const THIN_TOWER_PENALTY = 0.3;     // Penalty for thin towers
const MIN_STABLE_WIDTH = 6;         // Minimum width considered stable (out of 10)
const IDEAL_ROW_STABILITY = 1.0;    // Perfect stability score for comparison
const CRITICAL_STABILITY = 0.4;     // Below this is critically unstable
const CONSECUTIVE_CRITICAL_LIMIT = 2; // This many consecutive critical rows is dangerous

/**
 * Calculate the current stability of the tower
 * @param {object} scene - The game scene
 * @returns {number} The calculated stability value (0-100, higher is more stable)
 */
export function calculateStability(scene) {
  const board = scene.board;
  const topRow = findTopRow(board);
  
  if (topRow === -1) return 100; // No blocks, tower is perfectly stable
  
  // Calculate cell stability for the tower area
  const cellStability = calculateCellStability(board, topRow);
  
  // Calculate row stability based on cell stability
  const rowStability = [];
  for (let y = 0; y < board.length; y++) {
    rowStability[y] = calculateRowStability(cellStability, board, y);
  }
  
  // Calculate raw section stability (without historical influence)
  const rawSectionStability = calculateRawSectionStability(rowStability, board, topRow);
  
  // Store raw stability for display purposes
  scene.rawSectionStability = rawSectionStability;
  
  // Calculate overall tower stability with historical influence
  let towerStability = rawSectionStability;
  
  // Apply historical influence if available
  if (scene.historicalStability !== undefined) {
    // Foundation is only as strong as its weakest part
    towerStability = Math.min(towerStability, scene.historicalStability);
  }
  
  // Apply external factors (like attacks) as instability
  towerStability = Math.max(0, towerStability - (scene.externalInstability || 0));
  
  // Cache the stability data for visualization
  scene.cellStability = cellStability;
  scene.rowStability = rowStability;
  
  // Return stability percentage
  return towerStability;
}

/**
 * Update stability after a piece is placed
 * @param {object} scene - The game scene
 * @param {object} placedPiece - The piece that was just placed (shape and position)
 */
export function updateStabilityAfterPlacement(scene, placedPiece) {
  const { shape, x, y } = placedPiece;
  
  // Determine a broader affected area for void detection
  const searchAreaMinX = Math.max(GUTTER_WIDTH, x - 5);
  const searchAreaMaxX = Math.min(GUTTER_WIDTH + TOWER_WIDTH - 1, x + shape[0].length + 5);
  const searchAreaMinY = Math.max(0, y - 5);
  const searchAreaMaxY = Math.min(scene.board.length - 1, y + shape.length + 10);
  
  // Calculate stability for the entire tower
  // We need to recalculate everything because voids can affect distant cells
  const stability = calculateStability(scene);
  
  // Update scene stability value (as instability for gameplay purposes)
  scene.instability = MAX_INSTABILITY - stability;
  
  // Update visual effects
  updateStabilityEffects(scene);
  
  return stability;
}

/**
 * Detect voids and assign stability to all cells
 * @param {Array} board - The game board
 * @param {number} topRow - The topmost occupied row
 * @returns {Array} 2D array of cell stability values
 */
function calculateCellStability(board, topRow) {
  // Initialize cell stability 
  const cellStability = Array.from({ length: board.length }, () => 
    Array(board[0].length).fill(1.0));
  
  // First pass: detect voids and mark them with negative stability
  for (let y = topRow; y < board.length - 1; y++) {
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      // If cell is empty (potential void)
      if (!board[y][x]) {
        // Check if it's a trapped void - MUST have a block directly above to be a void
        const hasBlockAbove = y > 0 && board[y-1][x] === 1;
        
        // If no block above, it's not a void (it's an open space)
        if (!hasBlockAbove) continue;
        
        // Must have at least one side wall to be a void
        const hasBlockLeft = x > GUTTER_WIDTH && board[y][x-1] === 1;
        const hasBlockRight = x < GUTTER_WIDTH + TOWER_WIDTH - 1 && board[y][x+1] === 1;
        
        if (hasBlockLeft || hasBlockRight) {
          cellStability[y][x] = VOID_STABILITY;
        }
      }
    }
  }
  
  // Second pass: calculate stability for blocks
  for (let y = topRow; y < board.length; y++) {
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      // Skip empty cells that aren't voids (they remain at 1.0)
      if (!board[y][x] && cellStability[y][x] === 1.0) continue;
      
      // If this is a filled cell, calculate its stability
      if (board[y][x]) {
        // Start with medium-high stability
        let stability = 0.7; // Increased from 0.5
        
        // Foundation row and row directly above are always stable
        if (y === board.length - 1 || y === board.length - 2) {
          stability = 1.0; // Perfect stability for foundation and row above
        } else {
          // Check for direct support
          if (y + 1 < board.length && board[y+1][x]) {
            stability += SUPPORT_WEIGHT;
          } else {
            // No direct support - check for diagonal support
            const hasLeftSupport = y + 1 < board.length && x > GUTTER_WIDTH && board[y+1][x-1];
            const hasRightSupport = y + 1 < board.length && x < GUTTER_WIDTH + TOWER_WIDTH - 1 && board[y+1][x+1];
            
            if (hasLeftSupport || hasRightSupport) {
              stability += SUPPORT_WEIGHT * 0.5;
            } else {
              // Complete overhang
              stability -= OVERHANG_PENALTY;
            }
          }
          
          // Check for lateral support - edge blocks get a slight bonus
          const isLeftEdge = x === GUTTER_WIDTH;
          const isRightEdge = x === GUTTER_WIDTH + TOWER_WIDTH - 1;
          const hasLeftNeighbor = x > GUTTER_WIDTH && board[y][x-1];
          const hasRightNeighbor = x < GUTTER_WIDTH + TOWER_WIDTH - 1 && board[y][x+1];
          
          if (hasLeftNeighbor) stability += NEIGHBOR_WEIGHT;
          if (hasRightNeighbor) stability += NEIGHBOR_WEIGHT;
          
          // Edge stability bonus - edges act as partial supports
          if (isLeftEdge || isRightEdge) stability += NEIGHBOR_WEIGHT * 0.5;
          
          // Check for void below (capping penalty)
          if (y + 1 < board.length && cellStability[y+1][x] === VOID_STABILITY) {
            stability -= CAPPING_PENALTY;
          }
          
          // Check width - need to calculate row width first
          let rowWidth = 0;
          for (let i = GUTTER_WIDTH; i < GUTTER_WIDTH + TOWER_WIDTH; i++) {
            if (board[y][i]) rowWidth++;
          }
          
          // Apply width penalty
          if (rowWidth < MIN_STABLE_WIDTH) {
            stability -= (MIN_STABLE_WIDTH - rowWidth) * THIN_TOWER_PENALTY / MIN_STABLE_WIDTH;
          }
        }
        
        // Clamp stability to valid range
        cellStability[y][x] = Math.max(0, Math.min(1, stability));
      }
    }
  }
  
  return cellStability;
}

/**
 * Calculate row stability including void cells
 * @param {Array} cellStability - 2D array of cell stability values
 * @param {Array} board - The game board
 * @param {number} y - Row index
 * @returns {number} Row stability value (0-1)
 */
function calculateRowStability(cellStability, board, y) {
  // Count filled cells and voids in this row
  let filledCells = 0;
  let voidCells = 0;
  let totalStability = 0;
  
  for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
    if (board[y][x]) {
      // This is a filled cell
      filledCells++;
      totalStability += cellStability[y][x];
    } else if (cellStability[y][x] === VOID_STABILITY) {
      // This is a void cell
      voidCells++;
      totalStability += VOID_STABILITY; // Add negative stability
    }
  }
  
  // Calculate row stability
  if (filledCells + voidCells === 0) {
    return 1.0; // Empty row is stable
  }
  
  // Calculate average stability for non-empty cells
  const avgStability = totalStability / (filledCells + voidCells);
  
  // Complete rows get a bonus
  if (filledCells === TOWER_WIDTH) {
    return Math.min(1.0, avgStability * 1.5);
  }
  
  return Math.max(0, Math.min(1.0, avgStability));
}

/**
 * Calculate raw section stability without historical influence
 * @param {Array} rowStabilities - Array of row stability values
 * @param {Array} board - The game board
 * @param {number} topRow - The topmost occupied row
 * @returns {number} Raw section stability (0-100)
 */
function calculateRawSectionStability(rowStabilities, board, topRow) {
  // Track worst section and consecutive unstable rows
  let worstSectionStability = 1.0;
  let consecLowStabilityRows = 0;
  let currentSectionStability = 1.0;
  
  // Process each row from top to bottom
  for (let y = topRow; y < rowStabilities.length; y++) {
    // Skip empty rows
    if (rowStabilities[y] === 1.0 && !hasFilledCells(board, y)) continue;
    
    // Track consecutive low stability
    if (rowStabilities[y] < CRITICAL_STABILITY) {
      consecLowStabilityRows++;
      currentSectionStability = Math.min(currentSectionStability, rowStabilities[y]);
      
      // Penalize consecutive unstable rows, but less severely
      if (consecLowStabilityRows >= CONSECUTIVE_CRITICAL_LIMIT) {
        worstSectionStability = Math.min(
          worstSectionStability,
          currentSectionStability * 0.7 // Less harsh penalty
        );
      }
    } else {
      // Reset tracking for non-critical rows
      consecLowStabilityRows = 0;
      currentSectionStability = 1.0;
    }
    
    // Always track the overall worst section
    worstSectionStability = Math.min(worstSectionStability, rowStabilities[y]);
  }
  
  // Calculate structural integrity score
  // Give less weight to the worst section
  let structuralIntegrity = (worstSectionStability * 0.5) + 0.5;
  
  // Apply smaller height penalty
  const towerHeight = countFilledRows(board, topRow);
  const heightFactor = Math.max(0, towerHeight - 15) * 0.01; // Much smaller penalty
  structuralIntegrity -= heightFactor;
  
  // Calculate final stability percentage
  return Math.max(0, Math.min(100, structuralIntegrity * 100));
}

/**
 * Helper to check if a row has any filled cells
 * @param {Array} board - The game board
 * @param {number} y - Row index
 * @returns {boolean} True if row has filled cells
 */
function hasFilledCells(board, y) {
  for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
    if (board[y][x]) return true;
  }
  return false;
}

/**
 * Count the number of rows with blocks in them
 */
function countFilledRows(board, topRow) {
  let count = 0;
  for (let y = topRow; y < board.length; y++) {
    if (hasFilledCells(board, y)) count++;
  }
  return count;
}

/**
 * Update stability visuals and effects
 * @param {object} scene - The game scene
 */
export function updateStabilityEffects(scene) {
  const instability = scene.instability;
  
  // Calculate stability percentage (inverse of instability)
  const stabilityPercentage = Math.max(0, 100 - Math.floor(instability));
  
  // For UI display, use the raw section stability if available
  const displayStability = scene.rawSectionStability !== undefined ? 
    Math.floor(scene.rawSectionStability) : 
    stabilityPercentage;
  
  // Update stability text
  if (scene.instabilityText) {
    scene.instabilityText.setText(`Stability: ${displayStability}%`);
  }
  
  // Visual effect: Tint blocks based on cell stability
  if (scene.cellStability) {
    scene.lockedBlocks.getChildren().forEach(block => {
      const gridX = Math.floor(block.x / GRID_SIZE);
      const gridY = Math.floor(block.y / GRID_SIZE);
      
      // Use cell stability if available for precise tinting
      if (gridY < scene.cellStability.length && gridX < scene.cellStability[0].length) {
        const cellStability = scene.cellStability[gridY][gridX];
        block.setTint(getStabilityTint(cellStability));
      } else {
        // Fallback to overall stability
        block.setTint(getStabilityTint(stabilityPercentage / 100));
      }
    });
  } else {
    // Fallback if cell stability isn't available
    scene.lockedBlocks.getChildren().forEach(block => {
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
  
  // Check for collapse
  if (instability >= 90 && !scene.isCollapsing) {
    initiateCollapse(scene);
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
function getStabilityTint(stability) {
  if (stability > 0.85) {
    return 0x4488ff; // Very stable - blue
  } else if (stability > 0.70) {
    return 0x99ff99; // Stable - green
  } else if (stability > 0.50) {
    return 0xffffaa; // Moderately stable - yellow
  } else if (stability > 0.30) {
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
    return '#4488ff'; // Blue
  } else if (stability > 70) {
    return '#99ff99'; // Green
  } else if (stability > 50) {
    return '#ffffaa'; // Yellow
  } else if (stability > 30) {
    return '#ffaa66'; // Orange
  } else {
    return '#ff4444'; // Red
  }
}

/**
 * Initiate tower collapse when stability is too low
 * @param {object} scene - The game scene
 */
export function initiateCollapse(scene) {
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
        newInstability: scene.instability
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
  scene.lockedBlocks.getChildren().forEach(block => {
    const gridY = Math.floor(block.y / GRID_SIZE); // Calculate grid position using GRID_SIZE
    if (rowsToCollapse.includes(gridY)) {
      blocksToDestroy.push(block);
    }
  });
  
  // Animate blocks falling away
  blocksToDestroy.forEach(block => {
    // Random rotation and fall animation
    scene.tweens.add({
      targets: block,
      y: '+=' + (Math.random() * 100 + 100),
      angle: Math.random() * 360,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        block.destroy();
      }
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
 * Compact the tower by moving blocks down after a collapse
 * @param {object} scene - The game scene
 */
function compactTowerAfterCollapse(scene) {
  // Initialize new board with fixed bottom row
  const newBoard = createEmptyBoard(scene.board.length);
  
  // Preserve the bottom row (foundation)
  for (let x = 0; x < scene.board[0].length; x++) {
    newBoard[scene.board.length - 1][x] = scene.board[scene.board.length - 1][x];
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
        const block = scene.add.image(x * GRID_SIZE, y * GRID_SIZE, "block").setOrigin(0);
        scene.lockedBlocks.add(block);
        
        // Calculate new stability for proper tinting
        const stabilityPercentage = Math.max(0, 100 - Math.floor(scene.instability));
        block.setTint(getStabilityTint(stabilityPercentage / 100));
      }
    }
  }
  
  // Recalculate stability after compaction
  updateStabilityAfterPlacement(scene, {
    shape: [[1]],
    x: GUTTER_WIDTH,
    y: findTopRow(scene.board) || 0
  });
}

/**
 * Create a clean empty board of specified dimensions
 * @param {number} rows - Number of rows
 * @returns {Array} Empty board array
 */
function createEmptyBoard(rows) {
  return Array.from({ length: rows }, () => Array(TOWER_WIDTH + 2 * GUTTER_WIDTH).fill(0));
}

/**
 * Render debug visualization of stability values
 * @param {object} scene - The game scene
 */
export function renderDebugOverlay(scene) {
  // Clear previous graphics and text
  if (scene.debugGraphics) {
    scene.debugGraphics.clear();
    scene.debugText.forEach(text => text.destroy());
    scene.debugText = [];
  } else {
    return; // Not in debug mode
  }
  
  // Only proceed if cell stability data exists
  if (!scene.cellStability) return;
  
  const topRow = findTopRow(scene.board);
  if (topRow === -1) return; // No blocks to debug
  
  // Calculate text size based on grid
  const textSize = Math.max(8, Math.min(12, GRID_SIZE / 2));
  
  // Number of rows to display in debug mode
  const debugVisibleRows = 30; // Default if VISIBLE_ROWS isn't available
  
  // Show stability values for visible cells
  for (let y = topRow; y < Math.min(scene.board.length, topRow + debugVisibleRows); y++) {
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      // Get stability value
      let value = 0;
      if (y < scene.cellStability.length && x < scene.cellStability[0].length) {
        value = scene.cellStability[y][x];
      }
      
      // Skip cells with perfect stability (empty cells)
      if (value === 1.0 && !scene.board[y][x]) continue;
      
      // Get color based on stability
      let color = getDebugColor(value);
      
      // Draw box around cell
      scene.debugGraphics.lineStyle(1, color, 0.8);
      scene.debugGraphics.strokeRect(
        x * GRID_SIZE, 
        y * GRID_SIZE, 
        GRID_SIZE, 
        GRID_SIZE
      );
      
      // Add text with stability value
      const text = scene.add.text(
        x * GRID_SIZE + GRID_SIZE/2, 
        y * GRID_SIZE + GRID_SIZE/2, 
        value.toFixed(2), 
        { 
          fontSize: `${textSize}px`, 
          fill: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center'
        }
      ).setOrigin(0.5);
      
      scene.debugText.push(text);
    }
  }
  
  // Show row stability
  if (scene.rowStability) {
    for (let y = topRow; y < Math.min(scene.board.length, topRow + debugVisibleRows); y++) {
      if (y < scene.rowStability.length) {
        const rowValue = scene.rowStability[y];
        const color = getDebugColor(rowValue);
        
        // Draw row indicator on the right
        scene.debugGraphics.fillStyle(color, 0.8);
        scene.debugGraphics.fillRect(
          (GUTTER_WIDTH + TOWER_WIDTH) * GRID_SIZE,
          y * GRID_SIZE,
          GRID_SIZE/2,
          GRID_SIZE
        );
        
        // Add text with row stability value
        const text = scene.add.text(
          (GUTTER_WIDTH + TOWER_WIDTH) * GRID_SIZE + GRID_SIZE/4, 
          y * GRID_SIZE + GRID_SIZE/2, 
          rowValue.toFixed(2), 
          { 
            fontSize: `${textSize - 2}px`, 
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 1,
            align: 'center'
          }
        ).setOrigin(0.5);
        
        scene.debugText.push(text);
      }
    }
  }
  
  // Show tower and historical stability values
  if (scene.instability !== undefined) {
    const currentStability = 100 - scene.instability;
    const displayStability = scene.rawSectionStability !== undefined ? scene.rawSectionStability : currentStability;
    
    const text = scene.add.text(
      GRID_SIZE * GUTTER_WIDTH,
      20,
      `Section: ${displayStability.toFixed(1)}%` + 
      (scene.historicalStability !== undefined ? 
        ` | Historical: ${scene.historicalStability.toFixed(1)}%` : ''),
      {
        fontSize: '14px',
        fill: getStabilityTextColor(displayStability),
        stroke: '#000000',
        strokeThickness: 3,
        align: 'left'
      }
    );
    scene.debugText.push(text);
  }
}

/**
 * Get debug color based on stability value
 * @param {number} value - Stability value (-1 to 1)
 * @returns {number} - Color value for debug rendering
 */
function getDebugColor(value) {
  if (value < 0) {
    // Negative values (voids) are purple
    return 0x9933cc; 
  } else if (value > 0.85) {
    return 0x4488ff; // Very stable - blue
  } else if (value > 0.70) {
    return 0x99ff99; // Stable - green  
  } else if (value > 0.50) {
    return 0xffffaa; // Moderately stable - yellow
  } else if (value > 0.30) {
    return 0xffaa66; // Unstable - orange
  } else {
    return 0xff4444; // Very unstable - red
  }
}