// utils/ui.js

export function updateAbilityText(scene) {
  scene.abilityText.setText(`Abilities: ${scene.abilities.join(", ") || "none"}`);
}

export function updateSidebarText(scene) {
  scene.lockStatusText.setText(`Lock: ${scene.lockReady ? "Ready (L)" : "Unavailable"}`);
}
