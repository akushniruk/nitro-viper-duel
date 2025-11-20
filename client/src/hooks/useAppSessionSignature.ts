import { useState, useCallback } from "react";
import { useWebSocketContext } from "../context/WebSocketContext";
import { createECDSAMessageSigner } from "@erc7824/nitrolite";
import type { AppSessionSignatureRequestMessage, AppSessionStartGameRequestMessage } from "../types";

/**
 * Hook for handling app session signature requests
 */
export function useAppSessionSignature(
    sendSignature?: (roomId: string, signature: string) => void,
    sendStartGame?: (roomId: string, signature: string) => void
) {
    const [isSigningInProgress, setIsSigningInProgress] = useState(false);
    const [signatureError, setSignatureError] = useState<string | null>(null);
    const { keyPair } = useWebSocketContext();

    /**
     * Signs an app session message and sends it to the server
     */
    const signAppSessionMessage = useCallback(
        async (roomId: string, requestToSign: any, messageType: "appSession:signature" | "appSession:startGame") => {
            if (!keyPair?.privateKey) {
                throw new Error("No private key available for signing");
            }

            setIsSigningInProgress(true);
            setSignatureError(null);

            try {
                // ✅ CRITICAL: Sign the EXACT requestToSign array that server sent
                // DO NOT use createAppSessionMessage() - that creates a NEW message with NEW timestamp
                // The server already created the message, we just need to sign it
                const signer = createECDSAMessageSigner(keyPair.privateKey as `0x${string}`);
                console.log("Client signing requestToSign array:", requestToSign);

                // Sign the requestToSign array directly
                const signature = await signer(requestToSign);
                console.log("Client signature created:", signature);

                // Send signature to server
                if (messageType === "appSession:signature" && sendSignature) {
                    sendSignature(roomId, signature);
                } else if (messageType === "appSession:startGame" && sendStartGame) {
                    sendStartGame(roomId, signature);
                } else {
                    throw new Error("No send function for message type: " + messageType);
                }

                setIsSigningInProgress(false);
                return signature;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown signing error";
                console.error("App session signing error:", errorMessage);
                setSignatureError(errorMessage);
                setIsSigningInProgress(false);
                throw error;
            }
        },
        [keyPair, sendSignature, sendStartGame]
    );

    /**
     * Handles participant B signature request (when joining)
     */
    const handleParticipantBSignature = useCallback(
        async (message: AppSessionSignatureRequestMessage) => {
            try {
                // ✅ CRITICAL: Pass requestToSign (the exact array to sign), not appSessionData
                await signAppSessionMessage(
                    message.roomId,
                    message.requestToSign,
                    "appSession:signature"
                );
            } catch (error) {
                console.error("Failed to sign as participant B:", error);
                throw error;
            }
        },
        [signAppSessionMessage]
    );

    /**
     * Handles participant A signature request (when starting game)
     */
    const handleParticipantASignature = useCallback(
        async (message: AppSessionStartGameRequestMessage) => {
            try {
                // ✅ CRITICAL: Pass requestToSign (the exact array to sign), not appSessionData
                await signAppSessionMessage(
                    message.roomId,
                    message.requestToSign,
                    "appSession:startGame"
                );
            } catch (error) {
                console.error("Failed to sign as participant A:", error);
                throw error;
            }
        },
        [signAppSessionMessage]
    );

    return {
        isSigningInProgress,
        signatureError,
        handleParticipantBSignature,
        handleParticipantASignature,
        signAppSessionMessage,
    };
}
