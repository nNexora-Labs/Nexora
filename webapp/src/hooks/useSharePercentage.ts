'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useReadContract, useWalletClient } from 'wagmi';
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
  const [encryptedUserSharesState, setEncryptedUserSharesStateState] = useState<string | null>(null);
  const [encryptedTotalSharesState, setEncryptedTotalSharesStateState] = useState<string | null>(null);
  const [sharePercentage, setSharePercentage] = useState<string>('••••••••');
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [hasShares, setHasShares] = useState<boolean>(false);

  // Refs for preventing multiple simultaneous decryption attempts
  const isDecryptingRef = useRef(false);

  // Read encrypted user shares from contract using useReadContract for auto-refresh
  const { data: encryptedUserShares, refetch: refetchUserShares } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'getEncryptedShares',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!VAULT_ADDRESS && VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000' && typeof window !== 'undefined',
      refetchInterval: 2000, // Poll every 2 seconds for real-time updates
      refetchIntervalInBackground: true, // Continue polling even when tab is not active
      staleTime: 1000, // Consider data stale after 1 second
    },
  });

  // Read encrypted total shares from contract using useReadContract for auto-refresh
  const { data: encryptedTotalShares, refetch: refetchTotalShares } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'getEncryptedTotalShares',
    args: [],
    query: {
      enabled: !!VAULT_ADDRESS && VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000' && typeof window !== 'undefined',
      refetchInterval: 2000, // Poll every 2 seconds for real-time updates
      refetchIntervalInBackground: true, // Continue polling even when tab is not active
      staleTime: 1000, // Consider data stale after 1 second
    },
  });

  // Handle encrypted user shares from useReadContract
  useEffect(() => {
    if (encryptedUserShares) {
      // Handle different return types from contract call
      let userSharesData: string | null = null;
      
      if (typeof encryptedUserShares === 'string') {
        userSharesData = encryptedUserShares;
      } else if (typeof encryptedUserShares === 'object' && encryptedUserShares !== null) {
        userSharesData = (encryptedUserShares as any).data || (encryptedUserShares as any).result || null;
      }
      
    // Encrypted shares received
      setEncryptedUserSharesStateState(userSharesData);
    } else {
      setEncryptedUserSharesStateState(null);
    }
  }, [encryptedUserShares]);

  // Handle encrypted total shares from useReadContract
  useEffect(() => {
    if (encryptedTotalShares) {
      // Handle different return types from contract call
      let totalSharesData: string | null = null;
      
      if (typeof encryptedTotalShares === 'string') {
        totalSharesData = encryptedTotalShares;
      } else if (typeof encryptedTotalShares === 'object' && encryptedTotalShares !== null) {
        totalSharesData = (encryptedTotalShares as any).data || (encryptedTotalShares as any).result || null;
      }
      
    // Encrypted total shares received
      setEncryptedTotalSharesStateState(totalSharesData);
    } else {
      setEncryptedTotalSharesStateState(null);
    }
  }, [encryptedTotalShares]);

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
    // Fetching share data
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          
          // Test the connection
          await publicClient.getBlockNumber();
    // Connected to RPC
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
        // Note: State is now managed by useReadContract hooks above
        
        // Check if user has any shares
        const isAllZeros = userSharesData === '0x0000000000000000000000000000000000000000000000000000000000000000';
        setHasShares(!isAllZeros);
    // User shares check
      } else {
        // Note: State is now managed by useReadContract hooks above
        setHasShares(false);
      }

      if (totalSharesResult.data && totalSharesResult.data !== '0x') {
        const totalSharesData = totalSharesResult.data as `0x${string}`;
        // Note: State is now managed by useReadContract hooks above
    // Total shares fetched
      } else {
        // Note: State is now managed by useReadContract hooks above
      }

    } catch (error) {
      console.error('Failed to fetch share data:', error);
      // Note: State is now managed by useReadContract hooks above
    }
  }, [address, VAULT_ADDRESS]);

  // Decrypt and calculate share percentage
  const decryptAndCalculate = useCallback(async () => {
    if (!isConnected || !address || !encryptedUserSharesState || !encryptedTotalSharesState || !masterSignature || !walletClient) {
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
          { handle: encryptedUserSharesState, contractAddress: VAULT_ADDRESS },
          { handle: encryptedTotalSharesState, contractAddress: VAULT_ADDRESS }
        ],
        masterSig.privateKey,
        masterSig.publicKey,
        masterSig.signature,
        masterSig.contractAddresses,
        masterSig.userAddress,
        masterSig.startTimestamp,
        masterSig.durationDays
      );

      const userSharesValue = encryptedUserSharesState ? (result as any)[encryptedUserSharesState] : undefined;
      const totalSharesValue = encryptedTotalSharesState ? (result as any)[encryptedTotalSharesState] : undefined;

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
        
    // Share percentage calculated successfully
      }
    } catch (error) {
      console.error('Share percentage calculation failed:', error);
      setSharePercentage('••••••••');
      setIsDecrypting(false);
    } finally {
      isDecryptingRef.current = false;
    }
  }, [isConnected, address, encryptedUserSharesState, encryptedTotalSharesState, masterSignature, walletClient, getMasterSignature, VAULT_ADDRESS]);

  // Initialize when component mounts
  useEffect(() => {
    if (isConnected) {
      fetchEncryptedShares();
    } else {
      // Note: State is now managed by useReadContract hooks above
      setSharePercentage('••••••••');
      setHasShares(false);
    }
  }, [isConnected, fetchEncryptedShares]);

  // Auto-decrypt when master signature becomes available
  useEffect(() => {
    if (masterSignature && encryptedUserSharesState && encryptedTotalSharesState && hasShares) {
      decryptAndCalculate();
    } else if (!masterSignature) {
      setSharePercentage('••••••••');
    }
  }, [masterSignature, encryptedUserSharesState, encryptedTotalSharesState, hasShares, decryptAndCalculate]);

  // Simple refresh function
  const refreshShares = useCallback(() => {
    refetchUserShares();
    refetchTotalShares();
  }, [refetchUserShares, refetchTotalShares]);

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
