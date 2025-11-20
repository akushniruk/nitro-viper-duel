/**
 * ============================================================================
 * APP SESSIONS COORDINATOR
 * ============================================================================
 *
 * Central export point for all app session functionality.
 * This file re-exports functions from specialized modules.
 *
 * MODULES:
 * - session-storage.js  - In-memory session storage
 * - session-create.js   - Session message generation
 * - session-signatures.js - Signature collection
 * - session-close.js    - Session closure and fund distribution
 * ============================================================================
 */

// Session creation
export {
  generateAppSessionMessage,
  getPendingAppSessionMessage
} from './session-create.js';

// Signature collection and move tracking
export {
  addAppSessionSignature,
  createAppSessionWithSignatures,
  addMoveToSession
} from './session-signatures.js';

// Session updates
export {
  submitAppState
} from './session-update.js';

// Session closure
export {
  closeAppSession
} from './session-close.js';

// Session storage
export {
  getAppSession,
  hasAppSession,
  setAppSession,
  deleteAppSession,
  getAllAppSessions,
  getPendingSession,
  setPendingSession,
  deletePendingSession,
  hasPendingSession
} from './session-storage.js';
