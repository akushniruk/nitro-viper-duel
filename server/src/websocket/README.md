# WebSocket Server & Handlers

This folder contains the WebSocket server configuration and message handlers.

## Files

### `config.js` - WebSocket Server Configuration

Server setup and utility functions.

**Functions:**

#### `createWebSocketServer(port)`
Creates and configures WebSocket server.

```javascript
const wss = createWebSocketServer(8080);
```

**Features:**
- Automatic port configuration (default: 8080)
- Connection logging
- Error handling
- Close event handling

#### `sendError(ws, code, message)`
Sends error message to client in standard format.

```javascript
sendError(ws, 'INVALID_PAYLOAD', 'Missing required field: playerAddress');
```

**Error Codes:**
- `INVALID_PAYLOAD` - Malformed or missing data
- `ROOM_NOT_FOUND` - Room doesn't exist
- `ROOM_FULL` - Room already has 2 players
- `BET_MISMATCH` - Bet amounts don't match
- `NOT_AUTHORIZED` - Player not in room
- `GAME_NOT_STARTED` - Game hasn't begun yet

#### `startPingInterval(wss, connections)`
Starts periodic ping to keep connections alive.

**Interval:** 30 seconds
**Purpose:** Prevent connection timeouts, detect dead connections

## Handlers

### `handlers/game.js` - Game Message Handlers

Handles game-related WebSocket messages.

**Message Types:**

#### `startGame`
Initiates game start and signature collection flow.

**Payload:**
```json
{
  "roomId": "uuid",
  "playerAddress": "0x..."
}
```

**Flow:**
1. Validate player is host
2. Validate room is ready
3. Generate app session message
4. Request guest signature
5. Wait for both signatures
6. Create app session
7. Start game loop
8. Broadcast game started

**Response:**
```json
{
  "type": "appSession:signatureRequest",
  "payload": {
    "roomId": "uuid",
    "message": { ... },
    "role": "guest"
  }
}
```

#### `changeDirection`
Updates player's snake direction.

**Payload:**
```json
{
  "direction": "UP" | "DOWN" | "LEFT" | "RIGHT",
  "playerAddress": "0x..."
}
```

**Validation:**
- Player must be in a room
- Game must be in progress
- Direction must be valid

**Response:** None (direction queued for next game tick)

#### `appSession:signature`
Receives player's signature for app session.

**Payload:**
```json
{
  "roomId": "uuid",
  "playerAddress": "0x...",
  "signature": "0x..."
}
```

**Flow:**
- Guest signs first → requests host signature
- Host signs second → creates app session → starts game

### `handlers/room.js` - Room Message Handlers

Handles room-related WebSocket messages.

**Message Types:**

#### `joinRoom`
Creates or joins a game room.

**Payload:**
```json
{
  "playerAddress": "0x...",
  "betAmount": 0.01
}
```

**Flow:**

**Create Room (no roomId):**
```
1. Create new room with player as host
2. Set bet amount
3. Return room ID
4. Broadcast room to available rooms list
```

**Join Room (with roomId):**
```
1. Validate room exists
2. Validate not full
3. Validate bet amount matches
4. Add player as guest
5. Mark room as ready
6. Notify both players
```

**Responses:**

**Room Created:**
```json
{
  "type": "room:created",
  "payload": {
    "roomId": "uuid",
    "betAmount": 0.01,
    "role": "host"
  }
}
```

**Room Ready:**
```json
{
  "type": "room:ready",
  "payload": {
    "roomId": "uuid",
    "players": {
      "host": "0x...",
      "guest": "0x..."
    },
    "betAmount": 0.01
  }
}
```

#### `getAvailableRooms`
Retrieves list of rooms waiting for players.

**Payload:** None

**Response:**
```json
{
  "type": "room:available",
  "payload": {
    "rooms": [
      {
        "id": "uuid",
        "hostAddress": "0x...",
        "betAmount": 0.01,
        "createdAt": timestamp
      }
    ]
  }
}
```

## Message Flow Examples

### Starting a Game

```
Client (Host) → Server: { type: "startGame", payload: { ... } }
  ↓
Server validates host
  ↓
Server → Guest: { type: "appSession:signatureRequest", ... }
  ↓
Client (Guest) → Server: { type: "appSession:signature", signature: "0x..." }
  ↓
Server → Host: { type: "appSession:startGameRequest", ... }
  ↓
Client (Host) → Server: { type: "appSession:startGame", signature: "0x..." }
  ↓
Server creates app session
  ↓
Server → Both: { type: "game:started", payload: { gameState: {...} } }
  ↓
Game loop begins
```

### Gameplay Loop

