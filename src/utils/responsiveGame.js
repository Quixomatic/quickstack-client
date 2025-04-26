// utils/responsiveGame.js
import { GRID_SIZE, BOARD_WIDTH, BOARD_HEIGHT, BUFFER_ROWS } from "./constants.js";

/**
 * Set up responsive game canvas and camera
 * @param {object} scene - The game scene
 */
export function setupResponsiveGame(scene) {
  // Store original design dimensions
  scene.originalWidth = GRID_SIZE * BOARD_WIDTH + 200;
  scene.originalHeight = GRID_SIZE * BOARD_HEIGHT;
  
  // Store current window dimensions to detect actual changes
  scene.currentWindowWidth = window.innerWidth;
  scene.currentWindowHeight = window.innerHeight;
  
  // Set up resize callback (throttled to prevent constant resizing)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    // Cancel any pending resize
    if (resizeTimeout) clearTimeout(resizeTimeout);
    
    // Only resize if dimensions actually changed
    if (window.innerWidth !== scene.currentWindowWidth || 
        window.innerHeight !== scene.currentWindowHeight) {
      
      // Set a timeout to prevent rapid consecutive resizes
      resizeTimeout = setTimeout(() => {
        scene.currentWindowWidth = window.innerWidth;
        scene.currentWindowHeight = window.innerHeight;
        resizeGame(scene);
      }, 250);
    }
  });
  
  // Initial resize
  resizeGame(scene);
  
  // Add pinch/zoom controls on touch devices
  setupTouchControls(scene);
}

/**
 * Resize game based on window size
 * @param {object} scene - The game scene
 */
function resizeGame(scene) {
  const { game } = scene;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Calculate maximum scale to fit window
  const widthScale = windowWidth / scene.originalWidth;
  const heightScale = windowHeight / scene.originalHeight;
  let scale = Math.min(widthScale, heightScale, 1); // Never scale up beyond 1
  
  // On very small screens, allow scrolling and minimum usable scale
  scale = Math.max(scale, 0.5); 
  
  // Resize the game canvas
  const newWidth = Math.round(scene.originalWidth * scale);
  const newHeight = Math.round(scene.originalHeight * scale);
  
  game.scale.resize(newWidth, newHeight);
  
  // If the game is too tall, adjust camera y position
  if (newHeight > windowHeight) {
    // Show the active gameplay area by default
    const visibleTop = (BUFFER_ROWS + 5) * GRID_SIZE * scale;
    scene.cameras.main.scrollY = visibleTop;
  } else {
    scene.cameras.main.scrollY = 0;
  }
  
  // Store current scale for touch controls
  scene.currentScale = scale;
  
  // Update UI scale and positions
  updateUI(scene, scale);
  
  // Check orientation
  checkOrientation(scene);
  
  console.log(`Resized game: ${newWidth}x${newHeight}, scale: ${scale}`);
}

/**
 * Set up touch-based controls for mobile
 * @param {object} scene - The game scene
 */
