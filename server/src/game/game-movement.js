/**
 * ============================================================================
 * MOVEMENT & COLLISION DETECTION
 * ============================================================================
 *
 * Core game logic for snake movement, collision detection, and game updates.
 * ============================================================================
 */

import { ethers } from 'ethers';
import { GRID_WIDTH, GRID_HEIGHT } from './game-constants.js';
import { ensureMinimumFood } from './game-food.js';

/**
 * Calculate new head position based on direction
 * @param {Position} head - Current head position
 * @param {string} direction - Direction to move
 * @returns {Position} New head position with wraparound applied
 */
export function calculateNewHead(head, direction) {
  let newHead;

  // Calculate new head position
  switch (direction) {
    case 'UP':
      newHead = { x: head.x, y: head.y - 1 };
      break;
    case 'DOWN':
      newHead = { x: head.x, y: head.y + 1 };
      break;
    case 'LEFT':
      newHead = { x: head.x - 1, y: head.y };
      break;
    case 'RIGHT':
      newHead = { x: head.x + 1, y: head.y };
      break;
  }

  // Handle screen wraparound (no wall collision)
  if (newHead.x < 0) {
    newHead.x = GRID_WIDTH - 1; // Wrap to right side
  } else if (newHead.x >= GRID_WIDTH) {
    newHead.x = 0; // Wrap to left side
  }

  if (newHead.y < 0) {
    newHead.y = GRID_HEIGHT - 1; // Wrap to bottom
  } else if (newHead.y >= GRID_HEIGHT) {
    newHead.y = 0; // Wrap to top
  }

  return newHead;
}

/**
 * Check if new head collides with snake's own body
 * @param {Position} newHead - New head position
 * @param {Snake} snake - Snake to check
 * @returns {boolean} True if collision detected
 */
export function checkSelfCollision(newHead, snake) {
  return snake.body.some(segment =>
    segment.x === newHead.x && segment.y === newHead.y
  );
}

/**
 * Check if new head collides with other snake
 * @param {Position} newHead - New head position
 * @param {Snake} otherSnake - Other snake to check
 * @returns {boolean} True if collision detected
 */
export function checkOtherSnakeCollision(newHead, otherSnake) {
  return otherSnake.body.some(segment =>
    segment.x === newHead.x && segment.y === newHead.y
  );
}

/**
 * Check if new head position has food
 * @param {Position} newHead - New head position
 * @param {Array<Position>} food - Food array
 * @returns {number} Index of food item, or -1 if none
 */
export function checkFoodCollision(newHead, food) {
  return food.findIndex(f =>
    f.x === newHead.x && f.y === newHead.y
  );
}

/**
 * Changes snake direction
 * @param {GameState} gameState - Current game state
 * @param {string} direction - New direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
 * @param {string} playerEoa - Player's Ethereum address
 * @returns {Object} Result with updated game state or error
 */
export function changeDirection(gameState, direction, playerEoa) {
  // Format player address to proper checksum format
  const formattedPlayerEoa = ethers.getAddress(playerEoa);

  // Check if the game is already over
  if (gameState.isGameOver) {
    return { success: false, error: 'Game is already over' };
  }

  // Determine which player is making the move
  const playerId = gameState.players.player1 === formattedPlayerEoa ? 'player1' : 'player2';
  if (!gameState.players[playerId]) {
    return { success: false, error: 'Player not in this game' };
  }

  const snake = gameState.snakes[playerId];
  if (!snake.alive) {
    return { success: false, error: 'Snake is dead' };
  }

  // Update direction only - automatic timer will handle movement
  const updatedGameState = {
    ...gameState,
    snakes: {
      ...gameState.snakes,
      [playerId]: {
        ...snake,
        direction
      }
    }
  };

  return {
    success: true,
    gameState: updatedGameState
  };
}

/**
 * Update game state by moving all snakes and checking collisions
 * @param {GameState} gameState - Current game state
 * @returns {Object} Result with updated game state
 */
export function updateGame(gameState) {
  if (gameState.isGameOver) {
    return { success: true, gameState };
  }

  const updatedSnakes = { ...gameState.snakes };
  let updatedFood = [...gameState.food];

  // Move each alive snake
  for (const [playerId, snake] of Object.entries(updatedSnakes)) {
    if (!snake.alive) continue;

    const head = snake.body[0];
    const newHead = calculateNewHead(head, snake.direction);

    // Check self collision
    if (checkSelfCollision(newHead, snake)) {
      console.log(`🔄 ${playerId} collided with self at (${newHead.x}, ${newHead.y})`);
      updatedSnakes[playerId] = { ...snake, alive: false };
      continue;
    }

    // Check collision with other snake
    const otherPlayerId = playerId === 'player1' ? 'player2' : 'player1';
    const otherSnake = updatedSnakes[otherPlayerId];
    if (checkOtherSnakeCollision(newHead, otherSnake)) {
      console.log(`🐍 ${playerId} collided with ${otherPlayerId} at (${newHead.x}, ${newHead.y})`);
      updatedSnakes[playerId] = { ...snake, alive: false };
      continue;
    }

    // Check food collision
    const foodIndex = checkFoodCollision(newHead, updatedFood);

    let newBody;
    if (foodIndex !== -1) {
      // Ate food - grow snake
      newBody = [newHead, ...snake.body];
      updatedFood.splice(foodIndex, 1);
      updatedSnakes[playerId] = {
        ...snake,
        body: newBody,
        score: snake.score + 1
      };

      // Ensure minimum food count
      const newGameState = {
        ...gameState,
        snakes: updatedSnakes,
        food: updatedFood
      };
      updatedFood = ensureMinimumFood(updatedFood, newGameState);
    } else {
      // Normal move - don't grow
      newBody = [newHead, ...snake.body.slice(0, -1)];
      updatedSnakes[playerId] = {
        ...snake,
        body: newBody
      };
    }
  }

  // Check for game over conditions
  const aliveSnakes = Object.values(updatedSnakes).filter(snake => snake.alive);
  let winner = null;
  let isGameOver = false;

  if (aliveSnakes.length === 0) {
    // Both snakes died - tie
    isGameOver = true;
  } else if (aliveSnakes.length === 1) {
    // One snake alive - winner
    const winningPlayerId = Object.keys(updatedSnakes).find(
      playerId => updatedSnakes[playerId].alive
    );
    winner = winningPlayerId;
    isGameOver = true;
  }

  const updatedGameState = {
    ...gameState,
    snakes: updatedSnakes,
    food: updatedFood,
    winner,
    isGameOver,
    gameTime: gameState.gameTime + 1
  };

  return {
    success: true,
    gameState: updatedGameState
  };
}
