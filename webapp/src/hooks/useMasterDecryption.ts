'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useWalletClient } from 'wagmi';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';

// Contract addresses that need decryption access
const CONTRACT_ADDRESSES = [
  process.env.NEXT_PUBLIC_CWETH_ADDRESS,
  process.env.NEXT_PUBLIC_VAULT_ADDRESS,
].filter(Boolean) as string[];

export const useMasterDecryption = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  
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
    if (!isConnected || !address || !CONTRACT_ADDRESSES.length || !walletClient) {
      console.log('Missing requirements for master decryption:', { 
        isConnected, 
        address, 
        contractAddresses: CONTRACT_ADDRESSES.length,
        walletClient: !!walletClient
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
      
      // Create signer
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      
      let signature = masterSignature;
      
      // If no stored signature, create one using FhevmDecryptionSignature
      if (!signature) {
        console.log('🔐 Creating master decryption signature...');
        
        // Use FhevmDecryptionSignature to create proper signature
        const sig = await FhevmDecryptionSignature.loadOrSign(
          fheInstance as any,
          CONTRACT_ADDRESSES,
          signer
        );

        if (!sig) {
          throw new Error('Failed to create master decryption signature');
        }

        console.log('✅ Master decryption signature created');

        // Store signature for session persistence
        localStorage.setItem(`fhe_master_decryption_${address}`, sig.signature);
        setMasterSignature(sig.signature);
        signature = sig.signature;
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
  }, [isConnected, address, masterSignature, walletClient]);

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
