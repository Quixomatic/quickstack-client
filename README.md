# QuickStack Development Plan

## 🎮 Game Concept

**QuickStack** is a fast-paced, skill-based 2D stacking game where players drop tetromino-style blocks to build the tallest and most stable tower possible. The game is designed for both single-player and competitive multiplayer modes.

### 🧠 Core Design Philosophy
- Encourage **quick decision-making** and **strategic tower management**
- Reward stability, clean play, and momentum through lock-based mechanics
- Track tower history visually and mechanically to reinforce progress
- Provide subtle but powerful ability-based interactions in multiplayer

### 🎯 Vision
- Competitive and casual appeal (easy to start, hard to master)
- Emphasis on **recoverable failure** — towers can wobble, collapse, or be re-stabilized
- Blend **Tetris familiarity** with **roguelike progression** (tower locking)
- Create a visual log of tower growth through the history system
- Enable long-term ranked play with server-based progression and match data

**QuickStack** is a competitive 2D multiplayer game where players drop tetromino-style blocks to build a tall and stable tower. The game includes a buffer zone for spawning, a visible play area, and a history zone below the fold to preserve previous tower sections.

- Players compete to build stable towers.
- Strategic locking of tower sections allows players to push progress downward and reset the board.
- Multiplayer interactions include visibility of other towers and real-time attacks.

---

## 📁 Project Structure
```
QuickStack/
├── client/                      # Vite-powered Phaser game client
│   ├── assets/                 # Game assets (e.g., block.png)
│   ├── src/
│   │   ├── main.js             # Phaser entry point (modularized)
│   │   └── utils/              # Modular game logic
│   │       ├── constants.js    # Game constants
│   │       ├── create.js       # Scene setup
│   │       ├── boardHelpers.js # Board manipulation and cell checking
│   │       ├── draw.js         # drawPiece, drawGhostPiece, clearActiveBlocks
│   │       ├── collision.js    # checkCollision, checkCollisionAt
│   │       ├── move.js         # movePiece, rotatePiece, dropPiece
│   │       ├── place.js        # lockPiece logic
│   │       ├── lock.js         # lockTowerSection logic
│   │       ├── spawn.js        # spawnTetromino logic
│   │       ├── ui.js           # updateAbilityText, updateSidebarText
│   │       ├── uiHelpers.js    # UI element creation and text updates
│   │       ├── tetrominoHelpers.js # Piece manipulation and rendering
│   │       ├── pieceHelpers.js # Preview queue and piece management
│   │       ├── chargeHelpers.js # Charge-based lock mechanics
│   │       ├── levelHelpers.js # Level progression and scoring
│   │       ├── animHelpers.js  # Animations and visual effects
│   │       ├── networkHelpers.js # Multiplayer communication
│   │       ├── towerHelpers.js # Auto-lock and tower management
│   │       ├── instabilityHelpers.js # Tower stability calculations
│   ├── index.html
│   └── vite.config.js
│
├── server/                     # Node.js + Colyseus multiplayer server
│   ├── rooms/                  # Game room definitions
│   │   └── NormalGameRoom.js
│   ├── index.js                # Server entry point
│   └── package.json
│
├── shared/                     # Shared logic (future use)
│   └── schema.js               # Colyseus schema (optional)
│
├── .gitignore
└── README.md
```

---

## ⚙️ Technical Specifications

### Grid & Layout
- `GRID_SIZE = 20` pixels
- Board Dimensions:
  - `GUTTER_WIDTH = 4`
  - `TOWER_WIDTH = 10`
  - `BOARD_WIDTH = 18` (10 + 4 + 4)
  - `BUFFER_ROWS = 4`
  - `VISIBLE_ROWS = 30`
  - `HISTORY_ROWS = 30`
  - `BOARD_HEIGHT = 64`

### Tetromino System
- `TETROMINO_SHAPES` supports I, O, T, S, Z, J, L
- `JLSTZ_KICKS` used for wall kicks during rotation

---

