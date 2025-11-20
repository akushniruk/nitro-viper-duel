# Game Logic

This folder contains the core Snake game mechanics and room management.

## Files

### `snake.js` - Snake Game Engine

Pure game logic for the Snake game.

**Game Configuration:**
- Grid: 20x20 cells
- Initial snake length: 3 segments
- Food items: 3 active at all times
- Wraparound: Yes (snakes wrap to opposite side, no wall collisions)

**Key Functions:**

#### `createGame(player1Address, player2Address)`
Creates initial game state with two snakes and food items.

```javascript
{
  snakes: {
    player1: {
      body: [{x: 3, y: 3}, {x: 2, y: 3}, {x: 1, y: 3}],
      direction: 'RIGHT',
      nextDirection: 'RIGHT',
      alive: true,
      score: 0
    },
    player2: { ... }
  },
  food: [{x: 10, y: 10}, {x: 15, y: 5}, {x: 8, y: 12}],
  players: [player1Address, player2Address],
  gameTime: 0
}
```

#### `changeDirection(gameState, playerAddress, direction)`
Updates a player's next direction (applied on next move).

**Directions:** `'UP'`, `'DOWN'`, `'LEFT'`, `'RIGHT'`

**Note:** No reverse direction validation (can turn 180° instantly)

#### `updateGame(gameState)`
Advances game by one tick. Returns `{ gameState, gameOver, winner }`.

**Per Tick:**
1. Apply next direction
2. Move snake head forward
3. Check collisions:
   - Food → grow snake, spawn new food
   - Self → snake dies
   - Other snake → colliding snake dies
   - Wall → wraparound (x: 0↔19, y: 0↔19)
4. Determine game over conditions

**Win Conditions:**
- One snake alive: That player wins
- Both snakes dead simultaneously: Tie (winner = null)
- Last snake standing wins

#### `formatGameState(gameState)`
Converts game state to format for client transmission.

#### `formatGameOverMessage(roomId, winner, gameState)`
Creates game over message with winner and final scores.

### `rooms.js` - Room Management

Manages game rooms, matchmaking, and player connections.

**Room States:**
- **waiting**: Created, waiting for second player
- **ready**: Both players present, can start
- **playing**: Game in progress
- **finished**: Game completed

**Key Functions:**

#### `createRoomManager()`
Creates room manager instance with Map-based storage.

```javascript
const roomManager = createRoomManager();
```

**Methods:**
- `createRoom(hostEOA, hostConnection, betAmount)` - Create new room
- `joinRoom(roomId, guestEOA, guestConnection, betAmount)` - Join existing room
- `getRoomById(roomId)` - Get room by ID
- `getRoomByPlayer(playerEOA)` - Find player's room
- `getAllRooms()` - Get all rooms
- `getAvailableRooms()` - Get rooms in 'waiting' state
- `deleteRoom(roomId)` - Delete room

**Room Structure:**
```javascript
{
  id: 'uuid',
  players: {
    host: '0xHostAddress',
    guest: '0xGuestAddress' | null
  },
  connections: Map {
    '0xHostAddress' => WebSocket,
    '0xGuestAddress' => WebSocket
  },
  betAmount: 0.01,
  gameState: null | { ... },
  isReady: false,
  createdAt: timestamp
}
```

## Game Flow

### 1. Room Creation
```
Player A creates room with bet amount
  ↓
Room in 'waiting' state
  ↓
Room appears in available rooms list
```

### 2. Matchmaking
```
Player B joins room with matching bet
  ↓
Room transitions to 'ready' state
  ↓
Both players receive 'room:ready' message
  ↓
Host can now start game
```

### 3. Game Start
```
Host clicks start
  ↓
Server creates app session
  ↓
Both players sign
  ↓
Game state initialized
  ↓
Game loop starts
```

### 4. Gameplay
```
Every tick (automatic):
  1. Apply next directions
  2. Move snakes forward
  3. Check collisions
  4. Update food
  5. Broadcast state to clients

Player input:
  - Send direction change
  - Server validates and queues
  - Applied on next tick
```

### 5. Game End
```
Collision detected
  ↓
Determine winner
  ↓
Close app session
  ↓
Distribute funds
  ↓
Send game over message
  ↓
Clean up room
```

## Game Mechanics Details

### Movement

Snakes move automatically:
- Server-driven game loop (not per-keypress)
- Interval-based updates
- Players only control direction

### Collision Detection

**Self-Collision:**
```javascript
// Head position matches any body segment
const head = snake.body[0];
const selfCollision = snake.body.slice(1).some(segment =>
  segment.x === head.x && segment.y === head.y
);
```

**Other Snake Collision:**
```javascript
// Head position matches any segment of other snake
const otherSnakeCollision = otherSnake.body.some(segment =>
  segment.x === head.x && segment.y === head.y
);
```

**Wraparound:**
```javascript
// Screen wraps at edges
newX = (newX + GRID_WIDTH) % GRID_WIDTH;
newY = (newY + GRID_HEIGHT) % GRID_HEIGHT;
```

### Food System

**Spawning:**
- Random positions avoiding snake bodies
- Always maintain 3 food items
- Immediate respawn when eaten

**Consumption:**
```javascript
// Check if head position matches food
const foodIndex = food.findIndex(f => f.x === head.x && f.y === head.y);
if (foodIndex !== -1) {
  snake.score += 1;
  // Don't remove tail (snake grows)
  spawnNewFood();
}
```

### Scoring

- +1 point per food item eaten
- Score displayed in game over message
- Winner determined by survival, not score

## Bet Amounts

Valid bet amounts (in USDC):
- `0` - Free play (no betting)
- `0.01` - 1 cent
- `0.1` - 10 cents
- `1` - 1 dollar
- `2` - 2 dollars

**Room Matching:**
- Players can only join rooms with matching bet amounts
- Prevents mismatched stakes
- Winner takes all (pot = betAmount × 2)

## Testing Game Logic

```javascript
// Create game
const gameState = createGame('0xPlayer1', '0xPlayer2');

// Simulate moves
changeDirection(gameState, '0xPlayer1', 'UP');
const result = updateGame(gameState);

// Check result
if (result.gameOver) {
  console.log('Winner:', result.winner);
  console.log('Scores:', {
    player1: result.gameState.snakes.player1.score,
    player2: result.gameState.snakes.player2.score
  });
}
```

## Common Patterns

### Broadcasting Game State
```javascript
const formatted = formatGameState(gameState);
room.connections.forEach((ws, playerEOA) => {
  ws.send(JSON.stringify({
    type: 'game:update',
    payload: formatted
  }));
});
```

### Handling Player Disconnect
```javascript
// Remove player from room
const room = roomManager.getRoomByPlayer(playerEOA);
if (room && room.gameState) {
  // Game in progress - opponent wins by forfeit
  const opponent = room.players.host === playerEOA
    ? room.players.guest
    : room.players.host;

  closeAppSession(room.id, opponent);
}
roomManager.deleteRoom(room.id);
```
