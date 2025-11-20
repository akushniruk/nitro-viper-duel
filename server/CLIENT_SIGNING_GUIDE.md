# Client-Side App Session Signing Guide

## Problem
Yellow Network error: `"missing signature for participant 0x02F499..."`

This means Yellow Network **cannot verify** the signature. This happens when:
1. Client signs with main wallet instead of session key
2. Client doesn't use Nitrolite's `createAppSessionMessage()`
3. Client modifies the `appSessionData` before signing
4. Session key wasn't properly authorized

## Critical Requirements

⚠️ **MUST use SESSION KEY to sign, NOT main wallet**
⚠️ **MUST use `createAppSessionMessage()` from @erc7824/nitrolite**
⚠️ **MUST sign the EXACT `appSessionData` from server (don't modify it)**
⚠️ **Session key MUST be properly authorized via EIP-712 auth**

## How Client Must Sign

When the client receives `appSession:signatureRequest` or `appSession:startGameRequest`:

```javascript
// Message from server
{
  type: 'appSession:signatureRequest', // or 'appSession:startGameRequest'
  roomId: 'room-id',
  appSessionData: {...},
  appDefinition: {...},
  participants: [...],
  requestToSign: [requestId, method, params, timestamp]
}
```

### ✅ CORRECT Approach: Step-by-Step

#### Step 1: Setup Session Key (Do this ONCE during auth)

```typescript
import { ethers } from 'ethers';
import { createMessageSigner } from '@erc7824/nitrolite';

// Create ephemeral session key
const sessionKeyWallet = ethers.Wallet.createRandom();

// Create signer for Nitrolite (wrap the wallet)
const sessionKeySigner = createMessageSigner(sessionKeyWallet);

// Store for later use
this.sessionKey = sessionKeyWallet;
this.sessionKeySigner = sessionKeySigner;
```

#### Step 2: Sign App Session Request

```typescript
import { createAppSessionMessage } from '@erc7824/nitrolite';

// When server sends appSession:signatureRequest or appSession:startGameRequest
const { appSessionData } = serverMessage;

// Sign using the SESSION KEY signer (from Step 1)
const signedMessage = await createAppSessionMessage(
  this.sessionKeySigner,  // ← Use the signer from Step 1
  appSessionData          // ← Use EXACT data from server
);

// Parse and extract signature
const parsed = JSON.parse(signedMessage);
const signature = parsed.sig[0];

// Send signature back to server
ws.send(JSON.stringify({
  type: 'appSession:signature',
  payload: {
    roomId,
    signature
  }
}));
```

### ❌ WRONG Approaches

**Don't sign the requestToSign array directly:**
```typescript
// ❌ WRONG - This won't work!
const signature = await wallet.signMessage(JSON.stringify(requestToSign));
```

**Don't sign with main wallet:**
```typescript
// ❌ WRONG - Must use session key, not main wallet!
const signature = await mainWallet.signMessage(...);
```

**Don't recreate appSessionData:**
```typescript
// ❌ WRONG - Must use exact appSessionData from server!
const myAppSessionData = { ...modified };
const signature = await createAppSessionMessage(signer, myAppSessionData);
```

## Key Points

1. **Use SESSION KEY** - The signature must come from the session key that was authorized via EIP-712 auth
2. **Use Nitrolite Library** - Don't do raw signing, use `createAppSessionMessage`
3. **Use Exact Data** - Sign the exact `appSessionData` received from server
4. **Extract Signature** - Parse the result and extract `sig[0]`

## Verification

The signature will be verified by Yellow Network against:
- The participant address in `participants` array (main wallet address)
- The session key that was authorized for that wallet
- The exact request structure being submitted

## Troubleshooting Checklist

### 1. Check Session Key Setup
```typescript
// ❌ WRONG - Using main wallet
const signer = createMessageSigner(mainWallet);

// ✅ CORRECT - Using session key
const sessionKey = ethers.Wallet.createRandom();
const signer = createMessageSigner(sessionKey);
```

### 2. Check createMessageSigner Import
```typescript
// ✅ CORRECT
import { createMessageSigner } from '@erc7824/nitrolite';

// or check if using custom wrapper
import { createMessageSigner } from './utils/createSigner';
```

### 3. Check appSessionData Usage
```typescript
// ❌ WRONG - Modified or recreated
const myData = { ...appSessionData, custom: 'field' };

// ✅ CORRECT - Use exact data from server
const signedMessage = await createAppSessionMessage(
  sessionKeySigner,
  appSessionData  // ← Don't modify this!
);
```

### 4. Verify Signature Format
The signature should:
- Start with `"0x"`
- Be exactly 132 characters long
- Be a hex string (0-9, a-f)

### 5. Check Console for Errors
Look for:
- "Session key not initialized"
- "Invalid signer"
- Errors from createAppSessionMessage
- Network errors

### 6. Common Mistakes

**Mistake 1: Signing with main wallet**
```typescript
// ❌ WRONG
const wallet = await connector.getSigner();
await createAppSessionMessage(wallet, appSessionData);
```

**Mistake 2: Not storing session key**
```typescript
// ❌ WRONG - Creates new session key each time
const sessionKey = ethers.Wallet.createRandom();

// ✅ CORRECT - Store and reuse
this.sessionKey = ethers.Wallet.createRandom();
this.sessionKeySigner = createMessageSigner(this.sessionKey);
```

**Mistake 3: Using wrong signing method**
```typescript
// ❌ WRONG
const sig = await wallet.signMessage(JSON.stringify(appSessionData));

// ✅ CORRECT
const signedMsg = await createAppSessionMessage(sessionKeySigner, appSessionData);
const sig = JSON.parse(signedMsg).sig[0];
```

## Quick Debug Steps

1. **Verify wallet address** - Check wallet.address matches one in participants array
2. **Verify session key exists** - console.log(this.sessionKey.address)
3. **Verify using Nitrolite** - Check using createAppSessionMessage from @erc7824/nitrolite
4. **Verify signature format** - Should be "0x..." and 132 chars
5. **Verify exact data** - Don't modify appSessionData before signing
