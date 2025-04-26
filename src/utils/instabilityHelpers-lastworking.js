// utils/instabilityHelpers.js
import { GUTTER_WIDTH, TOWER_WIDTH, GRID_SIZE, HISTORY_ROWS } from "./constants.js";
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
  
  // Find the cutoff row for the active section (ignore history grid)
  const cutOffRow = board.length - HISTORY_ROWS;
  
  // Initialize cell stability with default values (all cells are stable)
  const cellStability = Array.from({ length: board.length }, () => 
    Array(board[0].length).fill(1.0));
  
  // Step 1: Perform void detection and get initial cell stability values
  // Only consider rows in the active tower section
  const { updatedCellStability, voidClusters } = detectVoids(board, topRow, cellStability, cutOffRow);
  
  // Step 2: Calculate overhang penalties
  calculateOverhangPenalties(board, updatedCellStability);
  
  // Step 3: Calculate thin tower penalties
  calculateThinTowerPenalties(board, updatedCellStability, cutOffRow);
  
  // Store void clusters for visualization if needed
  scene.voidClusters = voidClusters;
  
  // Calculate row stability based on cell stability, but only for active section
  const rowStability = [];
  for (let y = 0; y < board.length; y++) {
    if (y >= cutOffRow) {
      // History rows have perfect stability by definition (they're stable in our model)
      rowStability[y] = 1.0;
    } else {
      rowStability[y] = calculateRowStability(updatedCellStability, board, y);
    }
  }
  
  // Calculate raw section stability (without historical influence)
  const rawSectionStability = calculateRawSectionStability(rowStability, board, topRow, cutOffRow);
  
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
  scene.cellStability = updatedCellStability;
  scene.rowStability = rowStability;
  
  // Return stability percentage
  return towerStability;
}

/**
 * Calculate overhang penalties for blocks without direct support
 * @param {Array} board - The game board
 * @param {Array} cellStability - Cell stability values to update
 */
function calculateOverhangPenalties(board, cellStability) {
  // Skip foundation row and history grid
  for (let y = 0; y < board.length - HISTORY_ROWS - 1; y++) {
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      // Skip empty cells
      if (!board[y][x]) continue;
      
      // Check for direct support
      const hasDirectSupport = y + 1 < board.length && board[y+1][x] === 1;
      
      if (!hasDirectSupport) {
        // Check for diagonal support
        const hasLeftDiagonalSupport = y + 1 < board.length && x > GUTTER_WIDTH && board[y+1][x-1] === 1;
        const hasRightDiagonalSupport = y + 1 < board.length && x < GUTTER_WIDTH + TOWER_WIDTH - 1 && board[y+1][x+1] === 1;
        
        if (hasLeftDiagonalSupport || hasRightDiagonalSupport) {
          // Diagonal support is better than nothing but not as good as direct
          cellStability[y][x] = Math.max(0, cellStability[y][x] - OVERHANG_PENALTY * 0.5);
        } else {
          // Complete overhang (no support below)
          cellStability[y][x] = Math.max(0, cellStability[y][x] - OVERHANG_PENALTY);
        }
      }
      
      // Check for lateral support - edges get a slight bonus
      const isLeftEdge = x === GUTTER_WIDTH;
      const isRightEdge = x === GUTTER_WIDTH + TOWER_WIDTH - 1;
      const hasLeftNeighbor = x > GUTTER_WIDTH && board[y][x-1] === 1;
      const hasRightNeighbor = x < GUTTER_WIDTH + TOWER_WIDTH - 1 && board[y][x+1] === 1;
      
      // Apply lateral support bonuses
      if (hasLeftNeighbor) cellStability[y][x] = Math.min(1.0, cellStability[y][x] + NEIGHBOR_WEIGHT);
      if (hasRightNeighbor) cellStability[y][x] = Math.min(1.0, cellStability[y][x] + NEIGHBOR_WEIGHT);
      
      // Edge stability bonus - edges act as partial supports
      if (isLeftEdge || isRightEdge) cellStability[y][x] = Math.min(1.0, cellStability[y][x] + NEIGHBOR_WEIGHT * 0.5);
    }
  }
}

