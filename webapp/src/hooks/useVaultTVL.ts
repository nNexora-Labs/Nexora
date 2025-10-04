'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { sepolia } from 'wagmi/chains';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';
import { getSafeContractAddresses } from '../config/contractConfig';
import { getSepoliaRpcUrls } from '../utils/rpc';

// Contract ABI for vault TVL
const VAULT_ABI = [
  {
    "inputs": [],
    "name": "getEncryptedTotalAssets",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "",
        "type": "euint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const useVaultTVL = (masterSignature: string | null, getMasterSignature: () => FhevmDecryptionSignature | null, isTransactionPending: boolean = false) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  const VAULT_ADDRESS = contractAddresses?.VAULT_ADDRESS;

  // TVL hook initialized

  // Core state
  const [encryptedTVL, setEncryptedTVL] = useState<string | null>(null);
  const [tvLBalance, setTVLBalance] = useState<string>('••••••••');
  const [isLoadingTVL, setIsLoadingTVL] = useState<boolean>(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);

  // Refs for preventing multiple simultaneous decryption attempts
  const isDecryptingRef = useRef(false);

  // Fetch encrypted TVL from contract with aggressive polling
  const fetchEncryptedTVL = useCallback(async () => {
    if (!VAULT_ADDRESS) {
      console.warn('Missing vault address for fetching TVL');
      return;
    }

    try {
      setIsLoadingTVL(true);
      
      // Create public client for raw calls
      
      const rpcUrls = getSepoliaRpcUrls();
      
      let publicClient;
      let lastError;
      
      for (const rpcUrl of rpcUrls) {
        try {
    // Fetching TVL data
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          
          // Test the connection
          await publicClient.getBlockNumber();
    // Connected to RPC
          
          // Encode function call for getEncryptedTotalAssets
          const data = encodeFunctionData({
            abi: VAULT_ABI,
            functionName: 'getEncryptedTotalAssets',
            args: [],
          });
          
          // Make the contract call - with safety check
          if (!publicClient || typeof publicClient.call !== 'function') {
            console.error('❌ publicClient is not properly initialized in useVaultTVL');
            throw new Error('Public client not properly initialized');
          }

          const result = await publicClient.call({
            to: VAULT_ADDRESS as `0x${string}`,
            data,
          });
          
          if (result.data && result.data !== '0x') {
            const tvlData = result.data as `0x${string}`;
    // TVL data fetched
            setEncryptedTVL(tvlData);
            break; // Success, exit the loop
          } else {
            console.log('⚠️ No TVL data received');
            setEncryptedTVL(null);
          }
          
        } catch (error) {
          console.error(`❌ Failed to connect to ${rpcUrl}:`, error);
          lastError = error;
          continue; // Try next RPC URL
        }
      }
      
      if (!publicClient) {
        throw lastError || new Error('Failed to connect to any RPC endpoint');
      }
      
    } catch (error) {
      console.error('Failed to fetch vault TVL:', error);
      setEncryptedTVL(null);
    } finally {
      setIsLoadingTVL(false);
    }
  }, [VAULT_ADDRESS]);

  // More frequent polling for TVL updates to match other hooks
  useEffect(() => {
    if (!isConnected) return;
    
    // Initial fetch
    fetchEncryptedTVL();
    
    // Set up polling - much more frequent to match other hooks
    const pollInterval = isTransactionPending ? 1000 : 3000; // 1s when pending, 3s normally (was 10s)
    // Set up polling
    
    const interval = setInterval(() => {
    // Polling TVL data
      fetchEncryptedTVL();
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [isConnected, fetchEncryptedTVL, isTransactionPending]);

  // Additional trigger: refetch TVL when master signature changes (like other hooks)
  useEffect(() => {
    if (masterSignature && isConnected) {
      console.log('🔄 Master signature available, refetching TVL...');
      fetchEncryptedTVL();
    }
  }, [masterSignature, fetchEncryptedTVL, isConnected]);

  // Decrypt TVL using master signature
  const decryptTVL = useCallback(async () => {
    // TVL decryption called
    console.log('🔄 Starting TVL decryption process...');
    
    if (!isConnected || !address || !encryptedTVL || !walletClient || !masterSignature) {
      console.log('❌ Missing required data for TVL decryption:', {
        isConnected, address, encryptedTVL: !!encryptedTVL, walletClient: !!walletClient, masterSignature: !!masterSignature
      });
    // Missing requirements
      return;
    }

    // Prevent multiple simultaneous decryption attempts
    if (isDecryptingRef.current) {
    // Decryption already in progress
      return;
    }

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    
    try {
      // Starting TVL decryption
      setDecryptionError(null);
      
      // Get the master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

    // Master signature details

      // Verify that the VAULT_ADDRESS is included in the master signature's contract addresses
      if (!masterSig.contractAddresses.includes(VAULT_ADDRESS as `0x${string}`)) {
        throw new Error(`Vault address ${VAULT_ADDRESS} not included in master signature contract addresses: ${masterSig.contractAddresses.join(', ')}`);
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      // Try to decrypt TVL using master signature
      let result;
      try {
        result = await fheInstance.userDecrypt(
          [{ handle: encryptedTVL, contractAddress: VAULT_ADDRESS! }],
          masterSig.privateKey,
          masterSig.publicKey,
          masterSig.signature,
          masterSig.contractAddresses,
          masterSig.userAddress,
          masterSig.startTimestamp,
          masterSig.durationDays
        );
      } catch (userDecryptError: any) {
        console.warn('🚫 TVL Authorization error. Multiple users may be active.', {
          error: userDecryptError.message,
          currentVaultAddress: VAULT_ADDRESS,
          authorizedAddresses: masterSig.contractAddresses
        });
        
        setTVLBalance('Permission Error');
        setDecryptionError('Unable to decrypt TVL data. Contract may need updating for multi-user support.');
        setIsDecrypting(false);
        isDecryptingRef.current = false;
        return;
      }

      // Handle different result formats
      let decryptedValue;
      if (result[encryptedTVL] !== undefined) {
        // User decrypt format
        decryptedValue = result[encryptedTVL];
      } else if (result !== undefined) {
        // Direct decrypt format
        decryptedValue = result;
      }
      
      if (decryptedValue !== undefined) {
        console.log('🔍 Raw decrypted value for TVL:', decryptedValue, 'Type:', typeof decryptedValue);
        let ethValue: number;
        if (typeof decryptedValue === 'bigint') {
          ethValue = Number(decryptedValue) / 1e18;
        } else if (typeof decryptedValue === 'string') {
          ethValue = Number(BigInt(decryptedValue)) / 1e18;
        } else {
          ethValue = 0;
        }
        
        setTVLBalance(`${ethValue.toFixed(4)} ETH`);
        setIsDecrypted(true);
        console.log('✅ Vault TVL decrypted successfully:', ethValue);
      } else {
        console.log('❌ No decrypted value received for vaultTVL');
        setTVLBalance('••••••••');
      }
    } catch (error) {
      console.error('❌ TVL decryption failed:', error);
      
      // For TVL, this is expected behavior - it's a global contract value
      // Try fallback decryption with cWETH contract address
      if (error instanceof Error && (error.message.includes('special contract permissions') || error.message.includes('not authorized'))) {
        console.log('ℹ️ TVL decryption with user signature failed, trying fallback decryption...');
        console.log('🔍 TVL Error details:', error.message);
        setDecryptionError(null); // Don't show error for expected behavior
        
        // Try fallback decryption with cWETH contract address
        try {
          const CWETH_ADDRESS = contractAddresses?.CWETH_ADDRESS;
          const masterSig = getMasterSignature();
          if (CWETH_ADDRESS && masterSig) {
            console.log('🔄 Attempting fallback TVL decryption with cWETH contract...');
            
            const fheInstance = await getFHEInstance();
            const fallbackResult = await fheInstance.userDecrypt(
              [{ handle: encryptedTVL, contractAddress: CWETH_ADDRESS as `0x${string}` }],
              masterSig.privateKey,
              masterSig.publicKey,
              masterSig.signature,
              masterSig.contractAddresses,
              masterSig.userAddress,
              masterSig.startTimestamp,
              masterSig.durationDays
            );
            
            if (fallbackResult && Array.isArray(fallbackResult) && fallbackResult.length > 0) {
              const decryptedValue = fallbackResult[0];
              const ethValue = Number(BigInt(decryptedValue)) / 1e18;
              setTVLBalance(`${ethValue.toFixed(4)} ETH`);
              setIsDecrypted(true);
              console.log('✅ Vault TVL decrypted successfully with fallback method:', ethValue);
              return; // Success with fallback
            }
          }
        } catch (fallbackError) {
          console.log('ℹ️ Fallback TVL decryption also failed, showing aggregated data');
        }
        
        // If fallback also fails, show aggregated data instead of dots
        // This happens when multiple users are participating
        setTVLBalance('Multiple Users Active');
        setIsDecrypted(true); // Mark as "decrypted" but with special status
      } else {
        setDecryptionError(error instanceof Error ? error.message : 'Decryption failed');
        setTVLBalance('••••••••');
      }
    } finally {
      isDecryptingRef.current = false;
      setIsDecrypting(false);
    }
  }, [isConnected, address, encryptedTVL, walletClient, masterSignature, VAULT_ADDRESS]);

  // Lock TVL (reset to encrypted state)
  const lockTVL = useCallback(() => {
    setTVLBalance('••••••••');
    setDecryptionError(null);
    setIsDecrypted(false);
  }, []);

  // Initialize when component mounts
  useEffect(() => {
    if (isConnected) {
      // No need to manually fetch - useReadContract handles it
      console.log('🔍 useVaultTVL: Connected, useReadContract will handle fetching');
    } else {
      setEncryptedTVL(null);
      setTVLBalance('••••••••');
      setDecryptionError(null);
    }
  }, [isConnected]);

  // Auto-decrypt when master signature becomes available
  useEffect(() => {
    // Auto-decrypt check
    
    // Auto-decrypt if we have master signature and encrypted TVL data
    if (masterSignature && encryptedTVL && !isLoadingTVL && !isDecrypted) {
    // Auto-triggering TVL decryption
      decryptTVL();
    } else if (!masterSignature) {
    // Locking TVL (no master signature)
      lockTVL();
    }
  }, [masterSignature, encryptedTVL, isLoadingTVL, isDecrypted, decryptTVL, lockTVL]);

  // Simple refresh function
  const refreshTVL = useCallback(() => {
    fetchEncryptedTVL();
  }, [fetchEncryptedTVL]);

  const hasTVL = !!encryptedTVL && encryptedTVL !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  return {
    // State
    tvlBalance: tvLBalance,
    formattedTVL: tvLBalance,
    encryptedTVL,
    hasTVL,
    isDecrypted,
    isLoadingTVL,
    isDecrypting,
    decryptionError,
    
    // Actions
    decryptTVL,
    lockTVL,
    refreshTVL,
    fetchEncryptedTVL: fetchEncryptedTVL,
    
    // Computed
    canDecrypt: hasTVL && !!masterSignature && isConnected,
  };
};
