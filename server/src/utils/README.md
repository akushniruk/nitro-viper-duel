# Utilities

Common utility functions used throughout the server.

## Files

### `logger.js` - Colored Logging

Provides color-coded console logging for different categories.

**Usage:**
```javascript
import logger from './utils/logger.js';

logger.nitro('Requesting channel information...');
logger.auth('Authentication successful');
logger.ws('WebSocket connected');
logger.game('Player moved snake');
logger.data('Received message:', data);
logger.error('Connection failed:', error);
logger.system('Server started');
```

**Categories:**

| Method | Color | Use Case |
|--------|-------|----------|
| `nitro()` | Cyan | Nitrolite RPC operations |
| `auth()` | Magenta | Authentication flow |
| `ws()` | Blue | WebSocket connections |
| `game()` | Yellow | Game logic |
| `data()` | Green | Data processing |
| `error()` | Red | Errors |
| `system()` | White/Gray | System events |

**Features:**
- Color-coded output for easy visual scanning
- Timestamps included
- Multiple arguments supported
- Object pretty-printing
- Error stack traces

**Example Output:**
```
[21:49:25.366] NITROLITE Requesting channel information...
[21:49:25.367] WEBSOCKET Sending get_channels request (ID: 1)
[21:49:25.398] AUTH Authentication successful
[21:49:25.399] DATA Received message: { method: "bu", ... }
[21:49:25.400] ERROR Connection failed: WebSocket closed unexpectedly
```

### `validators.js` - Input Validation

Validates incoming WebSocket message payloads.

**Functions:**

#### `validateJoinRoomPayload(payload)`
Validates join room requests.

**Required Fields:**
- `playerAddress`: Ethereum address (string, 0x-prefixed)
- `betAmount`: Number, must be in [0, 0.01, 0.1, 1, 2]

**Optional Fields:**
- `roomId`: UUID string (for joining existing room)

**Returns:**
```javascript
{
  success: boolean,
  error?: string
}
```

**Example:**
```javascript
const validation = validateJoinRoomPayload({
  playerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  betAmount: 0.01
});

if (!validation.success) {
  return sendError(ws, 'INVALID_PAYLOAD', validation.error);
}
```

#### `validateDirectionPayload(payload)`
Validates direction change requests.

**Required Fields:**
- `direction`: String, must be 'UP', 'DOWN', 'LEFT', or 'RIGHT'
- `playerAddress`: Ethereum address (string, 0x-prefixed)

**Returns:**
```javascript
{
  success: boolean,
  error?: string
}
```

**Example:**
```javascript
const validation = validateDirectionPayload({
  direction: 'UP',
  playerAddress: '0x...'
});

if (!validation.success) {
  return sendError(ws, 'INVALID_PAYLOAD', validation.error);
}
```

## Validation Patterns

### Basic Validation
```javascript
function validatePayload(payload) {
  // Check payload exists
  if (!payload || typeof payload !== 'object') {
    return { success: false, error: 'Invalid payload format' };
  }

  // Check required fields
  if (!payload.requiredField) {
    return { success: false, error: 'Missing required field: requiredField' };
  }

  // Check field types
  if (typeof payload.requiredField !== 'string') {
    return { success: false, error: 'requiredField must be a string' };
  }

  // Check field values
  const validValues = ['value1', 'value2'];
  if (!validValues.includes(payload.requiredField)) {
    return { success: false, error: `Invalid value for requiredField` };
  }

  return { success: true };
}
```

### Ethereum Address Validation
```javascript
function isValidAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Check format: 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// In validator
if (!isValidAddress(payload.playerAddress)) {
  return { success: false, error: 'Invalid Ethereum address format' };
}
```

### Number Range Validation
```javascript
const VALID_BET_AMOUNTS = [0, 0.01, 0.1, 1, 2];

function isValidBetAmount(amount) {
  return typeof amount === 'number' &&
         VALID_BET_AMOUNTS.includes(amount);
}

// In validator
if (!isValidBetAmount(payload.betAmount)) {
  return {
    success: false,
    error: `Invalid bet amount. Must be one of: ${VALID_BET_AMOUNTS.join(', ')}`
  };
}
```

### Optional Field Validation
```javascript
// Only validate if field is provided
if (payload.optionalField !== undefined) {
  if (typeof payload.optionalField !== 'string') {
    return { success: false, error: 'optionalField must be a string if provided' };
  }
}
```