/**
 * Calculate thin tower penalties based on row width
 * @param {Array} board - The game board
 * @param {Array} cellStability - Cell stability values to update
 * @param {number} cutOffRow - The row where history begins
 */
function calculateThinTowerPenalties(board, cellStability, cutOffRow) {
  // For each row in active section, calculate width and apply penalties
  for (let y = 0; y < cutOffRow; y++) {
    // Skip empty rows
    if (!hasFilledCells(board, y)) continue;
    
    // Calculate row width
    let rowWidth = 0;
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      if (board[y][x]) rowWidth++;
    }
    
    // Apply thin tower penalty if row is narrower than minimum stable width
    if (rowWidth < MIN_STABLE_WIDTH) {
      const widthPenalty = (MIN_STABLE_WIDTH - rowWidth) * THIN_TOWER_PENALTY / MIN_STABLE_WIDTH;
      
      // Apply penalty to all blocks in this row
      for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
        if (board[y][x]) {
          cellStability[y][x] = Math.max(0, cellStability[y][x] - widthPenalty);
        }
      }
    }
  }
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
 * Detect all voids on the board and calculate their effects on stability
 * @param {Array} board - The game board
 * @param {number} topRow - The topmost occupied row
 * @param {Array} initialCellStability - Initial cell stability values
 * @param {number} cutOffRow - The row where history begins
 * @returns {Object} Object containing updated cell stability and void clusters
 */
function detectVoids(board, topRow, initialCellStability, cutOffRow) {
  const width = board[0].length;
  
  // Make a copy of the initial cell stability to avoid modifying the original
  const cellStability = initialCellStability.map(row => [...row]);
  
  // Initialize visited array for flood fill
  const visited = Array.from({ length: board.length }, () => 
    Array(width).fill(false));
  
  // Initialize array to track void clusters
  const voidClusters = [];
  
  // Check for open paths from the top
  const accessibleFromTop = findAccessibleCells(board, topRow);
  
  // First pass: identify potential voids
  // Only analyze up to the cutoff row
  let clusterIndex = 0;
  for (let y = topRow; y < cutOffRow; y++) {
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      // Skip if already visited or if cell is filled
      if (visited[y][x] || board[y][x] === 1) continue;
      
      // Check if it's possibly a void (has a block above it)
      const hasBlockAbove = y > 0 && board[y-1][x] === 1;
      
      // If cell is accessible from top or has no block above, it's not a void
      if (accessibleFromTop[y][x] || !hasBlockAbove) {
        // Mark as visited to avoid rechecking
        visited[y][x] = true;
        continue;
      }
      
      // This might be a void - identify the entire cluster
      // But limit it to active section
      const cluster = identifyVoidCluster(board, visited, x, y, cutOffRow);
      
      // Only consider it a void if the cluster has at least one block above
      let hasCapAbove = false;
      for (const cell of cluster) {
        const [cx, cy] = cell;
        if (cy > 0 && board[cy-1][cx] === 1) {
          hasCapAbove = true;
          break;
        }
      }
      
      // If no capping piece, it's not a void cluster
      if (!hasCapAbove || cluster.length === 0) continue;
      
      // Calculate cluster properties
      const clusterInfo = analyzeVoidCluster(board, cluster);
      clusterInfo.id = clusterIndex++;
      
      // Store cluster info
      voidClusters.push(clusterInfo);
      
      // Assign stability values based on void type
      for (const [vx, vy] of cluster) {
        // Skip cells in history grid
        if (vy >= cutOffRow) continue;
        
        // Deeper voids cause more instability
        const depthPenalty = Math.min(0.4, clusterInfo.depth * 0.1);
        // Larger voids cause more instability
        const sizePenalty = Math.min(0.3, cluster.length * 0.05); 
        
        // Combine penalties based on void type
        let voidPenalty;
        switch (clusterInfo.type) {
          case 'critical': // Completely sealed voids
            voidPenalty = -0.7 - depthPenalty - sizePenalty;
            break;
          case 'severe': // Almost sealed, hard to access
            voidPenalty = -0.5 - depthPenalty - sizePenalty;
            break;
          case 'moderate': // Partially accessible
            voidPenalty = -0.3 - depthPenalty;
            break;
          default: // Minor voids
            voidPenalty = -0.2;
        }
        
        cellStability[vy][vx] = voidPenalty;
      }
    }
  }
  
  // Second pass: propagate void effects to surrounding blocks
  for (const cluster of voidClusters) {
    propagateVoidEffects(board, cellStability, cluster, cutOffRow);
  }
  
  return { updatedCellStability: cellStability, voidClusters };
}

