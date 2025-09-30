'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { createPublicClient, http, parseEther } from 'viem';
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { SwapHoriz, AccountBalance, SwapVert } from '@mui/icons-material';
import { useCWETHBalance } from '../hooks/useCWETHBalance';
import { useMasterDecryption } from '../hooks/useMasterDecryption';

// Contract ABI for ConfidentialWETH wrap/unwrap functions
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
        "internalType": "externalEuint64",
        "name": "amountInput",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "unwrap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "completeUnwrap",
    "outputs": [],
    "stateMutability": "nonpayable",
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
        "internalType": "euint64",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface ETHToCWETHConverterProps {
  onTransactionSuccess?: () => Promise<void>;
}

export default function ETHToCWETHConverter({ onTransactionSuccess }: ETHToCWETHConverterProps) {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Separate transaction receipts for each step
  const { isLoading: isConfirmingStep1, isSuccess: isSuccessStep1 } = useWaitForTransactionReceipt({
    hash: step1Hash,
    query: { enabled: Boolean(step1Hash) },
  });
 
  const { isLoading: isConfirmingStep2, isSuccess: isSuccessStep2 } = useWaitForTransactionReceipt({
    hash: step2Hash,
    query: { enabled: Boolean(step2Hash) },
  });

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [swapDirection, setSwapDirection] = useState<'wrap' | 'unwrap'>('wrap');
  const [unwrapStep, setUnwrapStep] = useState<'none' | 'step1' | 'step2'>('none');
  const [step1Hash, setStep1Hash] = useState<`0x${string}` | undefined>(undefined);
  const [step2Hash, setStep2Hash] = useState<`0x${string}` | undefined>(undefined);

  // Contract address
  const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';
  
  // Contract address loaded

  // Get master decryption info
  const { masterSignature, getMasterSignature } = useMasterDecryption();
  
  // Get cWETH balance and decryption info
  const { formattedBalance: cWETHBalance, hasCWETH, isDecrypted } = useCWETHBalance(masterSignature, getMasterSignature);

  useEffect(() => {
    if (amount && swapDirection === 'wrap' && ethBalance) {
      const amountWei = parseFloat(amount);
      const balanceWei = parseFloat(ethBalance.formatted);
      setIsValidAmount(amountWei > 0 && amountWei <= balanceWei);
    } else if (amount && swapDirection === 'unwrap') {
      const amountWei = parseFloat(amount);
      // For unwrap, we need to check if user has cWETH balance
      if (isDecrypted && cWETHBalance.includes('cWETH')) {
        const balanceWei = parseFloat(cWETHBalance.replace(' cWETH', ''));
        setIsValidAmount(amountWei > 0 && amountWei <= balanceWei);
      } else if (hasCWETH) {
        // If user has encrypted cWETH but it's not decrypted, allow any positive amount
        // The contract will handle the validation
        setIsValidAmount(amountWei > 0);
      } else {
        // No cWETH balance at all
        setIsValidAmount(false);
      }
    } else {
      setIsValidAmount(false);
    }
  }, [amount, ethBalance, swapDirection, isDecrypted, cWETHBalance, hasCWETH]);

  useEffect(() => {
    if (isSuccessStep2 && unwrapStep === 'step2') {
      // Both steps completed
      setShowSuccess(true);
      setAmount('');
      setUnwrapStep('none');
      setStep1Hash(undefined);
      setStep2Hash(undefined);
      setTimeout(() => setShowSuccess(false), 5000);
      
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }
    } else if (isSuccess && unwrapStep === 'none') {
      // Regular wrap transaction completed
      setShowSuccess(true);
      setAmount('');
      setTimeout(() => setShowSuccess(false), 5000);
      
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }
    }
  }, [isSuccessStep2, isSuccess, onTransactionSuccess, unwrapStep]);

  const handleMaxAmount = () => {
    if (swapDirection === 'wrap' && ethBalance) {
      setAmount(ethBalance.formatted);
    } else if (swapDirection === 'unwrap') {
      if (isDecrypted && cWETHBalance.includes('cWETH')) {
        setAmount(cWETHBalance.replace(' cWETH', ''));
      } else if (hasCWETH) {
        // If user has encrypted cWETH but it's not decrypted, set a default amount
        setAmount('0.1'); // Default amount for testing
      }
    }
  };

  const handleSwap = async () => {
    console.log('🔄 handleSwap called:', {
      isValidAmount,
      amount,
      address,
      swapDirection,
      unwrapStep
    });
    
    if (!isValidAmount || !amount || !address) {
      console.log('❌ Validation failed:', { isValidAmount, amount, address });
      return;
    }
 
    try {
      if (swapDirection === 'wrap') {
        console.log('📦 Starting wrap process...');
        await writeContract({
          address: CWETH_ADDRESS as `0x${string}`,
          abi: CWETH_ABI,
          functionName: 'wrap',
          value: parseEther(amount),
        });
      } else {
        console.log('📤 Starting unwrap process...');
        setUnwrapStep('step1');
        
        // Import FHE utilities and ensure instance is ready
        const { encryptAndRegister, getFHEInstance } = await import('../utils/fhe');
        await getFHEInstance();
        
        const amountWei = parseEther(amount);
        
        // Encrypt amount for unwrap step
        const encryptedAmount = await encryptAndRegister(
          CWETH_ADDRESS,
          address,
          amountWei
        );
        
        if (!encryptedAmount || !encryptedAmount.handles?.length || !encryptedAmount.inputProof) {
          throw new Error('Failed to encrypt amount for unwrap');
        }
        
        // Step 1: Burn cWETH (unwrap)
        const tx1 = await writeContract({
          address: CWETH_ADDRESS as `0x${string}`,
          abi: CWETH_ABI,
          functionName: 'unwrap',
          args: [encryptedAmount.handles[0] as `0x${string}`, encryptedAmount.inputProof as `0x${string}`],
        });
        setStep1Hash(tx1 as `0x${string}`);
        
        // Wait for step 1 confirmation before proceeding
        const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io';
        const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
        await publicClient.waitForTransactionReceipt({ hash: tx1 as `0x${string}` });
        
        // Step 2: Withdraw WETH -> ETH and send to user
        setUnwrapStep('step2');
        const tx2 = await writeContract({
          address: CWETH_ADDRESS as `0x${string}`,
          abi: CWETH_ABI,
          functionName: 'completeUnwrap',
          args: [amountWei],
        });
        setStep2Hash(tx2 as `0x${string}`);
      }
    } catch (err) {
      console.error('❌ Swap failed:', err);
      setUnwrapStep('none');
    }
  };

  const formatBalance = (balance: string) => {
    return parseFloat(balance).toFixed(4);
  };

  const handleDirectionChange = (event: React.MouseEvent<HTMLElement>, newDirection: 'wrap' | 'unwrap' | null) => {
    if (newDirection !== null) {
      setSwapDirection(newDirection);
      setAmount(''); // Clear amount when switching directions
    }
  };

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to swap between ETH and confidential WETH (cWETH).
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto' }}>
      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully {swapDirection === 'wrap' ? 'converted' : 'unwrapped'} {amount} {swapDirection === 'wrap' ? 'ETH to' : 'cWETH to'} {swapDirection === 'wrap' ? 'confidential WETH (cWETH)' : 'ETH'}!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {swapDirection === 'wrap' ? 'Conversion' : 'Unwrapping'} failed: {error.message}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SwapHoriz sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontFamily: 'sans-serif' }}>
                ETH ↔ cWETH Swapper
              </Typography>
            </Box>
            
            <ToggleButtonGroup
              value={swapDirection}
              exclusive
              onChange={handleDirectionChange}
              size="small"
              sx={{ ml: 2 }}
            >
              <ToggleButton value="wrap">
                <SwapVert sx={{ mr: 0.5 }} />
                Wrap
              </ToggleButton>
              <ToggleButton value="unwrap">
                <SwapVert sx={{ mr: 0.5, transform: 'rotate(180deg)' }} />
                Unwrap
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: 'sans-serif' }}>
            {swapDirection === 'wrap' 
              ? 'Convert your ETH to confidential WETH (cWETH) tokens. Your balance will be encrypted and private.'
              : 'Convert your confidential WETH (cWETH) tokens back to ETH. Your balance will be decrypted.'
            }
          </Typography>

          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label={`Amount (${swapDirection === 'wrap' ? 'ETH' : 'cWETH'})`}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              InputProps={{
                endAdornment: (
                  <Button
                    size="small"
                    onClick={handleMaxAmount}
                    disabled={
                      (swapDirection === 'wrap' && !ethBalance) ||
                      (swapDirection === 'unwrap' && !hasCWETH)
                    }
                    sx={{ ml: 1 }}
                  >
                    MAX
                  </Button>
                ),
              }}
              helperText={
                swapDirection === 'wrap' 
                  ? (ethBalance ? `Available: ${formatBalance(ethBalance.formatted)} ETH` : 'Loading ETH balance...')
                  : (isDecrypted && cWETHBalance.includes('cWETH') 
                      ? `Available: ${formatBalance(cWETHBalance.replace(' cWETH', ''))} cWETH` 
                      : hasCWETH 
                        ? 'Available: •••••••• cWETH (encrypted)' 
                        : 'No cWETH balance available')
              }
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontFamily: 'sans-serif' }}>
              Swap Summary
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
                {swapDirection === 'wrap' ? 'ETH Amount:' : 'cWETH Amount:'}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>{amount || '0'} {swapDirection === 'wrap' ? 'ETH' : 'cWETH'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
                {swapDirection === 'wrap' ? 'cWETH Amount:' : 'ETH Amount:'}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>{amount || '0'} {swapDirection === 'wrap' ? 'cWETH' : 'ETH'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>Status:</Typography>
              <Chip
                label={swapDirection === 'wrap' ? 'Confidential' : 'Public'}
                size="small"
                color={swapDirection === 'wrap' ? 'primary' : 'secondary'}
                icon={<AccountBalance />}
              />
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={() => {
              console.log('🖱️ Button clicked!', { 
                isValidAmount, 
                isPending, 
                isConfirming,
                swapDirection,
                amount 
              });
              handleSwap();
            }}
            disabled={!isValidAmount || isPending || isConfirming || isConfirmingStep1 || isConfirmingStep2}
            startIcon={
              isPending || isConfirming || isConfirmingStep1 || isConfirmingStep2 ? (
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
              ? unwrapStep === 'step1' 
                ? 'Burning cWETH...'
                : unwrapStep === 'step2'
                ? 'Converting to ETH...'
                : `${swapDirection === 'wrap' ? 'Converting' : 'Unwrapping'}...`
              : unwrapStep === 'step1'
              ? 'Step 1: Burn cWETH'
              : unwrapStep === 'step2'
              ? 'Step 2: Convert to ETH'
              : `${swapDirection === 'wrap' ? 'Convert ETH → cWETH' : 'Convert cWETH → ETH'}`}
          </Button>

          {hash && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>
                Transaction Hash: {hash.slice(0, 10)}...{hash.slice(-8)}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

    </Box>
  );
}
