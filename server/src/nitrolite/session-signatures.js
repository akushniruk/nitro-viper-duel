/**
 * ============================================================================
 * SIGNATURE COLLECTION
 * ============================================================================
 *
 * Collects signatures from both players for app session creation.
 *
 * FLOW:
 * 1. Guest signs first → stores signature
 * 2. Host signs second → stores signature
 * 3. Once both collected → submit to Nitrolite
 *
 * KEY FUNCTIONS:
 * - addAppSessionSignature() - Store player signature
 * - createAppSessionWithSignatures() - Submit with all signatures
 * ============================================================================
 */

import { parseAnyRPCResponse, RPCMethod } from "@erc7824/nitrolite";
import { ethers } from 'ethers';
import logger from '../utils/logger.js';
import { getRPCClient } from './client.js';
import {
  getPendingSession,
  deletePendingSession,
  setAppSession,
  getAppSession
} from './session-storage.js';

/**
 * Add player signature to pending app session
 *
 * @param {string} roomId - Room ID
 * @param {string} playerEOA - Player's Ethereum address
 * @param {string} signature - Player's signature
 * @returns {boolean} True if ALL signatures are now collected (2/2)
 */
export function addAppSessionSignature(roomId, playerEOA, signature) {
  const pending = getPendingSession(roomId);

  if (!pending) {
    logger.error(`No pending app session found for room ${roomId}`);
    return false;
  }

  // Format address
  const formattedAddress = ethers.getAddress(playerEOA);

  // Validate signature format
  if (!signature || typeof signature !== 'string') {
    logger.error(`Invalid signature format from ${formattedAddress}: not a string`);
    return false;
  }

  if (!signature.startsWith('0x')) {
    logger.error(`Invalid signature format from ${formattedAddress}: missing 0x prefix`);
    return false;
  }

  if (signature.length !== 132) {
    logger.warn(`Suspicious signature length from ${formattedAddress}: ${signature.length} (expected 132)`);
    logger.data('Signature:', signature);
  }

  // Store signature
  pending.signatures.set(formattedAddress, signature);

  logger.nitro(`✓ Signature added for room ${roomId} from ${formattedAddress}`);
  logger.data(`  Signature: ${signature.substring(0, 20)}...${signature.substring(signature.length - 20)}`);
  logger.data(`  Length: ${signature.length}`);
  logger.nitro(`Total signatures collected: ${pending.signatures.size}/2`);

  // Return true only if we now have all 2 signatures
  return pending.signatures.size === 2;
}

/**
 * Create app session with all collected signatures
 *
 * @param {string} roomId - Room ID
 * @returns {Promise<string>} App session ID
 */
