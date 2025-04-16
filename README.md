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
- Instability and collapse may be introduced later.
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
│   │       ├── draw.js         # drawPiece, drawGhostPiece, clearActiveBlocks
│   │       ├── collision.js    # checkCollision, checkCollisionAt
│   │       ├── move.js         # movePiece, rotatePiece, dropPiece
│   │       ├── place.js        # lockPiece logic
│   │       ├── lock.js         # lockTowerSection logic
│   │       ├── spawn.js        # spawnTetromino logic
│   │       ├── ui.js           # updateAbilityText, updateSidebarText
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

### Spawn
- New tetromino spawns in the buffer zone
- `spawnTetromino(scene, shapes)` initializes a piece and starts the fall timer

### Drop & Collision
- `dropPiece(scene)` advances the piece downward
- `checkCollisionAt()` detects against board and history grid

### Piece Locking
- `lockPiece(scene)` saves block positions and renders them
- If blocks are placed below the fold, they update `historyGrid`

### Tower Section Locking
- Pressing **L** when `lockReady` is true triggers `lockTowerSection()`
- Everything from topRow down (except the top row) is moved to `historyGrid`
- That top row becomes the new foundation

### History Grid
- Stores previous tower sections
- Renders below the fold using opacity
- Stack grows downward

---

## 🧠 UI/Sidebar
- Sidebar added on the right of the playfield (200px wide)
- Contains:
  - **Score**
  - **Abilities** (with `updateAbilityText()`)
  - **Lock status** (with `updateSidebarText()`)
- Uses `wordWrap` and `fixedWidth` to prevent overflow

---

## ✅ Features Completed

- Modularized Phaser codebase for testability and extensibility
- Clean separation between core gameplay functions (draw, spawn, move, lock)
- Sidebar UI layout with ability display and lock readiness
- Full integration of `historyGrid` for persistent tower sections
- Ghost piece logic and drop projection
- Lock system that promotes clean building and milestone resets
- Ability to manually lock or be forced to lock when overbuilding
- Locked tower sections fade visually and accumulate below the fold
- Multiplayer-ready architecture using Colyseus with real-time updates
- Modular codebase
- Ghost piece rendering
- Piece locking and rendering
- Tower section locking
- History grid persistence
- Sidebar with status
- Multiplayer connection via Colyseus

---

## 🛠️ Next Development Ideas

- [ ] Charge-based lock bar (fill with clean play)
- [ ] Auto-lock after reaching height threshold
- [ ] Instability calculation & tower collapse
- [ ] Multiplayer scoreboard
- [ ] Animated tower sections
- [ ] Replay or timeline of locked sections
- [ ] SFX for locks, drops, errors

- [ ] Ability cooldowns and recharging visual indicators
- [ ] Piece preview queue (next tetromino)
- [ ] Gamepad support (WASD + arrow fallback)
- [ ] Settings menu for sensitivity, UI scaling, etc.
- [ ] Spectator mode (for multiplayer rooms)
- [ ] Server-authoritative lock validation
- [ ] Replay system per round
- [ ] Tower instability algorithm (based on shape balance, overhangs, etc.)
- [ ] Mobile-friendly layout with responsive controls
- [ ] End-of-game summary: tower height, time survived, # of locks

## 🔐 Technical Systems Planned

### Architecture Overview

#### 🎮 Client (Frontend)
- **Tech:** [Phaser 3](https://phaser.io/) (HTML5 Canvas Game Engine), ES Module-based JavaScript, Vite-powered build
- **Purpose:** Handles rendering, input, UI updates, physics, and animations
- **Assets:** Tetromino sprites and basic geometric shading
- **Modular Codebase:** All core gameplay logic (movement, collision, draw, etc.) split into small utility modules under `utils/`
- **Key UI Modules:** Sidebar with ability and lock status, score tracking, future lock/charge visual meter

#### 🌐 Server (Backend)
- **Tech:** [Colyseus](https://colyseus.io/) multiplayer framework on Node.js
- **Purpose:** Manages multiplayer game rooms, synchronizes state, broadcasts messages, and handles player matchmaking
- **Rooms:** `NormalGameRoom.js` (default), extendable to ranked or chaotic rooms
- **Shared State:** Planned usage of Colyseus schemas (`shared/schema.js`) for synchronizing tower height, instability, and scores between players
- **Transport Layer:** WebSockets with room-based channels


### Charge Lock Mechanism
- Visual sidebar indicator for lock availability
- Charge fills over time or from good performance (e.g., lines cleared, fast placement)
- Once full, enables early lock (`lockReady = true`)
- Fallback auto-lock if tower reaches visible height threshold

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
- Lock status display (`Ready (L)` vs `Unavailable`)
- Score display dynamically updates
- Visual divider between tower and history zone
- Gutter shading for boundary clarity
- Animated block scaling on placement

## 🔄 Game Lifecycle
- Room joins (`joinOrCreate`)
- Server sends `gameStart` → triggers `spawnTetromino`
- Player drops, rotates, locks pieces
- Triggers `blockPlaced` to server
- Server broadcasts back updated stats (like opponent height)

Let me know if you'd like to focus on a specific next feature or expand this doc further.

