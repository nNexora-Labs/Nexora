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
  IconButton,
  Tooltip,
} from '@mui/material';
import { SwapHoriz, AccountBalance, Refresh } from '@mui/icons-material';

// Contract ABI for ConfidentialWETH wrap function
const CWETH_ABI = [
  {
    "inputs": [],
    "name": "wrap",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getEncryptedBalance",
    "outputs": [
      {
        "internalType": "euint32",
        "name": "",
        "type": "euint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export default function ETHToCWETHConverter() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cWETHBalance, setCWETHBalance] = useState<string>('Encrypted');

  // Contract address
  const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';

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
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isSuccess]);

  const handleMaxAmount = () => {
    if (balance) {
      setAmount(balance.formatted);
    }
  };

  const handleWrap = async () => {
    if (!isValidAmount || !amount || !address) return;

    try {
      await writeContract({
        address: CWETH_ADDRESS as `0x${string}`,
        abi: CWETH_ABI,
        functionName: 'wrap',
        value: BigInt(Math.floor(parseFloat(amount) * 1e18)),
      });
    } catch (err) {
      console.error('Wrap failed:', err);
    }
  };

  const formatBalance = (balance: string) => {
    return parseFloat(balance).toFixed(4);
  };

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to convert ETH to confidential WETH (cWETH).
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto' }}>
      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully converted {amount} ETH to confidential WETH (cWETH)!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Conversion failed: {error.message}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <SwapHoriz sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">
              ETH → cWETH Converter
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Convert your ETH to confidential WETH (cWETH) tokens. 
            Your balance will be encrypted and private.
          </Typography>

          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Amount (ETH)"
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
              Conversion Summary
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">ETH Amount:</Typography>
              <Typography variant="body2">{amount || '0'} ETH</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">cWETH Amount:</Typography>
              <Typography variant="body2">{amount || '0'} cWETH</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Status:</Typography>
              <Chip
                label="Confidential"
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
            onClick={handleWrap}
            disabled={!isValidAmount || isPending || isConfirming}
            startIcon={
              isPending || isConfirming ? (
                <CircularProgress size={20} />
              ) : (
                <SwapHoriz />
              )
            }
            sx={{ py: 1.5 }}
          >
            {isPending
              ? 'Confirming Transaction...'
              : isConfirming
              ? 'Converting...'
              : 'Convert ETH → cWETH'}
          </Button>

          {hash && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Transaction Hash: {hash.slice(0, 10)}...{hash.slice(-8)}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* cWETH Balance Display */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Your cWETH Balance
              </Typography>
              <Typography variant="h6" color="primary">
                {cWETHBalance}
              </Typography>
            </Box>
            <Tooltip title="Refresh cWETH Balance">
              <IconButton onClick={() => setCWETHBalance('Encrypted')}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Your confidential WETH balance is encrypted and private
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
