'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useSignMessage } from 'wagmi';
import { decryptUserData, getFHEInstance } from '../utils/fhe';

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
  
  console.log('useCWETHBalance: signMessageAsync available:', !!signMessageAsync);
  
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

  // Decrypt the cWETH balance using Zama's pattern
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
      
      // Get user's public key
      console.log('Getting public key...');
      const publicKey = fheInstance.getPublicKey();
      if (!publicKey) {
        throw new Error('No public key available');
      }
      console.log('✅ Public key obtained:', publicKey);

      let signature = decryptionSignature;
      
      // If no stored signature, request user to sign
      if (!signature) {
        console.log('🔐 Requesting user signature for cWETH decryption...');
        
        if (!signMessageAsync) {
          throw new Error('signMessageAsync not available');
        }
        
        // Create EIP712 message for decryption permission
        const eip712 = fheInstance.createEIP712(
          publicKey.publicKey,
          [CWETH_ADDRESS], // Contract addresses that can access decryption
          Math.floor(Date.now() / 1000), // Start timestamp
          7 // Duration in days
        );

        console.log('📝 EIP712 message created:', eip712);

        // Request user signature
        console.log('⏳ Requesting signature from wallet...');
        signature = await signMessageAsync({
          message: JSON.stringify(eip712),
        });

        console.log('✅ User signature obtained:', signature);

        // Store signature for session persistence
        localStorage.setItem(`fhe_cweth_decryption_${address}`, signature);
        setDecryptionSignature(signature);
        setCanDecrypt(true);
      } else {
        console.log('✅ Using stored signature');
      }

              // Now attempt to decrypt the encrypted balance using real FHE instance
              console.log('🔓 Attempting to decrypt encrypted cWETH balance...');
              console.log('Encrypted balance data:', encryptedBalance);
              
              try {
                // Use the real FHE instance to decrypt the encrypted balance
                // The encryptedBalance is a hex string (ciphertext) from the contract
                console.log('Calling fheInstance.decrypt with:', { encryptedBalance, address });
                
                const decryptedValue = await fheInstance.decrypt(encryptedBalance, address);
                
                console.log('✅ Real FHE Decryption successful:', decryptedValue);
                console.log('Decrypted value type:', typeof decryptedValue);
                console.log('Decrypted value:', decryptedValue);
                
                // Convert from wei to ETH and format
                const ethValue = parseFloat(decryptedValue) / 1e18;
                console.log('Converted ETH value:', ethValue);
                
                setCWETHBalance(`${ethValue.toFixed(4)} cWETH`);
                setHasCWETH(ethValue > 0);
                setIsDecrypting(false);
                
              } catch (decryptError) {
                console.error('❌ Real FHE Decryption error:', decryptError);
                console.error('Decrypt error details:', decryptError);
                throw new Error(`Failed to decrypt encrypted cWETH balance: ${decryptError.message}`);
              }

    } catch (error) {
      console.error('❌ cWETH Decryption failed:', error);
      setCWETHBalance('Decryption Failed');
      setHasCWETH(false);
      setIsDecrypting(false);
    }
    
    console.log('=== cWETH DECRYPTION COMPLETE ===');
  }, [isConnected, address, encryptedBalance, decryptionSignature, signMessageAsync, CWETH_ADDRESS]);

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
