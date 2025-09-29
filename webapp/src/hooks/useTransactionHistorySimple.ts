import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

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

  // Mock data for demonstration
  const mockTransactions: TransactionHistoryItem[] = [
    {
      id: '1',
      txHash: '0x1234567890abcdef1234567890abcdef12345678',
      blockNumber: 12345678,
      eventType: 'Supply',
      assets: [
        {
          token: 'cWETH',
          amount: '------',
          vault: '0x0ffD747aB5BC49F4b740b2Def06496444af7749a'
        }
      ],
      apy: '5%',
      timestamp: Date.now() - 86400000,
      date: new Date(Date.now() - 86400000).toLocaleDateString(),
      status: 'Success',
      explorerUrl: 'https://sepolia.etherscan.io/tx/0x1234567890abcdef1234567890abcdef12345678'
    }
  ];

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTransactions(mockTransactions);
    } catch (err) {
      setError('Failed to load transaction history');
      console.error('Error loading transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

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