```
Server (auto tick) → Both: { type: "game:update", payload: { snakes, food, scores } }
  ↓
Client renders state
  ↓
Player presses key
  ↓
Client → Server: { type: "changeDirection", payload: { direction: "UP", ... } }
  ↓
Server queues direction
  ↓
Next tick: direction applied
  ↓
Server → Both: { type: "game:update", ... }
```

### Game End

```
Server detects collision
  ↓
Server determines winner
  ↓
Server closes app session (funds distributed)
  ↓
Server → Both: {
  type: "game:over",
  payload: {
    winner: "0x...",
    scores: { player1: 5, player2: 3 },
    gameTime: 45.2
  }
}
  ↓
Clients show game over screen
```

## Error Handling

### Validation Errors
```javascript
if (!payload.playerAddress) {
  return sendError(ws, 'INVALID_PAYLOAD', 'Missing playerAddress');
}
```

### State Errors
```javascript
if (room.gameState) {
  return sendError(ws, 'GAME_ALREADY_STARTED', 'Game is already in progress');
}
```

### Authorization Errors
```javascript
if (room.players.host !== playerAddress) {
  return sendError(ws, 'NOT_AUTHORIZED', 'Only host can start game');
}
```

## Handler Patterns

### Standard Handler Structure
```javascript
export async function handleMessage(ws, payload, context) {
  // 1. Validate payload
  const validation = validatePayload(payload);
  if (!validation.success) {
    return context.sendError(ws, 'INVALID_PAYLOAD', validation.error);
  }

  // 2. Extract context
  const { roomManager, connections } = context;

  // 3. Business logic
  const room = roomManager.getRoomById(payload.roomId);
  if (!room) {
    return context.sendError(ws, 'ROOM_NOT_FOUND', 'Room does not exist');
  }

  // 4. Perform action
  // ...

  // 5. Send response
  ws.send(JSON.stringify({
    type: 'success',
    payload: { ... }
  }));

  // 6. Broadcast to others if needed
  room.connections.forEach((conn, addr) => {
    if (conn !== ws) {
      conn.send(JSON.stringify({ ... }));
    }
  });
}
```

### Context Object
```javascript
{
  roomManager: RoomManager,           // Room management
  connections: Map<string, WebSocket>, // Active connections by EOA
  sendError: Function                  // Error sender utility
}
```

## Testing Handlers

### Unit Testing
```javascript
// Mock WebSocket
const mockWs = {
  send: jest.fn(),
  readyState: 1
};

// Mock context
const mockContext = {
  roomManager: createRoomManager(),
  connections: new Map(),
  sendError: (ws, code, msg) => {
    ws.send(JSON.stringify({ type: 'error', error: { code, message: msg } }));
  }
};

// Test handler
await handleJoinRoom(mockWs, {
  playerAddress: '0x123',
  betAmount: 0.01
}, mockContext);

// Assert
expect(mockWs.send).toHaveBeenCalled();
```

### Integration Testing
```javascript
// Connect real WebSocket clients
const ws1 = new WebSocket('ws://localhost:8080');
const ws2 = new WebSocket('ws://localhost:8080');

// Player 1 creates room
ws1.send(JSON.stringify({
  type: 'joinRoom',
  payload: { playerAddress: '0x123', betAmount: 0.01 }
}));

// Player 2 joins
ws2.send(JSON.stringify({
  type: 'joinRoom',
  payload: { playerAddress: '0x456', betAmount: 0.01, roomId: 'uuid' }
}));

// Verify both receive room:ready
```

## Broadcasting Patterns

### Broadcast to Room
```javascript
function broadcastToRoom(room, message) {
  room.connections.forEach((ws, playerEOA) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}
```

### Broadcast to All
```javascript
function broadcastToAll(connections, message) {
  connections.forEach((ws, playerEOA) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}
```

### Broadcast Except Sender
```javascript
function broadcastExcept(room, senderWs, message) {
  room.connections.forEach((ws, playerEOA) => {
    if (ws !== senderWs && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}
```

## Connection Management

### On Connect
```javascript
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Wait for authentication message with player address
  ws.once('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'authenticate') {
      connections.set(msg.payload.playerAddress, ws);
    }
  });
});
```

### On Disconnect
```javascript
ws.on('close', () => {
  // Find player's room
  const room = roomManager.getRoomByConnection(ws);
  if (room) {
    // Handle forfeit if game in progress
    if (room.gameState) {
      const winner = getOpponent(room, playerAddress);
      closeAppSession(room.id, winner);
    }
    roomManager.deleteRoom(room.id);
  }

  // Remove from connections
  connections.delete(playerAddress);
});
```

### Keep-Alive
```javascript
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
```
