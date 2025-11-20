/**
 * ============================================================================
 * GAME CONSTANTS
 * ============================================================================
 *
 * Game configuration and constants for Snake game.
 * ============================================================================
 */

// Grid dimensions
export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 20;

// Snake configuration
export const INITIAL_SNAKE_LENGTH = 3;
export const MIN_FOOD_COUNT = 3;

// Directions
export const DIRECTIONS = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT'
};

/**
 * @typedef {Object} Position
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * @typedef {Object} Snake
 * @property {Array<Position>} body - Array of positions representing snake segments
 * @property {string} direction - Current direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
 * @property {boolean} alive - Whether the snake is alive
 * @property {number} score - Player's score
 */

/**
 * @typedef {Object} GameState
 * @property {Object} snakes - Object with snake data for each player
 * @property {Snake} snakes.player1 - Player 1's snake
 * @property {Snake} snakes.player2 - Player 2's snake
 * @property {Array<Position>} food - Array of food positions
 * @property {string|null} winner - The winner ('player1', 'player2', or null)
 * @property {boolean} isGameOver - Whether the game is over
 * @property {Object} players - Object with player information
 * @property {string} players.player1 - EOA address of player 1
 * @property {string} players.player2 - EOA address of player 2
 * @property {number} gameTime - Game time in ticks
 */
