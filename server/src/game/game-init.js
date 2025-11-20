/**
 * ============================================================================
 * GAME INITIALIZATION
 * ============================================================================
 *
 * Functions for creating new game instances and initial snake states.
 * ============================================================================
 */

import { ethers } from 'ethers';
import { GRID_WIDTH, GRID_HEIGHT, INITIAL_SNAKE_LENGTH } from './game-constants.js';
import { spawnFood } from './game-food.js';

/**
 * Creates initial snake at starting position
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {string} direction - Initial direction
 * @returns {Snake} Initial snake
 */
function createInitialSnake(startX, startY, direction) {
  const body = [];

  // Create snake segments based on direction
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    switch (direction) {
      case 'RIGHT':
        body.push({ x: startX - i, y: startY });
        break;
      case 'LEFT':
        body.push({ x: startX + i, y: startY });
        break;
      case 'DOWN':
        body.push({ x: startX, y: startY - i });
        break;
      case 'UP':
        body.push({ x: startX, y: startY + i });
        break;
    }
  }

  return {
    body,
    direction,
    alive: true,
    score: 0
  };
}

/**
 * Creates a new game state
 * @param {string} hostEoa - Host's Ethereum address (player 1)
 * @param {string} guestEoa - Guest's Ethereum address (player 2)
 * @returns {GameState} Initial game state
 */
export function createGame(hostEoa, guestEoa) {
  // Format addresses to proper checksum format
  const formattedHostEoa = ethers.getAddress(hostEoa);
  const formattedGuestEoa = ethers.getAddress(guestEoa);

  return {
    snakes: {
      player1: createInitialSnake(3, 3, 'RIGHT'),
      player2: createInitialSnake(GRID_WIDTH - 4, GRID_HEIGHT - 4, 'LEFT')
    },
    food: [spawnFood(), spawnFood(), spawnFood()], // Start with 3 food items
    winner: null,
    isGameOver: false,
    players: {
      player1: formattedHostEoa,
      player2: formattedGuestEoa
    },
    gameTime: 0
  };
}