## Logging Best Practices

### When to Use Each Logger

**`logger.nitro()`** - Nitrolite RPC operations
```javascript
logger.nitro('Connecting to RPC server...');
logger.nitro('Requesting channel information...');
logger.nitro('Creating app session...');
```

**`logger.auth()`** - Authentication flow
```javascript
logger.auth('Generating session key...');
logger.auth('Session key generated:', sessionKey.address);
logger.auth('Authentication successful');
logger.auth('Session signer created');
```

**`logger.ws()`** - WebSocket events
```javascript
logger.ws('Client connected from:', address);
logger.ws('Sending get_channels request (ID: 1)');
logger.ws('Client disconnected');
```

**`logger.game()`** - Game logic
```javascript
logger.game('Starting game for room:', roomId);
logger.game('Player moved:', direction);
logger.game('Collision detected - game over');
logger.game('Winner:', winnerAddress);
```

**`logger.data()`** - Data processing
```javascript
logger.data('Received message:', message);
logger.data('Parsing RPC response...');
logger.data('Channel info:', channelData);
```

**`logger.error()`** - Errors
```javascript
logger.error('Failed to connect:', error);
logger.error('Invalid payload:', validation.error);
logger.error('Error creating app session:', error.message);
```

**`logger.system()`** - System events
```javascript
logger.system('Server started on port', port);
logger.system('RPC client initialized');
logger.system('Shutting down...');
```

### Logging Sensitive Information

**DO:**
```javascript
logger.auth('Session key generated:', sessionKey.address);
logger.ws('Client connected:', address);
```

**DON'T:**
```javascript
// Never log private keys!
logger.auth('Private key:', privateKey); // ❌
logger.auth('Session key:', sessionKey.privateKey); // ❌
```

### Logging Complex Objects

```javascript
// Stringify objects for readability
logger.data('Game state:', JSON.stringify(gameState, null, 2));

// Log specific properties
logger.data('Room info:', {
  id: room.id,
  players: room.players,
  betAmount: room.betAmount
});

// Avoid logging huge objects
logger.data('Received message:', message.substring(0, 200) + '...');
```

### Error Logging

```javascript
try {
  // Some operation
} catch (error) {
  logger.error('Operation failed:', error.message);
  logger.error('Stack trace:', error.stack);

  // Include context
  logger.error('Failed to create room for player:', playerAddress);
}
```

## Adding New Validators

### Step 1: Define Validator Function
```javascript
/**
 * Validates example message payload
 * @param {Object} payload - Message payload
 * @returns {Object} Validation result
 */
export function validateExamplePayload(payload) {
  // Check payload exists
  if (!payload || typeof payload !== 'object') {
    return { success: false, error: 'Invalid payload format' };
  }

  // Validate required fields
  if (!payload.requiredField) {
    return { success: false, error: 'Missing required field: requiredField' };
  }

  // Validate types and values
  // ...

  return { success: true };
}
```

### Step 2: Use in Handler
```javascript
import { validateExamplePayload } from '../../utils/validators.js';

export function handleExample(ws, payload, context) {
  const validation = validateExamplePayload(payload);
  if (!validation.success) {
    return context.sendError(ws, 'INVALID_PAYLOAD', validation.error);
  }

  // Proceed with valid payload
}
```

### Step 3: Add Tests
```javascript
describe('validateExamplePayload', () => {
  it('should accept valid payload', () => {
    const result = validateExamplePayload({
      requiredField: 'value'
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing required field', () => {
    const result = validateExamplePayload({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});
```

## Performance Considerations

### Logging
- Avoid logging in tight loops
- Use conditional logging for verbose data
- Consider log levels in production

```javascript
const DEBUG = process.env.NODE_ENV !== 'production';

if (DEBUG) {
  logger.data('Detailed game state:', gameState);
}
```

### Validation
- Validate early (before expensive operations)
- Cache validation results when appropriate
- Use simple checks first (existence before regex)

```javascript
// Fast checks first
if (!payload) return { success: false, error: 'Missing payload' };
if (!payload.address) return { success: false, error: 'Missing address' };

// Expensive checks last
if (!isValidEthereumAddress(payload.address)) {
  return { success: false, error: 'Invalid address format' };
}
```
