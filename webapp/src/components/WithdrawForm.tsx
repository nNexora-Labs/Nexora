'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
} from '@mui/material';
import { Send, AccountBalance } from '@mui/icons-material';
import { encryptAndRegister } from '../utils/fhe';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';

// Contract ABI for withdraw function
const VAULT_ABI = [
  {
    "inputs": [],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export default function WithdrawForm() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { suppliedBalance, isDecrypting, hasSupplied, refetchSuppliedBalance } = useSuppliedBalance();

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Contract address
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    if (amount && suppliedBalance !== 'Encrypted') {
      const amountWei = parseFloat(amount);
      const suppliedWei = parseFloat(suppliedBalance.replace(' ETH', ''));
      setIsValidAmount(amountWei > 0 && amountWei <= suppliedWei);
    } else {
      setIsValidAmount(false);
    }
  }, [amount, suppliedBalance]);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      setAmount('');
      refetchSuppliedBalance(); // Refresh supplied balance
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isSuccess, refetchSuppliedBalance]);

  const handleMaxAmount = () => {
    if (suppliedBalance !== 'Encrypted') {
      setAmount(suppliedBalance.replace(' ETH', ''));
    }
  };

  const handleWithdraw = async () => {
    if (!isValidAmount || !amount || !address) return;

    try {
      // Convert ETH to wei
      const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));

      // Encrypt the amount using Zama Relayer SDK
      const ciphertexts = await encryptAndRegister(
        VAULT_ADDRESS,
        address,
        amountInWei
      );

      // Call the contract's withdraw function
      await writeContract({
        address: VAULT_ADDRESS as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'withdraw',
      });
    } catch (err) {
      console.error('Withdraw failed:', err);
    }
  };

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to withdraw ETH from the confidential lending vault.
      </Alert>
    );
  }


  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2" gutterBottom>
          <strong>Withdraw Functionality Not Available</strong>
        </Typography>
        <Typography variant="body2">
          The smart contract currently only implements supply functionality (Phase 1). 
          Withdraw functionality will be added in future phases.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Your supplied balance: {suppliedBalance}
        </Typography>
      </Alert>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully withdrew {amount} ETH from the confidential lending vault!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Transaction failed: {error.message}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Withdraw ETH from Confidential Lending Vault
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Withdraw your encrypted shares from the confidential lending vault.
          All transactions are encrypted using FHE technology.
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Amount (ETH)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={true} // Disabled because withdraw function doesn't exist in smart contract
          InputProps={{
            endAdornment: (
              <Button
                size="small"
                onClick={handleMaxAmount}
                disabled={true} // Disabled because withdraw function doesn't exist in smart contract
                sx={{ ml: 1 }}
              >
                MAX
              </Button>
            ),
          }}
          helperText={
            suppliedBalance !== 'Encrypted' 
              ? `Available: ${suppliedBalance} (Withdraw coming soon)` 
              : 'Loading supplied balance...'
          }
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Transaction Summary
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Amount to Withdraw:</Typography>
          <Typography variant="body2">{amount || '0'} ETH</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Interest Earned:</Typography>
          <Typography variant="body2">5% APY</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Status:</Typography>
          <Chip
            label="Encrypted"
            size="small"
            color="primary"
            icon={<AccountBalance />}
          />
        </Box>
      </Box>

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={handleWithdraw}
        disabled={true} // Disabled because withdraw function doesn't exist in smart contract
        startIcon={<Send />}
        sx={{ py: 1.5 }}
      >
        Withdraw ETH (Coming Soon)
      </Button>

      {hash && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Transaction Hash: {hash.slice(0, 10)}...{hash.slice(-8)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
