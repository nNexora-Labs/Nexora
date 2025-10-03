/**
 * RPC Configuration Utility
 * Provides fallback RPC endpoints for better reliability
 */

export const SEPOLIA_RPC_URLS = [
  // Primary: Environment variable (if set)
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  
  // Free public endpoints (no API key required)
  'https://ethereum-sepolia.publicnode.com',
  'https://sepolia.gateway.tenderly.co',
  'https://rpc.sepolia.org',
  'https://sepolia.drpc.org',
  'https://sepolia.blockpi.network/v1/rpc/public',
  'https://sepolia.meowrpc.com',
  'https://sepolia.api.onfinality.io/public',
  'https://sepolia.public.blastapi.io',
  
  // Fallback: Infura key (if not rate limited)
  'https://sepolia.infura.io/v3/edae100994ea476180577c9218370251',
];

/**
 * Get the best available RPC URL
 * Returns the first non-undefined URL from the list
 */
export const getSepoliaRpcUrl = (): string => {
  const validUrl = SEPOLIA_RPC_URLS.find(url => url && url.trim() !== '');
  
  if (!validUrl) {
    console.error('❌ No valid Sepolia RPC URL found');
    throw new Error('No valid Sepolia RPC URL configured');
  }
  
  console.log('🌐 Using Sepolia RPC:', validUrl);
  return validUrl;
};

/**
 * Get multiple RPC URLs for fallback scenarios
 */
export const getSepoliaRpcUrls = (): string[] => {
  return SEPOLIA_RPC_URLS.filter((url): url is string => url !== undefined && url.trim() !== '');
};
