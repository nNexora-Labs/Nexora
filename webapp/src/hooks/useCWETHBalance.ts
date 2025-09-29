'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';

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
  
  const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Core state - minimal and stable
  const [encryptedBalance, setEncryptedBalance] = useState<string | null>(null);
  const [cWETHBalance, setCWETHBalance] = useState<string>('••••••••');
  const [hasCWETH, setHasCWETH] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);

  // Refs for stable references
  const lastEncryptedBalanceRef = useRef<string | null>(null);
  const isDecryptingRef = useRef(false);

  // Simple balance fetch function - no dependencies
  const fetchBalance = useCallback(async () => {
    if (!address || !CWETH_ADDRESS || CWETH_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return;
    }

    try {
      setIsLoadingBalance(true);
      
      // Create a simple public client for raw calls
      const { createPublicClient, http, encodeFunctionData } = await import('viem');
      const { sepolia } = await import('wagmi/chains');
      
      // Use your dedicated Infura RPC endpoint
      const rpcUrls = [
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/edae100994ea476180577c9218370251'
      ];
      
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

      // Make raw contract call
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
        setEncryptedBalance(balanceData);
        
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
        setEncryptedBalance('0x0000000000000000000000000000000000000000000000000000000000000000');
        setHasCWETH(false);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setEncryptedBalance(null);
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

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      // Decrypt balance using master signature
      const result = await fheInstance.userDecrypt(
        [{ handle: encryptedBalance, contractAddress: CWETH_ADDRESS }],
        masterSig.privateKey,
        masterSig.publicKey,
        masterSig.signature,
        masterSig.contractAddresses,
        masterSig.userAddress,
        masterSig.startTimestamp,
        masterSig.durationDays
      );

      const decryptedValue = result[encryptedBalance];
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
        console.log('✅ cWETH balance decrypted:', ethValue);
      }
    } catch (error) {
      console.error('cWETH decryption failed:', error);
      setCWETHBalance('••••••••');
    } finally {
      setIsDecrypting(false);
      isDecryptingRef.current = false;
    }
  }, [isConnected, address, encryptedBalance, walletClient, masterSignature, getMasterSignature, CWETH_ADDRESS]);

  // Initialize when address changes
  useEffect(() => {
    if (address && isConnected) {
      fetchBalance();
    } else {
      setEncryptedBalance(null);
      setCWETHBalance('••••••••');
      setHasCWETH(false);
      setIsDecrypted(false);
    }
  }, [address, isConnected, fetchBalance]);

  // Auto-decrypt when master signature becomes available
  useEffect(() => {
    if (masterSignature && encryptedBalance && !isLoadingBalance && hasCWETH) {
      decryptBalance();
    } else if (!masterSignature) {
      lockBalance();
    }
  }, [masterSignature, encryptedBalance, isLoadingBalance, hasCWETH, decryptBalance]);

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
  
  // Debug logging
  console.log('🔍 useCWETHBalance return values:', {
    formattedBalance: cWETHBalance,
    hasCWETH,
    canDecrypt,
    isDecrypted,
    encryptedBalance,
    isDecrypting,
    isLoadingBalance
  });

  return {
    formattedBalance: cWETHBalance,
    refetchCWETHBalance: fetchBalance,
    hasCWETH,
    canDecrypt,
    decryptBalance,
    isDecrypting,
    isLoadingBalance,
    isDecrypted,
    isUpdating: isDecrypting || isLoadingBalance,
    lockBalance,
    forceRefresh,
  };
};