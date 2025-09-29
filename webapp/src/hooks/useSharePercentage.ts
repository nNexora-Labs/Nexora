'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';

// Contract ABI for getting encrypted shares
const VAULT_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getEncryptedShares",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getEncryptedTotalShares",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const useSharePercentage = (masterSignature: string | null, getMasterSignature: () => FhevmDecryptionSignature | null) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Core state
  const [encryptedUserShares, setEncryptedUserShares] = useState<string | null>(null);
  const [encryptedTotalShares, setEncryptedTotalShares] = useState<string | null>(null);
  const [sharePercentage, setSharePercentage] = useState<string>('••••••••');
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [hasShares, setHasShares] = useState<boolean>(false);

  // Refs for preventing multiple simultaneous decryption attempts
  const isDecryptingRef = useRef(false);

  // Fetch encrypted shares from contract
  const fetchEncryptedShares = useCallback(async () => {
    if (!address || !VAULT_ADDRESS || VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return;
    }

    try {
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
          console.log(`🔄 Fetching share data from: ${rpcUrl}`);
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

      // Fetch user shares
      const userSharesResult = await publicClient.call({
        to: VAULT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: VAULT_ABI,
          functionName: 'getEncryptedShares',
          args: [address as `0x${string}`],
        }),
      });

      // Fetch total shares
      const totalSharesResult = await publicClient.call({
        to: VAULT_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: VAULT_ABI,
          functionName: 'getEncryptedTotalShares',
          args: [],
        }),
      });

      if (userSharesResult.data && userSharesResult.data !== '0x') {
        const userSharesData = userSharesResult.data as `0x${string}`;
        setEncryptedUserShares(userSharesData);
        
        // Check if user has any shares
        const isAllZeros = userSharesData === '0x0000000000000000000000000000000000000000000000000000000000000000';
        setHasShares(!isAllZeros);
        console.log('🔍 User shares check:', { userSharesData, isAllZeros, hasShares: !isAllZeros });
      } else {
        setEncryptedUserShares('0x0000000000000000000000000000000000000000000000000000000000000000');
        setHasShares(false);
      }

      if (totalSharesResult.data && totalSharesResult.data !== '0x') {
        const totalSharesData = totalSharesResult.data as `0x${string}`;
        setEncryptedTotalShares(totalSharesData);
        console.log('✅ Total shares fetched:', totalSharesData);
      } else {
        setEncryptedTotalShares('0x0000000000000000000000000000000000000000000000000000000000000000');
      }

    } catch (error) {
      console.error('Failed to fetch share data:', error);
      setEncryptedUserShares(null);
      setEncryptedTotalShares(null);
      setHasShares(false);
    }
  }, [address, VAULT_ADDRESS]);

  // Decrypt and calculate share percentage
  const decryptAndCalculate = useCallback(async () => {
    if (!isConnected || !address || !encryptedUserShares || !encryptedTotalShares || !masterSignature || !walletClient) {
      return;
    }

    // Prevent multiple simultaneous decryption attempts
    if (isDecryptingRef.current) {
      console.log('🔒 Share percentage decryption already in progress, skipping...');
      return;
    }

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    
    try {
      // Get the master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      // Decrypt both user shares and total shares using master signature
      const result = await fheInstance.userDecrypt(
        [
          { handle: encryptedUserShares, contractAddress: VAULT_ADDRESS },
          { handle: encryptedTotalShares, contractAddress: VAULT_ADDRESS }
        ],
        masterSig.privateKey,
        masterSig.publicKey,
        masterSig.signature,
        masterSig.contractAddresses,
        masterSig.userAddress,
        masterSig.startTimestamp,
        masterSig.durationDays
      );

      const userSharesValue = result[encryptedUserShares];
      const totalSharesValue = result[encryptedTotalShares];

      if (userSharesValue !== undefined && totalSharesValue !== undefined) {
        let userShares: bigint;
        let totalShares: bigint;

        // Convert to bigint
        if (typeof userSharesValue === 'bigint') {
          userShares = userSharesValue;
        } else if (typeof userSharesValue === 'string') {
          userShares = BigInt(userSharesValue);
        } else {
          userShares = BigInt(0);
        }

        if (typeof totalSharesValue === 'bigint') {
          totalShares = totalSharesValue;
        } else if (typeof totalSharesValue === 'string') {
          totalShares = BigInt(totalSharesValue);
        } else {
          totalShares = BigInt(0);
        }

        // Calculate percentage
        let percentage = 0;
        if (totalShares > 0) {
          // Calculate percentage with higher precision
          const percentageBigInt = (userShares * BigInt(10000)) / totalShares;
          percentage = Number(percentageBigInt) / 100; // Convert back to percentage
        }

        setSharePercentage(`${percentage.toFixed(2)}% of vault`);
        setHasShares(userShares > 0);
        setIsDecrypting(false);
        
        console.log('✅ Share percentage calculated:', { userShares, totalShares, percentage });
      }
    } catch (error) {
      console.error('Share percentage calculation failed:', error);
      setSharePercentage('••••••••');
      setIsDecrypting(false);
    } finally {
      isDecryptingRef.current = false;
    }
  }, [isConnected, address, encryptedUserShares, encryptedTotalShares, masterSignature, walletClient, getMasterSignature, VAULT_ADDRESS]);

  // Initialize when component mounts
  useEffect(() => {
    if (isConnected) {
      fetchEncryptedShares();
    } else {
      setEncryptedUserShares(null);
      setEncryptedTotalShares(null);
      setSharePercentage('••••••••');
      setHasShares(false);
    }
  }, [isConnected, fetchEncryptedShares]);

  // Auto-decrypt when master signature becomes available
  useEffect(() => {
    if (masterSignature && encryptedUserShares && encryptedTotalShares && hasShares) {
      decryptAndCalculate();
    } else if (!masterSignature) {
      setSharePercentage('••••••••');
    }
  }, [masterSignature, encryptedUserShares, encryptedTotalShares, hasShares, decryptAndCalculate]);

  // Simple refresh function
  const refreshShares = useCallback(() => {
    fetchEncryptedShares();
  }, [fetchEncryptedShares]);

  return {
    // State
    sharePercentage,
    hasShares,
    isDecrypting,
    
    // Actions
    refreshShares,
    
    // Computed
    canDecrypt: hasShares && !!masterSignature && isConnected,
  };
};
