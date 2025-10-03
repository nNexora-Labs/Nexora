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
import { rpcCache, generateCacheKey, CACHE_TTL } from '../utils/rpcCache';

// Simplified ABI for cWETH contract
const CWETH_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getEncryptedBalance",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const useCWETHBalance = (masterSignature: string | null, getMasterSignature: () => FhevmDecryptionSignature | null) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  const CWETH_ADDRESS = contractAddresses?.CWETH_ADDRESS;

  // Core state - minimal and stable
  const [encryptedBalanceState, setEncryptedBalanceState] = useState<string | null>(null);
  const [cWETHBalance, setCWETHBalance] = useState<string>('••••••••');
  const [hasCWETH, setHasCWETH] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // Refs for stable references
  const lastEncryptedBalanceRef = useRef<string | null>(null);
  const isDecryptingRef = useRef(false);

  // Read encrypted balance from contract using useReadContract for auto-refresh
  const { data: encryptedBalance, refetch: refetchEncryptedBalance } = useReadContract({
    address: CWETH_ADDRESS as `0x${string}`,
    abi: CWETH_ABI,
    functionName: 'getEncryptedBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!CWETH_ADDRESS && CWETH_ADDRESS !== '0x0000000000000000000000000000000000000000' && typeof window !== 'undefined',
      refetchInterval: 2000, // Poll every 2 seconds for real-time updates
      refetchIntervalInBackground: true, // Continue polling even when tab is not active
      staleTime: 1000, // Consider data stale after 1 second
    },
  });

  // Simple balance fetch function - no dependencies
  const fetchBalance = useCallback(async () => {
    if (!address || !CWETH_ADDRESS) {
      console.warn('Missing address or cWETH address for fetching balance');
      return;
    }

    // Check cache first to reduce API calls
    const cacheKey = generateCacheKey(CWETH_ADDRESS, 'getEncryptedBalance', [address], address);
    const cachedData = rpcCache.get(cacheKey);
    
    if (cachedData) {
      console.log('📦 Using cached encrypted balance data');
      setEncryptedBalanceState(cachedData);
      setIsLoadingBalance(false);
      return;
    }

    try {
      setIsLoadingBalance(true);
      
      // Create a simple public client for raw calls
      
      // Use your dedicated Infura RPC endpoint
      const rpcUrls = getSepoliaRpcUrls();
      
      let publicClient;
      let lastError;
      
      for (const rpcUrl of rpcUrls) {
        try {
          console.log(`🔄 Trying RPC: ${rpcUrl}`);
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          
          // Test the connection with a simple call
          await publicClient.getBlockNumber();
          console.log(`✅ Connected to ${rpcUrl}`);
          break; // If successful, use this client
        } catch (error) {
          console.log(`❌ Failed to connect to ${rpcUrl}:`, (error as Error).message);
          lastError = error;
          continue;
        }
      }
      
      if (!publicClient) {
        console.error('❌ All RPC endpoints failed, last error:', lastError);
        throw new Error(`All RPC endpoints failed. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
      }

      // Make raw contract call - with additional safety check
      if (!publicClient || typeof publicClient.call !== 'function') {
        console.error('❌ publicClient is not properly initialized');
        throw new Error('Public client not properly initialized');
      }

      const result = await publicClient.call({
        to: CWETH_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: CWETH_ABI,
          functionName: 'getEncryptedBalance',
          args: [address as `0x${string}`],
        }),
      });

      if (result.data && result.data !== '0x') {
        const balanceData = result.data as `0x${string}`;
        setEncryptedBalanceState(balanceData);
        
        // Cache the result to reduce future API calls
        rpcCache.set(cacheKey, balanceData, CACHE_TTL.ENCRYPTED_DATA);
        
        // Check if balance changed
        if (balanceData !== lastEncryptedBalanceRef.current) {
          lastEncryptedBalanceRef.current = balanceData;
          
          // Update hasCWETH based on balance
          const isAllZeros = balanceData === '0x0000000000000000000000000000000000000000000000000000000000000000';
          setHasCWETH(!isAllZeros);
          console.log('🔍 Balance check:', { balanceData, isAllZeros, hasCWETH: !isAllZeros });
        }
      } else {
        console.log('🔍 No balance data or empty result:', result.data);
        setEncryptedBalanceState('0x0000000000000000000000000000000000000000000000000000000000000000');
        setHasCWETH(false);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setEncryptedBalanceState(null);
      setHasCWETH(false);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, CWETH_ADDRESS]);

  // Simple decrypt function - uses master signature
  const decryptBalance = useCallback(async () => {
    if (!isConnected || !address || !encryptedBalance || !walletClient || !masterSignature) {
      return;
    }

    // Prevent multiple simultaneous decryption attempts
    if (isDecryptingRef.current) {
      console.log('🔒 cWETH decryption already in progress, skipping...');
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
      if (!CWETH_ADDRESS || !masterSig.contractAddresses.includes(CWETH_ADDRESS as `0x${string}`)) {
        console.warn('⚠️ Master signature not authorized for current contract address in useCWETHBalance.', {
          currentCWETHAddress: CWETH_ADDRESS,
          authorizedAddresses: masterSig.contractAddresses,
          isAuthorized: masterSig.contractAddresses.includes(CWETH_ADDRESS as `0x${string}`)
        });
        
        // Clear the old signature from localStorage
        localStorage.removeItem(`fhe_master_decryption_${address}`);
        
        // Clear the current signature state
        setDecryptionError('Contract address changed. Please re-authorize decryption.');
        setIsDecrypting(false);
        return;
      }

      // Additional check: verify the contract addresses are valid
      if (!masterSig.contractAddresses || masterSig.contractAddresses.length === 0) {
        console.warn('⚠️ Master signature has no contract addresses in useCWETHBalance. Clearing cache.');
        localStorage.removeItem(`fhe_master_decryption_${address}`);
        setDecryptionError('Invalid decryption signature. Please re-authorize.');
        setIsDecrypting(false);
        return;
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      // Decrypt balance using master signature
      if (!encryptedBalanceState) {
        console.log('No encrypted balance data to decrypt');
        return;
      }
      
      let result;
      try {
        result = await fheInstance.userDecrypt(
          [{ handle: encryptedBalanceState, contractAddress: CWETH_ADDRESS as `0x${string}` }],
          masterSig.privateKey,
          masterSig.publicKey,
          masterSig.signature,
          masterSig.contractAddresses,
          masterSig.userAddress,
          masterSig.startTimestamp,
          masterSig.durationDays
        );
      } catch (decryptError: any) {
        // Handle authorization errors specifically
        if (decryptError.message && decryptError.message.includes('not authorized')) {
          console.warn('🚫 Authorization error during decryption in useCWETHBalance. Clearing cache and requesting re-authorization.', {
            error: decryptError.message,
            currentCWETHAddress: CWETH_ADDRESS,
            authorizedAddresses: masterSig.contractAddresses
          });
          
          // Clear the old signature from localStorage
          localStorage.removeItem(`fhe_master_decryption_${address}`);
          
          // Clear the current signature state
          setDecryptionError('Authorization expired. Please re-authorize decryption.');
          setIsDecrypting(false);
          return;
        }
        
        // Re-throw other decryption errors
        throw decryptError;
      }

      const decryptedValue = result[encryptedBalanceState];
      if (decryptedValue !== undefined) {
        let ethValue: number;
        if (typeof decryptedValue === 'bigint') {
          ethValue = Number(decryptedValue) / 1e18;
        } else if (typeof decryptedValue === 'string') {
          ethValue = Number(BigInt(decryptedValue)) / 1e18;
        } else {
          ethValue = 0;
        }
        
        setCWETHBalance(`${ethValue.toFixed(8)} cWETH`);
        setHasCWETH(ethValue > 0);
        setIsDecrypted(true);
    // Balance decrypted successfully
      }
    } catch (error) {
      console.error('cWETH decryption failed:', error);
      setCWETHBalance('••••••••');
    } finally {
      setIsDecrypting(false);
      isDecryptingRef.current = false;
    }
  }, [isConnected, address, encryptedBalanceState, walletClient, masterSignature, getMasterSignature, CWETH_ADDRESS]);

  // Handle encrypted balance from useReadContract
  useEffect(() => {
    if (encryptedBalance) {
      // Handle different return types from contract call
      let balanceData: string | null = null;
      
      if (typeof encryptedBalance === 'string') {
        balanceData = encryptedBalance;
      } else if (typeof encryptedBalance === 'object' && encryptedBalance !== null) {
        // If it's an object, try to extract the data
        balanceData = (encryptedBalance as any).data || (encryptedBalance as any).result || null;
      }
      
      console.log('🔍 useCWETHBalance: encryptedBalance received:', balanceData, 'type:', typeof balanceData);
      
      // Check if we have valid encrypted balance data
      const hasEncryptedBalance = Boolean(
        balanceData && 
        typeof balanceData === 'string' && 
        balanceData !== '0x' && 
        balanceData !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
        balanceData.length > 2
      );
      
      setHasCWETH(hasEncryptedBalance);
      setEncryptedBalanceState(balanceData);
      
      if (!hasEncryptedBalance) {
        setCWETHBalance('••••••••');
    // No balance found
      } else {
        setCWETHBalance('••••••••');
    // Balance found
      }
    } else {
    // No encrypted balance data
      setHasCWETH(false);
      setEncryptedBalanceState(null);
      setCWETHBalance('••••••••');
    }
  }, [encryptedBalance]);

  // Initialize when address changes
  useEffect(() => {
    if (address && isConnected) {
      // No need to manually fetch - useReadContract handles it
    // Address connected, useReadContract will handle fetching
    } else {
      setEncryptedBalanceState(null);
      setCWETHBalance('••••••••');
      setHasCWETH(false);
      setIsDecrypted(false);
    }
  }, [address, isConnected]);

  // Auto-decrypt when master signature becomes available
  useEffect(() => {
    if (masterSignature && encryptedBalanceState && !isLoadingBalance && hasCWETH) {
      decryptBalance();
    } else if (!masterSignature) {
      lockBalance();
    }
  }, [masterSignature, encryptedBalanceState, isLoadingBalance, hasCWETH, decryptBalance]);

  // Simple refresh function
  const forceRefresh = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Simple lock function
  const lockBalance = useCallback(() => {
    setIsDecrypted(false);
    setCWETHBalance('••••••••');
  }, []);

  const canDecrypt = !!encryptedBalance && encryptedBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000' && !!masterSignature;
  
  // Balance hook ready

  // Cleanup cache periodically to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      rpcCache.cleanup();
    }, 60000); // Clean every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    formattedBalance: cWETHBalance,
    refetchCWETHBalance: refetchEncryptedBalance,
    hasCWETH,
    canDecrypt,
    decryptBalance,
    isDecrypting,
    isLoadingBalance,
    isDecrypted,
    isUpdating: isDecrypting || isLoadingBalance,
    lockBalance,
    forceRefresh: refetchEncryptedBalance,
  };
};