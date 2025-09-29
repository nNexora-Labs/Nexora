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
import { useMasterDecryption } from '../hooks/useMasterDecryption';

// Contract ABI for withdraw function
const VAULT_ABI = [
  {
    "inputs": [
      {
        "internalType": "externalEuint64",
        "name": "encryptedAmount",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
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
  
  // Master decryption hook
  const { masterSignature } = useMasterDecryption();
  
  const { suppliedBalance, isDecrypting, hasSupplied, refetchEncryptedShares } = useSuppliedBalance(masterSignature);

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
      refetchEncryptedShares(); // Refresh supplied balance
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isSuccess, refetchEncryptedShares]);

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

      // Call the contract's withdraw function with encrypted amount and proof
      await writeContract({
        address: VAULT_ADDRESS as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [ciphertexts.ciphertext, ciphertexts.proof],
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
    <Box sx={{ maxWidth: 500, mx: 'auto' }}>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully withdrew ETH!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Transaction failed: {error.message}
        </Alert>
      )}

        <TextField
          fullWidth
          label="Amount"
          size="small"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending || isConfirming}
          InputProps={{
            endAdornment: (
              <Button
                size="small"
                onClick={handleMaxAmount}
                disabled={isPending || isConfirming || !hasSupplied}
                sx={{ ml: 1, minWidth: 'auto', px: 1 }}
              >
                MAX
              </Button>
            ),
          }}
          helperText={
            suppliedBalance !== 'Encrypted' 
              ? `Balance: ${suppliedBalance}` 
              : 'Loading balance...'
          }
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
          <Typography variant="body2">APY:</Typography>
          <Typography variant="body2">5%</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2">Status:</Typography>
          <Typography variant="body2" color="text.secondary">
            {isPending ? 'Pending...' : isConfirming ? 'Confirming...' : 'Ready'}
          </Typography>
        </Box>
      </Box>

      <Button
        fullWidth
        variant="contained"
        size="medium"
        onClick={handleWithdraw}
        disabled={!isValidAmount || isPending || isConfirming || !hasSupplied}
        startIcon={isPending || isConfirming ? <CircularProgress size={20} /> : <Send />}
        sx={{ py: 1 }}
      >
        {isPending ? 'Withdrawing...' : isConfirming ? 'Confirming...' : 'Withdraw'}
      </Button>

      {hash && (
        <Box sx={{ mt: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {hash?.slice(0, 10)}...{hash?.slice(-8)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