/**
 * Find all cells that are accessible from the top of the tower
 * @param {Array} board - The game board
 * @param {number} topRow - The topmost occupied row
 * @returns {Array} 2D array marking accessible cells as true
 */
function findAccessibleCells(board, topRow) {
  const width = board[0].length;
  const height = board.length;
  
  // Initialize accessibility array
  const accessible = Array.from({ length: height }, () => 
    Array(width).fill(false));
  
  // Start from each empty column at the top row
  for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
    if (!board[topRow][x]) {
      floodFillAccessible(board, accessible, x, topRow);
    }
  }
  
  return accessible;
}

/**
 * Flood fill algorithm to mark accessible cells
 * @param {Array} board - The game board
 * @param {Array} accessible - The accessibility array to fill
 * @param {number} x - Starting x coordinate
 * @param {number} y - Starting y coordinate
 */
function floodFillAccessible(board, accessible, x, y) {
  const width = board[0].length;
  const height = board.length;
  
  // Queue for breadth-first search
  const queue = [[x, y]];
  
  // Process queue
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    
    // Skip if out of bounds, already visited, or filled
    if (cx < GUTTER_WIDTH || cx >= GUTTER_WIDTH + TOWER_WIDTH || 
        cy < 0 || cy >= height || 
        accessible[cy][cx] || board[cy][cx] === 1) {
      continue;
    }
    
    // Mark as accessible
    accessible[cy][cx] = true;
    
    // Add neighbors to queue (4-directional)
    queue.push([cx + 1, cy]); // Right
    queue.push([cx - 1, cy]); // Left
    queue.push([cx, cy + 1]); // Down
    queue.push([cx, cy - 1]); // Up
  }
}

/**
 * Identify a cluster of connected void cells
 * @param {Array} board - The game board
 * @param {Array} visited - Tracking array for visited cells
 * @param {number} startX - Starting x coordinate
 * @param {number} startY - Starting y coordinate
 * @param {number} cutOffRow - The row where history begins
 * @returns {Array} Array of [x,y] coordinates in the cluster
 */
function identifyVoidCluster(board, visited, startX, startY, cutOffRow) {
  // Cluster cells
  const cluster = [];
  
  // Queue for breadth-first search
  const queue = [[startX, startY]];
  
  // Process queue
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    
    // Skip if out of bounds, already visited, filled, or in history grid
    if (cx < GUTTER_WIDTH || cx >= GUTTER_WIDTH + TOWER_WIDTH || 
        cy < 0 || cy >= cutOffRow || 
        visited[cy][cx] || board[cy][cx] === 1) {
      continue;
    }
    
    // Mark as visited
    visited[cy][cx] = true;
    
    // Add to cluster
    cluster.push([cx, cy]);
    
    // Add neighbors to queue (4-directional)
    queue.push([cx + 1, cy]); // Right
    queue.push([cx - 1, cy]); // Left
    queue.push([cx, cy + 1]); // Down
    queue.push([cx, cy - 1]); // Up
  }
  
  return cluster;
}

/**
 * Analyze a void cluster to determine its properties
 * @param {Array} board - The game board
 * @param {Array} cluster - Array of [x,y] coordinates in the cluster
 * @returns {Object} Information about the void cluster
 */
