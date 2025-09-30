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
import { useMasterDecryption } from '../hooks/useMasterDecryption';
import { useGasFee } from '../hooks/useGasFee';

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

interface WithdrawFormProps {
  onTransactionSuccess?: () => Promise<void>;
  suppliedBalance?: string;
  hasSupplied?: boolean;
  isDecrypted?: boolean;
}

export default function WithdrawForm({ onTransactionSuccess, suppliedBalance: propSuppliedBalance, hasSupplied: propHasSupplied, isDecrypted: propIsDecrypted }: WithdrawFormProps = {}) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  // Master decryption hook
  const { masterSignature, getMasterSignature } = useMasterDecryption();
  
  // Gas fee hook for real network fees
  const { calculateNetworkFee, isLoading: isGasLoading, getGasPriceInGwei } = useGasFee();
  
  // Use props for supplied balance instead of hook
  const suppliedBalance = propSuppliedBalance || '••••••••';
  const hasSupplied = propHasSupplied || false;
  const isDecrypted = propIsDecrypted || false;
  
  // Handle transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Withdraw transaction successful!');
      setShowSuccess(true);
      setAmount('');
      setIsValidAmount(false);
      
      // Call onTransactionSuccess to refresh balances in Dashboard
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    }
  }, [isSuccess, hash, onTransactionSuccess]);

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Contract address
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    console.log('🔍 WithdrawForm validation:', { amount, hasSupplied, suppliedBalance });
    
    // Clear previous error
    setBalanceError(null);
    
    // Check if we have a valid amount and the user has supplied
    if (amount && hasSupplied) {
      const amountWei = parseFloat(amount);
      
      // If balance is decrypted (contains 'ETH'), validate against actual balance
      if (suppliedBalance.includes('ETH')) {
        const suppliedWei = parseFloat(suppliedBalance.replace(' ETH', ''));
        
        // Calculate total cost (no protocol fee, no network fee)
        const protocolFee = 0.000000; // No protocol fee
        const totalCost = amountWei + protocolFee; // Only amount + protocol fee
        
        const isValid = amountWei > 0 && totalCost <= suppliedWei;
        setIsValidAmount(isValid);
        
          if (totalCost > suppliedWei) {
            setBalanceError(`Insufficient balance! You have ${suppliedWei.toFixed(4)} cWETH available, but need ${totalCost.toFixed(6)} cWETH.`);
          }
        
        console.log('🔍 Decrypted balance validation:', { 
          amountWei, 
          suppliedWei, 
          protocolFee, 
          totalCost, 
          isValid 
        });
      } else {
        // If balance is encrypted (••••••••), just check if amount is positive
        // User can enter any positive amount since we can't decrypt to validate
        const isValid = amountWei > 0;
        setIsValidAmount(isValid);
        console.log('🔍 Encrypted balance validation:', { amountWei, isValid });
      }
    } else {
      setIsValidAmount(false);
      if (amount && !hasSupplied) {
        setBalanceError('No supplied balance available');
      }
      console.log('🔍 Validation failed:', { hasAmount: !!amount, hasSupplied });
    }
  }, [amount, suppliedBalance, hasSupplied, calculateNetworkFee]);

  // Calculate total cost including real network fee
  const calculateTotalCost = (): string => {
    if (!amount) return '0.000000 cWETH';
    
    const amountValue = parseFloat(amount);
    const protocolFee = 0.000000; // No protocol fee
    
    const total = amountValue + protocolFee;
    return `${total.toFixed(6)} cWETH`;
  };

  const handleMaxAmount = () => {
    // If balance contains 'ETH', use the actual amount (regardless of isDecrypted flag)
    if (suppliedBalance.includes('ETH')) {
      const balanceWei = parseFloat(suppliedBalance.replace(' ETH', ''));
      setAmount(balanceWei.toString());
      console.log('🔍 MAX button: Set amount to supplied balance:', balanceWei);
    } else if (hasSupplied) {
      // If we have supplied balance but it's encrypted (••••••••), we can't set exact amount
      console.log('🔍 MAX button: Balance is encrypted, cannot set exact amount');
    } else {
      // No supplied balance available
      console.log('🔍 MAX button: No supplied balance available');
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
    <Box sx={{ maxWidth: 350, mx: 'auto', p: 1, position: 'relative' }}>
      {/* Close Button */}
      <Button
        onClick={() => {
          // Close the dialog by triggering a custom event or using parent component logic
          const event = new CustomEvent('closeWithdrawDialog');
          window.dispatchEvent(event);
        }}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          minWidth: 'auto',
          p: 0.5,
          borderRadius: '50%',
          color: 'text.secondary',
          '&:hover': {
            background: 'action.hover'
          }
        }}
      >
        ✕
      </Button>
      
      {/* Header */}
      <Box sx={{ mb: 1.5, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 1, fontWeight: 600, fontFamily: 'sans-serif' }}>
          Withdraw cWETH
        </Typography>
      </Box>

      {showSuccess && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 1.5, 
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            opacity: 0,
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { opacity: 0, transform: 'translateY(-20px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            Successfully withdrew {amount} ETH!
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 1.5, 
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            opacity: 0,
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { opacity: 0, transform: 'translateY(-20px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            Transaction failed: {error.message}
          </Typography>
        </Alert>
      )}

      {balanceError && (
        <Alert 
          severity="warning" 
          sx={{ 
            mb: 1.5, 
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            opacity: 0,
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { opacity: 0, transform: 'translateY(-20px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            {balanceError}
          </Typography>
        </Alert>
      )}

      {/* Amount Input */}
      <Box sx={{ mb: 1 }}>
        <TextField
          fullWidth
          label="Withdrawal Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending || isConfirming}
          placeholder="0.00"
          InputProps={{
            startAdornment: (
              <Typography variant="body1" sx={{ mr: 1, color: 'text.secondary', fontFamily: 'sans-serif' }}>
                cWETH
              </Typography>
            ),
            endAdornment: (
              <Button
                size="small"
                variant="outlined"
                onClick={handleMaxAmount}
                disabled={isPending || isConfirming || !hasSupplied}
                sx={{ 
                  ml: 1, 
                  minWidth: 'auto', 
                  px: 1.5,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  borderRadius: 1
                }}
              >
                MAX
              </Button>
            ),
          }}
          helperText={
            hasSupplied 
              ? suppliedBalance.includes('ETH')
                ? `Available: ${suppliedBalance.replace(' ETH', ' cWETH')}`
                : `Available: ${suppliedBalance}`
              : 'No supplied balance available'
          }
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              fontSize: '1rem'
            },
            // Hide the number input spinners
            '& input[type=number]': {
              '-moz-appearance': 'textfield',
            },
            '& input[type=number]::-webkit-outer-spin-button': {
              '-webkit-appearance': 'none',
              margin: 0,
            },
            '& input[type=number]::-webkit-inner-spin-button': {
              '-webkit-appearance': 'none',
              margin: 0,
            }
          }}
        />
      </Box>

      {/* Transaction Summary */}
      <Box sx={{ 
        mb: 1.5, 
        p: 1, 
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px',
        backgroundColor: 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 0.5, fontFamily: 'sans-serif' }}>
          Summary
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>Amount</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'sans-serif' }}>
            {amount ? `${parseFloat(amount).toFixed(4)} cWETH` : '0.0000 cWETH'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>Protocol Fee</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'sans-serif' }}>
            0.000000 cWETH
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>Network Fee</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'sans-serif' }}>
            {isGasLoading ? 'Loading...' : calculateNetworkFee('WITHDRAW')}
          </Typography>
        </Box>
        
        <Divider sx={{ my: 0.5 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>Total</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>
            {isGasLoading ? 'Loading...' : calculateTotalCost()}
          </Typography>
        </Box>
      </Box>

      {/* Submit Button */}
      <Button
        fullWidth
        variant="contained"
        size="medium"
        onClick={handleWithdraw}
        disabled={!isValidAmount || isPending || isConfirming || !hasSupplied}
        startIcon={
          isPending || isConfirming ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <Send />
          )
        }
        sx={{ 
          py: 1.2,
          borderRadius: '4px',
          fontSize: '0.95rem',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 2,
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            boxShadow: 4,
            transform: 'translateY(-1px)',
            scale: 1.02
          },
          '&:active': {
            transform: 'translateY(1px) scale(0.98)',
            boxShadow: 1,
            transition: 'all 0.1s ease-in-out'
          },
          '&:focus': {
            outline: 'none',
            boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.3)'
          },
          '&:disabled': {
            opacity: 0.6,
            transform: 'none',
            scale: 1,
            boxShadow: 2
          }
        }}
      >
        {isPending ? 'Withdrawing...' : isConfirming ? 'Confirming...' : 'Withdraw'}
      </Button>

      {/* Transaction Hash */}
      {hash && (
        <Box sx={{ 
          mt: 1, 
          p: 0.5, 
          backgroundColor: 'action.hover', 
          borderRadius: 1,
          textAlign: 'center',
          transition: 'all 0.2s ease-in-out',
          opacity: 0,
          animation: 'fadeIn 0.3s ease-in-out forwards',
          '@keyframes fadeIn': {
            '0%': { opacity: 0, transform: 'translateY(10px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' }
          }
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>
            {hash?.slice(0, 10)}...{hash?.slice(-8)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
