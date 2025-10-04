'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useReadContract, useWalletClient } from 'wagmi';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { sepolia } from 'wagmi/chains';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';
import { getSafeContractAddresses } from '../config/contractConfig';
import { getSepoliaRpcUrls } from '../utils/rpc';

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
  
  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  const VAULT_ADDRESS = contractAddresses?.VAULT_ADDRESS;

  // Core state
  const [encryptedUserSharesState, setEncryptedUserSharesStateState] = useState<string | null>(null);
  const [encryptedTotalSharesState, setEncryptedTotalSharesStateState] = useState<string | null>(null);
  const [sharePercentage, setSharePercentage] = useState<string>('••••••••');
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [hasShares, setHasShares] = useState<boolean>(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // Refs for preventing multiple simultaneous decryption attempts
  const isDecryptingRef = useRef(false);

  // Read encrypted user shares from contract using useReadContract for auto-refresh
  const { data: encryptedUserShares, refetch: refetchUserShares } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'getEncryptedShares',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!VAULT_ADDRESS && typeof window !== 'undefined',
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
      enabled: !!VAULT_ADDRESS && typeof window !== 'undefined',
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
      
      console.log('🔍 User shares from useReadContract:', { encryptedUserShares, userSharesData });
      setEncryptedUserSharesStateState(userSharesData);
    } else {
      console.log('🔍 No user shares from useReadContract');
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
      
      console.log('🔍 Total shares from useReadContract:', { encryptedTotalShares, totalSharesData });
      setEncryptedTotalSharesStateState(totalSharesData);
    } else {
      console.log('🔍 No total shares from useReadContract');
      setEncryptedTotalSharesStateState(null);
    }
  }, [encryptedTotalShares]);

  // Fetch encrypted shares from contract
  const fetchEncryptedShares = useCallback(async () => {
    if (!address || !VAULT_ADDRESS) {
      console.warn('Missing address or vault address for fetching encrypted shares');
      return;
    }

    try {
      // Create public client for raw calls
      
      const rpcUrls = getSepoliaRpcUrls();
      
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

      // Safety check for publicClient
      if (!publicClient || typeof publicClient.call !== 'function') {
        console.error('❌ publicClient is not properly initialized in useSharePercentage');
        throw new Error('Public client not properly initialized');
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
        console.log('🔍 User shares check in fetchEncryptedShares:', { userSharesData, isAllZeros, hasShares: !isAllZeros });
    // User shares check
      } else {
        // Note: State is now managed by useReadContract hooks above
        setHasShares(false);
        console.log('🔍 No user shares data received');
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
    console.log('🔍 Share decryption conditions check:', {
      isConnected,
      address,
      encryptedUserSharesState: !!encryptedUserSharesState,
      encryptedTotalSharesState: !!encryptedTotalSharesState,
      masterSignature: !!masterSignature,
      walletClient: !!walletClient
    });
    
    if (!isConnected || !address || !encryptedUserSharesState || !encryptedTotalSharesState || !masterSignature || !walletClient) {
      console.log('❌ Missing required data for share decryption');
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

      // Check if the master signature is authorized for the current contract address
      if (!VAULT_ADDRESS || !masterSig.contractAddresses.includes(VAULT_ADDRESS as `0x${string}`)) {
        console.warn('⚠️ Master signature not authorized for current contract address.', {
          currentVaultAddress: VAULT_ADDRESS,
          authorizedAddresses: masterSig.contractAddresses,
          isAuthorized: masterSig.contractAddresses.includes(VAULT_ADDRESS as `0x${string}`)
        });
        
        // Clear the old signature from localStorage
        localStorage.removeItem(`fhe_master_decryption_${address}`);
        
        // Clear the current signature state and show error
        setDecryptionError('Contract address changed. Please re-authorize decryption.');
        setIsDecrypting(false);
        isDecryptingRef.current = false;
        return;
      }

      // Additional check: verify the contract addresses are valid
      if (!masterSig.contractAddresses || masterSig.contractAddresses.length === 0) {
        console.warn('⚠️ Master signature has no contract addresses. Clearing cache.');
        localStorage.removeItem(`fhe_master_decryption_${address}`);
        setDecryptionError('Invalid decryption signature. Please re-authorize.');
        setIsDecrypting(false);
        isDecryptingRef.current = false;
        return;
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      console.log('🔓 Attempting FHE decryption for shares:', {
        userSharesHandle: encryptedUserSharesState,
        totalSharesHandle: encryptedTotalSharesState,
        contractAddress: VAULT_ADDRESS,
        masterSigAddress: masterSig.userAddress,
        authorizedContracts: masterSig.contractAddresses
      });
      
      // Decrypt both user shares and total shares using master signature
      let result;
      try {
        result = await fheInstance.userDecrypt(
          [
            { handle: encryptedUserSharesState, contractAddress: VAULT_ADDRESS as `0x${string}` },
            { handle: encryptedTotalSharesState, contractAddress: VAULT_ADDRESS as `0x${string}` }
          ],
          masterSig.privateKey,
          masterSig.publicKey,
          masterSig.signature,
          masterSig.contractAddresses,
          masterSig.userAddress,
          masterSig.startTimestamp,
          masterSig.durationDays
        );
        
        console.log('✅ FHE decryption successful for shares:', result);
      } catch (decryptError: any) {
        // Handle authorization errors specifically
        if (decryptError.message && decryptError.message.includes('not authorized')) {
          console.warn('🚫 Authorization error during decryption. Clearing cache and requesting re-authorization.', {
            error: decryptError.message,
            currentVaultAddress: VAULT_ADDRESS,
            authorizedAddresses: masterSig.contractAddresses
          });
          
          // Clear the old signature from localStorage
          localStorage.removeItem(`fhe_master_decryption_${address}`);
          
          // Clear the current signature state and show error
          setDecryptionError('Authorization expired. Please re-authorize decryption.');
          setIsDecrypting(false);
          isDecryptingRef.current = false;
          return;
        }
        
        // For other errors, show dots
        console.error('❌ Share percentage decryption failed:', decryptError);
        setSharePercentage('••••••••');
        setDecryptionError('Decryption failed. Please try again.');
        setIsDecrypting(false);
        return;
      }

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

        // Debug logging for share calculations
        console.log('🔍 Share Calculation Debug:', {
          userShares: userShares.toString(),
          totalShares: totalShares.toString(),
          userSharesValue,
          totalSharesValue,
          address,
          userSharesHex: userShares.toString(16),
          totalSharesHex: totalShares.toString(16),
          userSharesWei: (Number(userShares) / 1e18).toFixed(6),
          totalSharesWei: (Number(totalShares) / 1e18).toFixed(6)
        });

        // Calculate percentage with proper validation
        let percentage = 0;
        
        // Import precision math utilities
        const { calculatePrecisePercentage, formatPercentage } = await import('../utils/precisionMath');
        
        // Only calculate if both values are valid and total shares > 0
        if (totalShares > 0 && userShares >= 0) {
          
          // Calculate percentage using BigInt arithmetic for maximum precision
          // (userShares * 10000) / totalShares to get percentage with 2 decimal places
          const percentageBigInt = (userShares * BigInt(10000)) / totalShares;
          percentage = Number(percentageBigInt) / 100;
          
          // Manual calculation for comparison
          const manualPercentage = userShares === BigInt(0) ? 0 : (Number(userShares) / Number(totalShares)) * 100;
          
          // Also try precision math for comparison
          const precisionMathPercentage = calculatePrecisePercentage(userShares, totalShares, 8);
          
          console.log('📊 Percentage Calculation:', {
            userShares: userShares.toString(),
            totalShares: totalShares.toString(),
            bigIntCalculation: percentage.toFixed(6),
            manualPercentage: manualPercentage.toFixed(6),
            precisionMathPercentage: precisionMathPercentage.toFixed(6),
            expectedRatio: userShares === BigInt(0) ? '0%' : `${manualPercentage.toFixed(6)}%`,
            difference: Math.abs(percentage - manualPercentage).toFixed(6)
          });
          
          const formattedPercentage = formatPercentage(percentage);
          setSharePercentage(`${formattedPercentage} of vault`);
        } else if (userShares === BigInt(0)) {
          // User has no shares
          percentage = 0;
          console.log('👤 User has no shares');
          const formattedPercentage = formatPercentage(percentage);
          setSharePercentage(`${formattedPercentage} of vault`);
        } else {
          // Invalid state - show error
          console.warn('❌ Invalid share calculation state:', { userShares, totalShares });
          setSharePercentage('Error');
          setIsDecrypting(false);
          return;
        }
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
    if (masterSignature && encryptedUserSharesState && encryptedTotalSharesState) {
      console.log('🔄 Master signature available for share decryption, attempting decryption...');
      decryptAndCalculate();
    } else if (!masterSignature) {
      setSharePercentage('••••••••');
    }
  }, [masterSignature, encryptedUserSharesState, encryptedTotalSharesState, decryptAndCalculate]);

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
