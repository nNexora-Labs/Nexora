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
  }
] as const;

export const useSuppliedBalance = (masterSignature: string | null, getMasterSignature: () => FhevmDecryptionSignature | null) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [encryptedShares, setEncryptedShares] = useState<string | null>(null);
  const [suppliedBalance, setSuppliedBalance] = useState<string>('••••••••');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasSupplied, setHasSupplied] = useState(false);
  const [canDecrypt, setCanDecrypt] = useState(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  const VAULT_ADDRESS = contractAddresses?.VAULT_ADDRESS;

  // Refs for preventing multiple simultaneous decryption attempts
  const isDecryptingRef = useRef(false);

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
    // Fetching encrypted shares
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          
          // Test the connection
          await publicClient.getBlockNumber();
    // Connected to RPC
          
          // Encode function call for getEncryptedShares
          const data = encodeFunctionData({
            abi: VAULT_ABI,
            functionName: 'getEncryptedShares',
            args: [address],
          });
          
          // Make the contract call - with safety check
          if (!publicClient || typeof publicClient.call !== 'function') {
            console.error('❌ publicClient is not properly initialized in useSuppliedBalance');
            throw new Error('Public client not properly initialized');
          }

          const result = await publicClient.call({
            to: VAULT_ADDRESS as `0x${string}`,
            data,
          });
          
          if (result.data && result.data !== '0x') {
            const sharesData = result.data as `0x${string}`;
    // Encrypted shares fetched
            setEncryptedShares(sharesData);
            break; // Success, exit the loop
          } else {
            console.log('⚠️ No shares data received');
            setEncryptedShares(null);
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
      console.error('Failed to fetch encrypted shares:', error);
      setEncryptedShares(null);
    }
  }, [address, VAULT_ADDRESS]);

  // Initialize when address changes
  useEffect(() => {
    if (address && isConnected) {
      fetchEncryptedShares();
    } else {
      setEncryptedShares(null);
      setSuppliedBalance('••••••••');
      setHasSupplied(false);
    }
  }, [address, isConnected, fetchEncryptedShares]);

  // Check if user has any encrypted shares
  useEffect(() => {
    if (encryptedShares) {
      // The encryptedShares is now a hex string (ciphertext)
      // If we get a non-empty hex string, the user has supplied
      const hasEncryptedShares = encryptedShares && 
        typeof encryptedShares === 'string' && 
        encryptedShares !== '0x' && 
        encryptedShares !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
        encryptedShares.length > 2;
      
      setHasSupplied(Boolean(hasEncryptedShares));
      
      if (!hasEncryptedShares) {
        setSuppliedBalance('••••••••');
        // No shares found
      } else {
        setSuppliedBalance('••••••••');
    // Shares data processed
      }
    } else {
    // No shares data
    }
  }, [encryptedShares]);

  // Update canDecrypt based on master signature
  useEffect(() => {
    setCanDecrypt(!!masterSignature && hasSupplied);
  }, [masterSignature, hasSupplied]);

  // Decrypt the supplied balance using master signature
  const decryptBalance = useCallback(async () => {
    if (!isConnected || !address || !encryptedShares || !masterSignature || !walletClient) {
      console.log('Missing requirements:', { isConnected, address, encryptedShares, masterSignature, walletClient });
      return;
    }

    // Prevent multiple simultaneous decryption attempts
    if (isDecryptingRef.current) {
      console.log('🔒 Supplied balance decryption already in progress, skipping...');
      return;
    }

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    
    try {
      console.log('Starting decryption process...');
      console.log('Encrypted shares ciphertext:', encryptedShares);
      
      // Get the master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

      // Check if the master signature is authorized for the current contract address
      if (!VAULT_ADDRESS || !masterSig.contractAddresses.includes(VAULT_ADDRESS as `0x${string}`)) {
        console.warn('⚠️ Master signature not authorized for current contract address in useSuppliedBalance.', {
          currentVaultAddress: VAULT_ADDRESS,
          authorizedAddresses: masterSig.contractAddresses,
          isAuthorized: masterSig.contractAddresses.includes(VAULT_ADDRESS as `0x${string}`)
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
        console.warn('⚠️ Master signature has no contract addresses in useSuppliedBalance. Clearing cache.');
        localStorage.removeItem(`fhe_master_decryption_${address}`);
        setDecryptionError('Invalid decryption signature. Please re-authorize.');
        setIsDecrypting(false);
        return;
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      console.log('FHE instance created');
      
      // Decrypt balance using master signature
      console.log('Using master signature for decryption...');
      
      let result;
      try {
        result = await fheInstance.userDecrypt(
          [{ handle: encryptedShares, contractAddress: VAULT_ADDRESS as `0x${string}` }],
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
          console.warn('🚫 Authorization error during decryption in useSuppliedBalance. Clearing cache and requesting re-authorization.', {
            error: decryptError.message,
            currentVaultAddress: VAULT_ADDRESS,
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

      const decryptedValue = result[encryptedShares];
      console.log('🔍 Raw decrypted value for supplied balance:', decryptedValue, 'Type:', typeof decryptedValue);
      if (decryptedValue !== undefined) {
        let ethValue: number;
        if (typeof decryptedValue === 'bigint') {
          ethValue = Number(decryptedValue) / 1e18;
        } else if (typeof decryptedValue === 'string') {
          ethValue = Number(BigInt(decryptedValue)) / 1e18;
        } else {
          ethValue = 0;
        }
        
        // Use adaptive precision: show more decimal places for small amounts
        let formattedValue: string;
        if (ethValue >= 1) {
          formattedValue = ethValue.toFixed(4);
        } else if (ethValue >= 0.01) {
          formattedValue = ethValue.toFixed(6);
        } else if (ethValue >= 0.001) {
          formattedValue = ethValue.toFixed(7);
        } else if (ethValue >= 0.0001) {
          formattedValue = ethValue.toFixed(8);
        } else if (ethValue > 0) {
          formattedValue = ethValue.toFixed(10);
        } else {
          formattedValue = '0.0000000000';
        }
        
        setSuppliedBalance(`${formattedValue} ETH`);
        setHasSupplied(ethValue > 0);
        setIsDecrypting(false);
        
    // Supplied balance decrypted successfully
      } else {
        throw new Error('No decrypted value returned');
      }

    } catch (error) {
      console.error('Supplied balance decryption failed:', error);
      setSuppliedBalance('••••••••');
      setHasSupplied(false);
      setIsDecrypting(false);
    } finally {
      isDecryptingRef.current = false;
    }
  }, [isConnected, address, encryptedShares, masterSignature, walletClient, getMasterSignature, VAULT_ADDRESS]);

  // Auto-decrypt when master signature becomes available
  useEffect(() => {
    if (masterSignature && encryptedShares && hasSupplied) {
      decryptBalance();
    } else if (!masterSignature) {
      setSuppliedBalance('••••••••');
    }
  }, [masterSignature, encryptedShares, hasSupplied, decryptBalance]);

  // Clear decryption session on disconnect
  useEffect(() => {
    if (!isConnected && address) {
      setSuppliedBalance('••••••••');
      setHasSupplied(false);
      setCanDecrypt(false);
    }
  }, [isConnected, address]);

  return {
    suppliedBalance,
    isDecrypting,
    hasSupplied,
    canDecrypt,
    decryptBalance,
    encryptedShares,
    refetchEncryptedShares: fetchEncryptedShares,
    clearDecryption: () => {
      setSuppliedBalance('••••••••');
      setCanDecrypt(false);
    }
  };
};