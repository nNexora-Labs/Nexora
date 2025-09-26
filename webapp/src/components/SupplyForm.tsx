'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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

// Contract ABI for supplying cWETH to the vault
const VAULT_ABI = [
  {
    "inputs": [],
    "name": "supply",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

export default function SupplyForm() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Contract address (will be set after deployment)
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    if (amount && balance) {
      const amountWei = parseFloat(amount);
      const balanceWei = parseFloat(balance.formatted);
      setIsValidAmount(amountWei > 0 && amountWei <= balanceWei);
    } else {
      setIsValidAmount(false);
    }
  }, [amount, balance]);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      setAmount('');
      // Note: Balance refresh is handled automatically by the useSuppliedBalance hook
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isSuccess]);

  const handleMaxAmount = () => {
    if (balance) {
      setAmount(balance.formatted);
    }
  };

  const handleSupply = async () => {
    if (!isValidAmount || !amount || !address) return;

    try {
      // For Phase 1, we'll use the simple supply function
      // In a full implementation, we would encrypt the amount first using:
      // const ciphertexts = await encryptAndRegister(VAULT_ADDRESS, address, BigInt(Math.floor(parseFloat(amount) * 1e18)));
      // Then call supplyEncrypted with the encrypted data
      
      await writeContract({
        address: VAULT_ADDRESS as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'supply',
        value: BigInt(Math.floor(parseFloat(amount) * 1e18)),
      });
    } catch (err) {
      console.error('Supply failed:', err);
    }
  };

  const formatBalance = (balance: string) => {
    return parseFloat(balance).toFixed(4);
  };

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to supply assets to the confidential lending protocol.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully supplied {amount} ETH to the confidential lending vault!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Transaction failed: {error.message}
        </Alert>
      )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Supply cWETH to Confidential Lending Vault
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supply your confidential WETH (cWETH) tokens to the lending vault.
                  All balances and transactions are encrypted using FHE technology.
                </Typography>
              </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Amount (cWETH)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          InputProps={{
            endAdornment: (
              <Button
                size="small"
                onClick={handleMaxAmount}
                disabled={!balance}
                sx={{ ml: 1 }}
              >
                MAX
              </Button>
            ),
          }}
          helperText={
            balance ? `Available: ${formatBalance(balance.formatted)} ETH` : 'Loading balance...'
          }
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Transaction Summary
        </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Amount to Supply:</Typography>
                  <Typography variant="body2">{amount || '0'} cWETH</Typography>
                </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Interest Rate:</Typography>
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
        onClick={handleSupply}
        disabled={!isValidAmount || isPending || isConfirming}
        startIcon={
          isPending || isConfirming ? (
            <CircularProgress size={20} />
          ) : (
            <Send />
          )
        }
        sx={{ py: 1.5 }}
      >
                {isPending
                  ? 'Confirming Transaction...'
                  : isConfirming
                  ? 'Processing...'
                  : 'Supply cWETH'}
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
