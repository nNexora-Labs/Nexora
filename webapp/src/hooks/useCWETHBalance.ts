'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useSignMessage, useWalletClient } from 'wagmi';
import { decryptUserData, getFHEInstance } from '../utils/fhe';
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
        "type": "euint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const useCWETHBalance = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
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
  const decryptionSignatureRef = useRef<string | null>(null);
  const lastEncryptedBalanceRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          
          // Auto-decrypt if we have a session (COMMENTED OUT FOR NOW)
          // if (isDecrypted && decryptionSignatureRef.current && !isAllZeros) {
          //   setTimeout(() => decryptBalance(), 100);
          // }
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
  }, [address, CWETH_ADDRESS, isDecrypted]);

  // Simple decrypt function - no dependencies
  const decryptBalance = useCallback(async () => {
    if (!isConnected || !address || !encryptedBalance || !walletClient) {
      return;
    }

    try {
      setIsDecrypting(true);
      
      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      // Create signer
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      
      // Load or create signature
      const sig = await FhevmDecryptionSignature.loadOrSign(
        fheInstance as any,
        [CWETH_ADDRESS],
        signer
      );

      if (!sig) {
        throw new Error('Failed to create decryption signature');
      }

      // Decrypt balance
      const result = await fheInstance.userDecrypt(
        [{ handle: encryptedBalance, contractAddress: CWETH_ADDRESS }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
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
        decryptionSignatureRef.current = sig.signature;
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      setCWETHBalance('••••••••');
    } finally {
      setIsDecrypting(false);
    }
  }, [isConnected, address, encryptedBalance, walletClient, CWETH_ADDRESS]);

  // Simple polling - no dependencies (COMMENTED OUT FOR NOW)
  // const startPolling = useCallback(() => {
  //   if (pollingIntervalRef.current) {
  //     clearInterval(pollingIntervalRef.current);
  //   }
  //   
  //   pollingIntervalRef.current = setInterval(() => {
  //     fetchBalance();
  //   }, 5000); // Poll every 5 seconds
  // }, [fetchBalance]);

  // const stopPolling = useCallback(() => {
  //   if (pollingIntervalRef.current) {
  //     clearInterval(pollingIntervalRef.current);
  //     pollingIntervalRef.current = null;
  //   }
  // }, []);

  // Initialize when address changes
  useEffect(() => {
    if (address && isConnected) {
      fetchBalance();
      // startPolling(); // COMMENTED OUT FOR NOW
    } else {
      // stopPolling(); // COMMENTED OUT FOR NOW
      setEncryptedBalance(null);
      setCWETHBalance('••••••••');
      setHasCWETH(false);
      setIsDecrypted(false);
    }
    
    // return () => stopPolling(); // COMMENTED OUT FOR NOW
  }, [address, isConnected, fetchBalance]); // Removed startPolling, stopPolling from dependencies

  // Load stored signature (COMMENTED OUT FOR NOW - NO AUTO-DECRYPTION)
  // useEffect(() => {
  //   if (typeof window !== 'undefined' && address) {
  //     const storedSignature = localStorage.getItem(`fhe_cweth_decryption_${address}`);
  //     if (storedSignature) {
  //       decryptionSignatureRef.current = storedSignature;
  //       setIsDecrypted(true);
  //     }
  //   }
  // }, [address]);

  // Cleanup on unmount (COMMENTED OUT FOR NOW)
  // useEffect(() => {
  //   return () => {
  //     stopPolling();
  //     if (updateTimeoutRef.current) {
  //       clearTimeout(updateTimeoutRef.current);
  //     }
  //   };
  // }, [stopPolling]);

  // Simple refresh function
  const forceRefresh = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Simple clear decryption
  const clearDecryption = useCallback(() => {
    if (address) {
      localStorage.removeItem(`fhe_cweth_decryption_${address}`);
      decryptionSignatureRef.current = null;
      setIsDecrypted(false);
      setCWETHBalance('••••••••');
    }
  }, [address]);

  // Simple lock function
  const lockBalance = useCallback(() => {
    setIsDecrypted(false);
    setCWETHBalance('••••••••');
  }, []);

  const canDecrypt = !!encryptedBalance && encryptedBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000';
  
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
    clearDecryption,
    lockBalance,
    forceRefresh,
  };
};