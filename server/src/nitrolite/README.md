# Nitrolite Integration

This folder contains all blockchain and state channel integration using Nitrolite (ERC-7824).

## Files

### `client.js` - Main RPC Client (290 lines)

Simplified WebSocket client for Nitrolite RPC communication.

**What it does:**
- Manages WebSocket connection
- Sends signed RPC requests
- Handles responses and errors
- Uses auth.js for authentication

**Main Class:** `NitroliteRPCClient`

**Key Methods:**
- `connect()` - Connect & authenticate
- `sendRequest(method, params)` - Send signed request
- `getChannelInfo()` - Get channels

### `auth.js` - Authentication Module (161 lines)

Handles session key authentication flow.

**What it does:**
- Generates ephemeral session keys
- Handles EIP-712 signing for auth
- Manages auth_request/challenge/verify flow

**Main Function:**
- `authenticateWithSessionKey()` - Complete auth flow

### `signer.js` - Cryptographic Utilities

Handles all signing operations and session key management.

**Functions:**
- `generateKeyPair()` - Creates ephemeral session keypairs
- `createEthersSigner(privateKey)` - Creates message signer from private key
- `createNitroliteWalletClient(privateKey)` - Creates EIP-712 compatible wallet client

**Session Key Flow:**
1. Generate random keypair
2. Hash private key for additional security
3. Create ECDSA message signer
4. Use session signer for all RPC messages

### `appSessions.js` - Virtual Application Management

Manages the lifecycle of game sessions as Nitrolite virtual applications.

**Key Functions:**
- `createAppSession(roomId, hostEOA, guestEOA, betAmount)` - Create game session
- `generateAppSessionMessage(roomId)` - Generate message for players to sign
- `addAppSessionSignature(roomId, playerEOA, signature)` - Collect player signatures
- `createAppSessionWithSignatures(roomId)` - Submit session with all signatures
- `closeAppSession(roomId, winnerEOA)` - Close session and distribute funds

**App Session Flow:**
1. Host starts game → server creates app session data
2. Guest signs first
3. Host signs second
4. Server submits with both signatures
5. Game runs
6. Winner determined → session closed with fund distribution

### `onChain.js` - On-Chain Operations

Handles blockchain interactions (currently minimal, mainly for future features).

**Functions:**
- `initializeClients(privateKey)` - Initialize viem clients
- Future: Handle deposits, withdrawals, channel operations

## How Session Keys Work

### Why Session Keys?

Session keys provide security and usability:
- Main wallet only signs once (EIP-712 auth)
- Session key signs all subsequent messages
- Session keys can expire
- Session keys have spending limits
- No need to prompt user for every action

### Authentication Flow

```
1. Server generates random keypair
   ↓
2. Server connects to Nitrolite RPC
   ↓
3. Server sends auth_request with session key address
   ↓
4. Nitrolite sends auth_challenge
   ↓
5. Server signs challenge with main wallet (EIP-712)
   ↓
6. Nitrolite registers session key
   ↓
7. All future messages signed with session key
```

### Message Signing

```javascript
// Main wallet signs only EIP-712 auth
const authSignature = await walletClient.signTypedData({
  domain: { name: "Viper Duel" },
  types: { ... },
  message: { challenge, participant: sessionKey.address, ... }
});

// Session signer signs all RPC messages
const messageSigner = createECDSAMessageSigner(sessionKey.privateKey);
const signedMessage = await NitroliteRPC.signRequestMessage(request, messageSigner);
```

## App Sessions (Virtual Applications)

### What is an App Session?

An app session is a virtual application running on Nitrolite that:
- Holds funds from multiple participants
- Updates state based on game logic
- Distributes funds when closed
- Is backed by cryptographic proofs

### Creating an App Session

```javascript
const appSessionData = {
  definition: {
    protocol: "NitroliteRPC/0.2",
    participants: [hostAddress, guestAddress],
    weights: [50, 50],        // Equal voting power
    quorum: 100,              // 100% required to update
    challenge: 86400,         // Challenge period
    nonce: timestamp
  },
  allocations: [
    { participant: hostAddress, asset: "usdc", amount: "100" },
    { participant: guestAddress, asset: "usdc", amount: "100" }
  ]
};
```

### Closing an App Session

```javascript
// Winner takes all
const closeData = {
  allocations: [
    { participant: winnerAddress, asset: "usdc", amount: "200" },
    { participant: loserAddress, asset: "usdc", amount: "0" }
  ]
};
```

## Error Handling

Common errors and solutions:

**"message validation failed"**
- Ensure using session signer, not main wallet
- Check that auth completed successfully

**"failed to parse parameters"**
- Verify params format matches API spec
- Don't wrap params in arrays unless required

**"session key expired"**
- Re-authenticate with Nitrolite
- Generate new session key

## Integration Checklist

- [ ] Session key generated
- [ ] Connected to Nitrolite RPC
- [ ] Authenticated with EIP-712
- [ ] Session signer created
- [ ] All RPC messages use session signer
- [ ] App sessions created for games
- [ ] Signatures collected from players
- [ ] Sessions closed with correct fund distribution
