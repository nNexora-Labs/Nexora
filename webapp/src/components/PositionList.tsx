'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { getSafeContractAddresses } from '../config/contractConfig';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Link,
} from '@mui/material';
import { Send, AccountBalance, OpenInNew, Refresh } from '@mui/icons-material';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
import { useMasterDecryption } from '../hooks/useMasterDecryption';
import WithdrawForm from './WithdrawForm';

interface SupplyPosition {
  id: string;
  asset: string;
  amount: string;
  apy: string;
  status: string;
  vault: string;
}

interface PositionListProps {
  suppliedBalance?: string;
  hasSupplied?: boolean;
  isDecrypted?: boolean;
  onTransactionSuccess?: () => Promise<void>;
  onNavigateToSupply?: () => void;
  isDarkMode?: boolean;
}

export default function PositionList({ suppliedBalance: propSuppliedBalance, hasSupplied: propHasSupplied, isDecrypted: propIsDecrypted, onTransactionSuccess, onNavigateToSupply, isDarkMode = false }: PositionListProps = {}) {
  const { address, isConnected } = useAccount();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  // Listen for close dialog event
  useEffect(() => {
    const handleCloseDialog = () => {
      setWithdrawDialogOpen(false);
    };
    
    window.addEventListener('closeWithdrawDialog', handleCloseDialog);
    
    return () => {
      window.removeEventListener('closeWithdrawDialog', handleCloseDialog);
    };
  }, []);
  const [positions, setPositions] = useState<SupplyPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Master decryption hook
  const { masterSignature, getMasterSignature } = useMasterDecryption();
  
  // Use props from Dashboard if available, otherwise use hook
  const hookData = useSuppliedBalance(masterSignature, getMasterSignature);
  const suppliedBalance = propSuppliedBalance || hookData.suppliedBalance;
  const hasSupplied = propHasSupplied !== undefined ? propHasSupplied : hookData.hasSupplied;
  // Note: Dashboard passes isDecrypted={isDecryptingSupplied} which is actually the isDecrypting flag
  const isDecrypting = propIsDecrypted !== undefined ? propIsDecrypted : hookData.isDecrypting;
  const decryptBalance = hookData.decryptBalance;

  // Auto-decrypt when balance is encrypted to verify actual balance
  useEffect(() => {
    if (isConnected && address && hasSupplied && suppliedBalance && suppliedBalance.includes('••••••••') && masterSignature && !isDecrypting) {
      console.log('🔓 Auto-decrypting balance to verify position...');
      decryptBalance();
    }
  }, [isConnected, address, hasSupplied, suppliedBalance, masterSignature, isDecrypting, decryptBalance]);

  // Load aggregated supply positions per asset
  const loadSupplyPositions = useCallback(async () => {
    if (!address || !isConnected) return;
    
    setIsLoading(true);
    
    try {
      const contractAddresses = getSafeContractAddresses();
      const VAULT_ADDRESS = contractAddresses?.VAULT_ADDRESS;
      
      if (!VAULT_ADDRESS) {
        console.error('Vault address not configured or invalid');
        return;
      }
      
      console.log('🔍 Loading supply positions - hasSupplied:', hasSupplied, 'suppliedBalance:', suppliedBalance);
      
      // SMART APPROACH: Show position only if user has actually supplied tokens
      // Check both hasSupplied flag AND actual balance
      
      // First check: Must have supplied flag
      if (!hasSupplied) {
        setPositions([]);
        console.log('🔍 No positions - user has not supplied any tokens');
        return;
      }
      
      // Second check: If balance is decrypted and zero, don't show position
      if (suppliedBalance && !suppliedBalance.includes('••••••••')) {
        const balanceValue = parseFloat(suppliedBalance.replace(' ETH', ''));
        console.log('🔍 Decrypted balance value:', balanceValue);
        if (balanceValue <= 0) {
          setPositions([]);
          console.log('🔍 No positions - decrypted balance is zero or negative:', balanceValue);
          return;
        }
      }
      
      // If we reach here, either balance is encrypted (and hasSupplied=true) or balance is positive
      console.log('✅ User has supplied tokens - showing position');
      
      // Create aggregated position data from on-chain data
      const supplyPositions: SupplyPosition[] = [{
        id: 'cWETH-supply',
        asset: 'cWETH',
        amount: suppliedBalance, // This shows the aggregated balance
        apy: '5.00%', // Fixed APY for v1
        status: 'Active',
        vault: VAULT_ADDRESS
      }];
      
      setPositions(supplyPositions);
      console.log('🔍 Loaded aggregated supply positions:', supplyPositions.length);
      
    } catch (err) {
      console.error('Failed to load supply positions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, hasSupplied, suppliedBalance]);

  // Load positions when component mounts, address changes, or balance changes
  useEffect(() => {
    loadSupplyPositions();
  }, [loadSupplyPositions]);

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to view your positions.
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <Typography>Loading positions...</Typography>
      </Box>
    );
  }

  if (isDecrypting) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <Typography>Verifying position balance...</Typography>
      </Box>
    );
  }

  if (positions.length === 0) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h6" sx={{ mb: 2, opacity: 0.7, color: isDarkMode ? 'white' : '#2c3e50' }}>
          No Supply Positions
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.6, mb: 3, color: isDarkMode ? 'white' : '#2c3e50' }}>
          Start supplying assets to earn yield
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={onNavigateToSupply}
          sx={{
            background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)',
            }
          }}
        >
          Start Supplying
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ 
          fontFamily: 'sans-serif', 
          color: isDarkMode ? 'white' : '#2c3e50', 
          fontWeight: '600' 
        }}>
          Your Supply Positions ({positions.length})
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadSupplyPositions}
          disabled={isLoading}
          sx={{
            color: isDarkMode ? 'white' : '#2c3e50',
            borderColor: isDarkMode 
              ? 'rgba(255, 255, 255, 0.3)'
              : 'rgba(44, 62, 80, 0.4)',
            '&:hover': {
              borderColor: isDarkMode 
                ? 'rgba(255, 255, 255, 0.5)'
                : 'rgba(44, 62, 80, 0.6)',
              backgroundColor: isDarkMode 
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(44, 62, 80, 0.05)'
            }
          }}
        >
          Refresh
        </Button>
      </Box>

      
      {/* Position Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {positions.map((position, index) => (
          <Card
            key={position.id}
            sx={{
              borderRadius: '4px',
              background: isDarkMode 
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(255, 255, 255, 0.8)',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 12px rgba(0, 0, 0, 0.2)'
                : '0 4px 12px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: isDarkMode 
                  ? '0 8px 24px rgba(0, 0, 0, 0.3)'
                  : '0 8px 24px rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Asset Info */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: '50%',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(44, 62, 80, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1
                  }}>
                    <img 
                      src="/assets/icons/ethereum.svg" 
                      alt="Ethereum"
                      style={{ width: '24px', height: '24px' }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ 
                      fontFamily: 'sans-serif',
                      color: isDarkMode ? 'white' : '#2c3e50',
                      fontWeight: '600',
                      fontSize: '1rem',
                      mb: 0.5
                    }}>
                      {position.asset}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      fontFamily: 'sans-serif',
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                      fontSize: '0.875rem'
                    }}>
                      Wrapped Ethereum
                    </Typography>
                  </Box>
                </Box>

                {/* APY */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'sans-serif',
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                    fontSize: '0.75rem',
                    mb: 0.5
                  }}>
                    APY
                  </Typography>
                  <Chip 
                    label={position.apy} 
                    size="small" 
                    sx={{
                      background: isDarkMode 
                        ? 'rgba(76, 175, 80, 0.2)'
                        : 'rgba(76, 175, 80, 0.1)',
                      color: isDarkMode ? '#4caf50' : '#2e7d32',
                      border: isDarkMode 
                        ? '1px solid rgba(76, 175, 80, 0.3)'
                        : '1px solid rgba(76, 175, 80, 0.2)',
                      fontWeight: '600'
                    }}
                  />
                </Box>

                {/* Amount */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'sans-serif',
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                    fontSize: '0.75rem',
                    mb: 0.5
                  }}>
                    Amount
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    fontFamily: 'sans-serif',
                    color: isDarkMode ? 'white' : '#2c3e50',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}>
                    {position.amount}
                  </Typography>
                </Box>

                {/* Status */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'sans-serif',
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                    fontSize: '0.75rem',
                    mb: 0.5
                  }}>
                    Status
                  </Typography>
                  <Chip 
                    label={position.status} 
                    size="small" 
                    sx={{
                      background: isDarkMode 
                        ? 'rgba(33, 150, 243, 0.2)'
                        : 'rgba(33, 150, 243, 0.1)',
                      color: isDarkMode ? '#2196f3' : '#1976d2',
                      border: isDarkMode 
                        ? '1px solid rgba(33, 150, 243, 0.3)'
                        : '1px solid rgba(33, 150, 243, 0.2)',
                      fontWeight: '600'
                    }}
                  />
                </Box>

                {/* Action Button */}
                <Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Send />}
                    onClick={() => setWithdrawDialogOpen(true)}
                    disabled={isDecrypting}
                    sx={{
                      color: isDarkMode ? 'white' : '#2c3e50',
                      borderColor: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.3)'
                        : 'rgba(44, 62, 80, 0.4)',
                      borderRadius: '4px',
                      textTransform: 'none',
                      fontWeight: '600',
                      px: 2,
                      py: 1,
                      '&:hover': {
                        borderColor: isDarkMode 
                          ? 'rgba(255, 255, 255, 0.5)'
                          : 'rgba(44, 62, 80, 0.6)',
                        backgroundColor: isDarkMode 
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(44, 62, 80, 0.05)',
                        transform: 'translateY(-1px)'
                      },
                      '&:disabled': {
                        opacity: 0.6,
                        cursor: 'not-allowed'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Withdraw
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Withdraw Dialog */}
      <Dialog 
        open={withdrawDialogOpen} 
        onClose={() => setWithdrawDialogOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            maxWidth: '380px',
            width: 'auto',
            borderRadius: '4px'
          }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <WithdrawForm 
            onTransactionSuccess={onTransactionSuccess}
            suppliedBalance={propSuppliedBalance}
            hasSupplied={propHasSupplied}
            isDecrypted={propIsDecrypted}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
