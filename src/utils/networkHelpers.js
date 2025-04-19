// utils/networkHelpers.js
import * as Colyseus from "colyseus.js";
import { shakeScreen, flashScreen } from "./animHelpers.js";
import { updateStabilityAfterPlacement  } from "./instabilityHelpers.js";

// Create a Colyseus client connection
export function createClient(endpoint = "ws://localhost:2567") {
  return new Colyseus.Client(endpoint);
}

// Join or create a room
export async function joinRoom(client, roomName, options = {}) {
  try {
    const room = await client.joinOrCreate(roomName, options);
    return room;
  } catch (error) {
    console.error("Error joining room:", error);
    return null;
  }
}

// Send a message to the room with error handling
export function sendRoomMessage(room, messageType, data, onError) {
  try {
    if (room) {
      room.send(messageType, data);
      return true;
    }
    return false;
  } catch (error) {
    if (onError) onError(error);
    console.error(`Error sending ${messageType}:`, error);
    return false;
  }
}

// Setup standard message handlers
export function setupMessageHandlers(room, scene, TETROMINO_SHAPES) {
  if (!room) return;
  
  // Game start handler
  room.onMessage("gameStart", () => {
    scene.spawnTetromino(TETROMINO_SHAPES);
  });
  
  // Attack handler
  room.onMessage("incomingAttack", (data) => {
    const attackStrength = data.strength || 10;
    scene.externalInstability += attackStrength;
    
    // Recalculate instability after attack
    scene.instability += attackStrength;
    
    // Update visuals after attack
    if (scene.cellStability) {
      updateStabilityAfterPlacement (scene, {
        shape: [[1]], // Dummy shape for recalculation
        x: GUTTER_WIDTH,
        y: findTopRow(scene.board) || 0
      });
    }
    
    // Visual feedback
    shakeScreen(scene);
    flashScreen(scene, 300, 0xff0000);
    
    // Display attack message
    const attackText = scene.add.text(
      scene.game.config.width / 2,
      150,
      `ATTACK! +${attackStrength} INSTABILITY`,
      { fontSize: '24px', fill: '#ff0000', fontStyle: 'bold' }
    ).setOrigin(0.5);
    
    // Fade out attack message
    scene.tweens.add({
      targets: attackText,
      alpha: 0,
      y: 100,
      duration: 1500,
      onComplete: () => attackText.destroy()
    });
  });
  
  // Tower update handler
  room.onMessage("adjacentTowerUpdate", ({ from, towerHeight, instability }) => {
    updateAdjacentTower(scene, from, towerHeight, instability);
  });
  
  // Tower collapse handler
  room.onMessage("towerCollapse", (data) => {
    // Display notification about opponent's tower collapsing
    const collapseText = scene.add.text(
      scene.game.config.width / 2,
      150,
      `OPPONENT'S TOWER COLLAPSED!`,
      { fontSize: '20px', fill: '#ffaa00', fontStyle: 'bold' }
    ).setOrigin(0.5);
    
    // Fade out message
    scene.tweens.add({
      targets: collapseText,
      alpha: 0,
      y: 100,
      duration: 1500,
      onComplete: () => collapseText.destroy()
    });
  });
  
  return room;
}

// Update adjacent tower visualization
export function updateAdjacentTower(scene, from, towerHeight, instability) {
  if (!scene.adjacentTowers[from]) {
    scene.adjacentTowers[from] = scene.add.group();
  }
  
  const tower = scene.adjacentTowers[from];
  tower.clear(true, true);
  
  const index = Object.keys(scene.adjacentTowers).indexOf(from);
  const baseX = 250 + index * 60;
  const baseY = 580;
  
  for (let i = 0; i < towerHeight; i++) {
    const block = scene.add.image(baseX, baseY - i * 20, "block").setScale(0.5);
    tower.add(block);
    
    // Color based on instability
    if (instability > 80) {
      block.setTint(0xff5555); // Red for high instability
    } else if (instability > 50) {
      block.setTint(0xffaa66); // Orange for medium instability  
    } else if (instability > 30) {
      block.setTint(0xffffaa); // Yellow for low instability
    }
  }
}

// Use an ability
export function useAbility(scene, abilityType) {
  if (scene.abilities.includes(abilityType)) {
    sendRoomMessage(scene.room, "useAbility", { type: abilityType });
    scene.abilities = scene.abilities.filter(a => a !== abilityType);
    return true;
  }
  return false;
}

// Find topmost row (helper function)
function findTopRow(board) {
  for (let y = 0; y < board.length; y++) {
    if (board[y].some(cell => cell === 1)) {
      return y;
    }
  }
  return -1;
}