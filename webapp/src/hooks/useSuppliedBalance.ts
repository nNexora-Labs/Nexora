'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWalletClient } from 'wagmi';
import { decryptUserData, getFHEInstance } from '../utils/fhe';
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

export const useSuppliedBalance = (masterSignature: string | null) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [suppliedBalance, setSuppliedBalance] = useState<string>('••••••••');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasSupplied, setHasSupplied] = useState(false);
  const [canDecrypt, setCanDecrypt] = useState(false);

  // Contract address
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

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
        encryptedShares.length > 2;
      
      setHasSupplied(hasEncryptedShares);
      
      if (!hasEncryptedShares) {
        setSuppliedBalance('No supplies found');
      } else {
        setSuppliedBalance('••••••••');
      }
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

    setIsDecrypting(true);
    
    try {
      console.log('Starting decryption process...');
      console.log('Encrypted shares ciphertext:', encryptedShares);
      
      // Get FHE instance
      const fheInstance = await getFHEInstance();
      console.log('FHE instance created');
      
      // Create signer
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      
      // Use master signature for decryption
      console.log('Using master signature for decryption...');
      
      // Load or create signature
      const sig = await FhevmDecryptionSignature.loadOrSign(
        fheInstance as any,
        [VAULT_ADDRESS],
        signer
      );

      if (!sig) {
        throw new Error('Failed to create decryption signature');
      }

      // Decrypt balance using real FHEVM decryption
      console.log('Attempting to decrypt encrypted shares...');
      
      const result = await fheInstance.userDecrypt(
        [{ handle: encryptedShares, contractAddress: VAULT_ADDRESS }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
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
        
        console.log('Decryption successful:', ethValue);
      } else {
        throw new Error('No decrypted value returned');
      }

    } catch (error) {
      console.error('Decryption failed:', error);
      setSuppliedBalance('Decryption Failed');
      setHasSupplied(false);
      setIsDecrypting(false);
    }
  }, [isConnected, address, encryptedShares, masterSignature, walletClient, VAULT_ADDRESS]);

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