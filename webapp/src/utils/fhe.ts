'use client';

// Import polyfills first
import './polyfills';

// Create FHE instance using SepoliaConfig (concise approach)
let fheInstance: any = null;
let isInitializing = false;

export const getFHEInstance = async () => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FHE operations can only be performed in the browser');
  }

  if (!fheInstance && !isInitializing) {
    isInitializing = true;
    try {
      // Dynamic import to avoid SSR issues and reduce circular dependencies
      const { createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/web');
      fheInstance = await createInstance(SepoliaConfig);
    } catch (error) {
      console.error('Failed to initialize FHE instance:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  }
  
  if (!fheInstance) {
    throw new Error('FHE instance not available');
  }
  
  return fheInstance;
};

// Cleanup function to dispose of FHE instance
export const cleanupFHEInstance = () => {
  fheInstance = null;
  isInitializing = false;
};

// Create encrypted input buffer for contract interaction
export const createEncryptedInput = async (
  contractAddress: string,
  userAddress: string
) => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FHE operations can only be performed in the browser');
  }

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
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FHE operations can only be performed in the browser');
  }

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
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return null; // Return null during SSR
  }

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
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return 'Encrypted'; // Return default during SSR
  }

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
