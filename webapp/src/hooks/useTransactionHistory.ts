import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { getSafeContractAddresses } from '../config/contractConfig';

export interface TransactionHistoryItem {
  id: string;
  txHash: string;
  blockNumber: number;
  eventType: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay' | 'Liquidation';
  assets: {
    token: string;
    amount: string;
    vault?: string;
  }[];
  apy?: string;
  timestamp: number;
  date: string;
  status: 'Success' | 'Pending' | 'Failed';
  explorerUrl: string;
}

export interface TransactionHistoryFilters {
  eventType: string;
  asset: string;
  dateFrom: string;
  dateTo: string;
  status: string;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeFields: string[];
  dateRange: {
    from: string;
    to: string;
  };
}

const useTransactionHistory = () => {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionHistoryItem[]>([]);
  const [filters, setFilters] = useState<TransactionHistoryFilters>({
    eventType: '',
    asset: '',
    dateFrom: '',
    dateTo: '',
    status: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No mock data - all data comes from on-chain events

  // Load transactions from on-chain events
  const loadTransactions = useCallback(async () => {
    if (!address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Query blockchain events for ConfidentialSupply and ConfidentialWithdraw
      const contractAddresses = getSafeContractAddresses();
      const VAULT_ADDRESS = contractAddresses?.VAULT_ADDRESS;
      const CWETH_ADDRESS = contractAddresses?.CWETH_ADDRESS;
      
      if (!VAULT_ADDRESS || !CWETH_ADDRESS) {
        setError('Contract addresses not configured or invalid');
        return;
      }
      
      // Get recent blocks to search for events
      const provider = new ethers.BrowserProvider(window.ethereum);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Search last 1000 blocks
      
      // Get ConfidentialSupply events
      const supplyFilter = {
        address: VAULT_ADDRESS,
        topics: [
          ethers.id("ConfidentialSupply(address)") // event signature
        ]
      };
      
      const supplyLogs = await provider.getLogs({
        ...supplyFilter,
        fromBlock,
        toBlock: currentBlock
      });
      
      // Get ConfidentialWithdraw events
      const withdrawFilter = {
        address: VAULT_ADDRESS,
        topics: [
          ethers.id("ConfidentialWithdraw(address)") // event signature
        ]
      };
      
      const withdrawLogs = await provider.getLogs({
        ...withdrawFilter,
        fromBlock,
        toBlock: currentBlock
      });
      
      // Process events into transaction history items
      const transactionItems: TransactionHistoryItem[] = [];
      
      // Process supply events
      for (const log of supplyLogs) {
        if (log.topics[1]) {
          // Extract user address from topic (topics are 32 bytes, addresses are 20 bytes)
          const userAddress = ethers.getAddress("0x" + log.topics[1].slice(-40));
          
          if (userAddress.toLowerCase() === address.toLowerCase()) {
            const block = await provider.getBlock(log.blockNumber);
            transactionItems.push({
              id: log.transactionHash,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              eventType: 'Supply',
              assets: [{
                token: 'cWETH',
                amount: '••••••••', // Encrypted amount
                vault: VAULT_ADDRESS
              }],
              apy: '0.00%', // Placeholder
              timestamp: block!.timestamp,
              date: new Date(block!.timestamp * 1000).toISOString(),
              status: 'Success',
              explorerUrl: `https://sepolia.etherscan.io/tx/${log.transactionHash}`
            });
          }
        }
      }
      
      // Process withdraw events
      for (const log of withdrawLogs) {
        if (log.topics[1]) {
          // Extract user address from topic (topics are 32 bytes, addresses are 20 bytes)
          const userAddress = ethers.getAddress("0x" + log.topics[1].slice(-40));
          
          if (userAddress.toLowerCase() === address.toLowerCase()) {
            const block = await provider.getBlock(log.blockNumber);
            transactionItems.push({
              id: log.transactionHash,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              eventType: 'Withdraw',
              assets: [{
                token: 'cWETH',
                amount: '••••••••', // Encrypted amount
                vault: VAULT_ADDRESS
              }],
              apy: '0.00%', // Placeholder
              timestamp: block!.timestamp,
              date: new Date(block!.timestamp * 1000).toISOString(),
              status: 'Success',
              explorerUrl: `https://sepolia.etherscan.io/tx/${log.transactionHash}`
            });
          }
        }
      }
      
      // Sort by date (newest first)
      transactionItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setTransactions(transactionItems);
    } catch (err) {
      setError('Failed to load transaction history');
      console.error('Error loading transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Load transactions when component mounts or address changes
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...transactions];

    if (filters.eventType) {
      filtered = filtered.filter(tx => tx.eventType === filters.eventType);
    }
    
    if (filters.asset) {
      filtered = filtered.filter(tx => 
        tx.assets.some(asset => asset.token.toLowerCase().includes(filters.asset.toLowerCase()))
      );
    }
    
    if (filters.status) {
      filtered = filtered.filter(tx => tx.status === filters.status);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.txHash.toLowerCase().includes(term) ||
        tx.eventType.toLowerCase().includes(term) ||
        tx.assets.some(asset => asset.token.toLowerCase().includes(term)) ||
        tx.status.toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, filters, searchTerm]);

  // Export functions
  const exportToCSV = useCallback((exportOptions: ExportOptions) => {
    const headers = [
      'Transaction Hash', 'Block Number', 'Event Type', 'Asset(s)', 
      'Amount(s)', 'APY', 'Vault', 'Date', 'Status', 'Explorer URL'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(tx => [
        tx.txHash, tx.blockNumber, tx.eventType,
        tx.assets.map(a => a.token).join(';'),
        tx.assets.map(a => a.amount).join(';'),
        tx.apy || '', tx.assets.map(a => a.vault || '').join(';'),
        tx.date, tx.status, tx.explorerUrl
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transaction-history-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredTransactions]);

  const exportToJSON = useCallback((exportOptions: ExportOptions) => {
    const jsonData = {
      exportDate: new Date().toISOString(),
      totalTransactions: filteredTransactions.length,
      filters: filters,
      transactions: filteredTransactions
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transaction-history-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredTransactions, filters]);

  const clearFilters = useCallback(() => {
    setFilters({
      eventType: '',
      asset: '',
      dateFrom: '',
      dateTo: '',
      status: ''
    });
    setSearchTerm('');
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  return {
    transactions: filteredTransactions,
    allTransactions: transactions,
    filters,
    setFilters,
    searchTerm,
    setSearchTerm,
    isLoading,
    error,
    loadTransactions,
    exportToCSV,
    exportToJSON,
    clearFilters,
    totalTransactions: transactions.length,
    filteredCount: filteredTransactions.length
  };
};

export default useTransactionHistory;
