/**
 * Signer utilities for Nitrolite integration
 * Creates signers compatible with @erc7824/nitrolite library
 */
import { ethers } from 'ethers';
import logger from '../utils/logger.js';

/**
 * Creates a message signer from a private key using ethers.js v6
 * This signer is compatible with Nitrolite's MessageSigner interface
 *
 * @param {string} privateKey - The private key to create the signer from
 * @returns {Object} An object with address and sign function
 * @throws {Error} if signer creation fails
 */
export function createEthersSigner(privateKey) {
    try {
        // Ensure private key has 0x prefix
        const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

        // Create ethers wallet from private key
        const wallet = new ethers.Wallet(formattedPrivateKey);

        return {
            address: ethers.getAddress(wallet.address),
            /**
             * Sign function compatible with Nitrolite Messawe geSigner
             * @param {Array} payload - RPCData tuple: [RequestID, RPCMethod, object, Timestamp?]
             * @returns {Promise<string>} Hex signature
             */
            sign: async (payload) => {
                try {
                    // Stringify the payload to match server-side signing
                    const message = JSON.stringify(payload);
                    logger.data('Signing message:', message);

                    // Hash the message with keccak256
                    const digestHex = ethers.id(message);
                    const messageBytes = ethers.getBytes(digestHex);

                    // Sign the hashed message
                    const { serialized: signature } = wallet.signingKey.sign(messageBytes);

                    return signature;
                } catch (error) {
                    logger.error('Error signing message:', error);
                    throw error;
                }
            }
        };
    } catch (error) {
        logger.error('Error creating ethers signer:', error);
        throw error;
    }
}

/**
 * Creates a wallet client compatible with Nitrolite for EIP-712 signing
 * This creates a custom wallet client that wraps an ethers wallet
 *
 * @param {string} privateKey - The private key to create the wallet client from
 * @returns {Object} A wallet client compatible with EIP-712 signing
 */
export function createNitroliteWalletClient(privateKey) {
    try {
        // Ensure private key has 0x prefix
        const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

        // Create ethers wallet from private key
        const wallet = new ethers.Wallet(formattedPrivateKey);

        // Create a wallet client compatible with Nitrolite's expectations
        const walletClient = {
            ...wallet,
            account: {
                address: wallet.address,
            },
            signMessage: async ({ message }) => {
                try {
                    // Handle both string and object message formats
                    const raw = message.raw || message;

                    logger.data('Signing message:', raw);

                    // Sign the raw message
                    const { serialized: signature } = wallet.signingKey.sign(raw);

                    return signature;
                } catch (error) {
                    logger.error('Error signing message:', error);
                    throw error;
                }
            },
            signTypedData: async ({ domain, types, primaryType, message }) => {
                try {
                    logger.data('Signing EIP-712 typed data');
                    logger.data('Domain:', domain);
                    logger.data('Types:', types);
                    logger.data('Primary Type:', primaryType);
                    logger.data('Message:', message);

                    // Use ethers.js v6 signTypedData method
                    // Note: ethers expects types without the EIP712Domain
                    const typesForSigning = { ...types };
                    delete typesForSigning.EIP712Domain;

                    const signature = await wallet.signTypedData(domain, typesForSigning, message);

                    logger.data('EIP-712 signature created:', signature);
                    return signature;
                } catch (error) {
                    logger.error('Error signing EIP-712 typed data:', error);
                    throw error;
                }
            },
        };

        return walletClient;
    } catch (error) {
        logger.error('Error creating Nitrolite wallet client:', error);
        throw error;
    }
}

/**
 * Generates a random keypair using ethers v6
 * This creates an ephemeral session key for authentication
 *
 * @returns {Promise<Object>} A Promise resolving to a keypair object with privateKey and address
 */
export async function generateKeyPair() {
    try {
        // Create random wallet
        const wallet = ethers.Wallet.createRandom();

        // Hash the private key with Keccak256 for additional security
        const privateKeyHash = ethers.keccak256(wallet.privateKey);

        // Derive public key from hashed private key to create a new wallet
        const walletFromHashedKey = new ethers.Wallet(privateKeyHash);

        return {
            privateKey: privateKeyHash,
            address: ethers.getAddress(walletFromHashedKey.address),
        };
    } catch (error) {
        logger.error('Error generating keypair, using fallback:', error);
        // Fallback implementation
        const randomHex = ethers.randomBytes(32);
        const privateKey = ethers.keccak256(randomHex);
        const wallet = new ethers.Wallet(privateKey);

        return {
            privateKey: privateKey,
            address: ethers.getAddress(wallet.address),
        };
    }
}
