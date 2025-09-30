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
}

export default function PositionList({ suppliedBalance: propSuppliedBalance, hasSupplied: propHasSupplied, isDecrypted: propIsDecrypted, onTransactionSuccess }: PositionListProps = {}) {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Your Supply Positions ({positions.length})
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadSupplyPositions}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </Box>

      {positions.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> Positions show your aggregated supply per asset. 
            The vault combines all your supplies into a single share balance. 
            You can withdraw from your total position using the withdraw button.
          </Typography>
        </Alert>
      )}
      
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Asset</TableCell>
              <TableCell>APY</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((position, index) => (
              <TableRow key={position.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountBalance />
                    <Typography variant="body2">{position.asset}</Typography>
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
                  <Typography variant="body2" color="text.secondary">
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
                  >
                    Withdraw
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
