// stability/debugVisualization.js
import { GRID_SIZE, GUTTER_WIDTH, TOWER_WIDTH, HISTORY_ROWS } from "../constants.js";
import { findTopRow } from "../boardHelpers.js";
import { MIN_STABLE_WIDTH } from "./instabilityCore.js";
import { getStabilityTextColor } from "./stabilityEffects.js";

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
  
  // Define cutoff row for active section vs history
  const cutOffRow = scene.board.length - HISTORY_ROWS;
  
  // Track cells for different stability issues (to avoid double-highlighting)
  const overhangCells = new Set();
  const thinWidthCells = new Set();
  
  // First, calculate which rows are "thin"
  const thinRows = [];
  for (let y = topRow; y < Math.min(cutOffRow, topRow + debugVisibleRows); y++) {
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
      // Skip empty cells
      if (!scene.board[y][x]) continue;
      
      // Handle history rows separately
      if (y >= cutOffRow) {
        // Draw history cells with gray outline
        scene.debugGraphics.lineStyle(1, 0x888888, 0.5);
        scene.debugGraphics.strokeRect(
          x * GRID_SIZE, 
          y * GRID_SIZE, 
          GRID_SIZE, 
          GRID_SIZE
        );
        
        // Add "HISTORY" text to first history row if it's visible
        if (y === cutOffRow && x === GUTTER_WIDTH) {
          const historyLabel = scene.add.text(
            x * GRID_SIZE, 
            y * GRID_SIZE - 20, 
            "HISTORY SECTION (NOT IN STABILITY CALC)",
            { 
              fontSize: '12px', 
              fill: '#888888',
              stroke: '#000000',
              strokeThickness: 1
            }
          );
          scene.debugText.push(historyLabel);
        }
        continue;
      }
      
      // Handle active section with stability values
      // Get stability value
      let value = null;
      if (y < scene.cellStability.length && x < scene.cellStability[0].length) {
        value = scene.cellStability[y][x];
      }
      
      // Skip cells with no stability value
      if (value === null) continue;
      
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
        const hasDirectSupport = y + 1 < scene.board.length && scene.board[y+1] && scene.board[y+1][x] === 1;
        
        if (!hasDirectSupport && y < scene.board.length - 1) {
          // Check for diagonal support
          const hasLeftDiagonalSupport = 
            y + 1 < scene.board.length && 
            x > GUTTER_WIDTH && 
            scene.board[y+1] && scene.board[y+1][x-1] === 1;
          const hasRightDiagonalSupport = 
            y + 1 < scene.board.length && 
            x < GUTTER_WIDTH + TOWER_WIDTH - 1 && 
            scene.board[y+1] && scene.board[y+1][x+1] === 1;
          
          if (!hasLeftDiagonalSupport && !hasRightDiagonalSupport) {
            // Complete overhang
            cellType = 'overhang';
            overhangCells.add(`${x},${y}`);
          }
        }
        
        // Check if in a thin row
        if (thinRows.includes(y)) {
          cellType = overhangCells.has(`${x},${y}`) ? cellType : 'thinWidth';
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
      
      // Add text with stability value (only for active section)
      if (y < cutOffRow && value !== null) {
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
  }

  // Show row stability
  if (scene.rowStability) {
    for (let y = topRow; y < Math.min(cutOffRow, topRow + debugVisibleRows); y++) {
      if (y < scene.rowStability.length && scene.rowStability[y] !== null) {
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
  
  // Draw center of mass indicator for non-empty rows
  for (let y = topRow; y < Math.min(cutOffRow, topRow + debugVisibleRows); y++) {
    if (hasFilledCells(scene.board, y)) {
      // Calculate center of mass for visualization
      let totalMass = 0;
      let weightedSum = 0;
      
      for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
        if (scene.board[y][x]) {
          totalMass++;
          weightedSum += x;
        }
      }
      
      if (totalMass > 0) {
        const centerOfMass = weightedSum / totalMass;
        const idealCenter = GUTTER_WIDTH + (TOWER_WIDTH / 2);
        
        // Draw vertical line at center of mass
        const imbalance = Math.abs(centerOfMass - idealCenter) / (TOWER_WIDTH / 2);
        let lineColor = 0x00ff00; // Green for balanced
        
        if (imbalance > 0.3) {
          lineColor = 0xff9900; // Orange for somewhat imbalanced
        }
        if (imbalance > 0.6) {
          lineColor = 0xff0000; // Red for severely imbalanced
        }
        
        // Draw center of mass marker
        scene.debugGraphics.lineStyle(2, lineColor, 0.8);
        scene.debugGraphics.beginPath();
        scene.debugGraphics.moveTo(centerOfMass * GRID_SIZE, y * GRID_SIZE);
        scene.debugGraphics.lineTo(centerOfMass * GRID_SIZE, (y + 1) * GRID_SIZE);
        scene.debugGraphics.closePath();
        scene.debugGraphics.strokePath();
        
        // Draw ideal center marker (fainter)
        scene.debugGraphics.lineStyle(1, 0xffffff, 0.3);
        scene.debugGraphics.beginPath();
        scene.debugGraphics.moveTo(idealCenter * GRID_SIZE, y * GRID_SIZE);
        scene.debugGraphics.lineTo(idealCenter * GRID_SIZE, (y + 1) * GRID_SIZE);
        scene.debugGraphics.closePath();
        scene.debugGraphics.strokePath();
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
        // Skip cells in history section
        if (y >= cutOffRow) continue;
        
        scene.debugGraphics.strokeRect(
          x * GRID_SIZE, 
          y * GRID_SIZE, 
          GRID_SIZE, 
          GRID_SIZE
        );
      }
      
      // Add cluster info label near the center of the cluster
      if (cluster.cells.length > 0) {
        // Find cells that are in the active section
        const activeCells = cluster.cells.filter(([_, y]) => y < cutOffRow);
        if (activeCells.length === 0) return; // Skip this cluster in forEach
        
        // Calculate center based on active cells only
        let sumX = 0, sumY = 0;
        activeCells.forEach(([x, y]) => {
          sumX += x;
          sumY += y;
        });
        const centerX = (sumX / activeCells.length) * GRID_SIZE + GRID_SIZE/2;
        const centerY = (sumY / activeCells.length) * GRID_SIZE + GRID_SIZE/2;
        
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
      }
    });
  }
  
  // Add a debug legend at the top of the screen
  addDebugLegend(scene);
  
  // Show tower and historical stability values
  if (scene.instability !== undefined) {
    const currentStability = 100 - scene.instability;
    const displayStability = scene.rawSectionStability !== undefined ? 
      scene.rawSectionStability : 
      currentStability;
    
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
  
  // Balance indicator
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "Off Balance", 
    0xFF9900, 
    "Center of mass offset"
  );
  legendY += spacing;
  
  // History indicator
  addLegendItem(
    scene, 
    legendX, 
    legendY, 
    "History", 
    0x888888, 
    "Not in stability calc"
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

/**
 * Helper to check if a row has any filled cells
 * @param {Array} board - The game board
 * @param {number} y - Row index
 * @returns {boolean} True if row has filled cells
 */
function hasFilledCells(board, y) {
  if (!board[y]) return false;
  
  for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
    if (board[y][x]) return true;
  }
  return false;
}