'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { sepolia } from 'wagmi/chains';
import { getSafeContractAddresses } from '../config/contractConfig';
import { getSepoliaRpcUrl } from '../utils/rpc';
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

// Contract ABI for supplying cWETH to the vault
const VAULT_ABI = [
  {
    "inputs": [
      { "internalType": "externalEuint64", "name": "encryptedAmount", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" }
    ],
    "name": "supply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// Contract ABI for cWETH token - Updated for ConfidentialFungibleToken
const CWETH_ABI = [
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
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "internalType": "uint48",
        "name": "until",
        "type": "uint48"
      }
    ],
    "name": "setOperator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
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
    "name": "confidentialTransferFrom",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "transferred",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      }
    ],
    "name": "isOperator",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface SupplyFormProps {
  onTransactionSuccess?: () => Promise<void>;
  cWETHBalance?: string;
  hasCWETH?: boolean;
  isDecrypted?: boolean;
}

export default function SupplyForm({ onTransactionSuccess, cWETHBalance: propCWETHBalance, hasCWETH: propHasCWETH, isDecrypted: propIsDecrypted }: SupplyFormProps = {}) {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { writeContract, data: hash, isPending, error, reset: resetWrite } = useWriteContract();
  
  // Debug wagmi error
  if (error) {
    console.error('Wagmi writeContract error:', error);
  }
  const { isLoading: isConfirming, isSuccess, isError: isReceiptError } = useWaitForTransactionReceipt({ hash });
  const { data: walletClient } = useWalletClient();

  // Master decryption hook
  const { masterSignature, getMasterSignature } = useMasterDecryption();
  
  // Gas fee hook for real network fees
  const { calculateNetworkFee, isLoading: isGasLoading, getGasPriceInGwei, refetchGasPrice } = useGasFee();
  
  // Use props for cWETH balance instead of hook
  const cWETHBalance = propCWETHBalance || '••••••••';
  const hasCWETH = propHasCWETH || false;
  const isDecrypted = propIsDecrypted || false;

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [userCancelled, setUserCancelled] = useState(false);

  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  const VAULT_ADDRESS = contractAddresses?.VAULT_ADDRESS;
  const CWETH_ADDRESS = contractAddresses?.CWETH_ADDRESS;
  

  // Balance validation with decryption and gas fees
  useEffect(() => {
    console.log('🔍 SupplyForm validation:', { amount, hasCWETH, cWETHBalance, isDecrypted });
    
    // Clear previous error
    setBalanceError(null);
    
    if (amount && hasCWETH) {
      const amountWei = parseFloat(amount);
      
      // If balance is decrypted (contains 'cWETH'), validate against actual balance
      if (isDecrypted && cWETHBalance.includes('cWETH')) {
        const balanceWei = parseFloat(cWETHBalance.replace(' cWETH', ''));
        
        // Calculate total cost (no protocol fee, no network fee)
        const protocolFee = 0.000000; // No protocol fee
        const totalCost = amountWei + protocolFee; // Only amount + protocol fee
        
        const isValid = amountWei > 0 && totalCost <= balanceWei;
        setIsValidAmount(isValid);
        
        if (totalCost > balanceWei) {
          setBalanceError(`Insufficient balance! You have ${balanceWei.toFixed(4)} cWETH available, but need ${totalCost.toFixed(6)} cWETH.`);
        }
        
        console.log('🔍 Decrypted balance validation:', { 
          amountWei, 
          balanceWei, 
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
      if (amount && !hasCWETH) {
        setBalanceError('❌ No cWETH balance available');
      }
      console.log('🔍 Validation failed:', { hasAmount: !!amount, hasCWETH });
    }
  }, [amount, cWETHBalance, hasCWETH, isDecrypted, calculateNetworkFee]);

  // Calculate total cost including real network fee
  const calculateTotalCost = (): string => {
    if (!amount) return '0.000000 cWETH';
    
    const amountValue = parseFloat(amount);
    const protocolFee = 0.000000; // No protocol fee
    
    const total = amountValue + protocolFee;
    return `${total.toFixed(6)} cWETH`;
  };

  // Function to check if vault is operator
  const checkOperatorStatus = useCallback(async () => {
    console.log('checkOperatorStatus called with:', { address, CWETH_ADDRESS, VAULT_ADDRESS });
    
    if (!address || !CWETH_ADDRESS || !VAULT_ADDRESS) {
      console.log('Missing required parameters for checkOperatorStatus');
      return;
    }

    try {
      console.log('Creating public client for operator check...');
      
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(getSepoliaRpcUrl()),
      });

      console.log('Calling isOperator function...');
      
      // Safety check for publicClient
      if (!publicClient || typeof publicClient.call !== 'function') {
        console.error('❌ publicClient is not properly initialized in SupplyForm');
        throw new Error('Public client not properly initialized');
      }
      
      const result = await publicClient.call({
        to: CWETH_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: CWETH_ABI,
          functionName: 'isOperator',
          args: [address as `0x${string}`, VAULT_ADDRESS as `0x${string}`],
        }),
      });

      console.log('isOperator result:', result.data);
      
      if (result.data && result.data !== '0x') {
        const isOperator = result.data === '0x0000000000000000000000000000000000000000000000000000000000000001';
        console.log('Setting isApproved to:', isOperator);
        setIsApproved(isOperator);
        console.log('Is vault operator:', isOperator);
      } else {
        console.log('No data returned from isOperator call');
      }
    } catch (error) {
      console.error('Failed to check operator status:', error);
      setIsApproved(false);
    }
  }, [address, CWETH_ADDRESS, VAULT_ADDRESS]);

  // Check operator status when amount changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      checkOperatorStatus();
    }
  }, [amount, checkOperatorStatus]);

  useEffect(() => {
    // Check if user has cWETH balance (encrypted data means they have some balance)
    const hasCWETH = cWETHBalance && cWETHBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    if (amount && hasCWETH) {
      const amountWei = parseFloat(amount);
      // Allow any positive amount since we can't decrypt to check exact balance
      setIsValidAmount(amountWei > 0);
    } else {
      setIsValidAmount(false);
    }
  }, [amount, cWETHBalance]);

  useEffect(() => {
    console.log('Hash effect triggered:', { hash, isApproved });
    if (hash && !isApproved) {
      // This is an approval transaction
      console.log('Setting approval hash:', hash);
      setApprovalHash(hash);
    }
  }, [hash, isApproved]);

  useEffect(() => {
    console.log('Transaction success effect triggered:', { 
      isSuccess, 
      isReceiptError, 
      approvalHash, 
      isApproved, 
      hash,
      error: error?.message 
    });
    
    if (isSuccess && approvalHash) {
      // Operator permission was successful, now check operator status
      console.log('Operator permission successful, checking status...');
      setTimeout(() => {
        console.log('Calling checkOperatorStatus...');
        checkOperatorStatus();
      }, 2000); // Wait 2 seconds for the transaction to be mined
    } else if (isSuccess && !approvalHash) {
      // This is the supply transaction success
      console.log('✅ Supply transaction successful!');
      setShowSuccess(true);
      setAmount('');
      setApprovalHash(null);
      setIsApproved(false);
      setTransactionError(null);
      setUserCancelled(false);
      
      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetWrite();
      }, 100);
      
      setTimeout(() => setShowSuccess(false), 5000);
      
      // Refresh all dashboard balances
      if (onTransactionSuccess) {
        console.log('🔄 Refreshing dashboard balances after supply...');
        onTransactionSuccess().catch((error) => {
          console.error('Error refreshing balances:', error);
        });
      }
    } else if (isReceiptError) {
      console.log('❌ Transaction receipt shows error - transaction failed on-chain');
    }
  }, [isSuccess, isReceiptError, approvalHash, checkOperatorStatus, hash, error, onTransactionSuccess, resetWrite]);

  // Handle transaction errors
  useEffect(() => {
    if (error) {
      console.log('Transaction error:', error);
      
      // Check if user rejected the transaction
      if (error.message.toLowerCase().includes('user rejected') || 
          error.message.toLowerCase().includes('user denied') ||
          error.message.toLowerCase().includes('rejected the request')) {
        setUserCancelled(true);
        setTransactionError(null);
        setAmount(''); // Clear input on cancellation
      } else {
        // Other errors (network, contract, etc.)
        setTransactionError(error.message);
        setUserCancelled(false);
        setAmount(''); // Clear input on error
      }
      
      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetWrite();
      }, 100);
    }
  }, [error, resetWrite]);

  const handleMaxAmount = () => {
    // If balance is decrypted (contains 'cWETH'), use the actual amount
    if (isDecrypted && cWETHBalance.includes('cWETH')) {
      const balanceWei = parseFloat(cWETHBalance.replace(' cWETH', ''));
      setAmount(balanceWei.toString());
      console.log('🔍 MAX button: Set amount to decrypted balance:', balanceWei);
    } else if (hasCWETH) {
      // If balance is encrypted but we have cWETH, set a reasonable amount
      // Since we can't see the exact balance, set a moderate amount
      setAmount('0.5');
      console.log('🔍 MAX button: Set amount to moderate default (encrypted balance)');
    } else {
      // No cWETH balance available
      console.log('🔍 MAX button: No cWETH balance available');
    }
  };

  const handleSupply = async () => {
    if (!isValidAmount || !amount || !address || !walletClient) return;

    // Clear previous error states when starting new transaction
    setTransactionError(null);
    setUserCancelled(false);
    setBalanceError(null);

    try {
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
      
      if (!isApproved) {
        // Step 1: Set vault as operator (time-limited permission)
        console.log('Step 1: Setting vault as operator...');
        const until = Math.floor(Date.now() / 1000) + 3600; // Current timestamp + 1 hour
        console.log('setOperator parameters:', {
          address: CWETH_ADDRESS,
          vaultAddress: VAULT_ADDRESS,
          until: until,
          untilType: typeof until
        });
        try {
          writeContract({
            address: CWETH_ADDRESS as `0x${string}`,
            abi: CWETH_ABI,
            functionName: 'setOperator',
            args: [VAULT_ADDRESS as `0x${string}`, until],
          });
          console.log('Operator permission initiated...');
        } catch (writeError) {
          console.error('writeContract error:', writeError);
          throw writeError;
        }
      } else {
        // Step 2: Supply cWETH to the vault using encrypted inputs
        console.log('Step 2: Creating encrypted input for confidential transfer...');
        
        try {
          setIsEncrypting(true);
          
          // Get FHE instance (with mock fallback)
          const fheInstance = await getFHEInstance();
          console.log('FHE instance obtained');
          
          // Create encrypted input bound to the vault (pull pattern)
          console.log('Creating encrypted input for vault:', VAULT_ADDRESS, 'user:', address);
          const input = (fheInstance as any).createEncryptedInput(
            VAULT_ADDRESS as `0x${string}`,
            address as `0x${string}`
          );
          
          // Add the amount as encrypted value
          input.add64(amountWei);
          console.log('Added amount to encrypted input');
          
          // Encrypt the input (this is CPU-intensive)
          console.log('Encrypting input (this may take a moment)...');
          const encryptedData = await input.encrypt();
          console.log('Input encrypted successfully');
          
          // Extract and normalize encrypted amount and proof to hex strings
          console.log('Raw encrypted data:', encryptedData);
          console.log('Handles:', encryptedData.handles);
          console.log('Input proof:', encryptedData.inputProof);
          
          const encryptedAmountHandle = (encryptedData as any).handles?.[0];
          const inputProofRaw = (encryptedData as any).inputProof;
          
          const toHex = (v: any): `0x${string}` => {
            if (typeof v === 'string') {
              return (v.startsWith('0x') ? v : `0x${v}`) as `0x${string}`;
            }
            if (v instanceof Uint8Array) {
              return ('0x' + Array.from(v).map((b: number) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
            }
            throw new Error('Unsupported encrypted payload type');
          };
          
          // Format as bytes32 (fixed 32 bytes) for externalEuint64
          const formattedEncryptedAmount = toHex(encryptedAmountHandle);
          const formattedInputProof = toHex(inputProofRaw);
          
          console.log('Encrypted payload (normalized):', {
            encryptedAmount: formattedEncryptedAmount,
            inputProof: formattedInputProof,
          });
          
          console.log('Step 3: Calling supply on vault (pull pattern)...');
          writeContract({
            address: VAULT_ADDRESS as `0x${string}`,
            abi: VAULT_ABI,
            functionName: 'supply',
            args: [
              formattedEncryptedAmount, // encrypted handle for externalEuint64
              formattedInputProof // input proof
            ],
            gas: BigInt(800000), // Increase gas limit for FHE operations
          });
          console.log('Supply submitted to vault...');
          
        } catch (encryptError) {
          console.error('Encryption/Transfer failed:', encryptError);
          
          // Check if this is an FHEVM initialization error for the vault
          if (encryptError instanceof Error) {
            const errorMessage = encryptError.message.toLowerCase();
            if (errorMessage.includes('fhe') || 
                errorMessage.includes('encrypt') ||
                errorMessage.includes('instance') ||
                errorMessage.includes('vault') ||
                errorMessage.includes('contract')) {
              console.log('FHEVM vault encryption error detected:', encryptError.message);
              throw new Error(`Vault encryption failed: ${encryptError.message}`);
            }
          }
          
          throw new Error(`Failed to encrypt transfer amount: ${encryptError}`);
        } finally {
          setIsEncrypting(false);
        }
      }
    } catch (err) {
      console.error('Transaction failed:', err);
    }
  };

  // For now, we'll just handle the approval transaction
  // The user can manually call the supply function after approval

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
    <Box sx={{ 
      maxWidth: 350, 
      mx: 'auto', 
      p: 1, 
      position: 'relative',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: '4px',
      backgroundColor: 'background.paper',
      boxShadow: 2
    }}>
      {/* Close Button */}
      <Button
        onClick={() => {
          // Close the dialog by triggering a custom event or using parent component logic
          const event = new CustomEvent('closeSupplyDialog');
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
          Supply cWETH
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
            {isApproved ? 'Successfully supplied cWETH!' : 'Operator set! Click Supply again to complete.'}
          </Typography>
        </Alert>
      )}

      {userCancelled && (
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
            Transaction cancelled by user. No funds were supplied.
          </Typography>
        </Alert>
      )}

      {transactionError && (
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
            Transaction failed: {transactionError}
          </Typography>
        </Alert>
      )}

      {isReceiptError && (
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
            Transaction failed: Transaction was reverted on-chain
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
          label="Supply Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending || isConfirming || isEncrypting}
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
                disabled={isPending || isConfirming || !hasCWETH}
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
            hasCWETH 
              ? isDecrypted && cWETHBalance.includes('cWETH')
                ? `Available: ${cWETHBalance}`
                : 'Available: ••••••••'
              : 'No cWETH balance available'
          }
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              fontSize: '1rem'
            },
            // Hide the number input spinners
            '& input[type=number]': {
              MozAppearance: 'textfield',
            },
            '& input[type=number]::-webkit-outer-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
            '& input[type=number]::-webkit-inner-spin-button': {
              WebkitAppearance: 'none',
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
            {isGasLoading ? 'Loading...' : calculateNetworkFee('SUPPLY')}
          </Typography>
        </Box>
        
        <Divider sx={{ my: 0.5 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>Total</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>
            {isGasLoading ? 'Loading...' : calculateTotalCost()}
          </Typography>
        </Box>
        
        <Divider sx={{ my: 0.5 }} />
        
        <Box sx={{ 
          mt: 0.5, 
          p: 0.5, 
          backgroundColor: 'action.hover', 
          borderRadius: 1,
          transition: 'background-color 0.2s ease-in-out'
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>
            {isPending ? 'Pending...' : isConfirming ? 'Confirming...' : isEncrypting ? 'Encrypting...' : 'Ready'}
          </Typography>
        </Box>
      </Box>

      {/* Submit Button */}
      <Button
        fullWidth
        variant="contained"
        size="medium"
        onClick={handleSupply}
        disabled={!isValidAmount || isPending || isConfirming || isEncrypting || !hasCWETH}
        startIcon={
          isPending || isConfirming || isEncrypting ? (
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
        {isPending
          ? 'Confirming...'
          : isConfirming
          ? 'Processing...'
          : isEncrypting
          ? 'Encrypting...'
          : isApproved
          ? 'Supply cWETH'
          : 'Set Operator'}
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
