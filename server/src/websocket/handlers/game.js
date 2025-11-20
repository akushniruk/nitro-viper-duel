/**
 * ============================================================================
 * GAME MESSAGE HANDLERS
 * ============================================================================
 *
 * Handles all game-related WebSocket messages from clients.
 *
 * MESSAGE FLOW:
 * 1. START GAME:
 *    Host → startGame → Generate app session → Collect signatures → Start
 *
 * 2. GAMEPLAY:
 *    Player → changeDirection → Queue direction → Applied on next tick
 *
 * 3. SIGNATURES:
 *    Guest → appSession:signature → Store signature → Request host signature
 *    Host → appSession:startGame → Submit to Nitrolite → Game begins
 *
 * KEY HANDLERS:
 * - handleStartGame(): Initiates signature collection flow
 * - handleDirectionChange(): Updates player's snake direction
 * - handleAppSessionSignature(): Collects player signatures
 * ============================================================================
 */

import { validateDirectionPayload } from '../../utils/validators.js';
import {
  formatGameState,
  formatGameOverMessage,
  createGame
} from '../../game/snake.js';
import {
  closeAppSession,
  hasAppSession,
  addMoveToSession
} from '../../nitrolite/appSessions.js';
import logger from '../../utils/logger.js';

/**
 * Handles a start game request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */
export async function handleStartGame(ws, payload, { roomManager, connections, sendError }) {
  console.log(`🎯 handleStartGame called for payload:`, payload);
  
  if (!payload || typeof payload !== 'object') {
    return sendError(ws, 'INVALID_PAYLOAD', 'Invalid payload format');
  }

  const { roomId } = payload;

  if (!roomId) {
    return sendError(ws, 'INVALID_PAYLOAD', 'Room ID is required');
  }
  
  console.log(`🎯 Processing start game for room: ${roomId}`);

  // Find the player trying to start the game
  let playerEoa = null;
  for (const [eoa, connection] of connections.entries()) {
    if (connection.ws === ws) {
      playerEoa = eoa;
      break;
    }
  }

  if (!playerEoa) {
    return sendError(ws, 'NOT_AUTHENTICATED', 'Player not authenticated');
  }

  // Get the room
  const room = roomManager.rooms.get(roomId);
  if (!room) {
    return sendError(ws, 'ROOM_NOT_FOUND', 'Room not found');
  }

  // Only the host can start the game
  if (room.players.host !== playerEoa) {
    return sendError(ws, 'NOT_AUTHORIZED', 'Only the host can start the game');
  }

  // Need both players
  if (!room.players.host || !room.players.guest) {
    return sendError(ws, 'ROOM_NOT_FULL', 'Room must have two players to start the game');
  }

  // Initialize game state if not already done
  if (!room.gameState) {
    console.log(`🎮 Creating game state for room ${roomId}`);
    room.gameState = createGame(room.players.host, room.players.guest);
    console.log(`✅ Game state created:`, {
      player1: room.gameState.players.player1,
      player2: room.gameState.players.player2,
      snakesCount: Object.keys(room.gameState.snakes).length
    });
  } else {
    console.log(`♻️ Game state already exists for room ${roomId}`);
  }

  // App session is created via signature collection flow (see room.js and server.js)

  // Broadcast game started
  roomManager.broadcastToRoom(
    roomId,
    'game:started',
    { roomId }
  );

  // Start the automatic movement game loop
  console.log(`🚀 Starting automatic movement game loop for room ${roomId}`);
  startGameLoop(roomId, roomManager);

  // Send the initial game state
  roomManager.broadcastToRoom(
    roomId, 
    'room:state', 
    formatGameState(room.gameState, roomId, room.betAmount)
  );
}

/**
 * Game loop intervals for each room
 */
const gameLoops = new Map();

/**
 * Handles app session closure when game ends
 * @param {string} roomId - Room ID
 * @param {Object} gameState - Final game state
 * @param {Object} roomManager - Room manager instance
 */
async function handleGameOverAppSession(roomId, gameState, roomManager) {
  try {
    logger.game(`🏁 Game over for room ${roomId} - Starting app session closure`);
    const room = roomManager.rooms.get(roomId);

    if (!room) {
      logger.warn(`No room found for ${roomId} during game over`);
      return;
    }

    // Determine winner EOA
    let winnerEOA = null;
    if (gameState.winner === 'player1') {
      winnerEOA = room.players.host;
      logger.game(`Winner: Player 1 (${winnerEOA})`);
    } else if (gameState.winner === 'player2') {
      winnerEOA = room.players.guest;
      logger.game(`Winner: Player 2 (${winnerEOA})`);
    } else {
      logger.game(`Game ended in a tie`);
    }

    // Prepare game data for session_data
    const gameData = {
      endCondition: gameState.winner ? 'collision' : 'tie',
      finalScores: {
        player1: gameState.snakes.player1?.score || 0,
        player2: gameState.snakes.player2?.score || 0
      },
      gameTime: gameState.gameTime
    };

    logger.data('Final game data:', gameData);

    // First check if the room has an appId directly
    if (room && room.appId) {
      logger.nitro(`Closing app session with ID ${room.appId} for room ${roomId}`);

      await closeAppSession(roomId, winnerEOA, gameData);
      logger.success(`✓ App session closed successfully for room ${roomId}`);
    }
    // Otherwise check the app sessions storage
    else if (hasAppSession(roomId)) {
      logger.nitro(`Closing app session from storage for room ${roomId}`);

      await closeAppSession(roomId, winnerEOA, gameData);
      logger.success(`✓ App session closed successfully for room ${roomId}`);
    }
    else {
      logger.warn(`No app session found for room ${roomId} - skipping closure`);
      logger.data('Room state:', {
        hasAppId: !!room.appId,
        hasAppSession: hasAppSession(roomId),
        betAmount: room.betAmount
      });
    }
  } catch (error) {
    logger.error(`Failed to close app session for room ${roomId}:`, error);
    logger.error('Error stack:', error.stack);
    // Continue with room cleanup even if app session closure fails
  }
}

