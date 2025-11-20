# Viper Duel Server

WebSocket server for the Viper Duel multiplayer snake game with Nitrolite state channels integration.

## Overview

The server manages game rooms, handles real-time snake gameplay, and integrates with Yellow Network's Nitrolite protocol for off-chain state channels and USDC betting.

## Tech Stack

- **Runtime**: Node.js 20+
- **WebSocket**: ws 8.x
- **State Channels**: Nitrolite SDK 0.4.0
- **Ethereum Library**: Ethers.js 6.x + Viem 2.x
- **Environment**: ES Modules
- **Logging**: Chalk (colored console output)

## Project Structure

```
server/
├── src/
│   ├── server.js              # Main server entry point
│   ├── game/                  # Game logic
│   │   ├── rooms.js          # Room management
│   │   └── snake.js          # Snake game mechanics
│   ├── nitrolite/            # Nitrolite integration
│   │   ├── client.js         # RPC client wrapper
│   │   ├── auth.js           # Authentication with Yellow Network
│   │   ├── session-create.js # App session creation
│   │   ├── session-signatures.js # Signature collection
│   │   ├── session-storage.js    # Session state management
│   │   ├── session-update.js     # State updates
│   │   └── session-close.js      # Session closing
│   ├── websocket/            # WebSocket handlers
│   │   ├── handlers/         # Message handlers
│   │   │   ├── room.js      # Room-related messages
│   │   │   ├── game.js      # Game-related messages
│   │   │   └── session.js   # App session messages
│   │   └── server.js        # WebSocket server setup
│   └── utils/                # Utilities
│       ├── logger.js        # Colored logging
│       └── validators.js    # Input validation
├── .env                      # Environment configuration
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Installation

```bash
# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the server directory:

```bash
# Copy the example
cp .env.example .env

# Edit and add your configuration
nano .env
```

### Required Environment Variables

```bash
# Yellow Network WebSocket URL
WS_URL=wss://clearnet.yellow.com/ws

# Server's private key (IMPORTANT: Keep this secret!)
SERVER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Nitrolite Configuration
CHAIN_ID=137
USDC_TOKEN_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
CUSTODY_ADDRESS=0x4C8Bd8877C3b403BA9f9ECfaAD910AF0d8CA2c4D
ADJUDICATOR_ADDRESS=0x2627644ae08aa21Da0Fb458D8879729743D1bB51
DEFAULT_GUEST_ADDRESS=0x3c93C321634a80FB3657CFAC707718A11cA57cBf
POLYGON_RPC_URL=https://polygon-rpc.com

# Server Configuration
PORT=8080
```

### Environment Variable Details

- **WS_URL**: Yellow Network's Nitrolite WebSocket endpoint
- **SERVER_PRIVATE_KEY**: Your server's private key for signing Nitrolite messages (starts with `0x`)
- **CHAIN_ID**: Polygon mainnet = 137
- **USDC_TOKEN_ADDRESS**: USDC token contract on Polygon
- **CUSTODY_ADDRESS**: Yellow Network custody contract
- **ADJUDICATOR_ADDRESS**: Nitrolite adjudicator contract
- **PORT**: WebSocket server port (default: 8080)

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

Uses Node's `--watch` flag for automatic restart on file changes.

### Production Mode

```bash
npm start
```

### Linting

```bash
npm run lint
```

## Game Flow

### 1. Room Creation & Joining

```
Player A → joinRoom (create)
  └─> Server creates room
      └─> room:created sent to Player A

Player B → joinRoom (join with roomId)
  └─> Server adds Player B to room
      └─> room:ready sent to both players
```

### 2. Nitrolite App Session

```
Server → Generates app session message
  └─> appSession:signatureRequest sent to Player B (guest)
  └─> appSession:startGameRequest sent to Player A (host)

Player B → appSession:signature (signs message)
Player A → appSession:startGame (signs message)

Server → Collects both signatures
  └─> Sends to Yellow Network
  └─> Receives app session ID
  └─> Starts game
```

### 3. Gameplay

```
Server → game:started sent to both players
Server → Runs game loop (60 FPS)
  └─> game:update sent to both players (snake positions, food, etc.)

Player → changeDirection (UP/DOWN/LEFT/RIGHT)
  └─> Server updates snake direction
  └─> Direction reflected in next game:update

Game End Condition:
  ├─> Snake hits wall
  ├─> Snake hits itself
  └─> Snake hits other snake

Server → game:over sent to both players
  └─> Winner determined
  └─> Close app session with final allocations
```

