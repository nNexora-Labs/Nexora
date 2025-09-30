'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
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
  isDarkMode?: boolean;
}

export default function PositionList({ suppliedBalance: propSuppliedBalance, hasSupplied: propHasSupplied, isDecrypted: propIsDecrypted, onTransactionSuccess, isDarkMode = false }: PositionListProps = {}) {
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
  
  const { suppliedBalance, isDecrypting, hasSupplied } = useSuppliedBalance(masterSignature, getMasterSignature);

  // Load aggregated supply positions per asset
  const loadSupplyPositions = async () => {
    if (!address || !isConnected || !hasSupplied) return;
    
    setIsLoading(true);
    
    try {
      const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS;
      
      if (!VAULT_ADDRESS) {
        console.error('Vault address not configured');
        return;
      }
      
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
  };

  // Load positions when component mounts, address changes, or balance changes
  useEffect(() => {
    loadSupplyPositions();
  }, [address, isConnected, hasSupplied, suppliedBalance]);

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

  if (positions.length === 0) {
    return (
      <Alert severity="info">
        No positions found. Supply some cWETH to start earning yield.
      </Alert>
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

      
      <Card sx={{
        mb: 3,
        background: 'transparent',
        border: 'transparent',
        boxShadow: 'none'
      }}>
        <TableContainer sx={{
          background: 'transparent',
          '& .MuiTable-root': {
            background: 'transparent'
          },
          '& .MuiTableHead-root': {
            background: isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(44, 62, 80, 0.05)'
          },
          '& .MuiTableRow-root': {
            background: 'transparent',
            '&:hover': {
              background: isDarkMode 
                ? 'rgba(255, 255, 255, 0.02)'
                : 'rgba(44, 62, 80, 0.02)'
            }
          },
          '& .MuiTableCell-root': {
            borderBottom: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            color: isDarkMode ? 'white' : '#2c3e50'
          }
        }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#2c3e50' }}>Asset</TableCell>
                <TableCell sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#2c3e50' }}>APY</TableCell>
                <TableCell sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#2c3e50' }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#2c3e50' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#2c3e50' }}>Action</TableCell>
              </TableRow>
            </TableHead>
          <TableBody>
            {positions.map((position, index) => (
              <TableRow key={position.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountBalance />
                    <Typography variant="body2" sx={{ 
                      fontFamily: 'sans-serif',
                      color: isDarkMode ? 'white' : '#2c3e50'
                    }}>{position.asset}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={position.apy} 
                    size="small" 
                    color="success" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'sans-serif',
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)'
                  }}>
                    {position.amount}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={position.status} 
                    size="small" 
                    color="primary" 
                  />
                </TableCell>
                <TableCell>
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
                    Withdraw
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
      </Card>

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
