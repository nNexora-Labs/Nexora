'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
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
        "type": "externalEuint64"
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
        "type": "euint64"
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

export default function SupplyForm() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  // Debug wagmi error
  if (error) {
    console.error('Wagmi writeContract error:', error);
  }
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { data: walletClient } = useWalletClient();

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cWETHBalance, setCWETHBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Contract address (will be set after deployment)
  const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000';
  const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';
  

  // Function to fetch cWETH balance using raw contract call
  const fetchCWETHBalance = useCallback(async () => {
    if (!address || !CWETH_ADDRESS || CWETH_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return;
    }

    try {
      setIsLoadingBalance(true);
      
      // Create a simple public client for raw calls
      const { createPublicClient, http, encodeFunctionData } = await import('viem');
      const { sepolia } = await import('wagmi/chains');
      
      // Use your dedicated Infura RPC endpoint
      const rpcUrls = [
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/edae100994ea476180577c9218370251'
      ];
      
      let publicClient;
      for (const rpcUrl of rpcUrls) {
        try {
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          break; // If successful, use this client
        } catch (error) {
          console.log(`Failed to connect to ${rpcUrl}, trying next...`);
          continue;
        }
      }
      
      if (!publicClient) {
        throw new Error('All RPC endpoints failed');
      }

      // Make raw contract call
      const result = await publicClient.call({
        to: CWETH_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: CWETH_ABI,
          functionName: 'getEncryptedBalance',
          args: [address as `0x${string}`],
        }),
      });

      if (result.data && result.data !== '0x') {
        const balanceData = result.data as `0x${string}`;
        setCWETHBalance(balanceData);
      } else {
        setCWETHBalance('0x0000000000000000000000000000000000000000000000000000000000000000');
      }
    } catch (error) {
      console.error('Failed to fetch cWETH balance:', error);
      setCWETHBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, CWETH_ADDRESS]);

  // Fetch balance when address changes
  useEffect(() => {
    if (address && isConnected) {
      fetchCWETHBalance();
    } else {
      setCWETHBalance(null);
    }
  }, [address, isConnected, fetchCWETHBalance]);

  // Function to check if vault is operator
  const checkOperatorStatus = useCallback(async () => {
    console.log('checkOperatorStatus called with:', { address, CWETH_ADDRESS, VAULT_ADDRESS });
    
    if (!address || !CWETH_ADDRESS || !VAULT_ADDRESS) {
      console.log('Missing required parameters for checkOperatorStatus');
      return;
    }

    try {
      console.log('Creating public client for operator check...');
      const { createPublicClient, http, encodeFunctionData } = await import('viem');
      const { sepolia } = await import('wagmi/chains');
      
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/edae100994ea476180577c9218370251'),
      });

      console.log('Calling isOperator function...');
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
    console.log('Transaction success effect triggered:', { isSuccess, approvalHash, isApproved });
    
    if (isSuccess && approvalHash) {
      // Operator permission was successful, now check operator status
      console.log('Operator permission successful, checking status...');
      setTimeout(() => {
        console.log('Calling checkOperatorStatus...');
        checkOperatorStatus();
      }, 2000); // Wait 2 seconds for the transaction to be mined
    } else if (isSuccess && !approvalHash) {
      // This is the supply transaction success
      console.log('Supply transaction successful');
      setShowSuccess(true);
      setAmount('');
      setApprovalHash(null);
      setIsApproved(false);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [isSuccess, approvalHash, checkOperatorStatus]);

  const handleMaxAmount = () => {
    // Since we can't decrypt the exact balance, we'll set a reasonable amount
    // User can adjust as needed
    const hasCWETH = cWETHBalance && cWETHBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (hasCWETH) {
      setAmount('0.1'); // Set a small amount as default
    }
  };

  const handleSupply = async () => {
    if (!isValidAmount || !amount || !address || !walletClient) return;

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
          
          // Create encrypted input
          const input = (fheInstance as any).createEncryptedInput(
            CWETH_ADDRESS as `0x${string}`,
            address as `0x${string}`
          );
          
          // Add the amount as encrypted value
          input.add64(amountWei);
          console.log('Added amount to encrypted input');
          
          // Encrypt the input (this is CPU-intensive)
          console.log('Encrypting input (this may take a moment)...');
          const encryptedData = await input.encrypt();
          console.log('Input encrypted successfully');
          
          // Extract the encrypted amount and proof
          console.log('Raw encrypted data:', encryptedData);
          console.log('Handles:', encryptedData.handles);
          console.log('Input proof:', encryptedData.inputProof);
          
          const encryptedAmount = encryptedData.handles[0];
          const inputProof = encryptedData.inputProof;
          
          // Convert Uint8Array to hex strings
          const encryptedAmountStr = Array.from(encryptedAmount).map(b => b.toString(16).padStart(2, '0')).join('');
          const inputProofStr = Array.from(inputProof).map(b => b.toString(16).padStart(2, '0')).join('');
          
          // Ensure they are properly formatted hex strings
          const formattedEncryptedAmount = `0x${encryptedAmountStr}`;
          const formattedInputProof = `0x${inputProofStr}`;
          
          console.log('Encrypted data:', {
            encryptedAmount: formattedEncryptedAmount,
            inputProof: formattedInputProof,
            encryptedAmountType: typeof formattedEncryptedAmount,
            inputProofType: typeof formattedInputProof
          });
          
          console.log('Step 3: Creating viem contract and calling confidentialTransferFrom...');
          
          const { encodeFunctionData } = await import('viem');
          
          // Create a simplified ABI for viem (without FHEVM types)
          const ViemCWETH_ABI = [
            {
              "inputs": [
                {"internalType": "address", "name": "from", "type": "address"},
                {"internalType": "address", "name": "to", "type": "address"},
                {"internalType": "bytes", "name": "encryptedAmount", "type": "bytes"},
                {"internalType": "bytes", "name": "inputProof", "type": "bytes"}
              ],
              "name": "confidentialTransferFrom",
              "outputs": [{"internalType": "bytes", "name": "transferred", "type": "bytes"}],
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ] as const;

          // Encode the function call
          const data = encodeFunctionData({
            abi: ViemCWETH_ABI,
            functionName: 'confidentialTransferFrom',
            args: [
              address as `0x${string}`, // from
              VAULT_ADDRESS as `0x${string}`, // to
              formattedEncryptedAmount as `0x${string}`, // encrypted amount
              formattedInputProof as `0x${string}` // input proof
            ],
          });

          console.log('Encoded function data:', data);

          // Send the transaction using wagmi's writeContract
          console.log('Sending transaction via wagmi...');
          writeContract({
            address: CWETH_ADDRESS as `0x${string}`,
            abi: ViemCWETH_ABI,
            functionName: 'confidentialTransferFrom',
            args: [
              address as `0x${string}`, // from
              VAULT_ADDRESS as `0x${string}`, // to
              formattedEncryptedAmount as `0x${string}`, // encrypted amount
              formattedInputProof as `0x${string}` // input proof
            ],
          });
          console.log('Transaction submitted via wagmi...');
          
        } catch (encryptError) {
          console.error('Encryption/Transfer failed:', encryptError);
          throw new Error('Failed to encrypt transfer amount or execute transfer');
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
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          {showSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {isApproved ? 'Successfully supplied encrypted cWETH to the confidential lending vault!' : 'Successfully set vault as operator! Now click Supply again to complete the encrypted transfer.'}
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
                disabled={!cWETHBalance || cWETHBalance === '0x0000000000000000000000000000000000000000000000000000000000000000'}
                sx={{ ml: 1 }}
              >
                MAX
              </Button>
            ),
          }}
          helperText={
            isLoadingBalance 
              ? 'Loading cWETH balance...'
              : cWETHBalance && cWETHBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000' 
              ? `cWETH Balance: Available (encrypted)` 
              : cWETHBalance === '0x0000000000000000000000000000000000000000000000000000000000000000'
              ? `cWETH Balance: 0.0000 cWETH`
              : 'No cWETH balance found'
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
            disabled={!isValidAmount || isPending || isConfirming || isEncrypting}
            startIcon={
              isPending || isConfirming || isEncrypting ? (
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
              : isEncrypting
              ? 'Encrypting Amount...'
              : isApproved
              ? 'Supply cWETH (Encrypted)'
              : 'Set Operator'}
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
