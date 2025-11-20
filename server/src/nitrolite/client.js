/**
 * ============================================================================
 * NITROLITE RPC CLIENT (Simplified)
 * ============================================================================
 *
 * Main client for communicating with Nitrolite RPC server.
 *
 * WHAT IT DOES:
 * - Connects to Nitrolite WebSocket server
 * - Authenticates with session keys (see auth.js)
 * - Sends signed RPC requests
 * - Handles responses and errors
 *
 * KEY METHODS:
 * - connect() - Establish connection
 * - sendRequest(method, params) - Send RPC request
 * - getChannelInfo() - Get channel information
 *
 * USES:
 * - auth.js for authentication
 * - signer.js for session key generation
 * ============================================================================
 */

import { NitroliteRPC, RPCMethod, parseAnyRPCResponse } from "@erc7824/nitrolite";
import { ethers } from "ethers";
import WebSocket from "ws";
import logger from "../utils/logger.js";
import { authenticateWithSessionKey } from "./auth.js";

// ============================================================================
// CONNECTION STATUS
// ============================================================================

export const WSStatus = {
    CONNECTED: "connected",
    CONNECTING: "connecting",
    DISCONNECTED: "disconnected",
    AUTHENTICATING: "authenticating",
    AUTH_FAILED: "auth_failed",
};

// ============================================================================
// MAIN CLIENT CLASS
// ============================================================================

export class NitroliteRPCClient {
    constructor(url, privateKey) {
        this.url = url;
        this.privateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        this.wallet = new ethers.Wallet(this.privateKey);
        this.address = this.wallet.address;

        // Connection state
        this.ws = null;
        this.status = WSStatus.DISCONNECTED;

        // Session authentication
        this.sessionKey = null;
        this.sessionSigner = null;
        this.jwtToken = null;

        // Request tracking
        this.pendingRequests = new Map();
        this.nextRequestId = 1;

        // Callbacks
        this.onMessageCallbacks = [];
        this.onStatusChangeCallbacks = [];

        logger.system(`RPC client initialized with address: ${this.address}`);
    }

    // ========================================================================
    // STATUS MANAGEMENT
    // ========================================================================

    setStatus(newStatus) {
        if (this.status !== newStatus) {
            logger.ws(`Status changed: ${this.status} -> ${newStatus}`);
            this.status = newStatus;
            this.onStatusChangeCallbacks.forEach(cb => cb(newStatus));
        }
    }

    onStatusChange(callback) {
        this.onStatusChangeCallbacks.push(callback);
    }

    onMessage(callback) {
        this.onMessageCallbacks.push(callback);
    }

    // ========================================================================
    // CONNECTION
    // ========================================================================

