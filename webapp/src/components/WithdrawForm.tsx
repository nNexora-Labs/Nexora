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
import { getFHEInstance } from '../utils/fhe';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
import { useMasterDecryption } from '../hooks/useMasterDecryption';

// Contract ABI for withdraw function
const VAULT_ABI = [
  {
    "inputs": [
      {
        "internalType": "externalEuint64",
        "name": "encryptedAmount",
        "type": "bytes32"
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
  
  // Handle transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Withdraw transaction successful!');
      setShowSuccess(true);
      setAmount('');
      setIsValidAmount(false);
      // Refetch encrypted shares to update the balance
      refetchEncryptedShares();
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    }
  }, [isSuccess, hash, refetchEncryptedShares]);

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Contract address
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    console.log('🔍 WithdrawForm validation:', { amount, hasSupplied, suppliedBalance });
    
    // Check if we have a valid amount and the user has supplied
    if (amount && hasSupplied) {
      const amountWei = parseFloat(amount);
      
      // If balance is decrypted (contains 'ETH'), validate against actual balance
      if (suppliedBalance.includes('ETH')) {
        const suppliedWei = parseFloat(suppliedBalance.replace(' ETH', ''));
        const isValid = amountWei > 0 && amountWei <= suppliedWei;
        setIsValidAmount(isValid);
        console.log('🔍 Decrypted balance validation:', { amountWei, suppliedWei, isValid });
      } else {
        // If balance is encrypted (••••••••), just check if amount is positive
        // User can enter any positive amount since we can't decrypt to validate
        const isValid = amountWei > 0;
        setIsValidAmount(isValid);
        console.log('🔍 Encrypted balance validation:', { amountWei, isValid });
      }
    } else {
      setIsValidAmount(false);
      console.log('🔍 Validation failed:', { hasAmount: !!amount, hasSupplied });
    }
  }, [amount, suppliedBalance, hasSupplied]);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      setAmount('');
      refetchEncryptedShares(); // Refresh supplied balance
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isSuccess, refetchEncryptedShares]);

  const handleMaxAmount = () => {
    // If balance is decrypted (contains 'ETH'), use the actual amount
    if (suppliedBalance.includes('ETH')) {
      setAmount(suppliedBalance.replace(' ETH', ''));
    } else {
      // If balance is encrypted, set a reasonable default amount
      // User can adjust as needed since we can't decrypt to show exact balance
      setAmount('0.1');
    }
  };

  const handleWithdraw = async () => {
    if (!isValidAmount || !amount || !address) return;

    try {
      console.log('Starting withdraw process...');
      
      // Convert ETH to wei
      const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
      console.log('Amount in wei:', amountInWei.toString());

      // Get FHE instance (same pattern as supply form)
      const fheInstance = await getFHEInstance();
      console.log('FHE instance obtained');

      // Create encrypted input using the same pattern as supply
      console.log('Creating encrypted input for vault:', VAULT_ADDRESS, 'user:', address);
      
      const encryptedInput = await fheInstance.createEncryptedInput(
        VAULT_ADDRESS,
        address
      );
      
      // Add amount to encrypted input
      encryptedInput.add64(amountInWei);
      console.log('Added amount to encrypted input');

      // Encrypt the input
      console.log('Encrypting input (this may take a moment)...');
      const encryptedData = await encryptedInput.encrypt();
      console.log('Input encrypted successfully');

      console.log('Raw encrypted data:', encryptedData);
      console.log('Handles:', encryptedData.handles);
      console.log('Input proof:', encryptedData.inputProof);

      // Normalize the encrypted payload to match expected format
      const toHex = (v: any): `0x${string}` => {
        if (v instanceof Uint8Array) {
          return ('0x' + Array.from(v).map((b: number) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
        }
        throw new Error('Unsupported encrypted payload type');
      };
      
      // Format as bytes32 (fixed 32 bytes) for externalEuint64
      const formattedEncryptedAmount = toHex(encryptedData.handles[0]);
      const formattedInputProof = toHex(encryptedData.inputProof);
      
      console.log('Encrypted payload (normalized):', {
        encryptedAmount: formattedEncryptedAmount,
        inputProof: formattedInputProof,
      });

      // Call the contract's withdraw function with encrypted amount and proof
      console.log('Calling withdraw on vault...');
      writeContract({
        address: VAULT_ADDRESS as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [formattedEncryptedAmount, formattedInputProof],
        gas: BigInt(800000), // Increase gas limit for FHE operations
      });
      console.log('Withdraw submitted to vault...');
      
    } catch (err) {
      console.error('Withdraw failed:', err);
      
      // Check if this is an FHEVM initialization error
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('fhe') || 
            errorMessage.includes('encrypt') ||
            errorMessage.includes('instance') ||
            errorMessage.includes('vault') ||
            errorMessage.includes('contract')) {
          console.log('FHEVM vault encryption error detected:', err.message);
        }
      }
      
      throw err;
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
            hasSupplied 
              ? `Balance: ${suppliedBalance}` 
              : 'No supplied balance found'
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
