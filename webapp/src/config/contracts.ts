import { getSafeContractAddresses } from './contractConfig';

// Legacy export for backward compatibility
export const CONTRACT_ADDRESSES = (() => {
  const addresses = getSafeContractAddresses();
  return {
    CWETH: addresses?.CWETH_ADDRESS || '0x0000000000000000000000000000000000000000',
    VAULT: addresses?.VAULT_ADDRESS || '0x0000000000000000000000000000000000000000',
  };
})();

export const NETWORK_CONFIG = {
  SEPOLIA: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID',
  },
} as const;
