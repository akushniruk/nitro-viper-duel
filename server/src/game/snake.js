/**
 * ============================================================================
 * SNAKE GAME COORDINATOR
 * ============================================================================
 *
 * Central export point for all snake game functionality.
 * This file re-exports functions from specialized modules.
 *
 * GAME RULES:
 * - Grid: 20x20 cells with wraparound (no walls!)
 * - 2 players, each controlling a snake
 * - Snakes move forward automatically every tick
 * - Players control direction only (UP, DOWN, LEFT, RIGHT)
 * - Eat food to grow and score points
 * - Collision = death (self or other snake)
 *
 * WIN CONDITIONS:
 * - Last snake alive wins
 * - Both die = tie
 * - Winner takes all the funds
 *
 * MODULES:
 * - game-constants.js - Configuration and types
 * - game-init.js      - Game initialization
 * - game-food.js      - Food spawning and management
 * - game-movement.js  - Movement and collision detection
 * - game-format.js    - State formatting for clients
 * ============================================================================
 */

// Re-export constants
export {
  GRID_WIDTH,
  GRID_HEIGHT,
  INITIAL_SNAKE_LENGTH,
  MIN_FOOD_COUNT,
  DIRECTIONS
} from './game-constants.js';

// Re-export initialization
export {
  createGame
} from './game-init.js';

// Re-export food management
export {
  spawnFood,
  isPositionOccupied,
  ensureMinimumFood
} from './game-food.js';

// Re-export movement and collision
export {
  calculateNewHead,
  checkSelfCollision,
  checkOtherSnakeCollision,
  checkFoodCollision,
  changeDirection,
  updateGame
} from './game-movement.js';

// Re-export formatting
export {
  formatGameState,
  formatGameOverMessage
} from './game-format.js';