export async function createAppSessionWithSignatures(roomId) {
  const pending = getPendingSession(roomId);

  if (!pending) {
    throw new Error(`No pending app session for room ${roomId}`);
  }

  // Verify we have all signatures
  if (pending.signatures.size !== 2) {
    logger.warn(`Not all signatures collected yet (have ${pending.signatures.size}/2)`);
    throw new Error(`Not all signatures collected (have ${pending.signatures.size}/2)`);
  }

  logger.nitro(`Creating app session for room ${roomId} with all signatures`);
  logger.nitro(`Participant A (${pending.participantA}): signed`);
  logger.nitro(`Participant B (${pending.participantB}): signed`);
  logger.nitro(`Server (${pending.serverAddress}): signed`);

  try {
    const rpcClient = await getRPCClient();

    // Ensure WebSocket is connected
    await rpcClient.ensureConnected();

    // Build complete request with all signatures
    const sigA = pending.signatures.get(pending.participantA);
    const sigB = pending.signatures.get(pending.participantB);
    const sigServer = pending.serverSignature;

    logger.nitro('═══════════════════════════════════════════════════════');
    logger.nitro('SIGNATURE VERIFICATION:');
    logger.nitro('═══════════════════════════════════════════════════════');
    logger.nitro('Participants order (from definition):');
    logger.data(`  [0]: ${pending.participantA}`);
    logger.data(`  [1]: ${pending.participantB}`);
    logger.data(`  [2]: ${pending.serverAddress}`);
    logger.nitro('');
    logger.nitro('Signatures order (MUST match participants):');
    logger.nitro(`  sig[0] for ${pending.participantA}:`);
    logger.data(`    ${sigA}`);
    logger.data(`    Length: ${sigA ? sigA.length : 'null'}`);
    logger.nitro(`  sig[1] for ${pending.participantB}:`);
    logger.data(`    ${sigB}`);
    logger.data(`    Length: ${sigB ? sigB.length : 'null'}`);
    logger.nitro(`  sig[2] for ${pending.serverAddress}:`);
    logger.data(`    ${sigServer}`);
    logger.data(`    Length: ${sigServer ? sigServer.length : 'null'}`);
    logger.nitro('');
    logger.nitro('⚠️  CRITICAL: Client must sign using SESSION KEY, not main wallet!');
    logger.nitro('⚠️  CRITICAL: Client must use createAppSessionMessage() from @erc7824/nitrolite');
    logger.nitro('═══════════════════════════════════════════════════════');

    const completeRequest = {
      req: pending.requestToSign,
      sig: [
        sigA,
        sigB,
        sigServer
      ]
    };

    logger.data('Complete request structure:', completeRequest);
    logger.data('Request array (for signing):', pending.requestToSign);
    logger.nitro('▶ Sending: create_app_session');

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

    logger.nitro(`WebSocket connected and ready (state: ${currentState})`);

    // Send directly to WebSocket (multi-signature requests need direct send)
    const requestString = JSON.stringify(completeRequest);
    logger.data('Sending JSON:', requestString);

    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for app session creation'));
      }, 30000);

      const handler = (data) => {
        try {
          const msg = typeof data === 'string' ? data : data.toString();
          const parsed = JSON.parse(msg);

          // Check if this is a response (has "res" array)
          if (parsed.res && Array.isArray(parsed.res)) {
            const [reqId, method, params] = parsed.res;

            // Match by method name
            if (method === 'create_app_session') {
              clearTimeout(timeout);
              rpcClient.ws.removeListener('message', handler);
              logger.nitro('◀ Received: create_app_session response');
              logger.data('Response:', params);
              resolve(params);
            }
          }
          // Check for error
          else if (parsed.err && Array.isArray(parsed.err)) {
            const [reqId, errorCode, errorMsg] = parsed.err;
            clearTimeout(timeout);
            rpcClient.ws.removeListener('message', handler);
            logger.error('◀ Received error:', errorMsg);
            reject(new Error(`Create app session failed: ${errorMsg}`));
          }
        } catch (err) {
          // Ignore parsing errors for other messages
        }
      };

      rpcClient.ws.on('message', handler);
      rpcClient.ws.send(requestString);
    });

    // Extract app session ID
    const appSessionId = response.app_session_id || response.appSessionId;

    if (!appSessionId) {
      logger.error('No app session ID in response!');
      logger.data('Response object:', response);
      throw new Error('App session created but no ID returned');
    }

    logger.nitro(`✓ App session created with ID: ${appSessionId}`);

    // Calculate fee information
    const betAmount = pending.appSessionData.allocations[0].amount;
    const serverFee = '0'; // Server fee (currently 0)

    // Store active session with move tracking and fee history
    setAppSession(roomId, {
      appSessionId,
      participantA: pending.participantA,
      participantB: pending.participantB,
      serverAddress: pending.serverAddress,
      betAmount: betAmount,
      createdAt: Date.now(),
      moves: [], // Track all direction changes
      feeHistory: [
        {
          event: 'session_created',
          timestamp: pending.requestToSign[0], // Original creation time
          timestampISO: new Date(pending.requestToSign[0]).toISOString(),
          serverAddress: pending.serverAddress,
          feeCharged: serverFee,
          feeUsed: false,
          player1Contribution: betAmount,
          player2Contribution: betAmount,
          totalPot: (parseFloat(betAmount) * 2).toString()
        },
        {
          event: 'game_started',
          timestamp: Date.now(),
          timestampISO: new Date().toISOString(),
          serverAddress: pending.serverAddress,
          feeCharged: serverFee,
          feeUsed: true, // Fee is now consumed as game is active
          appSessionId: appSessionId,
          allSignaturesCollected: true
        }
      ]
    });

    // Clean up pending
    deletePendingSession(roomId);

    return appSessionId;

  } catch (error) {
    logger.error(`Error creating app session for room ${roomId}:`, error);
    throw error;
  }
}

/**
 * Add a move to the app session move history
 *
 * @param {string} roomId - Room ID
 * @param {string} playerEOA - Player who made the move
 * @param {string} direction - Direction (UP, DOWN, LEFT, RIGHT)
 * @param {number} timestamp - Move timestamp
 */
export function addMoveToSession(roomId, playerEOA, direction, timestamp = Date.now()) {
  const session = getAppSession(roomId);

  if (!session) {
    logger.warn(`No active session for room ${roomId} to track move`);
    return;
  }

  if (!session.moves) {
    session.moves = [];
  }

  // Add move to history
  const move = {
    player: ethers.getAddress(playerEOA),
    direction,
    timestamp,
    moveNumber: session.moves.length + 1
  };

  session.moves.push(move);

  logger.debug(`Move #${move.moveNumber} recorded: ${playerEOA} → ${direction}`);
}
