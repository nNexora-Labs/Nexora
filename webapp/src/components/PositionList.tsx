'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
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
} from '@mui/material';
import { Send, AccountBalance } from '@mui/icons-material';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
import { useMasterDecryption } from '../hooks/useMasterDecryption';
import WithdrawForm from './WithdrawForm';

export default function PositionList() {
  const { address, isConnected } = useAccount();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  
  // Master decryption hook
  const { masterSignature } = useMasterDecryption();
  
  const { suppliedBalance, isDecrypting, hasSupplied } = useSuppliedBalance(masterSignature);

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to view your positions.
      </Alert>
    );
  }

  if (!hasSupplied) {
    return (
      <Alert severity="info">
        No positions found. Supply some cWETH to start earning yield.
      </Alert>
    );
  }

  // Create position data from on-chain data
  const positions = [{
    id: 'cWETH-supply',
    asset: 'cWETH',
    apy: '0.00%', // Placeholder
    amount: suppliedBalance,
    status: 'Active',
    vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS
  }];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Your Positions
      </Typography>
      
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
              <TableRow key={index}>
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Withdraw cWETH</DialogTitle>
        <DialogContent>
          <WithdrawForm />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
