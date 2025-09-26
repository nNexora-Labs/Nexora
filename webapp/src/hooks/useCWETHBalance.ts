'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useSignMessage, useWalletClient } from 'wagmi';
import { decryptUserData, getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';

// Contract ABI for cWETH token - using the actual function from the contract
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
        "internalType": "euint32",
        "name": "",
        "type": "euint32"
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
  
  console.log('useCWETHBalance: signMessageAsync available:', !!signMessageAsync);
  console.log('useCWETHBalance: walletClient available:', !!walletClient);
  
  const [cWETHBalance, setCWETHBalance] = useState<string>('Encrypted');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasCWETH, setHasCWETH] = useState(false);
  const [canDecrypt, setCanDecrypt] = useState(false);
  const [decryptionSignature, setDecryptionSignature] = useState<string | null>(null);
  
  // Contract address
  const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';

  // State for encrypted balance
  const [encryptedBalance, setEncryptedBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Function to fetch encrypted balance using raw contract call
  const fetchEncryptedBalance = useCallback(async () => {
    if (!address || !CWETH_ADDRESS || CWETH_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return;
    }

    setIsLoadingBalance(true);
    try {
      console.log('Fetching encrypted cWETH balance...');
      
      const { createPublicClient, http, encodeFunctionData } = await import('viem');
      const { sepolia } = await import('viem/chains');
      
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });
      
      // Encode the function call manually
      const encodedData = encodeFunctionData({
        abi: CWETH_ABI,
        functionName: 'getEncryptedBalance',
        args: [address as `0x${string}`],
      });
      
      console.log('Encoded function data:', encodedData);
      
      // Make raw call to get encrypted data
      const result = await publicClient.call({
        to: CWETH_ADDRESS as `0x${string}`,
        data: encodedData,
      });
      
      console.log('Raw contract call result:', result);
      
      if (result.data && result.data !== '0x') {
        // Check if the result is all zeros (no balance)
        const isAllZeros = result.data === '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        if (isAllZeros) {
          console.log('✅ Contract call successful - User has 0 cWETH balance');
          setEncryptedBalance('0x0000000000000000000000000000000000000000000000000000000000000000');
        } else {
          console.log('✅ Encrypted balance data found:', result.data);
          setEncryptedBalance(result.data);
        }
      } else {
        console.log('❌ No encrypted balance data (empty result)');
        setEncryptedBalance(null);
      }
      
    } catch (error) {
      console.error('❌ Failed to fetch encrypted balance:', error);
      setEncryptedBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, CWETH_ADDRESS]);

  // Fetch balance when address changes
  useEffect(() => {
    if (address && CWETH_ADDRESS && CWETH_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      fetchEncryptedBalance();
    }
  }, [fetchEncryptedBalance]);

  // Debug contract call
  useEffect(() => {
    console.log('Contract call debug:');
    console.log('- CWETH_ADDRESS:', CWETH_ADDRESS);
    console.log('- address:', address);
    console.log('- encryptedBalance:', encryptedBalance);
    console.log('- isLoadingBalance:', isLoadingBalance);
  }, [CWETH_ADDRESS, address, encryptedBalance, isLoadingBalance]);

  // Check if user has any encrypted cWETH balance
  useEffect(() => {
    console.log('useCWETHBalance: encryptedBalance changed:', encryptedBalance);
    if (encryptedBalance) {
      // Check if the balance is all zeros (no balance)
      const isAllZeros = encryptedBalance === '0x0000000000000000000000000000000000000000000000000000000000000000';
      
      if (isAllZeros) {
        console.log('useCWETHBalance: User has 0 cWETH balance');
        setHasCWETH(false);
        setCWETHBalance('0.0000 cWETH');
      } else {
        // The encryptedBalance is a hex string (ciphertext) with actual encrypted data
        console.log('useCWETHBalance: User has encrypted cWETH balance');
        setHasCWETH(true);
        setCWETHBalance('Encrypted');
      }
    } else {
      console.log('useCWETHBalance: no encryptedBalance data');
      setHasCWETH(false);
      setCWETHBalance('Loading...');
    }
  }, [encryptedBalance]);

  // Check if we have a stored decryption signature
  useEffect(() => {
    if (typeof window !== 'undefined' && address) {
      const storedSignature = localStorage.getItem(`fhe_cweth_decryption_${address}`);
      if (storedSignature) {
        setDecryptionSignature(storedSignature);
        setCanDecrypt(true);
      }
    }
  }, [address]);

  // Decrypt the cWETH balance using official Zama pattern
  const decryptBalance = useCallback(async () => {
    console.log('=== STARTING cWETH DECRYPTION ===');
    console.log('isConnected:', isConnected);
    console.log('address:', address);
    console.log('encryptedBalance:', encryptedBalance);
    
    if (!isConnected || !address) {
      console.log('❌ Not connected or no address');
      return;
    }

    if (!encryptedBalance) {
      console.log('❌ No encrypted balance data');
      return;
    }

    setIsDecrypting(true);
    
    try {
      console.log('Starting cWETH decryption process...');
      console.log('Encrypted balance ciphertext:', encryptedBalance);
      
      // Get FHE instance
      console.log('Getting FHE instance...');
      const fheInstance = await getFHEInstance();
      console.log('✅ FHE instance created');
      
      // Create a real signer from wallet client
      if (!walletClient) {
        throw new Error('Wallet client not available');
      }
      
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      console.log('✅ Real signer created from wallet client');

      console.log('Creating decryption signature using official Zama pattern...');
      const sig = await FhevmDecryptionSignature.loadOrSign(
        fheInstance as any,
        [CWETH_ADDRESS],
        signer
      );

      if (!sig) {
        console.error('❌ Failed to create decryption signature');
        setCWETHBalance('Decryption Failed');
        setIsDecrypting(false);
        return;
      }

      console.log('✅ Decryption signature created');

      console.log('Calling userDecrypt using official Zama pattern...');
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

      console.log('✅ userDecrypt completed:', result);

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
        setCWETHBalance(`${ethValue.toFixed(4)} cWETH`);
        setHasCWETH(ethValue > 0);
        console.log('✅ Balance decrypted successfully:', ethValue, 'ETH');
      } else {
        console.log('❌ No decrypted value found');
        setCWETHBalance('Decryption Failed');
        setHasCWETH(false);
      }

    } catch (error) {
      console.error('❌ cWETH Decryption failed:', error);
      setCWETHBalance('Decryption Failed');
      setHasCWETH(false);
    } finally {
      setIsDecrypting(false);
    }
    
    console.log('=== cWETH DECRYPTION COMPLETE ===');
  }, [isConnected, address, encryptedBalance, CWETH_ADDRESS, walletClient]);

  // Clear decryption session on disconnect
  useEffect(() => {
    if (!isConnected && address) {
      localStorage.removeItem(`fhe_cweth_decryption_${address}`);
      setDecryptionSignature(null);
      setCanDecrypt(false);
      setCWETHBalance('Encrypted');
      setHasCWETH(false);
    }
  }, [isConnected, address]);

  return {
    cWETHBalance,
    formattedBalance: cWETHBalance,
    refetchCWETHBalance: fetchEncryptedBalance,
    hasCWETH,
    canDecrypt,
    decryptBalance,
    isDecrypting,
    isLoadingBalance,
    clearDecryption: () => {
      if (address) {
        localStorage.removeItem(`fhe_cweth_decryption_${address}`);
        setDecryptionSignature(null);
        setCanDecrypt(false);
        setCWETHBalance('Encrypted');
      }
    }
  };
};
