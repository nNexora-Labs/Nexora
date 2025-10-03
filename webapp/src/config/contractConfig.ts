/**
 * Centralized Contract Configuration
 * This ensures all components use the same contract addresses and validates them properly
 */

// LATEST deployed contract addresses (update these when contracts are redeployed)
export const LATEST_CONTRACTS = {
  SEPOLIA: {
    VAULT_ADDRESS: '0xE71B350e7022CC76000f82ca8A4AEf4dAFcc91F9',
    CWETH_ADDRESS: '0x67072781a2f06CA408F2dC37c30991b13f238022',
    CHAIN_ID: 11155111,
  },
  // Add other networks as needed
} as const;

// Environment variable overrides (for development/testing)
const ENV_CONTRACTS = {
  VAULT_ADDRESS: process.env.NEXT_PUBLIC_VAULT_ADDRESS,
  CWETH_ADDRESS: process.env.NEXT_PUBLIC_CWETH_ADDRESS,
  CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID) : 11155111,
} as const;

/**
 * Get contract addresses for the current network
 * 
 * PRIORITY ORDER:
 * 1. Environment variables (if set) - for development/testing
 * 2. Latest hardcoded addresses - for production
 * 
 * This ensures:
 * - Production always uses latest addresses unless overridden
 * - Developers can override for testing
 * - Clear indication of which addresses are being used
 */
export const getContractAddresses = () => {
  const chainId = ENV_CONTRACTS.CHAIN_ID;
  
  // For now, we only support Sepolia
  if (chainId !== 11155111) {
    console.warn(`Unsupported chain ID: ${chainId}. Defaulting to Sepolia.`);
  }

  // Check if environment variables are set
  const hasEnvOverride = !!(ENV_CONTRACTS.VAULT_ADDRESS && ENV_CONTRACTS.CWETH_ADDRESS);
  
  const addresses = {
    VAULT_ADDRESS: ENV_CONTRACTS.VAULT_ADDRESS || LATEST_CONTRACTS.SEPOLIA.VAULT_ADDRESS,
    CWETH_ADDRESS: ENV_CONTRACTS.CWETH_ADDRESS || LATEST_CONTRACTS.SEPOLIA.CWETH_ADDRESS,
    CHAIN_ID: 11155111, // Always use Sepolia for now
    SOURCE: hasEnvOverride ? 'environment' : 'latest' as 'environment' | 'latest',
  };

  // Validate addresses
  if (!isValidAddress(addresses.VAULT_ADDRESS)) {
    throw new Error(`Invalid VAULT_ADDRESS: ${addresses.VAULT_ADDRESS}`);
  }
  
  if (!isValidAddress(addresses.CWETH_ADDRESS)) {
    throw new Error(`Invalid CWETH_ADDRESS: ${addresses.CWETH_ADDRESS}`);
  }

  return addresses;
};

/**
 * Validate if an address is a valid Ethereum address
 */
const isValidAddress = (address: string | undefined): address is string => {
  return !!address && 
         address !== '0x0000000000000000000000000000000000000000' && 
         /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Get contract addresses with error handling
 * Returns null if addresses are invalid
 */
export const getSafeContractAddresses = () => {
  try {
    return getContractAddresses();
  } catch (error) {
    console.error('Failed to get contract addresses:', error);
    return null;
  }
};

/**
 * Check if current addresses match the latest deployment
 */
export const isUsingLatestContracts = () => {
  const addresses = getSafeContractAddresses();
  if (!addresses) return false;

  return addresses.VAULT_ADDRESS === LATEST_CONTRACTS.SEPOLIA.VAULT_ADDRESS &&
         addresses.CWETH_ADDRESS === LATEST_CONTRACTS.SEPOLIA.CWETH_ADDRESS;
};

/**
 * Check if using environment variable overrides
 */
export const isUsingEnvironmentOverride = () => {
  const addresses = getSafeContractAddresses();
  return addresses?.SOURCE === 'environment';
};

/**
 * Get a user-friendly message about contract addresses
 */
export const getContractStatusMessage = () => {
  const addresses = getSafeContractAddresses();
  if (!addresses) {
    return {
      status: 'error',
      message: 'Invalid contract addresses configured',
      details: 'Please check your environment variables',
      showBanner: true
    };
  }

  const isLatest = isUsingLatestContracts();
  const isEnvOverride = isUsingEnvironmentOverride();
  
  if (isLatest && !isEnvOverride) {
    return {
      status: 'success',
      message: 'Using latest contract deployment',
      details: `Vault: ${addresses.VAULT_ADDRESS.slice(0, 6)}...${addresses.VAULT_ADDRESS.slice(-4)}`,
      showBanner: false // Don't show banner for normal operation
    };
  } else if (isLatest && isEnvOverride) {
    return {
      status: 'info',
      message: 'Using latest contracts via environment override',
      details: `Environment variables match latest deployment`,
      showBanner: false // Don't show banner for intentional override
    };
  } else if (isEnvOverride) {
    return {
      status: 'warning',
      message: 'Using environment variable overrides',
      details: `Custom addresses via .env file - may be older deployment`,
      showBanner: true
    };
  } else {
    return {
      status: 'warning',
      message: 'Using different contract addresses',
      details: 'This might be an older deployment or custom configuration',
      showBanner: true
    };
  }
};

/**
 * Clear cached data for old contract addresses
 * Call this when contract addresses change
 */
export const clearContractCache = () => {
  // Clear localStorage items that might be tied to old addresses
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('fhe_master_decryption_') ||
      key.includes('encrypted_shares_') ||
      key.includes('encrypted_balance_') ||
      key.includes('encrypted_tvl_')
    )) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log(`Cleared ${keysToRemove.length} cached items for contract address change`);
};

/**
 * Hook to get contract addresses with validation
 */
export const useContractAddresses = () => {
  const addresses = getSafeContractAddresses();
  const status = getContractStatusMessage();
  const isLatest = isUsingLatestContracts();
  const isEnvOverride = isUsingEnvironmentOverride();
  
  return {
    addresses,
    status,
    isLatest,
    isEnvOverride,
    isValid: !!addresses,
    clearCache: clearContractCache,
  };
};