function setupTouchControls(scene) {
  // Variables to track touch/drag
  let dragStartX = 0;
  let dragStartY = 0;
  let isDragging = false;
  let pinchDistance = 0;
  let isPinching = false;
  
  // Add indicator for touch controls on mobile
  const touchControls = scene.add.text(
    10, 10, 
    "Drag to move | Pinch to zoom", 
    { fontSize: '14px', fill: '#ffffff', backgroundColor: '#00000080', padding: { x: 5, y: 3 } }
  );
  touchControls.setScrollFactor(0); // Fix to camera
  touchControls.setDepth(100);
  touchControls.alpha = 0;
  
  // Only show on touch devices
  if ('ontouchstart' in window) {
    scene.time.delayedCall(1000, () => {
      touchControls.alpha = 1;
      scene.tweens.add({
        targets: touchControls,
        alpha: 0,
        delay: 3000,
        duration: 1000
      });
    });
  }
  
  // Touch start
  scene.input.on('pointerdown', (pointer) => {
    if (pointer.button === 0) { // Left button/touch
      dragStartX = pointer.x;
      dragStartY = pointer.y;
      isDragging = true;
    }
  });
  
  // Touch move
  scene.input.on('pointermove', (pointer) => {
    if (!isDragging) return;
    
    const deltaX = pointer.x - dragStartX;
    const deltaY = pointer.y - dragStartY;
    
    // If movement is significant, scroll the camera
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      scene.cameras.main.scrollX -= deltaX / scene.currentScale;
      scene.cameras.main.scrollY -= deltaY / scene.currentScale;
      
      // Update drag start positions
      dragStartX = pointer.x;
      dragStartY = pointer.y;
    }
  });
  
  // Touch end
  scene.input.on('pointerup', () => {
    isDragging = false;
  });
  
  // Add pinch zoom for mobile
  scene.input.on('pointermove', function (pointer) {
    if (scene.input.pointer1 && scene.input.pointer2 && 
        scene.input.pointer1.isDown && scene.input.pointer2.isDown) {
      // Calculate current distance between pointers
      const currentDistance = Phaser.Math.Distance.Between(
        scene.input.pointer1.x, scene.input.pointer1.y,
        scene.input.pointer2.x, scene.input.pointer2.y
      );
      
      if (!isPinching) {
        pinchDistance = currentDistance;
        isPinching = true;
      } else {
        // Calculate zoom factor
        const zoomFactor = currentDistance / pinchDistance;
        
        // Adjust camera zoom
        const newZoom = scene.cameras.main.zoom * zoomFactor;
        
        // Limit zoom range
        if (newZoom > 0.5 && newZoom < 2) {
          scene.cameras.main.zoom = newZoom;
        }
        
        // Update pinch distance
        pinchDistance = currentDistance;
      }
    } else {
      isPinching = false;
    }
  });
  
  // Reset when touch ends
  scene.input.on('pointerup', function () {
    isPinching = false;
  });
  
  // Add keyboard camera controls for desktop
  const cursors = scene.input.keyboard.createCursorKeys();
  
  // Update function to check keyboard input
  scene.events.on('update', () => {
    const speed = 10 / scene.cameras.main.zoom;
    
    if (cursors.up.isDown) {
      scene.cameras.main.scrollY -= speed;
    } else if (cursors.down.isDown) {
      scene.cameras.main.scrollY += speed;
    }
    
    if (cursors.left.isDown) {
      scene.cameras.main.scrollX -= speed;
    } else if (cursors.right.isDown) {
      scene.cameras.main.scrollX += speed;
    }
    
    // Zoom with keyboard
    if (cursors.space.isDown && !cursors.space.wasDown) {
      // Toggle between default and zoomed out
      if (scene.cameras.main.zoom === 1) {
        scene.cameras.main.zoom = 0.7;
      } else {
        scene.cameras.main.zoom = 1;
      }
    }
    cursors.space.wasDown = cursors.space.isDown;
  });
}

/**
 * Update UI elements based on scale
 * @param {object} scene - The game scene
 * @param {number} scale - The current scale factor
 */
function updateUI(scene, scale) {
  // Sidebar position
  if (scene.sidebar) {
    scene.sidebar.x = (GRID_SIZE * BOARD_WIDTH) * scale;
    scene.sidebar.displayWidth = 200 * scale;
    scene.sidebar.displayHeight = GRID_SIZE * BOARD_HEIGHT * scale;
  }
  
  // UI text
  const uiElements = [
    scene.scoreText, scene.abilityText, scene.lockStatusText, 
    scene.instabilityText, scene.levelText, scene.linesText
  ];
  
  // Update all UI text elements
  uiElements.forEach((element, index) => {
    if (!element) return;
    
    element.x = (GRID_SIZE * BOARD_WIDTH + 10) * scale;
    element.y = (10 + index * 30) * scale;
    element.setFontSize(16 * scale);
  });
  
  // Update charge meter if it exists
  if (scene.chargeMeter) {
    scene.chargeMeter.x = (GRID_SIZE * BOARD_WIDTH + 10) * scale;
    scene.chargeMeter.y = 380 * scale;
    scene.chargeMeter.displayWidth = scene.chargeMeter.width * scale;
    scene.chargeMeter.displayHeight = 20 * scale;
  }
  
  // Update charge text
  if (scene.chargeText) {
    scene.chargeText.x = (GRID_SIZE * BOARD_WIDTH + 100) * scale;
    scene.chargeText.y = 380 * scale;
    scene.chargeText.setFontSize(14 * scale);
  }
  
  // Update any other UI elements as needed
}

/**
 * Check device orientation and display message if needed
 * @param {object} scene - The game scene
 */
function checkOrientation(scene) {
  // Check if we're on mobile
  const isMobile = scene.game.device.os.android || scene.game.device.os.iOS ||
                  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    const isLandscape = window.innerWidth > window.innerHeight;
    
    // Show/hide orientation message
    if (!isLandscape) {
      if (!scene.orientationMessage) {
        scene.orientationMessage = scene.add.text(
          scene.cameras.main.centerX, 
          scene.cameras.main.centerY,
          "Please rotate your device to landscape mode for the best experience",
          { 
            fontSize: '18px', 
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 20, y: 10 },
            align: 'center',
            wordWrap: { width: window.innerWidth - 40 }
          }
        ).setScrollFactor(0).setOrigin(0.5).setDepth(1000);
      } else {
        scene.orientationMessage.setVisible(true);
      }
    } else if (scene.orientationMessage) {
      scene.orientationMessage.setVisible(false);
    }
  }
}

export default setupResponsiveGame;