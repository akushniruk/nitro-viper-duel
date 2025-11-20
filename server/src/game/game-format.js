/**
 * ============================================================================
 * GAME STATE FORMATTING
 * ============================================================================
 *
 * Functions for formatting game state for client transmission.
 * ============================================================================
 */

/**
 * Formats game state for client consumption
 * @param {GameState} gameState - Current game state
 * @param {string} roomId - Room ID
 * @param {number} betAmount - Bet amount (default 0)
 * @returns {Object} Formatted game state for client
 */
export function formatGameState(gameState, roomId, betAmount = 0) {
  return {
    roomId,
    snakes: gameState.snakes,
    food: gameState.food,
    players: gameState.players,
    gameTime: gameState.gameTime,
    betAmount: betAmount
  };
}

/**
 * Formats game over message
 * @param {GameState} gameState - Current game state
 * @returns {Object} Game over message
 */
export function formatGameOverMessage(gameState) {
  return {
    winner: gameState.winner,
    finalScores: {
      player1: gameState.snakes.player1.score,
      player2: gameState.snakes.player2.score
    },
    gameTime: gameState.gameTime
  };
}