## 🎯 Gameplay Mechanics

### Spawn & Preview Queue
- Next tetromino spawns in the buffer zone
- Preview queue shows upcoming pieces (default 3)
- `spawnTetromino(scene, shapes)` initializes a piece and starts the fall timer

### Drop & Collision
- `dropPiece(scene)` advances the piece downward
- `checkCollisionAt()` detects against board and history grid
- Drop speed increases with player level

### Piece Locking
- `lockPiece(scene)` saves block positions and renders them
- If blocks are placed below the fold, they update `historyGrid`
- Detects and scores completed lines (Tetris)

### Gutter Management
- Pieces hanging in gutters have blocks stripped away
- Each stripped block incurs a score penalty
- Animated falling effect provides visual feedback
- Prevents exploitative building strategies

### Tower Section Locking
- Pressing **L** when `lockReady` is true triggers `lockTowerSection()`
- Everything from topRow down (except the top row) is moved to `historyGrid`
- That top row becomes the new foundation
- Level increases after each tower section lock

### Charge-based Lock System
- Lock ability must be charged by placing pieces
- Charge meter fills visually, showing progress
- Only when fully charged can the player lock a tower section

### Auto-Lock System
- Triggers countdown when tower reaches a threshold height
- Emergency instant lock when tower gets dangerously high
- Can be toggled on/off via UI

### History Grid
- Stores previous tower sections
- Renders below the fold using opacity
- Stack grows downward

### Level & Scoring System
- Level increases when tower section is locked
- Higher levels increase piece drop speed
- Scores awarded for:
  - Basic piece placement (scaled by level)
  - Completing lines (classic Tetris scoring, scaled by level)
  - Locking tower sections (large bonus, scaled by level)
- Penalties for gutter overhangs and instability

### Stability System
- **Cell-level stability**: Each block has its own stability value
- **Row stability**: Calculated from cell stability values
- **Tower stability**: Affected by both current and historical stability
- **Historical tracking**: Average stability across all locked sections
- Visual feedback with color-coded blocks:
  - Blue: Very stable (85-100%)
  - Green: Stable (70-85%)
  - Yellow: Moderate stability (50-70%)
  - Orange: Unstable (30-50%)
  - Red: Critical instability (0-30%)
- Debug mode (G key) shows detailed stability values
- Structural factors affecting stability:
  - Direct support (blocks below)
  - Diagonal support
  - Lateral support (adjacent blocks)
  - Voids (covered empty spaces)
  - Tower width (thin towers are less stable)
  - Consecutive unstable rows
- Tower collapse triggered at critical instability levels

---

## 🧠 UI/Sidebar
- Sidebar added on the right of the playfield (200px wide)
- Contains:
  - **Score**
  - **Level**
  - **Lines Cleared**
  - **Abilities** (with `updateAbilityText()`)
  - **Lock status** (with `updateSidebarText()`)
  - **Next Pieces Preview**
  - **Lock Charge Meter**
  - **Auto-Lock Toggle**
  - **Stability Percentage**
- Uses `wordWrap` and `fixedWidth` to prevent overflow

---

## ✅ Features Completed

- Modularized codebase with helper functions for better maintainability
- Complete tetromino system with rotation, wall kicks, and ghost pieces
- Tower section locking with history tracking
- Charge-based lock mechanic that requires strategic play
- Level progression system with increasing difficulty
- Classic Tetris-style scoring for lines and tower management
- Next piece preview queue for strategic planning
- Auto-lock system with countdown and emergency locking
- Line completion detection with visual feedback (Tetris)
- Multiplayer-ready architecture using Colyseus with real-time updates
- Visual feedback through animations, flashes, and highlighting
- Fully functional sidebar UI with game stats and controls
- Advanced stability system with cell, row, and tower-level calculations
- Gutter overhang detection and penalties
- Tower collapse mechanics
- Cell-level visual feedback for stability (color-coded blocks)
- Debug visualization for stability values (toggle with G key)

---

## 🛠️ Next Development Ideas

