'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getFHEInstance } from '../utils/fhe';

// Contract addresses that need decryption access
const CONTRACT_ADDRESSES = [
  process.env.NEXT_PUBLIC_CWETH_ADDRESS,
  process.env.NEXT_PUBLIC_VAULT_ADDRESS,
].filter(Boolean) as string[];

export const useMasterDecryption = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  
  // Master decryption state
  const [isAllDecrypted, setIsAllDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [masterSignature, setMasterSignature] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // Load stored signature on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && address) {
      const storedSignature = localStorage.getItem(`fhe_master_decryption_${address}`);
      if (storedSignature) {
        setMasterSignature(storedSignature);
        setIsAllDecrypted(true);
      }
    }
  }, [address]);

  // Clear decryption state on disconnect
  useEffect(() => {
    if (!isConnected && address) {
      localStorage.removeItem(`fhe_master_decryption_${address}`);
      setMasterSignature(null);
      setIsAllDecrypted(false);
      setIsDecrypting(false);
      setDecryptionError(null);
    }
  }, [isConnected, address]);

  // Master unlock function
  const unlockAllBalances = useCallback(async () => {
    if (!isConnected || !address || !CONTRACT_ADDRESSES.length) {
      console.log('Missing requirements for master decryption:', { 
        isConnected, 
        address, 
        contractAddresses: CONTRACT_ADDRESSES.length 
      });
      return;
    }

    setIsDecrypting(true);
    setDecryptionError(null);
    
    try {
      console.log('🔓 Starting master decryption process...');
      
      // Get FHE instance
      const fheInstance = await getFHEInstance();
      console.log('✅ FHE instance created');
      
      // Get user's public key
      const publicKey = fheInstance.getPublicKey();
      if (!publicKey) {
        throw new Error('No public key available from FHE instance');
      }
      console.log('✅ Public key obtained');

      let signature = masterSignature;
      
      // If no stored signature, request user to sign
      if (!signature) {
        console.log('🔐 Requesting user signature for master decryption...');
        
        // Create EIP712 message for decryption permission
        const eip712 = fheInstance.createEIP712(
          Buffer.from(publicKey.publicKey).toString('hex'),
          CONTRACT_ADDRESSES, // All contracts at once
          Math.floor(Date.now() / 1000), // Start timestamp
          7 // Duration in days
        );

        console.log('✅ EIP712 message created for contracts:', CONTRACT_ADDRESSES);

        // Request user signature
        signature = await signMessageAsync({
          message: JSON.stringify(eip712),
        });

        console.log('✅ User signature obtained');

        // Store signature for session persistence
        localStorage.setItem(`fhe_master_decryption_${address}`, signature);
        setMasterSignature(signature);
      }

      // Set decryption state
      setIsAllDecrypted(true);
      console.log('✅ Master decryption successful - all balances unlocked');
      
    } catch (error) {
      console.error('❌ Master decryption failed:', error);
      setDecryptionError(error instanceof Error ? error.message : 'Decryption failed');
      setIsAllDecrypted(false);
    } finally {
      setIsDecrypting(false);
    }
  }, [isConnected, address, masterSignature, signMessageAsync]);

  // Master lock function
  const lockAllBalances = useCallback(() => {
    if (address) {
      localStorage.removeItem(`fhe_master_decryption_${address}`);
      setMasterSignature(null);
      setIsAllDecrypted(false);
      setDecryptionError(null);
      console.log('🔒 All balances locked');
    }
  }, [address]);

  // Clear decryption error
  const clearError = useCallback(() => {
    setDecryptionError(null);
  }, []);

  return {
    // State
    isAllDecrypted,
    isDecrypting,
    masterSignature,
    decryptionError,
    contractAddresses: CONTRACT_ADDRESSES,
    
    // Actions
    unlockAllBalances,
    lockAllBalances,
    clearError,
    
    // Computed
    canDecrypt: CONTRACT_ADDRESSES.length > 0 && isConnected && !!address,
  };
};
