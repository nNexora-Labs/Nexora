'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi';
import { formatEncryptedBalance } from '../utils/fhe';
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
} from '@mui/material';
import { AccountBalanceWallet, Security, TrendingUp } from '@mui/icons-material';
import SupplyForm from './SupplyForm';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: address,
  });

  const [encryptedBalance, setEncryptedBalance] = useState<string>('Encrypted');
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Handle encrypted balance decryption using Zama Relayer SDK
  useEffect(() => {
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

  const handleConnect = () => {
    if (connectors[0]) {
      connect({ connector: connectors[0] });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setEncryptedBalance('Encrypted');
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
            <Button
              color="inherit"
              onClick={handleConnect}
              disabled={isConnecting}
              startIcon={<AccountBalanceWallet />}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
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

          {/* Supply Form */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Supply Assets
                </Typography>
                <SupplyForm />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
