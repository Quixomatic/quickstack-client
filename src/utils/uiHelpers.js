// utils/uiHelpers.js
import { GRID_SIZE, BOARD_WIDTH } from "./constants.js";

// Create a standard text style object with customizable properties
export function createTextStyle(options = {}) {
  return {
    fontSize: options.fontSize || "16px",
    fill: options.fill || "#fff",
    wordWrap: { width: options.wrapWidth || 180 },
    fixedWidth: options.fixedWidth || 180,
    ...options
  };
}

// Update a text element with new content
export function updateText(textObject, newContent, prefix = "") {
  textObject.setText(`${prefix}${newContent}`);
  return textObject;
}

// Create a shaded rectangle
export function createShadedRect(scene, x, y, width, height, color = 0xffffff, alpha = 0.05) {
  return scene.add.rectangle(x, y, width, height, color)
    .setOrigin(0, 0)
    .setAlpha(alpha);
}

// Format ability list for display
export function formatAbilityList(abilities) {
  return abilities.length > 0 ? abilities.join(", ") : "none";
}