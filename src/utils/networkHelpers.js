// utils/networkHelpers.js
import * as Colyseus from "colyseus.js";
import { shakeScreen, flashScreen } from "./animHelpers.js";

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
  room.onMessage("incomingAttack", () => {
    scene.instability += 10;
    shakeScreen(scene);
    flashScreen(scene);
  });
  
  // Tower update handler
  room.onMessage("adjacentTowerUpdate", ({ from, towerHeight, instability }) => {
    updateAdjacentTower(scene, from, towerHeight, instability);
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
    
    if (instability > 20) {
      block.setTint(0xff5555);
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