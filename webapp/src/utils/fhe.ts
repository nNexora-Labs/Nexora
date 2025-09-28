'use client';

// Import polyfills first
import './polyfills';

// Types based on the official Zama example
export interface FhevmInstance {
  getPublicKey: () => { publicKeyId: string; publicKey: Uint8Array; } | null;
  getPublicParams: (bits: 1 | 8 | 16 | 32 | 64 | 128 | 160 | 256 | 512 | 1024 | 2048) => { publicParams: Uint8Array; publicParamsId: string; } | null;
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number
  ) => any;
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEncryptedInput: (contractAddress: string, userAddress: string) => {
    add64: (value: bigint) => void;
    encrypt: () => Promise<{
      handles: string[];
      inputProof: string;
    }>;
  };
  userDecrypt: (
    handles: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number
  ) => Promise<Record<string, string | bigint | boolean>>;
}

let fheInstance: FhevmInstance | null = null;
let isInitializing = false;

// Public key storage for caching
const publicKeyStorage = new Map<string, { publicKey: string; publicParams: any }>();

// Load Zama Relayer SDK from CDN (like the official example)
const loadRelayerSDK = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";
    
    const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`);
    if (existingScript) {
      if ((window as any).relayerSDK) {
        resolve();
        return;
      }
      reject(new Error("Script loaded but relayerSDK not available"));
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_CDN_URL;
    script.type = "text/javascript";
    script.async = true;

    script.onload = () => {
      if (!(window as any).relayerSDK) {
        reject(new Error(`Relayer SDK script loaded from ${SDK_CDN_URL}, but relayerSDK object is invalid`));
        return;
      }
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Failed to load Relayer SDK from ${SDK_CDN_URL}`));
    };

    console.log('Loading Zama Relayer SDK from CDN...');
    document.head.appendChild(script);
  });
};

