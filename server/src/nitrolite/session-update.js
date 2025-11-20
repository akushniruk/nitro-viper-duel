/**
 * ============================================================================
 * SESSION STATE UPDATES
 * ============================================================================
 *
 * Submits intermediate state updates to Nitrolite during gameplay.
 *
 * FLOW:
 * 1. Game progresses (moves, score changes)
 * 2. Submit updated state to Nitrolite
 * 3. Update session_data with current game state
 * 4. Funds stay in session (no redistribution until close)
 *
 * KEY FUNCTION:
 * - submitAppState() - Update app session state during game
 * ============================================================================
 */

import { createSubmitAppStateMessage } from "@erc7824/nitrolite";
import logger from '../utils/logger.js';
import { getRPCClient } from './client.js';
import { getAppSession } from './session-storage.js';

/**
 * Submit app state update to Nitrolite
 *
 * @param {string} roomId - Room ID
 * @param {Object} gameStateUpdate - Current game state data
 * @returns {Promise<void>}
 */
export async function submitAppState(roomId, gameStateUpdate = {}) {
  const session = getAppSession(roomId);

  if (!session) {
    logger.debug(`No active session for room ${roomId} to submit state`);
    return;
  }

  try {
    const rpcClient = await getRPCClient();

    // Ensure WebSocket is connected
    await rpcClient.ensureConnected();

    // Keep current allocations (no fund redistribution during game)
    const allocations = [
      {
        participant: session.participantA,
        asset: 'usdc',
        amount: session.betAmount
      },
      {
        participant: session.participantB,
        asset: 'usdc',
        amount: session.betAmount
      },
      {
        participant: session.serverAddress,
        asset: 'usdc',
        amount: '0'
      }
    ];

    // Update session data with current game state (for periodic updates during gameplay)
    const betAmountNum = parseFloat(session.betAmount);
    const totalPot = betAmountNum * 2;
    const serverFee = '0';

    const updatedSessionData = {
      // Game Metadata
      gameType: 'viper_duel',
      version: '1.0',
      protocol: 'NitroRPC/0.4',

      // Financial Data
      betAmount: session.betAmount,
      currency: 'usdc',
      totalPot: totalPot.toString(),
      serverFee: serverFee,

      // Fee History (preserved from session)
      feeHistory: session.feeHistory || [],

      // Timing Data
      startTime: session.createdAt,
      updateTime: Date.now(),
      elapsedTime: Date.now() - session.createdAt,

      // Player Information
      players: {
        player1: {
          address: session.participantA,
          role: 'host',
          contribution: session.betAmount
        },
        player2: {
          address: session.participantB,
          role: 'guest',
          contribution: session.betAmount
        }
      },

      // Current Game State
      gameState: 'playing',
      currentScores: gameStateUpdate.scores || {},
      gameTime: gameStateUpdate.gameTime || 0,

      // Move History (continuously updated)
      moves: session.moves || [],
      totalMoves: (session.moves || []).length,

      // Move Statistics (real-time)
      movesByPlayer: {
        [session.participantA]: (session.moves || []).filter(m => m.player === session.participantA).length,
        [session.participantB]: (session.moves || []).filter(m => m.player === session.participantB).length
      },

      // Verification Data
      appSessionId: session.appSessionId,
      serverAddress: session.serverAddress,
      lastUpdate: new Date().toISOString()
    };

    const stateData = {
      app_session_id: session.appSessionId,
      allocations,
      session_data: JSON.stringify(updatedSessionData)
    };

    logger.nitro(`▶ Sending: submit_app_state for room ${roomId}`);
    logger.data('State update:', stateData);

    // Sign with session signer
    const sign = rpcClient.sessionSigner || rpcClient.signMessage.bind(rpcClient);
    const stateMessage = await createSubmitAppStateMessage(sign, stateData);

    // Check WebSocket connection
    if (!rpcClient.ws) {
      logger.error('RPC client has no WebSocket instance');
      throw new Error('RPC client WebSocket not initialized');
    }

    const wsStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    const currentState = wsStates[rpcClient.ws.readyState] || `UNKNOWN(${rpcClient.ws.readyState})`;

    if (rpcClient.ws.readyState !== 1) {
      logger.error(`RPC client WebSocket not ready. Current state: ${currentState}`);
      throw new Error(`RPC client WebSocket not connected (state: ${currentState})`);
    }

    logger.debug(`WebSocket connected and ready (state: ${currentState})`);

    // Send directly to WebSocket
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for state submission'));
      }, 30000);

      const handler = (data) => {
        try {
          const msg = typeof data === 'string' ? data : data.toString();
          const parsed = JSON.parse(msg);

          // Check if this is a response
          if (parsed.res && Array.isArray(parsed.res)) {
            const [reqId, method, params] = parsed.res;

            if (method === 'submit_app_state') {
              clearTimeout(timeout);
              rpcClient.ws.removeListener('message', handler);
              logger.nitro('◀ Received: submit_app_state response');
              resolve(params);
            }
          }
          // Check for error
          else if (parsed.err && Array.isArray(parsed.err)) {
            const [reqId, errorCode, errorMsg] = parsed.err;
            clearTimeout(timeout);
            rpcClient.ws.removeListener('message', handler);
            logger.error('◀ Received error:', errorMsg);
            reject(new Error(`Submit app state failed: ${errorMsg}`));
          }
        } catch (err) {
          // Ignore parsing errors for other messages
        }
      };

      rpcClient.ws.on('message', handler);
      rpcClient.ws.send(stateMessage);
    });

    logger.nitro(`✓ App state submitted for room ${roomId}`);

  } catch (error) {
    logger.error(`Error submitting app state for room ${roomId}:`, error);
    // Don't throw - state submission is not critical for gameplay
  }
}
