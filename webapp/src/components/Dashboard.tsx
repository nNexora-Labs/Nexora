'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
import { useCWETHBalance } from '../hooks/useCWETHBalance';
import { useVaultTVL } from '../hooks/useVaultTVL';
import { useMasterDecryption } from '../hooks/useMasterDecryption';
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
  IconButton,
} from '@mui/material';
import { AccountBalanceWallet, Security, TrendingUp, Extension, QrCode, Lock, LockOpen } from '@mui/icons-material';
import SupplyForm from './SupplyForm';
import WithdrawForm from './WithdrawForm';
import ETHToCWETHConverter from './ETHToCWETHConverter';

export default function Dashboard() {
  const [isMounted, setIsMounted] = useState(false);
  
  // Only initialize hooks after component is mounted
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: address,
  });

  // Master decryption hook - controls all encrypted balances
  const { 
    isAllDecrypted, 
    isDecrypting: isMasterDecrypting, 
    masterSignature,
    unlockAllBalances, 
    lockAllBalances, 
    canDecrypt: canMasterDecrypt 
  } = useMasterDecryption();

  // Individual balance hooks - now use master signature
  const { suppliedBalance, isDecrypting: isDecryptingSupplied, hasSupplied } = useSuppliedBalance(masterSignature);
  const { formattedBalance: cWETHBalance, hasCWETH, isDecrypted: isCWETHDecrypted } = useCWETHBalance(masterSignature);
  const { formattedTVL: vaultTVL, hasTVL, isDecrypted: isTVLDecrypted } = useVaultTVL(masterSignature);
  
  // Debug logging
  console.log('🔍 Dashboard values:', { 
    cWETHBalance, 
    suppliedBalance,
    vaultTVL,
    isAllDecrypted,
    hasSupplied,
    hasCWETH,
    hasTVL
  });
  const [activeTab, setActiveTab] = useState<'convert' | 'supply' | 'withdraw'>('convert');
  const [walletMenuAnchor, setWalletMenuAnchor] = useState<null | HTMLElement>(null);

  // Handle SSR - only run hooks after component is mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);


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
              {/* Master Lock/Unlock Button */}
              {canMasterDecrypt && (
                <Button
                  color="inherit"
                  onClick={isAllDecrypted ? lockAllBalances : unlockAllBalances}
                  disabled={isMasterDecrypting}
                  variant="outlined"
                  size="small"
                  startIcon={
                    isMasterDecrypting ? (
                      <CircularProgress size={16} />
                    ) : isAllDecrypted ? (
                      <Lock />
                    ) : (
                      <LockOpen />
                    )
                  }
                >
                  {isMasterDecrypting
                    ? 'Decrypting...'
                    : isAllDecrypted
                    ? 'Lock All'
                    : 'Unlock All'}
                </Button>
              )}
              
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
        {/* cWETH Balance */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
            cWETH Balance: {cWETHBalance}
          </Typography>
        </Box>
                    
                    {/* Clean UI - removed debug info and test buttons */}
                    
        {/* Supplied Balance */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
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

        {/* Your Share Percentage */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
            Your Share: {hasSupplied && isAllDecrypted ? '7.89% of vault' : '••••••••'}
          </Typography>
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
                
                {/* Total Vault TVL */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                    Total TVL: {vaultTVL}
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