function analyzeVoidCluster(board, cluster) {
  const width = board[0].length;
  const height = board.length;
  
  // Find bounding box
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  
  for (const [x, y] of cluster) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  
  // Calculate dimensions
  const clusterWidth = maxX - minX + 1;
  const clusterHeight = maxY - minY + 1;
  const size = cluster.length;
  const depth = maxY - minY + 1;
  
  // Calculate coverage ratio (how much of the bounding box is filled)
  const coverage = size / (clusterWidth * clusterHeight);
  
  // Count blocks surrounding the void
  let surroundingBlocks = 0;
  let possibleSurroundingPositions = 0;
  
  // Check each void cell's neighbors
  for (const [x, y] of cluster) {
    // Check all 8 directions
    const directions = [
      [-1, -1], [0, -1], [1, -1], // Above
      [-1, 0], [1, 0],            // Sides
      [-1, 1], [0, 1], [1, 1]     // Below
    ];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      // Skip if out of bounds or another void cell
      if (nx < GUTTER_WIDTH || nx >= GUTTER_WIDTH + TOWER_WIDTH || 
          ny < 0 || ny >= height) {
        continue;
      }
      
      // Count surrounding cells
      possibleSurroundingPositions++;
      if (board[ny][nx] === 1) {
        surroundingBlocks++;
      }
    }
  }
  
  // Calculate enclosure ratio (how surrounded the void is)
  const enclosureRatio = surroundingBlocks / possibleSurroundingPositions;
  
  // Determine void type based on properties
  let type;
  if (enclosureRatio > 0.8) {
    type = 'critical'; // Highly enclosed void
  } else if (enclosureRatio > 0.6) {
    type = 'severe';   // Severely enclosed void
  } else if (enclosureRatio > 0.4) {
    type = 'moderate'; // Moderately enclosed void
  } else {
    type = 'minor';    // Minor void
  }
  
  // Return cluster properties
  return {
    minX, maxX, minY, maxY,
    width: clusterWidth, height: clusterHeight, size, depth,
    coverage, enclosureRatio,
    type, cells: cluster
  };
}

/**
 * Propagate void effects to surrounding blocks
 * @param {Array} board - The game board
 * @param {Array} cellStability - Cell stability values to update
 * @param {Object} cluster - Void cluster information
 */
