// stability/instabilityCore.js
import { GUTTER_WIDTH, TOWER_WIDTH, HISTORY_ROWS } from "../constants.js";
import { findTopRow } from "../boardHelpers.js";
import { detectVoids } from "./voidDetection.js";
import {
  applyOverhangPenalties,
  applyThinWidthPenalties,
  applyBalancePenalties,
} from "./supportStructure.js";
import { updateStabilityEffects } from "./stabilityEffects.js";

// Constants for stability calculations
export const MAX_INSTABILITY = 100;
export const SUPPORT_WEIGHT = 0.7; // Weight for support from below
export const NEIGHBOR_WEIGHT = 0.15; // Weight for lateral support
export const OVERHANG_PENALTY = 0.35; // Increased from 0.25 - Penalty for blocks with no direct support
export const VOID_STABILITY = -0.5; // Negative stability value for void cells
export const CAPPING_PENALTY = 0.4; // Penalty for blocks directly capping voids
export const THIN_TOWER_PENALTY = 0.4; // Increased from 0.3 - Penalty for thin towers
export const BALANCE_PENALTY = 0.3; // Penalty factor for imbalanced rows
export const MIN_STABLE_WIDTH = 6; // Minimum width considered stable (out of 10)
export const IDEAL_ROW_STABILITY = 1.0; // Perfect stability score for comparison
export const CRITICAL_STABILITY = 0.4; // Below this is critically unstable
export const CONSECUTIVE_CRITICAL_LIMIT = 2; // This many consecutive critical rows is dangerous

/**
 * Calculate the current stability of the tower
 * @param {object} scene - The game scene
 * @returns {number} The calculated stability value (0-100, higher is more stable)
 */
export function calculateStability(scene) {
  const board = scene.board;
  const topRow = findTopRow(board);

  if (topRow === -1) return 100; // No blocks, tower is perfectly stable

  // Define cutoff row for active section vs history
  const cutOffRow = board.length - HISTORY_ROWS;

  // Initialize cell stability with default values (all cells are stable)
  const cellStability = Array.from({ length: board.length }, () =>
    Array(board[0].length).fill(1.0)
  );

  // Step 1: Perform void detection on active section only
  const { updatedCellStability, voidClusters } = detectVoids(
    board,
    topRow,
    cellStability,
    cutOffRow
  );

  // Step 2: Apply support and overhang penalties to active section only
  applyOverhangPenalties(board, updatedCellStability, cutOffRow);

  // Step 3: Calculate thin tower penalties for active section only
  applyThinWidthPenalties(board, updatedCellStability, cutOffRow);

  // Step 4: Calculate balance penalties (center of mass)
  applyBalancePenalties(board, updatedCellStability, cutOffRow);

  // Store void clusters for visualization
  scene.voidClusters = voidClusters;

  // Calculate row stability for active section only
  const rowStability = [];
  for (let y = 0; y < board.length; y++) {
    if (y >= cutOffRow) {
      // History rows have no stability calculation
      rowStability[y] = null;
    } else {
      rowStability[y] = calculateRowStability(updatedCellStability, board, y);
    }
  }

  // Calculate raw section stability (without historical influence)
  const rawSectionStability = calculateRawSectionStability(
    rowStability,
    board,
    topRow,
    cutOffRow
  );

  // Store raw stability for display purposes
  scene.rawSectionStability = rawSectionStability;

  // Calculate overall tower stability with historical influence
  let towerStability = rawSectionStability;

  // Apply historical influence with greater weight
  if (scene.historicalStability !== undefined) {
    // Give historical stability more weight (70% historical, 30% current)
    towerStability = scene.historicalStability * 0.7 + towerStability * 0.3;

    // If historical stability is low, it actively reduces current stability
    if (scene.historicalStability < 50) {
      const penalty = (50 - scene.historicalStability) * 0.5;
      towerStability -= penalty;
    }
  }

  // Apply external factors (like attacks) as instability
  towerStability = Math.max(
    0,
    towerStability - (scene.externalInstability || 0)
  );

  // Cache the stability data for visualization
  scene.cellStability = updatedCellStability;
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
  // Calculate stability for the entire tower
  const stability = calculateStability(scene);

  // Update scene stability value (as instability for gameplay purposes)
  scene.instability = MAX_INSTABILITY - stability;

  // Update visual effects
  updateStabilityEffects(scene);

  return stability;
}

