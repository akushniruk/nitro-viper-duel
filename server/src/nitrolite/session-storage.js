/**
 * ============================================================================
 * SESSION STORAGE
 * ============================================================================
 *
 * Simple in-memory storage for app sessions and pending signatures.
 * In production, you might use Redis or a database.
 *
 * STORAGE:
 * - roomAppSessions: Active game sessions by room ID
 * - pendingAppSessions: Pending signature collection by room ID
 * ============================================================================
 */

import logger from '../utils/logger.js';

// Active app sessions by room ID
const roomAppSessions = new Map();

// Pending signature collection by room ID
const pendingAppSessions = new Map();

// ============================================================================
// APP SESSIONS
// ============================================================================

export function getAppSession(roomId) {
  const session = roomAppSessions.get(roomId);
  if (!session) {
    logger.debug(`getAppSession: No session for room ${roomId} (total active: ${roomAppSessions.size})`);
  }
  return session;
}

export function hasAppSession(roomId) {
  return roomAppSessions.has(roomId);
}

export function setAppSession(roomId, sessionData) {
  roomAppSessions.set(roomId, sessionData);
  logger.nitro(`✓ Active session stored for room ${roomId}`);
  logger.data('Session stored:', {
    roomId,
    appSessionId: sessionData.appSessionId,
    participantA: sessionData.participantA,
    participantB: sessionData.participantB,
    hasMoves: !!sessionData.moves,
    totalActiveSessions: roomAppSessions.size
  });
}

export function deleteAppSession(roomId) {
  const had = roomAppSessions.has(roomId);
  roomAppSessions.delete(roomId);
  if (had) {
    logger.nitro(`Session deleted for room ${roomId} (remaining: ${roomAppSessions.size})`);
  }
}

export function getAllAppSessions() {
  return Array.from(roomAppSessions.entries());
}

// ============================================================================
// PENDING SIGNATURES
// ============================================================================

export function getPendingSession(roomId) {
  return pendingAppSessions.get(roomId);
}

export function setPendingSession(roomId, sessionData) {
  pendingAppSessions.set(roomId, sessionData);
}

export function deletePendingSession(roomId) {
  pendingAppSessions.delete(roomId);
}

export function hasPendingSession(roomId) {
  return pendingAppSessions.has(roomId);
}