/**
 * Starts the game loop for a room
 * @param {string} roomId - Room ID
 * @param {Object} roomManager - Room manager instance
 */
export function startGameLoop(roomId, roomManager) {
  console.log(`🔄 startGameLoop called for room ${roomId}`);
  
  // Clear any existing loop
  if (gameLoops.has(roomId)) {
    console.log(`🧹 Clearing existing game loop for room ${roomId}`);
    clearInterval(gameLoops.get(roomId));
  }

  const interval = setInterval(() => {
    console.log(`⏰ Game loop tick for room ${roomId}`);
    const result = roomManager.updateGameState(roomId);
    if (!result.success) {
      console.error(`❌ Game loop failed for room ${roomId}:`, result.error);
      clearInterval(interval);
      gameLoops.delete(roomId);
      return;
    }

    // Broadcast updated game state
    const currentRoom = roomManager.rooms.get(roomId);
    const formattedState = formatGameState(result.gameState, roomId, currentRoom?.betAmount || 0);
    console.log("🚀 Broadcasting game:update:", {
      roomId,
      gameTime: formattedState.gameTime,
      player1Pos: formattedState.snakes?.player1?.body?.[0],
      player2Pos: formattedState.snakes?.player2?.body?.[0],
      foodCount: formattedState.food?.length
    });
    roomManager.broadcastToRoom(
      roomId,
      'game:update',
      formattedState
    );

    // Handle game over condition
    if (result.isGameOver) {
      clearInterval(interval);
      gameLoops.delete(roomId);
      
      roomManager.broadcastToRoom(
        roomId,
        'game:over',
        formatGameOverMessage(result.gameState)
      );

      // Close the app session if one was created
      handleGameOverAppSession(roomId, result.gameState, roomManager);

      // Clean up room after delay
      setTimeout(() => {
        roomManager.closeRoom(roomId);
      }, 5000);
    }
  }, 150); // Update every 150ms for real-time speed

  gameLoops.set(roomId, interval);
  console.log(`✅ Game loop started for room ${roomId}, interval ID:`, interval);
}

/**
 * Starts a minimal game over detection loop for real-time movement games
 * @param {string} roomId - Room ID
 * @param {Object} roomManager - Room manager instance
 */
export function startGameOverDetectionLoop(roomId, roomManager) {
  console.log(`🔄 startGameOverDetectionLoop called for room ${roomId}`);
  
  // Clear any existing loop
  if (gameLoops.has(roomId)) {
    console.log(`🧹 Clearing existing game loop for room ${roomId}`);
    clearInterval(gameLoops.get(roomId));
  }

  const interval = setInterval(() => {
    // Check if the room still exists
    const room = roomManager.rooms.get(roomId);
    if (!room || !room.gameState) {
      clearInterval(interval);
      gameLoops.delete(roomId);
      return;
    }

    // Only check for game over condition, don't move snakes
    if (room.gameState.isGameOver) {
      clearInterval(interval);
      gameLoops.delete(roomId);
      
      roomManager.broadcastToRoom(
        roomId,
        'game:over',
        formatGameOverMessage(room.gameState)
      );

      // Close the app session if one was created
      handleGameOverAppSession(roomId, room.gameState, roomManager);

      // Clean up room after delay
      setTimeout(() => {
        roomManager.closeRoom(roomId);
      }, 5000);
    }
  }, 1000); // Check every 1 second

  gameLoops.set(roomId, interval);
  console.log(`✅ Game over detection loop started for room ${roomId}, interval ID:`, interval);
}

/**
 * Handles a direction change request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */
export async function handleDirectionChange(ws, payload, { roomManager, connections, sendError }) {
  // Validate payload
  const validation = validateDirectionPayload(payload);
  if (!validation.success) {
    return sendError(ws, 'INVALID_PAYLOAD', validation.error);
  }

  const { roomId, direction } = payload;
  
  // Find the player making the move
  let playerEoa = null;
  for (const [eoa, connection] of connections.entries()) {
    if (connection.ws === ws) {
      playerEoa = eoa;
      break;
    }
  }

  if (!playerEoa) {
    return sendError(ws, 'NOT_AUTHENTICATED', 'Player not authenticated');
  }

  // Process the direction change
  const result = roomManager.processDirectionChange(roomId, direction, playerEoa);
  if (!result.success) {
    return sendError(ws, 'DIRECTION_CHANGE_FAILED', result.error);
  }

  // Track the move in the app session
  try {
    addMoveToSession(roomId, playerEoa, direction);
  } catch (error) {
    logger.warn(`Failed to track move for room ${roomId}:`, error);
    // Don't fail the direction change if move tracking fails
  }

  // Direction change processed - the automatic game loop will handle movement updates
}