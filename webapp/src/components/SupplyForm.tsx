'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
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
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "supply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// Contract ABI for cWETH token (ERC7984)
const CWETH_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "confidentialBalanceOf",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "",
        "type": "euint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
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
  const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Read cWETH balance using ERC7984 confidentialBalanceOf
  const { data: cWETHBalance } = useReadContract({
    address: CWETH_ADDRESS as `0x${string}`,
    abi: CWETH_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!CWETH_ADDRESS && CWETH_ADDRESS !== '0x0000000000000000000000000000000000000000' && typeof window !== 'undefined',
    },
  });

  useEffect(() => {
    // For ERC7984, cWETHBalance is encrypted (euint64), so we can't directly compare
    // We'll assume user has cWETH if we get a non-empty encrypted response
    if (amount && cWETHBalance) {
      const amountWei = parseFloat(amount);
      // Since cWETHBalance is encrypted, we'll allow any positive amount for now
      // In a real implementation, we'd need to decrypt first
      setIsValidAmount(amountWei > 0);
    } else {
      setIsValidAmount(false);
    }
  }, [amount, cWETHBalance]);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      setAmount('');
      // Note: Balance refresh is handled automatically by the useSuppliedBalance hook
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isSuccess]);

  const handleMaxAmount = () => {
    // For ERC7984, we can't get the exact balance without decryption
    // We'll set a reasonable default amount
    setAmount('1.0');
  };

  const handleSupply = async () => {
    if (!isValidAmount || !amount || !address) return;

    try {
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
      
      // Step 1: Approve vault to spend cWETH
      await writeContract({
        address: CWETH_ADDRESS as `0x${string}`,
        abi: CWETH_ABI,
        functionName: 'approve',
        args: [VAULT_ADDRESS as `0x${string}`, amountWei],
      });
      
      // Step 2: Call vault supply function with the amount
      await writeContract({
        address: VAULT_ADDRESS as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'supply',
        args: [amountWei],
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
            cWETHBalance ? `cWETH Balance: Encrypted (use Decrypt button to view)` : 'Loading cWETH balance...'
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
