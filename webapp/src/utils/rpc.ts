/**
 * RPC Configuration Utility
 * Provides fallback RPC endpoints for better reliability
 */

export const SEPOLIA_RPC_URLS = [
  // Primary: Environment variable (if set) - should contain your Infura or Alchemy URL
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  
  // Fallback: Only use reliable providers with API keys
  // These should be set in .env.local file
  process.env.NEXT_PUBLIC_INFURA_RPC_URL,
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL,
  
  // Last resort: Generic endpoints (less reliable)
  'https://rpc.sepolia.org',
  'https://sepolia.drpc.org',
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
