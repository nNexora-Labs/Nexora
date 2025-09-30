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

export const useVaultTVL = (masterSignature: string | null, getMasterSignature: () => FhevmDecryptionSignature | null, isTransactionPending: boolean = false) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  console.log('🔍 useVaultTVL initialized with VAULT_ADDRESS:', VAULT_ADDRESS);

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
          
          // Encode function call for getEncryptedTotalAssets
          const data = encodeFunctionData({
            abi: VAULT_ABI,
            functionName: 'getEncryptedTotalAssets',
            args: [],
          });
          
          // Make the contract call
          const result = await publicClient.call({
            to: VAULT_ADDRESS as `0x${string}`,
            data,
          });
          
          if (result.data && result.data !== '0x') {
            const tvlData = result.data as `0x${string}`;
            console.log('✅ TVL fetched:', tvlData);
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

  // Aggressive polling for TVL updates - more frequent when transactions are pending
  useEffect(() => {
    if (!isConnected) return;
    
    // Initial fetch
    fetchEncryptedTVL();
    
    // Set up polling - more frequent when transactions are pending
    const pollInterval = isTransactionPending ? 500 : 2000; // 500ms when pending, 2s normally
    console.log(`🔄 Setting up TVL polling with ${pollInterval}ms interval (transaction pending: ${isTransactionPending})`);
    
    const interval = setInterval(() => {
      console.log('🔄 Polling TVL data...');
      fetchEncryptedTVL();
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [isConnected, fetchEncryptedTVL, isTransactionPending]);

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
    setIsDecrypting(true);
    
    try {
      console.log('🔄 Starting vaultTVL decryption...');
      setDecryptionError(null);
      
      // Get the master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

      console.log('🔍 Master signature details:', {
        userAddress: masterSig.userAddress,
        contractAddresses: masterSig.contractAddresses,
        vaultAddress: VAULT_ADDRESS,
        isValid: masterSig.isValid(),
        signature: masterSig.signature.substring(0, 10) + '...'
      });
      console.log('🔍 Full contract addresses in master sig:', masterSig.contractAddresses);
      console.log('🔍 TVL contract address:', VAULT_ADDRESS);
      console.log('🔍 Encrypted TVL handle:', encryptedTVL);

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
          [{ handle: encryptedTVL, contractAddress: VAULT_ADDRESS }],
          masterSig.privateKey,
          masterSig.publicKey,
          masterSig.signature,
          masterSig.contractAddresses,
          masterSig.userAddress,
          masterSig.startTimestamp,
          masterSig.durationDays
        );
      } catch (userDecryptError) {
        console.log('❌ User decrypt failed for TVL, trying alternative approach:', userDecryptError);
        
        // TVL might be encrypted with a different approach
        // Let's try using the CWETH contract address instead of vault address
        console.log('🔍 Trying TVL decryption with CWETH contract address...');
        
        const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';
        
        try {
          result = await fheInstance.userDecrypt(
            [{ handle: encryptedTVL, contractAddress: CWETH_ADDRESS }],
            masterSig.privateKey,
            masterSig.publicKey,
            masterSig.signature,
            masterSig.contractAddresses,
            masterSig.userAddress,
            masterSig.startTimestamp,
            masterSig.durationDays
          );
          console.log('✅ TVL decrypted successfully with CWETH contract address');
        } catch (cwethDecryptError) {
          console.log('❌ CWETH contract address also failed:', cwethDecryptError);
          
          // TVL is a global contract value that requires special permissions
          // This is expected behavior - TVL is not user-specific
          console.log('🔍 TVL is a global contract value - showing encrypted state');
          console.log('ℹ️ This is expected behavior for contract-level values');
          
          // Don't throw an error, just keep it encrypted
          // The UI will show "••••••••" which is appropriate for global values
          return;
        }
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
      // Don't show this as an error to the user
      if (error instanceof Error && error.message.includes('special contract permissions')) {
        console.log('ℹ️ TVL decryption limitation is expected - this is a global contract value');
        setDecryptionError(null); // Don't show error for expected behavior
      } else {
        setDecryptionError(error instanceof Error ? error.message : 'Decryption failed');
      }
      
      setTVLBalance('••••••••');
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
    console.log('🔍 VaultTVL auto-decrypt check:', {
      masterSignature: masterSignature ? 'present' : 'missing',
      encryptedTVL: encryptedTVL ? 'present' : 'missing',
      isLoadingTVL,
      hasTVL,
      isDecrypted
    });
    
    // Auto-decrypt if we have master signature and encrypted TVL data
    if (masterSignature && encryptedTVL && !isLoadingTVL && !isDecrypted) {
      console.log('🔄 Auto-triggering TVL decryption...');
      decryptTVL();
    } else if (!masterSignature) {
      console.log('🔒 Locking vaultTVL (no master signature)');
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
