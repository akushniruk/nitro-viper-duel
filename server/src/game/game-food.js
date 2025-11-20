/**
 * ============================================================================
 * FOOD MANAGEMENT
 * ============================================================================
 *
 * Functions for spawning and managing food items on the game board.
 * ============================================================================
 */

import { GRID_WIDTH, GRID_HEIGHT, MIN_FOOD_COUNT } from './game-constants.js';

/**
 * Checks if a position is occupied by a snake
 * @param {Position} position - Position to check
 * @param {GameState} gameState - Current game state
 * @returns {boolean} Whether position is occupied
 */
export function isPositionOccupied(position, gameState) {
  for (const snake of Object.values(gameState.snakes)) {
    for (const segment of snake.body) {
      if (segment.x === position.x && segment.y === position.y) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Spawns food at a random empty position
 * @param {GameState} gameState - Current game state (optional)
 * @returns {Position} Food position
 */
export function spawnFood(gameState = null) {
  let position;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    position = {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT)
    };
    attempts++;
  } while (gameState && isPositionOccupied(position, gameState) && attempts < maxAttempts);

  return position;
}

/**
 * Ensures minimum food count on board
 * @param {Array<Position>} food - Current food array
 * @param {GameState} gameState - Current game state
 * @returns {Array<Position>} Updated food array
 */
export function ensureMinimumFood(food, gameState) {
  const updatedFood = [...food];

  while (updatedFood.length < MIN_FOOD_COUNT) {
    updatedFood.push(spawnFood({ ...gameState, food: updatedFood }));
  }

  return updatedFood;
}