## WebSocket Protocol

### Client → Server Messages

#### Join Room
```json
{
  "type": "joinRoom",
  "payload": {
    "roomId": "uuid-string",  // Optional for create, required for join
    "eoa": "0x...",           // Player's session key address
    "betAmount": 0            // 0, 0.01, 0.1, 1, or 2 USDC
  }
}
```

#### Change Direction
```json
{
  "type": "changeDirection",
  "payload": {
    "roomId": "uuid-string",
    "direction": "UP"  // UP, DOWN, LEFT, RIGHT
  }
}
```

#### Get Available Rooms
```json
{
  "type": "getAvailableRooms"
}
```

#### Send Signature (Guest)
```json
{
  "type": "appSession:signature",
  "payload": {
    "roomId": "uuid-string",
    "signature": "0x..."
  }
}
```

#### Start Game (Host)
```json
{
  "type": "appSession:startGame",
  "payload": {
    "roomId": "uuid-string",
    "signature": "0x..."
  }
}
```

### Server → Client Messages

#### Room Created
```json
{
  "type": "room:created",
  "roomId": "uuid-string",
  "role": "host"
}
```

#### Room Ready
```json
{
  "type": "room:ready",
  "roomId": "uuid-string"
}
```

#### Signature Request (Guest)
```json
{
  "type": "appSession:signatureRequest",
  "roomId": "uuid-string",
  "appSessionData": {...},
  "requestToSign": [...]
}
```

#### Start Game Request (Host)
```json
{
  "type": "appSession:startGameRequest",
  "roomId": "uuid-string",
  "appSessionData": {...},
  "requestToSign": [...]
}
```

#### Game Started
```json
{
  "type": "game:started",
  "roomId": "uuid-string"
}
```

#### Game Update
```json
{
  "type": "game:update",
  "roomId": "uuid-string",
  "snakes": {
    "player1": {
      "body": [{"x": 10, "y": 10}, ...],
      "direction": "RIGHT",
      "alive": true,
      "score": 5
    },
    "player2": {...}
  },
  "food": [{"x": 15, "y": 15}],
  "players": {
    "player1": "0x...",
    "player2": "0x..."
  },
  "gameTime": 60000,
  "betAmount": 0.1
}
```

#### Game Over
```json
{
  "type": "game:over",
  "winner": "player1",  // "player1", "player2", or null for tie
  "finalScores": {
    "player1": 10,
    "player2": 7
  },
  "gameTime": 120000
}
```

#### Available Rooms
```json
{
  "type": "room:available",
  "rooms": [
    {
      "roomId": "uuid-string",
      "hostAddress": "0x...",
      "createdAt": 1234567890,
      "betAmount": 0.1
    }
  ]
}
```

#### Error
```json
{
  "type": "error",
  "code": "ERROR_CODE",
  "msg": "Error description"
}
```

## Game Mechanics

### Grid

- 40x30 grid
- Each cell represents a position on the board

### Snakes

- Start with 3 segments
- Grow by 1 segment when eating food
- Move continuously in current direction
- Can only turn 90 degrees (not 180)

### Food

- 5 food items on the board at any time
- Randomly placed when eaten
- +1 score per food

### Win Conditions

1. **Collision with Wall**: Snake dies if it hits the grid boundary
2. **Self-Collision**: Snake dies if it hits its own body
3. **Other Snake Collision**: Snake dies if it collides with opponent
4. **Both Die Simultaneously**: Draw (tie)

### Tick Rate

- Game loop runs at 60 FPS
- Snake movement speed: Configurable (currently 100ms per move)

## Nitrolite Integration

### Authentication

Server authenticates with Yellow Network using:
1. Session key generation
2. Auth request creation
3. Wallet signature (using SERVER_PRIVATE_KEY)
4. Auth response handling

### App Session Lifecycle

1. **Create**: Generate app session message with participants and allocations
2. **Sign**: Collect signatures from both players + server
3. **Submit**: Send complete request to Yellow Network
4. **Play**: Game runs with state tracked off-chain
5. **Close**: Submit final allocations when game ends

### Session Keys

- Server uses session key (separate from main wallet)
- Clients use session keys (generated client-side)
- Session keys sign Nitrolite messages
- Actual funds locked from main wallets

