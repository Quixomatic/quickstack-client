// utils/ui.js
import { formatAbilityList, updateText } from "./uiHelpers.js";

export function updateAbilityText(scene) {
  updateText(scene.abilityText, formatAbilityList(scene.abilities), "Abilities: ");
}

export function updateSidebarText(scene) {
  updateText(scene.lockStatusText, scene.lockReady ? "Ready (L)" : "Charging...", "Lock: ");
}