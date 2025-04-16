// utils/state.js
import { BOARD_WIDTH, BOARD_HEIGHT, HISTORY_ROWS, BUFFER_ROWS, VISIBLE_ROWS } from "./constants.js";

export class GameState {
  constructor() {
    // Core game state
    this.activePiece = null;
    this.ghostBlocks = [];
    this.board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
    this.historyGrid = Array.from({ length: HISTORY_ROWS }, () => Array(BOARD_WIDTH).fill(0));
    
    // Game progression
    this.score = 0;
    this.towerHeight = 0;
    this.instability = 0;
    
    // Player abilities and status
    this.abilities = [];
    this.lockReady = true;
    this.chargeLevel = 0;
    
    // Multiplayer
    this.adjacentTowers = {};
  }
  
  // Helper methods for state manipulation
  resetBoard() {
    this.board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
  }
  
  addAbility(ability) {
    if (!this.abilities.includes(ability)) {
      this.abilities.push(ability);
    }
    return this.abilities;
  }
  
  removeAbility(ability) {
    this.abilities = this.abilities.filter(a => a !== ability);
    return this.abilities;
  }
  
  setLockReady(isReady) {
    this.lockReady = isReady;
    return this.lockReady;
  }
  
  increaseScore(points) {
    this.score += points;
    return this.score;
  }
  
  increaseTowerHeight(amount = 1) {
    this.towerHeight += amount;
    return this.towerHeight;
  }
  
  setActivePiece(piece) {
    this.activePiece = piece;
    return this.activePiece;
  }
  
  // Tower history management
  updateHistoryGrid(newRows) {
    this.historyGrid = [...newRows, ...this.historyGrid].slice(0, HISTORY_ROWS);
    return this.historyGrid;
  }
  
  // Board state queries
  isCellOccupied(x, y) {
    if (y >= BUFFER_ROWS + VISIBLE_ROWS) {
      const historyY = y - (BUFFER_ROWS + VISIBLE_ROWS);
      return Boolean(this.historyGrid[historyY]?.[x]);
    } else {
      return Boolean(this.board[y]?.[x]);
    }
  }
}