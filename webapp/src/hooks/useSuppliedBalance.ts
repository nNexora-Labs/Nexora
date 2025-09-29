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
  }
] as const;

export const useSuppliedBalance = (masterSignature: string | null, getMasterSignature: () => FhevmDecryptionSignature | null) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [suppliedBalance, setSuppliedBalance] = useState<string>('••••••••');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasSupplied, setHasSupplied] = useState(false);
  const [canDecrypt, setCanDecrypt] = useState(false);

  // Contract address
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Refs for preventing multiple simultaneous decryption attempts
  const isDecryptingRef = useRef(false);

  // Read encrypted shares from contract
  const { data: encryptedShares, refetch: refetchEncryptedShares } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'getEncryptedShares',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!VAULT_ADDRESS && VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000' && typeof window !== 'undefined',
    },
  });

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
      
      setHasSupplied(hasEncryptedShares);
      
      if (!hasEncryptedShares) {
        setSuppliedBalance('••••••••');
        console.log('🔍 useSuppliedBalance: No shares found, encryptedShares:', encryptedShares);
      } else {
        setSuppliedBalance('••••••••');
        console.log('🔍 useSuppliedBalance: Shares found, encryptedShares:', encryptedShares);
      }
    } else {
      console.log('🔍 useSuppliedBalance: No encryptedShares data');
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

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      console.log('FHE instance created');
      
      // Decrypt balance using master signature
      console.log('Using master signature for decryption...');
      
      const result = await fheInstance.userDecrypt(
        [{ handle: encryptedShares, contractAddress: VAULT_ADDRESS }],
        masterSig.privateKey,
        masterSig.publicKey,
        masterSig.signature,
        masterSig.contractAddresses,
        masterSig.userAddress,
        masterSig.startTimestamp,
        masterSig.durationDays
      );

      const decryptedValue = result[encryptedShares];
      if (decryptedValue !== undefined) {
        let ethValue: number;
        if (typeof decryptedValue === 'bigint') {
          ethValue = Number(decryptedValue) / 1e18;
        } else if (typeof decryptedValue === 'string') {
          ethValue = Number(BigInt(decryptedValue)) / 1e18;
        } else {
          ethValue = 0;
        }
        
        setSuppliedBalance(`${ethValue.toFixed(4)} ETH`);
        setHasSupplied(ethValue > 0);
        setIsDecrypting(false);
        
        console.log('✅ Supplied balance decrypted:', ethValue);
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
    refetchEncryptedShares,
    clearDecryption: () => {
      setSuppliedBalance('••••••••');
      setCanDecrypt(false);
    }
  };
};