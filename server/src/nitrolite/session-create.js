/**
 * ============================================================================
 * SESSION CREATION
 * ============================================================================
 *
 * Generates app session messages for players to sign.
 *
 * FLOW:
 * 1. Generate app definition (participants, weights, quorum)
 * 2. Create allocations (how much each player puts in)
 * 3. Create message that all players will sign
 * 4. Store as pending until all signatures collected
 *
 * KEY FUNCTION:
 * - generateAppSessionMessage() - Creates unsigned message
 * ============================================================================
 */

import { createAppSessionMessage } from "@erc7824/nitrolite";
import { ethers } from 'ethers';
import logger from '../utils/logger.js';
import { getRPCClient } from './client.js';
import { getPendingSession, setPendingSession } from './session-storage.js';

/**
 * Generate app session message for multi-signature collection
 *
 * @param {string} roomId - Room ID
 * @param {string} participantA - First player address
 * @param {string} participantB - Second player address
 * @param {number} betAmount - Bet amount per player (0, 0.01, 0.1, 1, 2)
 * @returns {Promise<Object>} Unsigned message and app definition
 */
export async function generateAppSessionMessage(roomId, participantA, participantB, betAmount = 0) {
  try {
    // Format addresses to checksum format
    const formattedA = ethers.getAddress(participantA);
    const formattedB = ethers.getAddress(participantB);

    logger.nitro(`Generating app session for room ${roomId}`);
    logger.nitro(`Players: ${formattedA} vs ${formattedB}`);
    logger.nitro(`Bet: ${betAmount} USDC each`);

    // Check if already have pending session
    let pending = getPendingSession(roomId);
    if (pending) {
      logger.nitro(`Reusing existing session for room ${roomId}`);
      return {
        appSessionData: pending.appSessionData,
        appDefinition: pending.appDefinition,
        participants: [pending.participantA, pending.participantB, pending.serverAddress],
        requestToSign: pending.requestToSign
      };
    }

    // Get RPC client (server)
    const rpcClient = await getRPCClient();
    if (!rpcClient) {
      throw new Error('RPC client not initialized');
    }

    // Ensure WebSocket is connected
    await rpcClient.ensureConnected();

    // Use session key address (what we sign with), not wallet address
    const serverAddress = ethers.getAddress(rpcClient.sessionKey.address);

    // Create app definition
    // Server has 100% voting power to ensure games can progress
    const nonce = Date.now();
    const appDefinition = {
      protocol: "NitroRPC/0.4",
      participants: [formattedA, formattedB, serverAddress],
      weights: [0, 0, 100],        // Only server can update
      quorum: 100,                  // Server must sign
      challenge: 0,                 // No challenge period
      nonce: nonce,
    };

    // Convert bet amount to proper format
    const betAmountString = betAmount > 0 ? betAmount.toString() : '0';
    const betAmountNum = parseFloat(betAmountString);

    // Calculate server fee (if applicable)
    // For now, server participates with 0 but this tracks fee structure
    const serverFee = '0'; // Could be percentage of pot in future
    const totalPot = betAmountNum * 2;

    // Create initial session data with complete game metadata
    const initialSessionData = {
      // Game Metadata
      gameType: 'viper_duel',
      version: '1.0',
      protocol: 'NitroRPC/0.4',

      // Financial Data
      betAmount: betAmountString,
      currency: 'usdc',
      totalPot: totalPot.toString(),
      serverFee: serverFee,

      // Fee History (for Yellow Network audit)
      feeHistory: [
        {
          event: 'session_created',
          timestamp: Date.now(),
          timestampISO: new Date().toISOString(),
          serverAddress: serverAddress,
          feeCharged: serverFee,
          feeUsed: false, // Will be true when session starts
          player1Contribution: betAmountString,
          player2Contribution: betAmountString,
          totalPot: totalPot.toString()
        }
      ],

      // Timing Data
      startTime: Date.now(),
      createdAt: new Date().toISOString(),

      // Player Information
      players: {
        player1: {
          address: formattedA,
          role: 'host',
          contribution: betAmountString
        },
        player2: {
          address: formattedB,
          role: 'guest',
          contribution: betAmountString
        }
      },

      // Initial Game State
      gameState: 'created',

      // Move History (empty at start, will be populated during gameplay)
      moves: [],
      totalMoves: 0,

      // Move Statistics
      movesByPlayer: {
        [formattedA]: 0,
        [formattedB]: 0
      },

      // Verification Data
      serverAddress: serverAddress,
      nonce: nonce
    };

    // Create app session data (single object, not array)
    const appSessionData = {
      definition: appDefinition,
      allocations: [
        {
          participant: formattedA,
          asset: 'usdc',
          amount: betAmountString,
        },
        {
          participant: formattedB,
          asset: 'usdc',
          amount: betAmountString,
        },
        {
          participant: serverAddress,
          asset: 'usdc',
          amount: '0',
        },
      ],
      session_data: JSON.stringify(initialSessionData)
    };

    // Generate message for signing
    // Use session signer for RPC messages
    const sign = rpcClient.sessionSigner || rpcClient.signMessage.bind(rpcClient);

    logger.nitro('Creating app session message...');
    const signedMessage = await createAppSessionMessage(sign, appSessionData);
    const parsedMessage = JSON.parse(signedMessage);

    // Extract request structure
    const requestToSign = parsedMessage.req;
    const serverSignature = parsedMessage.sig[0];

    logger.success(`Generated app session message for room ${roomId}`);
    logger.nitro('═══════════════════════════════════════════════════════');
    logger.nitro('DATA SENT TO CLIENTS FOR SIGNING:');
    logger.nitro('═══════════════════════════════════════════════════════');
    logger.data('requestToSign structure:', requestToSign);
    logger.data('requestToSign type:', Array.isArray(requestToSign) ? 'array' : typeof requestToSign);
    if (Array.isArray(requestToSign)) {
      logger.data('requestToSign[0] (request ID):', requestToSign[0]);
      logger.data('requestToSign[1] (method):', requestToSign[1]);
      logger.data('requestToSign[2] (params):', typeof requestToSign[2]);
      logger.data('requestToSign[3] (timestamp):', requestToSign[3]);
    }
    logger.nitro('Participants must sign this EXACT array structure');
    logger.nitro('═══════════════════════════════════════════════════════');
    logger.data('Request to sign:', requestToSign);
    logger.data('Server signature:', serverSignature);
    logger.data('App definition:', appDefinition);

    // Store as pending
    logger.nitro(`Storing pending session for room ${roomId}`);
    setPendingSession(roomId, {
      appSessionData,
      appDefinition,
      participantA: formattedA,
      participantB: formattedB,
      serverAddress,
      requestToSign,
      nonce,
      signatures: new Map(), // Will collect signatures here
      serverSignature
    });

    logger.info(`Pending session created - waiting for player signatures`);

    return {
      appSessionData,
      appDefinition,
      participants: [formattedA, formattedB, serverAddress],
      requestToSign
    };

  } catch (error) {
    logger.error(`Error generating app session message for room ${roomId}:`, error);
    throw error;
  }
}

/**
 * Get pending app session message for a room
 *
 * @param {string} roomId - Room ID
 * @returns {Object|null} Pending session or null
 */
export function getPendingAppSessionMessage(roomId) {
  return getPendingSession(roomId);
}
