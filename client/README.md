# Viper Duel Client

React frontend for the Viper Duel multiplayer snake game.

## Overview

The client is a React application built with Vite, featuring real-time WebSocket communication, wallet integration via RainbowKit, and Nitrolite state channels for off-chain game state management.

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS 3.4
- **Wallet Connection**: RainbowKit 2.2 + Wagmi 2.15
- **State Channels**: Nitrolite SDK 0.4.0
- **Ethereum Library**: Ethers.js 6.7 + Viem 2.31
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React

## Project Structure

```
client/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # Reusable UI components (buttons, dialogs, etc.)
│   │   ├── Lobby.tsx    # Room creation/joining interface
│   │   ├── Game.tsx     # Main game board
│   │   ├── GameOver.tsx # Game end screen
│   │   └── ...
│   ├── context/         # React contexts
│   │   ├── WebSocketContext.tsx  # WebSocket connection management
│   │   └── app.ts       # App configuration
│   ├── hooks/           # Custom React hooks
│   │   ├── useAppSessionSignature.ts  # Nitrolite signature handling
│   │   └── useWebSocket.ts            # WebSocket hook
│   ├── websocket/       # WebSocket client logic
│   ├── types/           # TypeScript type definitions
│   ├── store/           # State management
│   └── App.tsx          # Main app component
├── public/              # Static assets
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # TailwindCSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Configuration

### WebSocket URL

The WebSocket server URL is configured in `src/context/app.ts`:

```typescript
export const APP_CONFIG = {
    WEBSOCKET: {
        URL: "wss://clearnet.yellow.com/ws",
    },
    // ... other config
}
```

To change the WebSocket URL (e.g., to point to localhost during development):

```typescript
WEBSOCKET: {
    URL: "ws://localhost:8080",
}
```

### Network Configuration

The app is configured for Polygon mainnet (Chain ID: 137):

```typescript
TOKENS: {
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"  // USDC
},
CUSTODIES: {
    137: "0x4C8Bd8877C3b403BA9f9ECfaAD910AF0d8CA2c4D"
},
ADJUDICATORS: {
    137: "0x5F4A4B1D293A973a1Bc0daD3BB3692Bd51058FCF"
}
```

## Key Features

### 1. Wallet Connection

Uses RainbowKit for a beautiful wallet connection experience:
- Support for MetaMask, WalletConnect, and other popular wallets
- Automatic network switching to Polygon
- Session management

### 2. Session Keys

The app generates ephemeral session keys for signing game actions:
- Session keys are stored in localStorage
- Used for Nitrolite state channel signatures
- Separate from main wallet for security

### 3. Real-time Communication

WebSocket connection to game server:
- Room creation and joining
- Live game state updates
- Player presence tracking
- Signature collection for state channels

### 4. Nitrolite Integration

Off-chain state channels using Yellow Network's Nitrolite:
- App session creation with participant signatures
- State updates without on-chain transactions
- Instant game state synchronization

## Game Flow

1. **Connect Wallet**: User connects MetaMask or another wallet
2. **Generate Session Key**: Ephemeral key generated for signing
3. **Create/Join Room**:
   - Select bet amount (0, 0.01, 0.1, 1, 2 USDC)
   - Create room or join existing room with matching bet
4. **Wait for Opponent**: Room fills when second player joins
5. **Sign App Session**: Both players sign Nitrolite app session message
6. **Play Game**: Real-time snake game
7. **Game Over**: Winner receives the pot

## WebSocket Message Types

### Client → Server

- `joinRoom`: Create or join a game room
- `changeDirection`: Change snake direction
- `getAvailableRooms`: Request list of available rooms
- `appSession:signature`: Send signature for app session
- `appSession:startGame`: Host starts the game with signature

### Server → Client

- `room:created`: Room created successfully
- `room:ready`: Both players joined, ready to start
- `room:state`: Current game state update
- `game:started`: Game has started
- `game:update`: Game state update (snake positions, food, etc.)
- `game:over`: Game ended
- `appSession:signatureRequest`: Request signature from guest
- `appSession:startGameRequest`: Request signature from host to start
- `error`: Error message

## Component Overview

### Core Components

- **App.tsx**: Root component, manages routing and global state
- **Lobby.tsx**: Room creation/joining interface, bet selection
- **Game.tsx**: Main game board, renders snakes and food
- **GameOver.tsx**: Game end screen with results

### UI Components

Located in `src/components/ui/`:
- `button.tsx`: Styled button component
- `card.tsx`: Card container components
- `dialog.tsx`: Modal dialog components
- `input.tsx`: Form input component
- `tabs.tsx`: Tab navigation component

### Hooks

- **useWebSocket**: Manages WebSocket connection lifecycle
- **useAppSessionSignature**: Handles Nitrolite signature requests
- **useWebSocketContext**: Access WebSocket context from any component

## Styling

The app uses TailwindCSS with a custom theme:

### Custom Colors

```css
--viper-green: #00ff88    /* Player 1 / Snake 1 */
--viper-purple: #b44cff   /* Player 2 / Snake 2 */
--viper-grey: #808080     /* Neutral */
```

### Responsive Design

The app is fully responsive and works on:
- Desktop (1920x1080 and above)
- Tablets (768px and above)
- Mobile (375px and above)

## Build and Deployment

### Production Build

```bash
npm run build
```

Output: `dist/` directory containing optimized static files

### Preview Production Build

```bash
npm run preview
```

### Deployment

The built `dist/` folder can be deployed to any static hosting service:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

#### Environment Variables for Deployment

If you need different configurations for production, update `src/context/app.ts` before building:

```typescript
// For production
export const APP_CONFIG = {
    WEBSOCKET: {
        URL: "wss://your-production-server.com/ws",
    },
    // ... rest of config
}
```

## Troubleshooting

### WebSocket Connection Issues

**Problem**: Client can't connect to server

**Solutions**:
1. Verify server is running
2. Check WebSocket URL in `src/context/app.ts`
3. Check browser console for errors
4. Ensure no CORS issues (server must allow your origin)

### Wallet Connection Issues

**Problem**: Wallet won't connect

**Solutions**:
1. Ensure you're on a supported browser (Chrome, Firefox, Brave)
2. Install MetaMask or another supported wallet
3. Switch to Polygon network (Chain ID: 137)
4. Clear browser cache and try again

### Signature Failures

**Problem**: "Signature verification failed" error

**Solutions**:
1. Ensure session keys are properly generated
2. Check that you're signing with session key, not main wallet
3. Verify both players are on the same room
4. Try regenerating session keys (clear localStorage)

### Build Errors

**Problem**: TypeScript or build errors

**Solutions**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

## Development Tips

### Hot Module Replacement (HMR)

Vite provides fast HMR. Changes to React components will reflect immediately without full page reload.

### TypeScript Strict Mode

The project uses strict TypeScript. Ensure all types are properly defined.

### Console Logging

The app includes extensive console logging for debugging:
- WebSocket messages: `console.log("Received message:", data)`
- Signature creation: `console.log("Client signature created:", signature)`
- Room actions: `console.log("Creating room with session key:", address)`

### Browser DevTools

Useful for debugging:
1. **Network tab**: Monitor WebSocket frames
2. **Application tab**: Check localStorage for session keys
3. **Console**: View logs and errors

## License

MIT
