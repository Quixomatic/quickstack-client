// utils/animHelpers.js

// Create a tetromino placement animation
export function animateBlockPlacement(scene, block) {
  scene.tweens.add({
    targets: block,
    scale: { from: 1.3, to: 1 },
    duration: 200,
    ease: "Back"
  });
  return block;
}

// Flash effect (for attacks, etc.)
export function flashScreen(scene, duration = 300, color = 0xff0000) {
  scene.cameras.main.flash(duration, color >> 16 & 0xff, color >> 8 & 0xff, color & 0xff);
}

// Shake effect
export function shakeScreen(scene, duration = 300, intensity = 0.01) {
  scene.cameras.main.shake(duration, intensity);
}

// Animate score change
export function animateScoreChange(scene, amount, x, y) {
  const text = scene.add.text(x, y, `+${amount}`, {
    fontSize: '24px',
    fill: '#fff'
  }).setOrigin(0.5);
  
  scene.tweens.add({
    targets: text,
    y: y - 50,
    alpha: 0,
    duration: 1000,
    onComplete: () => text.destroy()
  });
}

// Animate a line clear
export function animateLineClear(scene, row) {
  const y = row * scene.gridSize;
  const width = scene.game.config.width;
  
  const flash = scene.add.rectangle(0, y, width, scene.gridSize, 0xffffff)
    .setOrigin(0, 0)
    .setAlpha(0.7);
  
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 300,
    onComplete: () => flash.destroy()
  });
}