'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'wagmi/chains';
import { CONTRACT_ADDRESSES } from '../config/contracts';

export const useGasFee = () => {
  const { address, isConnected } = useAccount();
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estimated gas limits for different operations
  const GAS_LIMITS = {
    SUPPLY: BigInt(800000), // Supply operation with FHE encryption
    WITHDRAW: BigInt(800000), // Withdraw operation with FHE encryption
    SET_OPERATOR: BigInt(100000), // Setting operator permission
  };

  const fetchGasPrice = async () => {
    if (!isConnected || !address) return;

    setIsLoading(true);
    setError(null);

    try {
      // Create a public client to fetch gas price
      
      const rpcUrls = [
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID'
      ];
      
      let publicClient;
      let lastError;
      
      for (const rpcUrl of rpcUrls) {
        try {
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          
          // Test the connection
          await publicClient.getBlockNumber();
          console.log(`✅ Connected to ${rpcUrl} for gas price`);
          break;
        } catch (error) {
          console.log(`❌ Failed to connect to ${rpcUrl}:`, (error as Error).message);
          lastError = error;
          continue;
        }
      }
      
      if (!publicClient) {
        throw lastError || new Error('Failed to connect to any RPC endpoint');
      }

      // Get current gas price
      const gasPriceWei = await publicClient.getGasPrice();
      setGasPrice(gasPriceWei);
      
      console.log('🔍 Gas price fetched successfully:', {
        gasPriceWei: gasPriceWei.toString(),
        gasPriceHex: gasPriceWei.toString(16),
        gweiValue: Number(gasPriceWei) / 1e9
      });
      
    } catch (err) {
      console.error('❌ Failed to fetch gas price:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch gas price');
      
      // Try to get gas price from a different method as fallback
      try {
        console.log('🔄 Trying alternative gas price method...');
        
        const fallbackClient = createPublicClient({
          chain: sepolia,
          transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID'),
        });
        
        // Try getting gas price from latest block
        const block = await fallbackClient.getBlock();
        if (block.baseFeePerGas) {
          setGasPrice(block.baseFeePerGas);
          console.log('✅ Fallback gas price from block:', block.baseFeePerGas.toString());
        }
      } catch (fallbackErr) {
        console.error('❌ Fallback gas price fetch also failed:', fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate network fee for a specific operation
  const calculateNetworkFee = (operation: keyof typeof GAS_LIMITS): string => {
    if (!gasPrice) return '0.000000 ETH';
    
    const gasLimit = GAS_LIMITS[operation];
    const totalGasCost = gasPrice * gasLimit;
    
    // Convert from wei to ETH
    const ethValue = Number(totalGasCost) / 1e18;
    
    return `${ethValue.toFixed(6)} ETH`;
  };

  // Get gas price in Gwei for display
  const getGasPriceInGwei = (): string => {
    if (!gasPrice) {
      console.log('🔍 No gas price available:', { gasPrice, isLoading, error });
      return '0.00';
    }
    
    const gweiValue = Number(gasPrice) / 1e9;
    console.log('🔍 Gas price conversion:', { 
      gasPriceWei: gasPrice.toString(), 
      gweiValue, 
      formatted: `${gweiValue.toFixed(2)} Gwei` 
    });
    return `${gweiValue.toFixed(2)} Gwei`;
  };

  // Fetch gas price when connected
  useEffect(() => {
    if (isConnected && address) {
      fetchGasPrice();
      
      // Refresh gas price every 30 seconds
      const interval = setInterval(fetchGasPrice, 30000);
      
      return () => clearInterval(interval);
    } else {
      setGasPrice(null);
      setError(null);
    }
  }, [isConnected, address]);

  return {
    gasPrice,
    isLoading,
    error,
    calculateNetworkFee,
    getGasPriceInGwei,
    refetchGasPrice: fetchGasPrice,
  };
};