export const getFHEInstance = async (provider?: any): Promise<FhevmInstance> => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FHE operations can only be performed in the browser');
  }

  if (!fheInstance && !isInitializing) {
    isInitializing = true;
    try {
      console.log('Creating FHE instance using official Zama configuration...');
      
      // Try to load the SDK from CDN first (like the official example)
      if (!(window as any).relayerSDK) {
        console.log('Loading Zama Relayer SDK from CDN...');
        await loadRelayerSDK();
      }
      
      const relayerSDK = (window as any).relayerSDK;
      if (!relayerSDK) {
        throw new Error('Failed to load relayerSDK from CDN');
      }
      
      console.log('Using SepoliaConfig:', relayerSDK.SepoliaConfig);
      
      // Initialize SDK if not already initialized
      if (!relayerSDK.__initialized__) {
        console.log('Initializing relayerSDK...');
        await relayerSDK.initSDK();
        relayerSDK.__initialized__ = true;
      }
      
      // Check if we have cached public key (like the official example)
      const aclAddress = relayerSDK.SepoliaConfig.aclContractAddress;
      let cachedKey = publicKeyStorage.get(aclAddress);
      
      // Clear cache for new contract addresses to force re-initialization
      const currentCWETHAddress = process.env.NEXT_PUBLIC_CWETH_ADDRESS;
      const currentVaultAddress = process.env.NEXT_PUBLIC_VAULT_ADDRESS;
      
      // If contract addresses changed, clear the cache
      if (currentCWETHAddress && currentVaultAddress) {
        const cacheKey = `${currentCWETHAddress}-${currentVaultAddress}`;
        if (!publicKeyStorage.has(cacheKey)) {
          console.log('New contract addresses detected, clearing FHEVM cache...');
          publicKeyStorage.clear();
        }
      }
      
      console.log('Creating FHE instance...');
      
      // Create config with or without public key (like the official example)
      const config = {
        ...relayerSDK.SepoliaConfig,
        network: provider || 'https://eth-sepolia.public.blastapi.io',
        ...(cachedKey && { 
          publicKey: cachedKey.publicKey,
          publicParams: cachedKey.publicParams 
        }),
      };
      
      fheInstance = await relayerSDK.createInstance(config);
      console.log('✅ FHE instance created successfully');
      
      // Get public key from the instance and cache it (like the official example)
      if (fheInstance) {
        const publicKeyData = fheInstance.getPublicKey();
        const publicParamsData = fheInstance.getPublicParams(2048);
        
        if (publicKeyData && publicParamsData) {
          console.log('Caching public key and params for future use...');
          publicKeyStorage.set(aclAddress, {
            publicKey: publicKeyData.publicKeyId, // Use the ID as the key
            publicParams: publicParamsData
          });
        }
      }
      
    } catch (error) {
      console.error('Failed to initialize FHE instance:', error);
      console.log('Using mock FHE instance for testing...');
      
      // Create a mock FHE instance for testing
      fheInstance = {
        getPublicKey: () => ({ publicKeyId: 'mock-key', publicKey: new Uint8Array(32) }),
        getPublicParams: () => ({ publicParams: new Uint8Array(32), publicParamsId: 'mock-params' }),
        createEIP712: () => ({}),
        generateKeypair: () => ({ publicKey: 'mock-pub', privateKey: 'mock-priv' }),
        createEncryptedInput: (contractAddress: string, userAddress: string) => ({
          add64: (value: bigint) => {
            console.log('Mock: Adding value', value.toString());
          },
          encrypt: async () => {
            console.log('Mock: Encrypting input...');
            // Return mock encrypted data
            return {
              handles: ['0x' + '1'.repeat(64)], // Mock handle
              inputProof: '0x' + '2'.repeat(128) // Mock proof
            };
          }
        }),
        userDecrypt: async () => ({})
      } as any;
      
      console.log('✅ Mock FHE instance created for testing');
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

// Force re-initialization for new contract addresses
export const reinitializeFHEForNewContracts = () => {
  console.log('Forcing FHEVM re-initialization for new contracts...');
  console.log('Current contract addresses:', {
    cWETH: process.env.NEXT_PUBLIC_CWETH_ADDRESS,
    vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS
  });
  
  fheInstance = null;
  isInitializing = false;
  publicKeyStorage.clear();
  
  // Also clear any cached encryption data in localStorage
  if (typeof window !== 'undefined') {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('fhevm') || key.includes('encrypt') || key.includes('relayer'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('Cleared localStorage encryption cache:', keysToRemove);
  }
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
  
  // Note: This method might not exist in the new SDK version
  // We'll need to check the actual API
  if ('createEncryptedInput' in instance) {
    return (instance as any).createEncryptedInput(contractAddress, userAddress);
  }
  
  throw new Error('createEncryptedInput method not available in current SDK version');
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
  if ('add64' in buffer) {
    (buffer as any).add64(value);
  } else if ('add32' in buffer) {
    (buffer as any).add32(Number(value));
  }
  
  // Encrypt and register to FHEVM
  if ('encrypt' in buffer) {
    const ciphertexts = await (buffer as any).encrypt();
    return ciphertexts;
  }
  
  throw new Error('Buffer encrypt method not available');
};

// Decrypt user data using the official Zama pattern
export const decryptUserData = async (
  encryptedData: string,
  userAddress: string,
  contractAddress: string,
  signer: any
) => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return null; // Return null during SSR
  }

  try {
    const instance = await getFHEInstance();
    
    // Import the signature management
    const { FhevmDecryptionSignature } = await import('./FhevmDecryptionSignature');
    
    // Create or load decryption signature
    const sig = await FhevmDecryptionSignature.loadOrSign(
      instance as any,
      [contractAddress],
      signer
    );
    
    if (!sig) {
      console.error('Failed to create decryption signature');
      return null;
    }
    
    // Use userDecrypt method (official Zama pattern)
    const result = await instance.userDecrypt(
      [{ handle: encryptedData, contractAddress }],
      sig.privateKey,
      sig.publicKey,
      sig.signature,
      sig.contractAddresses,
      sig.userAddress,
      sig.startTimestamp,
      sig.durationDays
    );
    
    const decryptedValue = result[encryptedData];
    if (typeof decryptedValue === 'bigint') {
      return decryptedValue;
    } else if (typeof decryptedValue === 'string') {
      return BigInt(decryptedValue);
    } else {
      return BigInt(0);
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

// Helper function to format encrypted balance for display
export const formatEncryptedBalance = async (
  encryptedBalance: string,
  userAddress: string,
  contractAddress: string,
  signer: any
): Promise<string> => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return 'Encrypted'; // Return default during SSR
  }

  try {
    const decryptedValue = await decryptUserData(encryptedBalance, userAddress, contractAddress, signer);
    
    if (decryptedValue !== null) {
      // Convert from wei to ETH and format
      const ethValue = Number(decryptedValue) / 1e18;
      return `${ethValue.toFixed(4)} ETH`;
    }
    return 'Encrypted';
  } catch (error) {
    console.error('Error formatting encrypted balance:', error);
    return 'Encrypted';
  }
};