    async connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            logger.ws("Already connected");
            return;
        }

        logger.ws(`Connecting to ${this.url}...`);
        this.setStatus(WSStatus.CONNECTING);

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.on("open", async () => {
                    logger.ws("WebSocket connected");

                    // Authenticate
                    try {
                        this.setStatus(WSStatus.AUTHENTICATING);
                        const authResult = await authenticateWithSessionKey(
                            this.ws,
                            this.address,
                            this.privateKey
                        );

                        this.sessionKey = authResult.sessionKey;
                        this.sessionSigner = authResult.sessionSigner;
                        this.jwtToken = authResult.jwtToken;

                        this.setStatus(WSStatus.CONNECTED);
                        logger.auth("Successfully authenticated with session key");

                        // Start listening to messages
                        this.ws.on("message", (data) => this.handleMessage(data));

                        resolve();
                    } catch (authError) {
                        logger.error("Authentication failed:", authError);
                        this.setStatus(WSStatus.AUTH_FAILED);
                        this.ws.close();
                        reject(authError);
                    }
                });

                this.ws.on("error", (error) => {
                    logger.error("WebSocket error:", error);
                    reject(error);
                });

                this.ws.on("close", () => {
                    logger.ws("WebSocket closed");
                    this.setStatus(WSStatus.DISCONNECTED);
                });
            } catch (error) {
                logger.error("Failed to create WebSocket:", error);
                reject(error);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setStatus(WSStatus.DISCONNECTED);
    }

    // ========================================================================
    // MESSAGE HANDLING
    // ========================================================================

    handleMessage(data) {
        try {
            const rawData = typeof data === "string" ? data : data.toString();
            let message;

            // Try to parse with library
            try {
                message = parseAnyRPCResponse(rawData);
            } catch (parseError) {
                // Fallback to raw JSON for unsupported formats
                logger.warn("Using raw JSON response:", parseError.message);
                message = JSON.parse(rawData);
            }

            // Log received message with method and key details
            const method = message.method || message.res?.[1] || 'unknown';
            logger.ws(`◀ Received: ${method}`);
            logger.data("Message content", message);

            // Notify callbacks
            this.onMessageCallbacks.forEach(cb => cb(message));

            // Handle response to pending request
            const requestId = message.requestId || message.res?.[0];
            if (this.pendingRequests.has(requestId)) {
                const { resolve, reject } = this.pendingRequests.get(requestId);

                if (message.method === RPCMethod.Error || message.method === "error") {
                    const errorMsg = message.params?.error || "Unknown error";
                    reject(new Error(`RPC Error: ${errorMsg}`));
                } else {
                    // Extract result from different response formats
                    const result = message.params || message.res?.[2];
                    resolve(result);
                }

                this.pendingRequests.delete(requestId);
            }
        } catch (error) {
            logger.error("Error handling message:", error);
        }
    }

    // ========================================================================
    // SENDING REQUESTS
    // ========================================================================

    async sendRequest(method, params = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        if (this.status !== WSStatus.CONNECTED) {
            logger.warn(`Status is ${this.status}, should be CONNECTED`);
        }

        const requestId = this.nextRequestId++;
        const signer = this.sessionSigner; // Use session signer for all RPC messages

        return new Promise(async (resolve, reject) => {
            try {
                // Create and sign request
                const request = NitroliteRPC.createRequest({ method, params, requestId });
                const signedRequest = await NitroliteRPC.signRequestMessage(request, signer);

                // Log outgoing request
                logger.ws(`▶ Sending: ${method} (ID: ${requestId})`);
                logger.data("Request params", params);

                // Track pending request
                this.pendingRequests.set(requestId, { resolve, reject });

                // Set timeout
                setTimeout(() => {
                    if (this.pendingRequests.has(requestId)) {
                        this.pendingRequests.delete(requestId);
                        reject(new Error("Request timeout"));
                    }
                }, 10000);

                // Send
                this.ws.send(typeof signedRequest === "string" ? signedRequest : JSON.stringify(signedRequest));
            } catch (error) {
                logger.error("Error sending request:", error);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }

    // ========================================================================
    // CONVENIENCE METHODS
    // ========================================================================

    async getChannelInfo() {
        try {
            logger.nitro("Requesting channel information...");
            const response = await this.sendRequest("get_channels", { participant: this.address });
            logger.data("Channel info received");
            return response?.channels || response || [];
        } catch (error) {
            logger.error("Error getting channel info:", error);
            throw error;
        }
    }

    /**
     * Ensure WebSocket is connected, reconnect if needed
     * @returns {Promise<void>}
     */
    async ensureConnected() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            logger.nitro('WebSocket not connected, attempting to reconnect...');
            await this.connect();
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let rpcClientInstance = null;

export function initializeRPCClient(url, privateKey) {
    if (!rpcClientInstance) {
        rpcClientInstance = new NitroliteRPCClient(url, privateKey);
    }
    return rpcClientInstance;
}

export function getRPCClient() {
    if (!rpcClientInstance) {
        throw new Error("RPC client not initialized. Call initializeRPCClient() first.");
    }
    return rpcClientInstance;
}
