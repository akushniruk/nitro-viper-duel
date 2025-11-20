# 🎮 Viper Duel - Hackathon Quick Start

**A production-ready example of multiplayer Snake with blockchain integration using Nitrolite (ERC-7824)**

Perfect for learning how to build real-time multiplayer games with state channels!

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
NITROLITE_RPC_URL=wss://your-nitrolite-endpoint
SERVER_PRIVATE_KEY=0xyourprivatekeyhere
PORT=8080
```

### 3. Run Server
```bash
npm run dev
```

That's it! Server is now running on `ws://localhost:8080`

## 📁 Code Organization

```
src/
├── server.js              # Main entry point (routing)
│
├── nitrolite/             # Blockchain integration
│   ├── client.js          # RPC client (290 lines)
│   ├── auth.js            # Session key auth (161 lines)
│   ├── signer.js          # Key generation (158 lines)
│   └── appSessions.js     # Game sessions (750 lines)
│
├── game/                  # Game logic
│   ├── snake.js           # Game engine (526 lines)
│   └── rooms.js           # Matchmaking (339 lines)
│
├── websocket/             # Network layer
│   ├── config.js          # Server setup (84 lines)
│   └── handlers/          # Message handlers
│       ├── game.js        # Game messages (390 lines)
│       └── room.js        # Room messages (150 lines)
│
└── utils/                 # Shared utilities
    ├── logger.js          # Color logging
    └── validators.js      # Input validation
```

**All files under 400 lines except appSessions.js** ✅

## 🎯 Where to Start

### Understanding the Flow

**1. Start with `server.js`**
- See how everything connects
- Message routing logic
- ~180 lines, well-commented

**2. Look at `game/snake.js`**
- Pure game logic
- No blockchain complexity
- Easy to modify game rules

**3. Check `nitrolite/auth.js`**
- See session key authentication
- ~160 lines, focused on one thing
- Shows EIP-712 signing

**4. Explore `nitrolite/appSessions.js`**
- Game session lifecycle
- Signature collection
- Fund distribution

### Key Concepts

#### Session Keys (nitrolite/auth.js)
- Your wallet signs ONCE to authorize a session key
- Session key signs all future messages
- Better UX (no wallet popups)
- Spending limits & expiration

#### App Sessions (nitrolite/appSessions.js)
- Virtual application holding funds
- Updates based on game outcomes
- Closes with winner-take-all distribution
- All backed by cryptographic proofs

#### Game Loop (game/snake.js)
- Server-driven automatic movement
- Players control direction only
- Collision detection
- Wraparound screen

## 🔨 Customization Ideas

### Easy Modifications

**1. Change Game Rules**
Edit `game/snake.js`:
- Grid size (GRID_WIDTH, GRID_HEIGHT)
- Food count
- Starting positions
- Collision behavior

**2. Add New Bet Amounts**
Edit `utils/validators.js`:
```javascript
const VALID_BET_AMOUNTS = [0, 0.01, 0.1, 1, 2, 5]; // Add 5 USDC
```

**3. Custom Messages**
Add handler in `websocket/handlers/`:
```javascript
export function handleMyCustomMessage(ws, payload, context) {
  // Your logic here
}
```

### Advanced Modifications

**1. Different Win Condition**
In `nitrolite/appSessions.js`, modify `closeAppSession()`:
```javascript
// Instead of winner-take-all:
allocations: [
  { participant: winner, amount: "150" },  // 75%
  { participant: loser, amount: "50" }     // 25%
]
```

**2. Add Power-Ups**
In `game/snake.js`, add new food types:
```javascript
const foodTypes = {
  normal: { score: 1, color: 'green' },
  power: { score: 5, color: 'gold', speed: 2 }
};
```

**3. Tournament Mode**
Create `game/tournament.js` for multi-player brackets

## 📚 Learning Path

### Day 1: Setup & Game Logic
1. Run the server
2. Read `server.js` to understand flow
3. Modify `game/snake.js` (change grid size)
4. Test your changes

### Day 2: Blockchain Basics
1. Read `nitrolite/README.md`
2. Understand session keys in `auth.js`
3. See how messages are signed in `client.js`

### Day 3: Game Sessions
1. Study `appSessions.js`
2. Understand signature collection
3. Learn about fund distribution

### Day 4: Build Your Own
1. Clone the structure
2. Replace Snake with your game
3. Keep the blockchain integration

## 🐛 Common Issues

### "WebSocket not connected"
- Check NITROLITE_RPC_URL in .env
- Ensure server is running

### "Authentication failed"
- Verify SERVER_PRIVATE_KEY is valid
- Check wallet has proper format (0x prefix)

### "Invalid bet amount"
- Only [0, 0.01, 0.1, 1, 2] are valid
- Both players must match bet amounts

## 💡 Tips for Hackers

1. **Start Small**: Modify game rules first, blockchain later
2. **Use Logs**: Color-coded logs show what's happening
3. **Read READMEs**: Each folder has detailed documentation
4. **Test Locally**: No blockchain needed for testing game logic
5. **Ask Questions**: Code is well-commented, but don't hesitate to ask!

## 🏆 What Makes This Special

✅ **Production-Ready**: Actually works, not a demo
✅ **Well-Organized**: Logical folder structure
✅ **Documented**: Every file has clear comments
✅ **Modular**: Easy to swap components
✅ **Educational**: Learn session keys, state channels, real-time games

## 🔗 Resources

- [Nitrolite Docs](https://docs.nitrolite.io)
- [ERC-7824 Standard](https://eips.ethereum.org/EIPS/eip-7824)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**Built with ❤️ for the hackathon community**

Ready to build your own blockchain game? Start here! 🚀