/**
 * Calculate row stability including void cells
 * @param {Array} cellStability - 2D array of cell stability values
 * @param {Array} board - The game board
 * @param {number} y - Row index
 * @returns {number} Row stability value (can be negative)
 */
export function calculateRowStability(cellStability, board, y) {
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

  // Allow negative row stability - don't clamp to 0
  return Math.min(1.0, avgStability);
}

/**
 * Calculate raw section stability without historical influence
 * @param {Array} rowStabilities - Array of row stability values
 * @param {Array} board - The game board
 * @param {number} topRow - The topmost occupied row
 * @param {number} cutOffRow - The row where history begins
 * @returns {number} Raw section stability (0-100)
 */
export function calculateRawSectionStability(
  rowStabilities,
  board,
  topRow,
  cutOffRow
) {
  // Track worst section and consecutive unstable rows
  let worstSectionStability = 1.0;
  let consecLowStabilityRows = 0;
  let currentSectionStability = 1.0;
  let negativeRowCount = 0;

  // Process each row from top to bottom (only active section)
  for (let y = topRow; y < cutOffRow; y++) {
    // Skip empty rows or null values
    if (
      !rowStabilities[y] ||
      (rowStabilities[y] === 1.0 && !hasFilledCells(board, y))
    )
      continue;

    // Track consecutive low stability
    if (rowStabilities[y] < CRITICAL_STABILITY) {
      consecLowStabilityRows++;
      currentSectionStability = Math.min(
        currentSectionStability,
        rowStabilities[y]
      );

      // Severely penalize consecutive unstable rows
      if (consecLowStabilityRows >= CONSECUTIVE_CRITICAL_LIMIT) {
        worstSectionStability = Math.min(
          worstSectionStability,
          currentSectionStability * 0.5 // More aggressive penalty
        );
      }

      // Count rows with negative stability
      if (rowStabilities[y] < 0) {
        negativeRowCount++;
      }
    } else {
      // Reset tracking for non-critical rows
      consecLowStabilityRows = 0;
      currentSectionStability = 1.0;
    }

    // Always track the overall worst stability
    worstSectionStability = Math.min(worstSectionStability, rowStabilities[y]);
  }

  // Calculate structural integrity score
  let structuralIntegrity = worstSectionStability * 0.6 + 0.4;

  // Apply larger penalty for negative rows
  if (negativeRowCount > 0) {
    structuralIntegrity -= negativeRowCount * 0.2; // Each negative row reduces overall stability by 20%
  }

  // Apply height penalty
  const towerHeight = countFilledRows(board, topRow, cutOffRow);
  const heightFactor = Math.max(0, towerHeight - 10) * 0.02; // Increased penalty factor
  structuralIntegrity -= heightFactor;

  // Allow negative overall stability
  // Convert to percentage, but allow negative values
  return Math.min(100, structuralIntegrity * 100);
}

/**
 * Helper to check if a row has any filled cells
 * @param {Array} board - The game board
 * @param {number} y - Row index
 * @returns {boolean} True if row has filled cells
 */
export function hasFilledCells(board, y) {
  if (!board[y]) return false;

  for (let x = GUTTER_WIDTH; x < GUTTER_WIDTH + TOWER_WIDTH; x++) {
    if (board[y][x]) return true;
  }
  return false;
}

/**
 * Count the number of rows with blocks in them (only in active section)
 */
export function countFilledRows(board, topRow, cutOffRow) {
  let count = 0;
  for (let y = topRow; y < cutOffRow; y++) {
    if (hasFilledCells(board, y)) count++;
  }
  return count;
}
