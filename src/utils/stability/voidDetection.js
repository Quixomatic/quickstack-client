// stability/voidDetection.js
import { GUTTER_WIDTH, TOWER_WIDTH } from "../constants.js";
import { VOID_STABILITY } from "./instabilityCore.js";

/**
 * Detect all voids on the board and calculate their effects on stability
 * @param {Array} board - The game board
 * @param {number} topRow - The topmost occupied row
 * @param {Array} initialCellStability - Initial cell stability values
 * @param {number} cutOffRow - The row where history begins
 * @returns {Object} Object containing updated cell stability and void clusters
 */
export function detectVoids(board, topRow, initialCellStability, cutOffRow) {
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
export function findAccessibleCells(board, topRow) {
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
export function identifyVoidCluster(board, visited, startX, startY, cutOffRow) {
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
export function analyzeVoidCluster(board, cluster) {
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
      if (board[ny] && board[ny][nx] === 1) {
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
 * @param {number} cutOffRow - The row where history begins
 */
export function propagateVoidEffects(board, cellStability, cluster, cutOffRow) {
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
    // Skip cells in history
    if (y >= cutOffRow) continue;
    
    // Check adjacent positions (including diagonals)
    const directions = [
      [-1, -1], [0, -1], [1, -1], // Above
      [-1, 0], [1, 0],            // Sides
      [-1, 1], [0, 1], [1, 1]     // Below
    ];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      // Skip if out of bounds, in history, or not a block
      if (nx < GUTTER_WIDTH || nx >= GUTTER_WIDTH + TOWER_WIDTH || 
          ny < 0 || ny >= cutOffRow || 
          !board[ny] || board[ny][nx] !== 1) {
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