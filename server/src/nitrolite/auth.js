/**
 * ============================================================================
 * AUTHENTICATION FLOW
 * ============================================================================
 *
 * Handles Nitrolite authentication with session keys.
 *
 * FLOW:
 * 1. Generate ephemeral session keypair
 * 2. Send auth_request with session key address
 * 3. Receive auth_challenge from server
 * 4. Sign challenge with main wallet (EIP-712)
 * 5. Send auth_verify with signature
 * 6. Server authorizes session key
 * 7. All future messages signed with session key
 *
 * EXPORTS:
 * - authenticateWithSessionKey()
 * ============================================================================
 */

import {
    createAuthRequestMessage,
    createAuthVerifyMessage,
    createEIP712AuthMessageSigner,
    RPCMethod,
    parseAnyRPCResponse,
    createECDSAMessageSigner
} from "@erc7824/nitrolite";
import logger from "../utils/logger.js";
import { createNitroliteWalletClient, generateKeyPair } from "./signer.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTH_DOMAIN = { name: "Viper Duel" };
const SESSION_EXPIRY = 24 * 60 * 60; // 24 hours

/**
 * Get session expiration timestamp
 */
function getExpiry() {
    return String(Math.floor(Date.now() / 1000) + SESSION_EXPIRY);
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authenticate with Nitrolite using session key
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} walletAddress - Main wallet address
 * @param {string} privateKey - Main wallet private key
 * @param {number} timeout - Authentication timeout in ms
 * @returns {Promise<Object>} { sessionKey, sessionSigner }
 */
export async function authenticateWithSessionKey(ws, walletAddress, privateKey, timeout = 10000) {
    logger.auth("Starting authentication flow...");

    // Step 1: Generate session key
    logger.auth("Generating session key...");
    const sessionKey = await generateKeyPair();
    logger.auth("Session key generated:", sessionKey.address);

    // Step 2: Create session signer
    const sessionSigner = createECDSAMessageSigner(sessionKey.privateKey);
    logger.auth("Session signer created");

    // Step 3: Send auth_request
    const expire = getExpiry();
    const authMessage = {
        address: walletAddress,
        allowances: [
            // Asset allowances for the session
            {
                asset: "usdc",
                amount: "100"
            }
        ],
        app_name: "Viper Duel",
        application: walletAddress,
        session_key: sessionKey.address,
        expire: expire,
        scope: "all",
    };

    // Prepare auth request message (await the Promise)
    const authRequest = await createAuthRequestMessage(authMessage);
    logger.auth("▶ Sending: auth_request with session key:", sessionKey.address);

    return new Promise((resolve, reject) => {
        let authTimeoutId = setTimeout(() => {
            ws.removeEventListener("message", handleAuthResponse);
            reject(new Error("Authentication timeout"));
        }, timeout);

        const cleanup = () => {
            if (authTimeoutId) {
                clearTimeout(authTimeoutId);
                authTimeoutId = null;
            }
        };

        const handleAuthResponse = async (event) => {
            try {
                const response = parseAnyRPCResponse(event.data);

                // Log received auth message
                logger.auth(`◀ Received: ${response.method || 'unknown'}`);
                logger.data("Auth response", response);

                // Step 4: Handle auth_challenge
                if (response.method === RPCMethod.AuthChallenge) {
                    logger.auth("Processing auth_challenge, signing with main wallet...");

                    // Create wallet client for EIP-712 signing
                    const walletClient = createNitroliteWalletClient(privateKey);

                    // Create EIP-712 signer
                    const eip712SigningFunction = createEIP712AuthMessageSigner(
                        walletClient,
                        {
                            scope: authMessage.scope,
                            participant: authMessage.session_key,
                            expire: authMessage.expire,
                            allowances: authMessage.allowances,
                            application: authMessage.application,
                        },
                        AUTH_DOMAIN
                    );

                    // Sign and send auth_verify
                    const authVerify = await createAuthVerifyMessage(eip712SigningFunction, response);
                    logger.auth("▶ Sending: auth_verify with EIP-712 signature");
                    ws.send(authVerify);
                }
                // Step 5: Handle auth_verify success
                else if (response.method === RPCMethod.AuthVerify) {
                    logger.auth("Authentication successful");
                    cleanup();
                    ws.removeEventListener("message", handleAuthResponse);

                    resolve({
                        sessionKey,
                        sessionSigner,
                        jwtToken: response.params?.jwtToken
                    });
                }
                // Handle errors
                else if (response.method === RPCMethod.Error) {
                    logger.error("Authentication error:", response.params);
                    cleanup();
                    ws.removeEventListener("message", handleAuthResponse);
                    reject(new Error(`Authentication failed: ${response.params?.error || "Unknown error"}`));
                }
            } catch (error) {
                logger.error("Error in auth response handler:", error);
                cleanup();
                ws.removeEventListener("message", handleAuthResponse);
                reject(error);
            }
        };

        // Listen for auth responses
        ws.addEventListener("message", handleAuthResponse);

        // Send initial auth_request (message created outside Promise)
        ws.send(authRequest);
    });
}
