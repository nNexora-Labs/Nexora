'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Send } from '@mui/icons-material';

export default function RepayForm() {
  const { isConnected } = useAccount();
  
  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRepay = async () => {
    if (!isValidAmount || !amount) return;
    
    // TODO: Implement repay functionality
    console.log('Repay amount:', amount);
    setShowSuccess(true);
    setAmount('');
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleMaxAmount = () => {
    // TODO: Set max repayable amount
    setAmount('0.1');
  };

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to repay borrowed funds.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto' }}>
      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Repay functionality coming soon!
        </Alert>
      )}

      <TextField
        fullWidth
        label="Amount"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        size="small"
        InputProps={{
          endAdornment: (
            <Button
              size="small"
              onClick={handleMaxAmount}
              sx={{ ml: 1, minWidth: 'auto', px: 1 }}
            >
              MAX
            </Button>
          ),
        }}
        helperText="Balance: 0.0000 ETH"
      />

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Summary
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2">Amount:</Typography>
          <Typography variant="body2">{amount || '0'} ETH</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2">Interest Rate:</Typography>
          <Typography variant="body2">8%</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2">Status:</Typography>
          <Typography variant="body2" color="text.secondary">Coming Soon</Typography>
        </Box>
      </Box>

      <Button
        fullWidth
        variant="contained"
        size="medium"
        onClick={handleRepay}
        disabled={true}
        startIcon={<Send />}
        sx={{ py: 1 }}
      >
        Coming Soon
      </Button>
    </Box>
  );
}
