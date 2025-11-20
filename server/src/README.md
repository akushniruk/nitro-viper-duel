# Viper Duel Server

This is the backend server for Viper Duel - a real-time multiplayer Snake game with blockchain integration using Nitrolite state channels.

## 📁 Project Structure

```
src/
├── nitrolite/          # Nitrolite (ERC-7824) blockchain integration
│   ├── client.js       # WebSocket RPC client with session key authentication
│   ├── signer.js       # Session key generation and message signing
│   ├── appSessions.js  # Virtual app session management (game sessions)
│   └── onChain.js      # On-chain operations (deposits, withdrawals)
│
├── game/               # Snake game logic
│   ├── snake.js        # Game mechanics (movement, collisions, scoring)
│   └── rooms.js        # Room management (creating, joining, matchmaking)
│
├── websocket/          # WebSocket server and message handlers
│   ├── handlers/       # Message handlers by domain
│   │   ├── game.js     # Game-related messages (start, move, etc.)
│   │   └── room.js     # Room-related messages (join, list, etc.)
│   └── config.js       # WebSocket server configuration
│
├── utils/              # Utility functions
│   ├── logger.js       # Colored logging utility
│   └── validators.js   # Input validation functions
│
└── server.js           # Main entry point - sets up WebSocket server
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.0.0
- A Nitrolite RPC endpoint (e.g., Clearnode)
- Private key for server wallet

### Installation

```bash
cd server
npm install
```

### Configuration

Create a `.env` file in the `server/` directory:

```env
# Nitrolite Configuration
NITROLITE_RPC_URL=wss://your-nitrolite-rpc-endpoint
SERVER_PRIVATE_KEY=0xyourprivatekeyhere

# Server Configuration (optional)
PORT=8080
```

### Running

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## 🏗️ Architecture Overview

### Authentication Flow

1. **Session Key Generation**: Server generates an ephemeral session key on startup
2. **Authentication**: Server authenticates with Nitrolite using EIP-712 signatures
3. **Session Signer**: All subsequent RPC messages are signed with the session key

### Game Flow

1. **Room Creation**: Players create/join rooms with specific bet amounts (0, 0.01, 0.1, 1, 2 USDC)
2. **Matchmaking**: Room becomes "ready" when 2 players join with matching bets
3. **App Session**: Server creates a Nitrolite app session (virtual application) for the game
4. **Signature Collection**: Both players sign the app session creation message
5. **Game Start**: Once signatures are collected, the game begins
6. **Real-Time Gameplay**: Server runs game loop, players send direction changes
7. **Game End**: Winner determined by collisions, funds distributed via app session closure

### Key Components

#### Nitrolite Integration (`nitrolite/`)

- **client.js**: Manages WebSocket connection to Nitrolite RPC server
  - Handles authentication with session keys
  - Signs all RPC messages with session signer
  - Manages balance updates and channel state

- **signer.js**: Cryptographic operations
  - Generates ephemeral session keypairs
  - Creates ECDSA message signers
  - Creates EIP-712 wallet clients

- **appSessions.js**: Game session lifecycle
  - Creates virtual applications for each game
  - Collects signatures from both players
  - Manages app state updates
  - Closes sessions and distributes winnings

#### Game Logic (`game/`)

- **snake.js**: Core game mechanics
  - Grid-based snake movement (20x20)
  - Collision detection (self, other snake, food)
  - Wraparound screen (no walls)
  - Food spawning and consumption

- **rooms.js**: Room management
  - Create/join rooms with bet amounts
  - Player matchmaking
  - Room state management
  - Connection tracking

#### WebSocket Handlers (`websocket/`)

- **handlers/game.js**: Game message handlers
  - Start game (with signature collection)
  - Direction changes
  - App session signature submission

- **handlers/room.js**: Room message handlers
  - Join room
  - Get available rooms
  - Room state updates

## 🔑 Key Features

### Session Key Security

The server uses ephemeral session keys for all RPC communication:
- Main wallet only signs the initial EIP-712 authentication
- Session key signs all subsequent messages (channels, app sessions, etc.)
- Session keys have configurable expiration and spending limits

### Real-Time Game Loop

The server runs an automatic game loop:
- Snakes move forward automatically every tick
- Players only control direction changes
- State updates broadcast to both clients
- Collision detection happens server-side

### Blockchain Integration

All games are backed by Nitrolite state channels:
- Instant, gasless transactions
- Cryptographic proof of game outcomes
- Fair fund distribution based on game results

## 📝 Message Protocol

### Room Messages

**Join Room:**
```json
{
  "type": "joinRoom",
  "payload": {
    "playerAddress": "0x...",
    "betAmount": 0.01
  }
}
```

**Get Available Rooms:**
```json
{
  "type": "getAvailableRooms"
}
```

### Game Messages

**Start Game:**
```json
{
  "type": "startGame",
  "payload": {
    "roomId": "uuid",
    "playerAddress": "0x..."
  }
}
```

**Change Direction:**
```json
{
  "type": "changeDirection",
  "payload": {
    "direction": "UP" | "DOWN" | "LEFT" | "RIGHT",
    "playerAddress": "0x..."
  }
}
```

**App Session Signature:**
```json
{
  "type": "appSession:signature",
  "payload": {
    "roomId": "uuid",
    "playerAddress": "0x...",
    "signature": "0x..."
  }
}
```

## 🐛 Debugging

The logger provides color-coded output for different categories:
- **NITROLITE** (cyan): Nitrolite RPC operations
- **AUTH** (magenta): Authentication flow
- **WEBSOCKET** (blue): WebSocket connections
- **GAME** (yellow): Game logic
- **DATA** (green): Data processing
- **ERROR** (red): Errors

## 📚 Learn More

- [Nitrolite Documentation](https://docs.nitrolite.io)
- [ERC-7824 Standard](https://eips.ethereum.org/EIPS/eip-7824)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