## Logging

The server includes color-coded logging:

- **🔵 SYSTEM**: General system messages (blue)
- **🟢 SUCCESS**: Successful operations (green)
- **🟡 NITRO**: Nitrolite-related logs (yellow)
- **📊 DATA**: Data dumps (cyan)
- **🔐 AUTH**: Authentication logs (magenta)
- **🔴 ERROR**: Errors (red)

Example:
```
[10:15:32] 🔵 SYSTEM WebSocket server listening on port 8080
[10:15:33] 🟡 NITRO Authenticating with Yellow Network...
[10:15:34] 🟢 SUCCESS ✓ Connected to Yellow Network!
```

## Error Handling

### Common Error Codes

- `INVALID_PAYLOAD`: Malformed request
- `JOIN_FAILED`: Room join failed
- `ROOM_NOT_FOUND`: Room doesn't exist
- `PLAYER_NOT_IN_ROOM`: Player not in room
- `GAME_NOT_STARTED`: Game hasn't started yet
- `ALREADY_CONNECTED`: Address already connected

### Error Responses

All errors follow this format:
```json
{
  "type": "error",
  "code": "ERROR_CODE",
  "msg": "Human-readable description"
}
```

## Security Considerations

1. **Private Key**: Never commit `.env` or expose `SERVER_PRIVATE_KEY`
2. **Input Validation**: All client inputs are validated
3. **Address Formatting**: Ethereum addresses normalized to checksum format
4. **Room Isolation**: Players can only affect their own rooms
5. **Signature Verification**: All Nitrolite signatures verified before submission

## Performance

- Handles multiple rooms concurrently
- In-memory state management for fast access
- Efficient game loop with optimized updates
- WebSocket for low-latency communication

## Troubleshooting

### Server won't start

**Problem**: Error on `npm start` or `npm run dev`

**Solutions**:
1. Check Node.js version: `node --version` (must be >= 20.0.0)
2. Verify `.env` file exists and has all required variables
3. Check if port 8080 is already in use: `lsof -i :8080`
4. Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`

### Yellow Network connection fails

**Problem**: "Failed to authenticate with Yellow Network"

**Solutions**:
1. Verify `WS_URL` in `.env` is correct
2. Check `SERVER_PRIVATE_KEY` is valid (starts with `0x`)
3. Ensure you have internet connection
4. Check Yellow Network status

### Signature verification fails

**Problem**: "Signature verification failed" in logs

**Solutions**:
1. Ensure clients are signing with session keys (not main wallet)
2. Verify participants array matches signer addresses
3. Check that all signatures are in correct order
4. Ensure using same message body for signing

### Game loop issues

**Problem**: Game updates are slow or stuttering

**Solutions**:
1. Check server CPU usage
2. Verify no blocking operations in game loop
3. Check number of concurrent games
4. Monitor memory usage

## Development Tips

### Debugging WebSocket Messages

```javascript
// In websocket/server.js
ws.on('message', (message) => {
  console.log('📨 Received:', message.toString());
  // ... handler code
});
```

### Testing Locally

1. Start server: `npm run dev`
2. Use wscat for testing: `wscat -c ws://localhost:8080`
3. Send test messages:
```json
{"type":"getAvailableRooms"}
```

### Hot Reload

The `--watch` flag automatically restarts the server when files change. No need to manually restart during development.

## Production Deployment

### Recommended Setup

1. **Process Manager**: Use PM2 or similar
```bash
npm install -g pm2
pm2 start src/server.js --name viper-duel-server
pm2 save
pm2 startup
```

2. **Environment**: Use production `.env` with secure keys

3. **Reverse Proxy**: Use nginx or similar for SSL/TLS

4. **Monitoring**: Set up logging and monitoring (e.g., CloudWatch, DataDog)

5. **Auto-restart**: Configure auto-restart on crashes

### Health Checks

The server automatically logs connection status. Monitor logs for:
- Yellow Network connection status
- Number of active rooms
- Error frequencies

## Future Enhancements

- [ ] Add game replays
- [ ] Implement spectator mode
- [ ] Add tournament mode
- [ ] Support multiple token types
- [ ] Add leaderboard tracking
- [ ] Implement matchmaking system
- [ ] Add rate limiting
- [ ] Redis for distributed state

## License

MIT
