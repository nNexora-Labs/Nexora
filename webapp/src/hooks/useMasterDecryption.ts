'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';
import { getSafeContractAddresses } from '../config/contractConfig';

  // Master decryption contract addresses

export const useMasterDecryption = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // Master decryption state
  const [isAllDecrypted, setIsAllDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [masterSignature, setMasterSignature] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  
  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  
  // Ref to store the actual FhevmDecryptionSignature object for reuse
  const masterSignatureRef = useRef<FhevmDecryptionSignature | null>(null);
  const isUnlockingRef = useRef(false);

  // Clear corrupted signatures on mount
  useEffect(() => {
    if (address && typeof window !== 'undefined') {
      // Clear any corrupted signatures
      try {
        // Check for corrupted FhevmDecryptionSignature entries
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes(address) && (key.includes('fhevm-decryption-signature') || key.includes('fhe_master_decryption'))) {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                JSON.parse(value);
              }
            } catch (error) {
              console.log('🧹 Clearing corrupted signature:', key);
              localStorage.removeItem(key);
            }
          }
        }
      } catch (error) {
        console.log('Error cleaning corrupted signatures:', error);
      }
    }
  }, [address]);

  // Clear decryption state on disconnect or contract address change
  useEffect(() => {
    if (!isConnected && address) {
      localStorage.removeItem(`fhe_master_decryption_${address}`);
      setMasterSignature(null);
      setIsAllDecrypted(false);
      setIsDecrypting(false);
      setDecryptionError(null);
      masterSignatureRef.current = null;
      isUnlockingRef.current = false;
    }
  }, [isConnected, address]);

  // Clear decryption state when contract addresses change
  useEffect(() => {
    if (address && contractAddresses) {
      const storedSignature = localStorage.getItem(`fhe_master_decryption_${address}`);
      if (storedSignature) {
        try {
          const parsed = JSON.parse(storedSignature);
          // Check if stored signature is for different contract addresses
          const storedAddresses = parsed.contractAddresses || [];
          const currentAddresses = [contractAddresses.CWETH_ADDRESS, contractAddresses.VAULT_ADDRESS];
          
          // Compare addresses (sort to handle different order)
          const storedSorted = storedAddresses.sort();
          const currentSorted = currentAddresses.sort();
          
          if (JSON.stringify(storedSorted) !== JSON.stringify(currentSorted)) {
            console.log('🔄 Contract addresses changed, clearing old decryption signature');
            localStorage.removeItem(`fhe_master_decryption_${address}`);
            setMasterSignature(null);
            setIsAllDecrypted(false);
            setIsDecrypting(false);
            setDecryptionError(null);
            masterSignatureRef.current = null;
            isUnlockingRef.current = false;
          }
        } catch (error) {
          console.warn('Failed to parse stored signature:', error);
          localStorage.removeItem(`fhe_master_decryption_${address}`);
        }
      }
    }
  }, [address, contractAddresses]);
  const CONTRACT_ADDRESSES = contractAddresses ? [
    contractAddresses.CWETH_ADDRESS,
    contractAddresses.VAULT_ADDRESS,
  ] : [];

  // Master unlock function - now prevents multiple simultaneous calls
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

    // Prevent multiple simultaneous unlock attempts
    if (isUnlockingRef.current || isDecrypting) {
      console.log('🔒 Unlock already in progress, skipping...');
      return;
    }

    isUnlockingRef.current = true;
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
      
      let sig = masterSignatureRef.current;
      
      // If no stored signature, create one using FhevmDecryptionSignature
      if (!sig) {
        console.log('🔐 Creating master decryption signature...');
        
        // Use FhevmDecryptionSignature to create proper signature
        sig = await FhevmDecryptionSignature.loadOrSign(
          fheInstance as any,
          CONTRACT_ADDRESSES,
          signer
        );

        if (!sig) {
          throw new Error('Failed to create master decryption signature');
        }

        console.log('✅ Master decryption signature created');
        console.log('🔍 Master signature details:', {
          userAddress: sig.userAddress,
          contractAddresses: sig.contractAddresses,
          isValid: sig.isValid(),
          signature: sig.signature.substring(0, 10) + '...'
        });
        console.log('🔍 Full contract addresses:', sig.contractAddresses);
        masterSignatureRef.current = sig;
        
        // Store the full signature object in localStorage using FhevmDecryptionSignature's method
        await sig.saveToLocalStorage();
      }

      // Also store the signature string for quick access
      localStorage.setItem(`fhe_master_decryption_${address}`, sig.signature);
      setMasterSignature(sig.signature);
      setIsAllDecrypted(true);
      console.log('✅ Master decryption successful - all balances unlocked');
      
    } catch (error) {
      console.error('❌ Master decryption failed:', error);
      setDecryptionError(error instanceof Error ? error.message : 'Decryption failed');
      setIsAllDecrypted(false);
    } finally {
      setIsDecrypting(false);
      isUnlockingRef.current = false;
    }
  }, [isConnected, address, walletClient, isDecrypting]);

  // Load stored signature on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && address && walletClient) {
      const storedSignature = localStorage.getItem(`fhe_master_decryption_${address}`);
      if (storedSignature) {
        console.log('🔄 Found stored signature, loading FhevmDecryptionSignature object...');
        
        // We need to reconstruct the FhevmDecryptionSignature object from localStorage
        // The FhevmDecryptionSignature class stores the full object in localStorage
        const loadStoredSignatureObject = async () => {
          try {
            const fheInstance = await getFHEInstance();
            const provider = new ethers.BrowserProvider(walletClient);
            const signer = await provider.getSigner();
            
            // Try to load the full signature object from localStorage
            const sig = await FhevmDecryptionSignature.loadFromLocalStorage(
              fheInstance as any,
              CONTRACT_ADDRESSES,
              address
            );
            
            if (sig && sig.isValid()) {
              masterSignatureRef.current = sig;
              setMasterSignature(sig.signature);
              setIsAllDecrypted(true);
              console.log('✅ Successfully loaded stored master signature object');
            } else {
              console.log('❌ Stored signature is invalid or expired, clearing...');
              localStorage.removeItem(`fhe_master_decryption_${address}`);
            }
          } catch (error) {
            console.error('❌ Failed to load stored signature object:', error);
            localStorage.removeItem(`fhe_master_decryption_${address}`);
          }
        };
        
        loadStoredSignatureObject();
      }
    }
  }, [address, walletClient]);

  // Master lock function
  const lockAllBalances = useCallback(() => {
    if (address) {
      // Clear our custom localStorage entry
      localStorage.removeItem(`fhe_master_decryption_${address}`);
      
      // Clear all localStorage entries that might contain FhevmDecryptionSignature data
      // This is a bit aggressive but ensures clean state
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(address)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      setMasterSignature(null);
      setIsAllDecrypted(false);
      setDecryptionError(null);
      masterSignatureRef.current = null;
      isUnlockingRef.current = false;
      console.log('🔒 All balances locked');
    }
  }, [address]);

  // Clear decryption error
  const clearError = useCallback(() => {
    setDecryptionError(null);
  }, []);

  // Get the master signature object for decryption
  const getMasterSignature = useCallback(() => {
    return masterSignatureRef.current;
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
    getMasterSignature,
    
    // Computed
    canDecrypt: CONTRACT_ADDRESSES.length > 0 && isConnected && !!address,
  };
};
