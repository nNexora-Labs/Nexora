'use client';

import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk';

// Create FHE instance using SepoliaConfig (concise approach)
let fheInstance: any = null;

export const getFHEInstance = async () => {
  if (!fheInstance) {
    fheInstance = await createInstance(SepoliaConfig);
  }
  return fheInstance;
};

// Create encrypted input buffer for contract interaction
export const createEncryptedInput = async (
  contractAddress: string,
  userAddress: string
) => {
  const instance = await getFHEInstance();
  
  const buffer = instance.createEncryptedInput(
    contractAddress,
    userAddress
  );
  
  return buffer;
};

// Encrypt a value and register it to FHEVM
export const encryptAndRegister = async (
  contractAddress: string,
  userAddress: string,
  value: bigint
) => {
  const buffer = await createEncryptedInput(contractAddress, userAddress);
  
  // Add the value to the buffer (using add64 for uint64 values)
  buffer.add64(value);
  
  // Encrypt and register to FHEVM
  const ciphertexts = await buffer.encrypt();
  
  return ciphertexts;
};

// Decrypt user data (for UI display)
export const decryptUserData = async (
  encryptedData: any,
  userAddress: string
) => {
  try {
    const instance = await getFHEInstance();
    
    // Request decryption for the user
    const decryptedData = await instance.decrypt(
      encryptedData,
      userAddress
    );
    
    return decryptedData;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

// Helper function to format encrypted balance for display
export const formatEncryptedBalance = async (
  encryptedBalance: any,
  userAddress: string
): Promise<string> => {
  try {
    const decryptedValue = await decryptUserData(encryptedBalance, userAddress);
    
    if (decryptedValue !== null) {
      // Convert from wei to ETH and format
      const ethValue = Number(decryptedValue) / 1e18;
      return `${ethValue.toFixed(4)} ETH`;
    }
    
    return 'Encrypted';
  } catch (error) {
    console.error('Failed to decrypt balance:', error);
    return 'Encrypted';
  }
};
