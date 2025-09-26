'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { formatEncryptedBalance } from '../utils/fhe';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
import { useCWETHBalance } from '../hooks/useCWETHBalance';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { AccountBalanceWallet, Security, TrendingUp, Extension, QrCode } from '@mui/icons-material';
import SupplyForm from './SupplyForm';
import WithdrawForm from './WithdrawForm';
import ETHToCWETHConverter from './ETHToCWETHConverter';

export default function Dashboard() {
  const [isMounted, setIsMounted] = useState(false);
  
  // Only initialize hooks after component is mounted
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: address,
  });
  const { suppliedBalance, isDecrypting: isDecryptingSupplied, hasSupplied, canDecrypt, decryptBalance, clearDecryption } = useSuppliedBalance();
  const { formattedBalance: cWETHBalance, hasCWETH, canDecrypt: canDecryptCWETH, decryptBalance: decryptCWETHBalance, isDecrypting: isDecryptingCWETH } = useCWETHBalance();

  const [encryptedBalance, setEncryptedBalance] = useState<string>('Encrypted');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeTab, setActiveTab] = useState<'convert' | 'supply' | 'withdraw'>('convert');
  const [walletMenuAnchor, setWalletMenuAnchor] = useState<null | HTMLElement>(null);

  // Handle SSR - only run hooks after component is mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle encrypted balance decryption using Zama Relayer SDK
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined' || !isMounted) {
      setEncryptedBalance('Encrypted');
      setIsDecrypting(false);
      return;
    }

    if (isConnected && balance && address) {
      setIsDecrypting(true);
      
      // In a real implementation, you would get the encrypted balance from the contract
      // and decrypt it using the Zama Relayer SDK
      // For now, we'll simulate the decryption process
      
      setTimeout(() => {
        setEncryptedBalance('0.1234 ETH');
        setIsDecrypting(false);
      }, 2000);
    }
  }, [isConnected, balance, address, isMounted]);

  const handleConnect = (event: React.MouseEvent<HTMLElement>) => {
    setWalletMenuAnchor(event.currentTarget);
  };

  const handleWalletSelect = (connector: any) => {
    connect({ connector });
    setWalletMenuAnchor(null);
  };

  const handleCloseWalletMenu = () => {
    setWalletMenuAnchor(null);
  };

  const handleDisconnect = () => {
    disconnect();
    setEncryptedBalance('Encrypted');
  };

  const getWalletIcon = (connectorName: string) => {
    switch (connectorName.toLowerCase()) {
      case 'metamask':
        return <Extension />;
      case 'walletconnect':
        return <QrCode />;
      case 'rabby':
        return <Extension />;
      case 'coinbase wallet':
        return <Extension />;
      default:
        return <AccountBalanceWallet />;
    }
  };

  // Only render after component is mounted to avoid hydration issues
  if (!isMounted) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <>
      <AppBar position="static" sx={{ bgcolor: 'primary.main' }}>
        <Toolbar>
          <Security sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Confidential Lending Protocol
          </Typography>
          {isConnected ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Typography>
              <Button
                color="inherit"
                onClick={handleDisconnect}
                variant="outlined"
                size="small"
              >
                Disconnect
              </Button>
            </Box>
          ) : (
            <Button
              color="inherit"
              onClick={handleConnect}
              disabled={isConnecting}
              variant="outlined"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {/* Wallet Information Card */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Wallet Information
                </Typography>
                {isConnected && address ? (
                  <Box>
                    <Typography variant="body1">
                      Address: {address.slice(0, 6)}...{address.slice(-4)}
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        Balance: {isBalanceLoading ? <CircularProgress size={16} /> : `${balance?.formatted ?? '0'} ${balance?.symbol ?? 'ETH'}`}
                      </Typography>
                      {isBalanceLoading && (
                        <Chip
                          label="Loading..."
                          size="small"
                          color="primary"
                          icon={<CircularProgress size={16} />}
                        />
                      )}
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        cWETH Balance: {cWETHBalance}
                      </Typography>
                      {isDecryptingCWETH && (
                        <Chip
                          label="Decrypting..."
                          size="small"
                          color="primary"
                          icon={<CircularProgress size={16} />}
                        />
                      )}
                      {hasCWETH && cWETHBalance === 'Encrypted' && (
                        <Chip
                          label="Available"
                          size="small"
                          color="success"
                        />
                      )}
                    </Box>
                    
                    {/* Debug info - remove this later */}
                    <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Debug: hasCWETH={hasCWETH.toString()}, cWETHBalance="{cWETHBalance}", canDecrypt={canDecryptCWETH.toString()}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mt: 1 }}>
                      {/* Simple test button */}
                      <Button
                        variant="contained"
                        size="small"
                        onClick={async () => {
                          console.log('🧪 Test button clicked!');
                          console.log('Wallet connected:', isConnected);
                          console.log('Address:', address);
                          console.log('signMessageAsync available:', !!signMessageAsync);
                          
                          // Test FHE instance creation
                          try {
                            console.log('Testing FHE instance creation...');
                            const { getFHEInstance } = await import('../utils/fhe');
                            const fheInstance = await getFHEInstance();
                            console.log('✅ FHE instance created successfully:', !!fheInstance);
                          } catch (error) {
                            console.error('❌ FHE instance creation failed:', error);
                          }
                          
                          // Test contract address
                          const cwethAddress = process.env.NEXT_PUBLIC_CWETH_ADDRESS;
                          console.log('cWETH Contract Address:', cwethAddress);
                          
                          // Test if we can read from the contract using raw call
                          try {
                            const { createPublicClient, http, encodeFunctionData, decodeFunctionResult } = await import('viem');
                            const { sepolia } = await import('viem/chains');
                            
                            const publicClient = createPublicClient({
                              chain: sepolia,
                              transport: http(),
                            });
                            
                            console.log('Testing raw contract call...');
                            
                            // Encode the function call manually
                            const encodedData = encodeFunctionData({
                              abi: [{
                                "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
                                "name": "getEncryptedBalance",
                                "outputs": [{"internalType": "euint32", "name": "", "type": "euint32"}],
                                "stateMutability": "view",
                                "type": "function"
                              }],
                              functionName: 'getEncryptedBalance',
                              args: [address as `0x${string}`],
                            });
                            
                            console.log('Encoded function data:', encodedData);
                            
                            // Make raw call to get encrypted data
                            const result = await publicClient.call({
                              to: cwethAddress as `0x${string}`,
                              data: encodedData,
                            });
                            
                            console.log('✅ Raw contract call successful:', result);
                            console.log('Raw result data:', result.data);
                            
                            // The result.data contains the encrypted euint64 value
                            if (result.data && result.data !== '0x') {
                              console.log('✅ Encrypted balance data found:', result.data);
                            } else {
                              console.log('❌ No encrypted balance data (empty result)');
                            }
                            
                          } catch (contractError) {
                            console.error('❌ Contract call failed:', contractError);
                          }
                        }}
                        sx={{ mr: 1, mb: 1 }}
                      >
                        Test Wallet Connection
                      </Button>
                      
                      {/* Always show decrypt button for testing */}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          console.log('🔘 Decrypt button clicked!');
                          decryptCWETHBalance();
                        }}
                        disabled={isDecryptingCWETH}
                        startIcon={isDecryptingCWETH ? <CircularProgress size={16} /> : <Security />}
                        sx={{ mr: 1 }}
                      >
                        {isDecryptingCWETH ? 'Decrypting...' : 'Decrypt cWETH Balance'}
                      </Button>
                      
                      {/* Original conditional button */}
                      {cWETHBalance === 'Encrypted' && hasCWETH && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={decryptCWETHBalance}
                          disabled={isDecryptingCWETH}
                          startIcon={isDecryptingCWETH ? <CircularProgress size={16} /> : <Security />}
                        >
                          {isDecryptingCWETH ? 'Decrypting...' : 'Decrypt cWETH Balance (Conditional)'}
                        </Button>
                      )}
                      {canDecryptCWETH && cWETHBalance !== 'Encrypted' && (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => {
                            if (address) {
                              localStorage.removeItem(`fhe_cweth_decryption_${address}`);
                              window.location.reload();
                            }
                          }}
                          color="secondary"
                        >
                          Clear cWETH Decryption
                        </Button>
                      )}
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        Supplied: {suppliedBalance}
                      </Typography>
                      {isDecryptingSupplied && (
                        <Chip
                          label="Decrypting..."
                          size="small"
                          color="secondary"
                          icon={<CircularProgress size={16} />}
                        />
                      )}
                    </Box>
                    
                    <Box sx={{ mt: 1 }}>
                      {suppliedBalance === 'Encrypted' && hasSupplied && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={decryptBalance}
                          disabled={isDecryptingSupplied}
                          startIcon={isDecryptingSupplied ? <CircularProgress size={16} /> : <Security />}
                        >
                          {isDecryptingSupplied ? 'Decrypting...' : 'Decrypt Balance'}
                        </Button>
                      )}
                      {canDecrypt && suppliedBalance !== 'Encrypted' && (
                        <Button
                          variant="text"
                          size="small"
                          onClick={clearDecryption}
                          color="secondary"
                        >
                          Clear Decryption
                        </Button>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Connect your wallet to view encrypted balance information
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Protocol Information Card */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Protocol Information
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TrendingUp color="primary" />
                  <Typography variant="body1">
                    Interest Rate: 5% APY
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Security color="primary" />
                  <Typography variant="body1">
                    Status: Fully Encrypted
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccountBalanceWallet color="primary" />
                  <Typography variant="body1">
                    Network: Sepolia Testnet
                  </Typography>
                </Box>
                <Chip
                  label="Confidential DeFi"
                  color="primary"
                  variant="outlined"
                  icon={<Security />}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Supply/Withdraw Form */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                    <Tab label="Convert ETH → cWETH" value="convert" />
                    <Tab label="Supply cWETH" value="supply" />
                    <Tab label="Withdraw ETH" value="withdraw" />
                  </Tabs>
                </Box>
                {activeTab === 'convert' ? <ETHToCWETHConverter /> : activeTab === 'supply' ? <SupplyForm /> : <WithdrawForm />}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Wallet Selection Menu */}
      <Menu
        anchorEl={walletMenuAnchor}
        open={Boolean(walletMenuAnchor)}
        onClose={handleCloseWalletMenu}
      >
        {connectors.map((connector) => (
          <MenuItem
            key={connector.id}
            onClick={() => handleWalletSelect(connector)}
            disabled={isConnecting}
          >
            <ListItemIcon>
              {getWalletIcon(connector.name)}
            </ListItemIcon>
            <ListItemText primary={connector.name} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}