- [ ] ~~Instability calculation & tower collapse~~ ✅ Implemented!
- [ ] ~~Gutter overhang penalties~~ ✅ Implemented!
- [ ] Piece hold system - Allow holding a piece for later use
- [ ] Ability cooldowns and recharging visual indicators - Better UI for abilities
- [ ] Piece color variations - Visual distinction for different pieces
- [ ] Mobile-friendly layout with touch controls - Expand to mobile platforms
- [ ] Advanced scoring system - Combo chains, T-spins, etc.
- [ ] Advanced tower section management - Multiple section types
- [ ] Visual enhancements - Particles, better animations, background effects
- [ ] Sound effects and music - Audio feedback for actions
- [ ] Settings menu - Customize game parameters
- [ ] Tutorial system - Help new players learn the mechanics
- [ ] High score board - Local and server-based leaderboards

## 🔐 Technical Systems Implemented

### Architecture Overview

#### 🎮 Client (Frontend)
- **Tech:** [Phaser 3](https://phaser.io/) (HTML5 Canvas Game Engine), ES Module-based JavaScript, Vite-powered build
- **Purpose:** Handles rendering, input, UI updates, physics, and animations
- **Assets:** Tetromino sprites and basic geometric shading
- **Modular Codebase:** All core gameplay logic (movement, collision, draw, etc.) split into small utility modules under `utils/`
- **Key UI Modules:** Sidebar with ability and lock status, score tracking, level display, charge meter

#### 🌐 Server (Backend)
- **Tech:** [Colyseus](https://colyseus.io/) multiplayer framework on Node.js
- **Purpose:** Manages multiplayer game rooms, synchronizes state, broadcasts messages, and handles player matchmaking
- **Rooms:** `NormalGameRoom.js` (default), extendable to ranked or chaotic rooms
- **Shared State:** Planned usage of Colyseus schemas (`shared/schema.js`) for synchronizing tower height, instability, and scores between players
- **Transport Layer:** WebSockets with room-based channels

### Stability System
- Calculates tower stability based on:
  - Support structure (direct and diagonal)
  - Lateral connections (side-by-side blocks)
  - Voids (trapped empty spaces)
  - Tower width (thin towers are less stable)
  - Row completeness (complete rows are more stable)
- Historical stability tracking across tower sections
- Visual indicators of stability through color-coded blocks
- Tower collapse triggered at critical instability levels
- Animated collapse with blocks falling away and tower compaction
- Debug visualization for detailed stability values

### Multiplayer Framework (Colyseus)
- Matchmaking (future): general pool → ranked pool
- Game room sync: players receive updates via `adjacentTowerUpdate`
- Abilities can affect opponent state (e.g., `incomingAttack`)
- Shared state via schema (future-proofed in `/shared/schema.js`)

### History System
- Each tower section pushed into historyGrid on lock
- Truncated to last 30 rows max
- Drawn below the fold at `BUFFER_ROWS + VISIBLE_ROWS`
- Fade applied for visual separation (alpha = 0.5)
- Blocks can land on history and become part of it

## 🎨 Visual & UX Enhancements
- Sidebar layout with fixed-width wrapping
- Lock status display (`Ready (L)` vs `Charging...`)
- Score display dynamically updates
- Level and line count displays
- Charge meter with color coding
- Preview queue showing upcoming pieces
- Visual divider between tower and history zone
- Gutter shading for boundary clarity
- Animated block scaling on placement
- Pulsing highlights for completed lines
- Color-coded blocks reflecting stability
- Animated gutter overhang penalties
- Stability percentage display

## 🔄 Game Lifecycle
- Room joins (`joinOrCreate`)
- Server sends `gameStart` → triggers `spawnTetromino`
- Player drops, rotates, locks pieces
- Triggers `blockPlaced` to server
- Server broadcasts back updated stats (like opponent height)
- Level increases after tower section locking
- Game speed increases with level progression
- Tower stability affects gameplay difficulty
- Collapse occurs at critical instability