function propagateVoidEffects(board, cellStability, cluster) {
  const { cells, type, size } = cluster;
  
  // Base effect strength depends on void type
  let effectStrength;
  switch (type) {
    case 'critical':
      effectStrength = 0.4;
      break;
    case 'severe':
      effectStrength = 0.3;
      break;
    case 'moderate':
      effectStrength = 0.2;
      break;
    default:
      effectStrength = 0.1;
  }
  
  // Adjust for size (larger voids have stronger effects)
  effectStrength = Math.min(0.5, effectStrength + (size * 0.01));
  
  // Find all blocks that need to be affected
  const affectedCells = new Set();
  
  // First, find all blocks directly adjacent to the void
  for (const [x, y] of cells) {
    // Check adjacent positions (including diagonals)
    const directions = [
      [-1, -1], [0, -1], [1, -1], // Above
      [-1, 0], [1, 0],            // Sides
      [-1, 1], [0, 1], [1, 1]     // Below
    ];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      // Skip if out of bounds or not a block
      if (nx < GUTTER_WIDTH || nx >= GUTTER_WIDTH + TOWER_WIDTH || 
          ny < 0 || ny >= board.length || 
          board[ny][nx] !== 1) {
        continue;
      }
      
      // Add to affected cells
      affectedCells.add(`${nx},${ny}`);
    }
  }
  
  // Apply effects to all affected blocks
  for (const cellKey of affectedCells) {
    const [x, y] = cellKey.split(',').map(Number);
    
    // Blocks above voids are severely affected (capping blocks)
    if (y < cluster.minY) {
      cellStability[y][x] = Math.max(0, cellStability[y][x] - effectStrength * 1.5);
    } 
    // Blocks below are slightly affected
    else if (y > cluster.maxY) {
      cellStability[y][x] = Math.max(0, cellStability[y][x] - effectStrength * 0.5);
    }
    // Side blocks are moderately affected
    else {
      cellStability[y][x] = Math.max(0, cellStability[y][x] - effectStrength);
    }
  }
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
    } else if (cellStability[y][x] < 0) {
      // This is a void cell (negative stability)
      voidCells++;
      totalStability += cellStability[y][x]; // Add negative stability
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
 * @param {number} cutOffRow - The row where history begins
 * @returns {number} Raw section stability (0-100)
 */
function calculateRawSectionStability(rowStabilities, board, topRow, cutOffRow) {
  // Track worst section and consecutive unstable rows
  let worstSectionStability = 1.0;
  let consecLowStabilityRows = 0;
  let currentSectionStability = 1.0;
  
  // Process each row from top to bottom (only active section)
  for (let y = topRow; y < cutOffRow; y++) {
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
  const towerHeight = countFilledRows(board, topRow, cutOffRow);
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
 * Count the number of rows with blocks in them (only in active section)
 */
function countFilledRows(board, topRow, cutOffRow) {
  let count = 0;
  for (let y = topRow; y < cutOffRow; y++) {
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
    
    // Update text color
    scene.instabilityText.setColor(getStabilityTextColor(displayStability));
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
 * Render debug visualization of stability values and void clusters
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
  
  // Track cells for different stability issues (to avoid double-highlighting)
  const overhangCells = new Set();
  const thinWidthCells = new Set();
  
  // First, calculate which rows are "thin"
  const thinRows = [];
  for (let y = topRow; y < Math.min(scene.board.length, topRow + debugVisibleRows); y++) {
    let rowWidth = 0;
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      if (scene.board[y][x]) rowWidth++;
    }
    
    if (rowWidth > 0 && rowWidth < MIN_STABLE_WIDTH) {
      thinRows.push(y);
    }
  }
  
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
      
      // Determine cell type based on its properties
      let cellType = 'normal';
      let statusColor = getDebugColor(value);
      
      // Check if this is a void cell (negative stability)
      if (value < 0) {
        cellType = 'void';
      } 
      // Check for overhangs (if it's a block)
      else if (scene.board[y][x]) {
        // Check for direct support below
        const hasDirectSupport = y + 1 < scene.board.length && scene.board[y+1][x];
        
        if (!hasDirectSupport) {
          // Check for diagonal support
          const hasLeftDiagonalSupport = y + 1 < scene.board.length && x > GUTTER_WIDTH && scene.board[y+1][x-1];
          const hasRightDiagonalSupport = y + 1 < scene.board.length && x < GUTTER_WIDTH + TOWER_WIDTH - 1 && scene.board[y+1][x+1];
          
          if (!hasLeftDiagonalSupport && !hasRightDiagonalSupport) {
            // Complete overhang
            cellType = 'overhang';
            overhangCells.add(`${x},${y}`);
          }
        }
        
        // Check if in a thin row
        if (thinRows.includes(y)) {
          cellType = thinWidthCells.has(`${x},${y}`) ? cellType : 'thinWidth';
          thinWidthCells.add(`${x},${y}`);
        }
      }
      
      // Different outline styles based on cell type
      let lineWidth = 1;
      let outlineColor = statusColor;
      
      switch (cellType) {
        case 'void':
          // Voids use standard debug color based on stability value
          break;
        case 'overhang':
          // Overhangs get red diagonal hatch pattern
          outlineColor = 0xFF0000;
          lineWidth = 2;
          // Draw diagonal lines inside the cell
          scene.debugGraphics.lineStyle(1, 0xFF0000, 0.7);
          scene.debugGraphics.beginPath();
          scene.debugGraphics.moveTo(x * GRID_SIZE, y * GRID_SIZE);
          scene.debugGraphics.lineTo((x+1) * GRID_SIZE, (y+1) * GRID_SIZE);
          scene.debugGraphics.moveTo((x+1) * GRID_SIZE, y * GRID_SIZE);
          scene.debugGraphics.lineTo(x * GRID_SIZE, (y+1) * GRID_SIZE);
          scene.debugGraphics.closePath();
          scene.debugGraphics.strokePath();
          break;
        case 'thinWidth':
          // Thin width rows get orange dotted outline
          outlineColor = 0xFF9900;
          lineWidth = 2;
          // Draw horizontal line at the top of the cell
          scene.debugGraphics.lineStyle(1, 0xFF9900, 0.7);
          scene.debugGraphics.beginPath();
          scene.debugGraphics.moveTo(x * GRID_SIZE, y * GRID_SIZE);
          scene.debugGraphics.lineTo((x+1) * GRID_SIZE, y * GRID_SIZE);
          scene.debugGraphics.closePath();
          scene.debugGraphics.strokePath();
          break;
      }
      
      // Draw box around cell
      scene.debugGraphics.lineStyle(lineWidth, outlineColor, 0.8);
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
        
        // Highlight thin rows with a special indicator
        if (thinRows.includes(y)) {
          scene.debugGraphics.fillStyle(0xFF9900, 0.7); // Orange for thin rows
          scene.debugGraphics.fillRect(
            (GUTTER_WIDTH + TOWER_WIDTH) * GRID_SIZE + GRID_SIZE/2,
            y * GRID_SIZE,
            GRID_SIZE/4,
            GRID_SIZE
          );
        }
      }
    }
  }
  
  // Highlight void clusters with different colors if available
  if (scene.voidClusters && scene.voidClusters.length > 0) {
    const clusterColors = [
      0xCC33FF, // Purple
      0xFF33CC, // Pink
      0x33CCFF, // Light Blue
      0xFFCC33, // Orange
      0x33FF99  // Mint
    ];
    
    // Draw each void cluster with a unique color
    scene.voidClusters.forEach((cluster, index) => {
      const color = clusterColors[index % clusterColors.length];
      
      // Draw cluster outline
      scene.debugGraphics.lineStyle(2, color, 0.8);
      
      // Draw each cell in the cluster
      for (const [x, y] of cluster.cells) {
        scene.debugGraphics.strokeRect(
          x * GRID_SIZE, 
          y * GRID_SIZE, 
          GRID_SIZE, 
          GRID_SIZE
        );
      }
      
      // Add cluster info label near the center of the cluster
      const centerX = (cluster.minX + cluster.maxX) / 2 * GRID_SIZE;
      const centerY = (cluster.minY + cluster.maxY) / 2 * GRID_SIZE;
      
      const clusterLabel = scene.add.text(
        centerX,
        centerY,
        `${cluster.type} (${cluster.size})`,
        {
          fontSize: '10px',
          fill: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          backgroundColor: '#00000080'
        }
      ).setOrigin(0.5);
      
      scene.debugText.push(clusterLabel);
    });
  }
  
  // Add a debug legend at the top of the screen
  addDebugLegend(scene);
  
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
 * Add a debug legend to explain the different visual indicators
 * @param {object} scene - The game scene
 */
function addDebugLegend(scene) {
  const legendX = GRID_SIZE * (GUTTER_WIDTH + TOWER_WIDTH + 1);
  let legendY = 200;
  const spacing = 25;
  
  // Legend title
  const title = scene.add.text(
    legendX,
    legendY,
    "Debug Legend",
    {
      fontSize: '14px',
      fontStyle: 'bold',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }
  );
  scene.debugText.push(title);
  legendY += spacing;
  
  // Void indicator
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "Void", 
    0xCC33FF, 
    "Enclosed empty spaces"
  );
  legendY += spacing;
  
  // Overhang indicator
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "Overhang", 
    0xFF0000, 
    "No support below"
  );
  legendY += spacing;
  
  // Thin width indicator
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "Thin Width", 
    0xFF9900, 
    "Row too narrow"
  );
  legendY += spacing;
  
  // Stability colors
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "High Stability", 
    0x4488ff, 
    "> 0.85"
  );
  legendY += spacing;
  
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "Med Stability", 
    0x99ff99, 
    "0.7 - 0.85"
  );
  legendY += spacing;
  
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "Low Stability", 
    0xffaa66, 
    "< 0.5"
  );
  legendY += spacing;
}

/**
 * Helper to add a single legend item
 */
function addLegendItem(scene, x, y, label, color, description) {
  // Color box
  scene.debugGraphics.fillStyle(color, 0.8);
  scene.debugGraphics.fillRect(x, y, 15, 15);
  scene.debugGraphics.lineStyle(1, 0xffffff, 0.8);
  scene.debugGraphics.strokeRect(x, y, 15, 15);
  
  // Label
  const text = scene.add.text(
    x + 20,
    y,
    `${label}: ${description}`,
    {
      fontSize: '12px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 1
    }
  );
  scene.debugText.push(text);
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