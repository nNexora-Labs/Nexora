'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';

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

export const useVaultTVL = (masterSignature: string | null, getMasterSignature: () => FhevmDecryptionSignature | null) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Core state
  const [encryptedTVL, setEncryptedTVL] = useState<string | null>(null);
  const [tvLBalance, setTVLBalance] = useState<string>('••••••••');
  const [isLoadingTVL, setIsLoadingTVL] = useState<boolean>(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // Refs for preventing multiple simultaneous decryption attempts
  const isDecryptingRef = useRef(false);

  // Fetch encrypted TVL from contract
  const fetchEncryptedTVL = useCallback(async () => {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return;
    }

    try {
      setIsLoadingTVL(true);
      
      // Create public client for raw calls
      const { createPublicClient, http, encodeFunctionData } = await import('viem');
      const { sepolia } = await import('wagmi/chains');
      
      const rpcUrls = [
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/edae100994ea476180577c9218370251'
      ];
      
      let publicClient;
      let lastError;
      
      for (const rpcUrl of rpcUrls) {
        try {
          console.log(`🔄 Fetching vault TVL from: ${rpcUrl}`);
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          
          // Test the connection
          await publicClient.getBlockNumber();
          console.log(`✅ Connected to ${rpcUrl}`);
          break;
        } catch (error) {
          console.log(`❌ Failed to connect to ${rpcUrl}:`, (error as Error).message);
          lastError = error;
          continue;
        }
      }
      
      if (!publicClient) {
        throw new Error(`All RPC endpoints failed. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
      }

      // Make raw contract call
      const result = await publicClient.call({
        to: VAULT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: VAULT_ABI,
          functionName: 'getEncryptedTotalAssets',
          args: [],
        }),
      });

      if (result.data && result.data !== '0x') {
        const tvlData = result.data as `0x${string}`;
        setEncryptedTVL(tvlData);
        console.log('✅ Vault TVL fetched:', tvlData);
      } else {
        console.log('🔍 No TVL data or empty result:', result.data);
        setEncryptedTVL('0x0000000000000000000000000000000000000000000000000000000000000000');
      }
    } catch (error) {
      console.error('Failed to fetch vault TVL:', error);
      setEncryptedTVL(null);
      setDecryptionError(error instanceof Error ? error.message : 'Failed to fetch TVL');
    } finally {
      setIsLoadingTVL(false);
    }
  }, [VAULT_ADDRESS]);

  // Decrypt TVL using master signature
  const decryptTVL = useCallback(async () => {
    console.log('🔍 decryptTVL called with:', {
      isConnected,
      address,
      encryptedTVL: encryptedTVL ? 'present' : 'missing',
      walletClient: walletClient ? 'present' : 'missing',
      masterSignature: masterSignature ? 'present' : 'missing'
    });
    
    if (!isConnected || !address || !encryptedTVL || !walletClient || !masterSignature) {
      console.log('❌ decryptTVL: Missing requirements, returning early');
      return;
    }

    // Prevent multiple simultaneous decryption attempts
    if (isDecryptingRef.current) {
      console.log('🔒 TVL decryption already in progress, skipping...');
      return;
    }

    isDecryptingRef.current = true;
    
    try {
      console.log('🔄 Starting vaultTVL decryption...');
      setDecryptionError(null);
      
      // Get the master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      // Decrypt TVL using master signature
      const result = await fheInstance.userDecrypt(
        [{ handle: encryptedTVL, contractAddress: VAULT_ADDRESS }],
        masterSig.privateKey,
        masterSig.publicKey,
        masterSig.signature,
        masterSig.contractAddresses,
        masterSig.userAddress,
        masterSig.startTimestamp,
        masterSig.durationDays
      );

      const decryptedValue = result[encryptedTVL];
      if (decryptedValue !== undefined) {
        let ethValue: number;
        if (typeof decryptedValue === 'bigint') {
          ethValue = Number(decryptedValue) / 1e18;
        } else if (typeof decryptedValue === 'string') {
          ethValue = Number(BigInt(decryptedValue)) / 1e18;
        } else {
          ethValue = 0;
        }
        
        setTVLBalance(`${ethValue.toFixed(4)} ETH`);
        console.log('✅ Vault TVL decrypted successfully:', ethValue);
      } else {
        console.log('❌ No decrypted value received for vaultTVL');
        setTVLBalance('••••••••');
      }
    } catch (error) {
      console.error('❌ TVL decryption failed:', error);
      setDecryptionError(error instanceof Error ? error.message : 'Decryption failed');
      setTVLBalance('••••••••');
    } finally {
      isDecryptingRef.current = false;
    }
  }, [isConnected, address, encryptedTVL, walletClient, masterSignature, getMasterSignature, VAULT_ADDRESS]);

  // Lock TVL (reset to encrypted state)
  const lockTVL = useCallback(() => {
    setTVLBalance('••••••••');
    setDecryptionError(null);
  }, []);

  // Initialize when component mounts
  useEffect(() => {
    if (isConnected) {
      fetchEncryptedTVL();
    } else {
      setEncryptedTVL(null);
      setTVLBalance('••••••••');
      setDecryptionError(null);
    }
  }, [isConnected, fetchEncryptedTVL]);

  // Auto-decrypt when master signature becomes available
  useEffect(() => {
    console.log('🔍 VaultTVL auto-decrypt check:', {
      masterSignature: masterSignature ? 'present' : 'missing',
      encryptedTVL: encryptedTVL ? 'present' : 'missing',
      isLoadingTVL,
      hasTVL
    });
    
    if (masterSignature && encryptedTVL && !isLoadingTVL) {
      console.log('🔄 Triggering vaultTVL decryption...');
      decryptTVL();
    } else if (!masterSignature) {
      console.log('🔒 Locking vaultTVL (no master signature)');
      lockTVL();
    }
  }, [masterSignature, encryptedTVL, isLoadingTVL, decryptTVL, lockTVL]);

  // Simple refresh function
  const refreshTVL = useCallback(() => {
    fetchEncryptedTVL();
  }, [fetchEncryptedTVL]);

  const hasTVL = !!encryptedTVL && encryptedTVL !== '0x0000000000000000000000000000000000000000000000000000000000000000';
  const isDecrypted = tvLBalance !== '••••••••' && tvLBalance !== 'Loading...';

  return {
    // State
    formattedTVL: tvLBalance,
    encryptedTVL,
    hasTVL,
    isDecrypted,
    isLoadingTVL,
    decryptionError,
    
    // Actions
    refreshTVL,
    lockTVL,
    
    // Computed
    canDecrypt: hasTVL && !!masterSignature && isConnected,
  };
};
