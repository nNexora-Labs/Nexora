'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi';
import { formatEncryptedBalance } from '../utils/fhe';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
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
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: address,
  });
  const { suppliedBalance, isDecrypting: isDecryptingSupplied, hasSupplied, canDecrypt, decryptBalance, clearDecryption } = useSuppliedBalance();

  const [encryptedBalance, setEncryptedBalance] = useState<string>('Encrypted');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeTab, setActiveTab] = useState<'convert' | 'supply' | 'withdraw'>('convert');
  const [walletMenuAnchor, setWalletMenuAnchor] = useState<null | HTMLElement>(null);

  // Handle encrypted balance decryption using Zama Relayer SDK
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      setEncryptedBalance('Encrypted');
      setIsDecrypting(false);
      return;
    }

    if (isConnected && balance && address) {
      setIsDecrypting(true);
      
      // In a real implementation, you would get the encrypted balance from the contract
      // and then decrypt it using the Zama Relayer SDK
      // For now, we'll simulate the decryption process
      
      const simulateDecryption = async () => {
        try {
          // Simulate getting encrypted balance from contract
          // const encryptedBalance = await contract.getEncryptedBalance(address);
          // const decryptedBalance = await formatEncryptedBalance(encryptedBalance, address);
          
          // For demo purposes, show the regular balance
          setEncryptedBalance(`${parseFloat(balance.formatted).toFixed(4)} ETH`);
        } catch (error) {
          console.error('Decryption failed:', error);
          setEncryptedBalance('Encrypted');
        } finally {
          setIsDecrypting(false);
        }
      };
      
      // Simulate decryption delay
      setTimeout(simulateDecryption, 2000);
    }
  }, [isConnected, balance, address]);

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
              <Chip
                label={`${address?.slice(0, 6)}...${address?.slice(-4)}`}
                color="secondary"
                icon={<AccountBalanceWallet />}
              />
              <Button color="inherit" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </Box>
          ) : (
            <>
              <Button
                color="inherit"
                onClick={handleConnect}
                disabled={isConnecting}
                startIcon={isConnecting ? <CircularProgress size={20} /> : <AccountBalanceWallet />}
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
              <Menu
                anchorEl={walletMenuAnchor}
                open={Boolean(walletMenuAnchor)}
                onClose={handleCloseWalletMenu}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                {connectors.map((connector) => (
                  <MenuItem
                    key={connector.uid}
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
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {/* Wallet Info Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Wallet Information
                </Typography>
                {isConnected ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Address: {address}
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        Balance: {isBalanceLoading ? (
                          <CircularProgress size={16} />
                        ) : (
                          encryptedBalance
                        )}
                      </Typography>
                      {isDecrypting && (
                        <Chip
                          label="Decrypting..."
                          size="small"
                          color="primary"
                          icon={<CircularProgress size={16} />}
                        />
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

          {/* Protocol Info Card */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Protocol Information
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUp color="primary" />
                  <Typography variant="body2">
                    Interest Rate: 5% APY
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  ETH Price: $4,000 USDC
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Utilization: 50%
                </Typography>
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
    </>
  );
}
