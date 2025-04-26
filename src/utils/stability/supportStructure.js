// stability/supportStructure.js
import { GUTTER_WIDTH, TOWER_WIDTH } from "../constants.js";
import {
  OVERHANG_PENALTY,
  NEIGHBOR_WEIGHT,
  THIN_TOWER_PENALTY,
  MIN_STABLE_WIDTH,
  BALANCE_PENALTY,
} from "./instabilityCore.js";
import { hasFilledCells } from "./instabilityCore.js";

/**
 * Apply overhang penalties to blocks without support
 * @param {Array} board - The game board
 * @param {Array} cellStability - Cell stability values to update
 * @param {number} cutOffRow - The row where history begins
 */
export function applyOverhangPenalties(board, cellStability, cutOffRow) {
  // Only process active section (not history)
  for (let y = 0; y < cutOffRow - 1; y++) {
    // Skip the bottom row of active section
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      // Skip empty cells
      if (!board[y][x]) continue;

      // Check for direct support
      const hasDirectSupport = board[y + 1] && board[y + 1][x] === 1;

      if (!hasDirectSupport) {
        // Check for diagonal support
        const hasLeftDiagonalSupport =
          x > GUTTER_WIDTH && board[y + 1] && board[y + 1][x - 1] === 1;
        const hasRightDiagonalSupport =
          x < GUTTER_WIDTH + TOWER_WIDTH - 1 &&
          board[y + 1] &&
          board[y + 1][x + 1] === 1;

        if (hasLeftDiagonalSupport || hasRightDiagonalSupport) {
          // Diagonal support is better than nothing but still problematic
          cellStability[y][x] = Math.max(
            -1.0,
            cellStability[y][x] - OVERHANG_PENALTY * 0.7
          ); // Increased from 0.5
        } else {
          // Complete overhang is very unstable - can go negative
          cellStability[y][x] = Math.max(
            -1.0,
            cellStability[y][x] - OVERHANG_PENALTY * 2.0
          );
        }
      }

      // Apply lateral support bonuses
      const hasLeftNeighbor = x > GUTTER_WIDTH && board[y][x - 1] === 1;
      const hasRightNeighbor =
        x < GUTTER_WIDTH + TOWER_WIDTH - 1 && board[y][x + 1] === 1;

      if (hasLeftNeighbor)
        cellStability[y][x] = Math.min(
          1.0,
          cellStability[y][x] + NEIGHBOR_WEIGHT
        );
      if (hasRightNeighbor)
        cellStability[y][x] = Math.min(
          1.0,
          cellStability[y][x] + NEIGHBOR_WEIGHT
        );

      // Edge support
      const isLeftEdge = x === GUTTER_WIDTH;
      const isRightEdge = x === GUTTER_WIDTH + TOWER_WIDTH - 1;
      if (isLeftEdge || isRightEdge) {
        cellStability[y][x] = Math.min(
          1.0,
          cellStability[y][x] + NEIGHBOR_WEIGHT * 0.3
        );
      }
    }
  }

  // The bottom row of active section always has perfect stability
  const bottomRow = cutOffRow - 1;
  for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
    if (board[bottomRow] && board[bottomRow][x]) {
      cellStability[bottomRow][x] = 1.0;
    }
  }
}

/**
 * Apply thin width penalties
 * @param {Array} board - The game board
 * @param {Array} cellStability - Cell stability values to update
 * @param {number} cutOffRow - The row where history begins
 */
export function applyThinWidthPenalties(board, cellStability, cutOffRow) {
  // Only process active section (not history)
  for (let y = 0; y < cutOffRow; y++) {
    // Skip empty rows
    if (!hasFilledCells(board, y)) continue;

    // Calculate row width
    let rowWidth = 0;
    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      if (board[y][x]) rowWidth++;
    }

    // Apply thin tower penalty
    if (rowWidth > 0 && rowWidth < MIN_STABLE_WIDTH) {
      // Make penalty more severe for very thin rows
      const widthFactor = (MIN_STABLE_WIDTH - rowWidth) / MIN_STABLE_WIDTH;
      const widthPenalty = widthFactor * THIN_TOWER_PENALTY * 1.5; // Added multiplier

      // Apply to all blocks in this row
      for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
        if (board[y][x]) {
          cellStability[y][x] = Math.max(
            -1.0,
            cellStability[y][x] - widthPenalty
          );
        }
      }
    }
  }
}

/**
 * Apply penalties for imbalanced rows (center of mass too far from middle)
 * @param {Array} board - The game board
 * @param {Array} cellStability - Cell stability values to update
 * @param {number} cutOffRow - The row where history begins
 */
export function applyBalancePenalties(board, cellStability, cutOffRow) {
  // Process each row in active section
  for (let y = 0; y < cutOffRow; y++) {
    // Skip empty rows
    if (!hasFilledCells(board, y)) continue;

    // Calculate center of mass for this row
    let totalMass = 0;
    let weightedSum = 0;

    for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
      if (board[y][x]) {
        totalMass++;
        weightedSum += x;
      }
    }

    // Skip rows with only one block (no balance issues)
    if (totalMass <= 1) continue;

    // Calculate center of mass
    const centerOfMass = weightedSum / totalMass;

    // Calculate the ideal center (middle of tower area)
    const idealCenter = GUTTER_WIDTH + TOWER_WIDTH / 2;

    // Calculate imbalance as distance from ideal center (normalized to 0-1 range)
    const maxPossibleOffset = TOWER_WIDTH / 2;
    const imbalance = Math.abs(centerOfMass - idealCenter) / maxPossibleOffset;

    // Apply penalties based on imbalance
    // Only penalize significant imbalances (more than 30% off center)
    if (imbalance > 0.3) {
      const balancePenalty = (imbalance - 0.3) * BALANCE_PENALTY;

      // Apply to all blocks in this row
      for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
        if (board[y][x]) {
          // Blocks farther from center get bigger penalties
          const distanceFromCenter =
            Math.abs(x - idealCenter) / maxPossibleOffset;
          const blockPenalty =
            balancePenalty * (0.5 + distanceFromCenter * 0.5);

          cellStability[y][x] = Math.max(
            -1.0,
            cellStability[y][x] - blockPenalty
          );
        }
      }
    }
  }
}
