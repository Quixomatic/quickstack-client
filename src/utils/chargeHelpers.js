// utils/chargeHelpers.js
import { updateText } from "./uiHelpers.js";
import { updateSidebarText } from "./ui.js";

// Update the charge meter visuals
export function updateChargeMeter(scene) {
  const chargePercent = (scene.chargeLevel / scene.maxChargeLevel) * 100;
  const meterWidth = (scene.chargeLevel / scene.maxChargeLevel) * 180;
  
  // Update meter fill
  scene.chargeMeter.width = meterWidth;
  
  // Update color based on charge level
  if (chargePercent < 30) {
    scene.chargeMeter.fillColor = 0xff0000; // Red when low
  } else if (chargePercent < 70) {
    scene.chargeMeter.fillColor = 0xffff00; // Yellow when medium
  } else {
    scene.chargeMeter.fillColor = 0x00ff00; // Green when high/full
  }
  
  // Update text
  updateText(scene.chargeText, `${Math.floor(chargePercent)}%`);
  
  // Update lock ready state
  const wasReady = scene.lockReady;
  scene.lockReady = scene.chargeLevel >= scene.maxChargeLevel;
  
  // If lock ready state changed, update sidebar
  if (wasReady !== scene.lockReady) {
    updateSidebarText(scene);
  }
}

// Add charge for various actions
export function addCharge(scene, amount) {
  scene.chargeLevel = Math.min(scene.maxChargeLevel, scene.chargeLevel + amount);
  updateChargeMeter(scene);
}

// Reset charge after using lock
export function resetCharge(scene) {
    console.log("Resetting charge");

  scene.chargeLevel = 0;
  updateChargeMeter(scene);
}

// Get charge based on piece placement quality
export function getPlacementCharge(scene, pieceType, clearedRows = 0) {
  // Base charge for placing any piece
  let charge = 5;
  
  // Bonus charge for clearing rows
  if (clearedRows > 0) {
    charge += clearedRows * 15; // More charge for more rows cleared
  }
  
  // Bonus for placing difficult pieces
  if (pieceType === 'Z' || pieceType === 'S') {
    charge += 2; // These are typically harder to place
  }

  return charge;
}