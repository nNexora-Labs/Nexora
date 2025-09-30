'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
import { useCWETHBalance } from '../hooks/useCWETHBalance';
import { useVaultTVL } from '../hooks/useVaultTVL';
import { useSharePercentage } from '../hooks/useSharePercentage';
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
import { AccountBalanceWallet, TrendingUp, ContentCopy, ExpandMore, Close, SwapHoriz, Lock, LockOpen } from '@mui/icons-material';
import SupplyForm from './SupplyForm';
import WithdrawForm from './WithdrawForm';
import RepayForm from './RepayForm';
import ETHToCWETHConverter from './ETHToCWETHConverter';
import PositionList from './PositionList';
import TransactionHistoryTable from './TransactionHistoryTable';
import styles from './SwapStyles.module.css';
import { encryptAndRegister } from '../utils/fhe';

// Contract ABI for ConfidentialWETH wrap function
const CWETH_ABI = [
  {
    "inputs": [],
    "name": "wrap",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

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
    canDecrypt: canMasterDecrypt,
    getMasterSignature
  } = useMasterDecryption();

  // Individual balance hooks - now use master signature
  const { suppliedBalance, isDecrypting: isDecryptingSupplied, hasSupplied, refetchEncryptedShares } = useSuppliedBalance(masterSignature, getMasterSignature);
  const { formattedBalance: cWETHBalance, hasCWETH, isDecrypted: isCWETHDecrypted, isDecrypting: isDecryptingCWETH, refetchCWETHBalance } = useCWETHBalance(masterSignature, getMasterSignature);
  const { 
    tvlBalance: vaultTVL, 
    hasTVL, 
    isDecrypted: isTVLDecrypted, 
    isDecrypting: isDecryptingTVL,
    isLoadingTVL: isTVLLoading,
    canDecrypt: canDecryptTVL,
    decryptTVL,
    lockTVL: lockTVLIndividual,
    fetchEncryptedTVL: fetchTVL
  } = useVaultTVL();
  const { sharePercentage, hasShares, isDecrypting: isDecryptingShares, refreshShares } = useSharePercentage(masterSignature, getMasterSignature);
  
  // Check if any decryption is in progress
  const isAnyDecrypting = isDecryptingSupplied || isDecryptingCWETH || isDecryptingShares || isMasterDecrypting || isDecryptingTVL;

  // Refresh all blockchain data
  const refreshAllBalances = useCallback(async () => {
    console.log('🔄 Refreshing all blockchain data...');
    try {
      await Promise.all([
        refetchEncryptedShares(),
        refetchCWETHBalance(),
        refreshShares()
      ]);
      console.log('✅ All blockchain data refreshed');
    } catch (error) {
      console.error('❌ Error refreshing blockchain data:', error);
    }
  }, [refetchEncryptedShares, refetchCWETHBalance, refreshShares]);
  
  // Debug logging
  console.log('🔍 Dashboard values:', { 
    cWETHBalance, 
    suppliedBalance,
    vaultTVL,
    sharePercentage,
    isAllDecrypted,
    hasSupplied,
    hasCWETH,
    hasTVL,
    hasShares,
    isAnyDecrypting,
    masterSignature: masterSignature ? 'present' : 'missing',
    isCWETHDecrypted,
    isTVLDecrypted,
    canDecryptTVL,
    isDecryptingTVL
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'supply' | 'borrow' | 'portfolio'>('dashboard');
  const [walletInfoAnchor, setWalletInfoAnchor] = useState<null | HTMLElement>(null);
  const [selectedNetwork, setSelectedNetwork] = useState('Sepolia');
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [useVerticalNav, setUseVerticalNav] = useState(false);
  
  const navigationTabs: ('dashboard' | 'supply' | 'borrow' | 'portfolio')[] = ['dashboard', 'supply', 'borrow', 'portfolio'];
  
  // Dynamic breakpoint detection
  useEffect(() => {
    const checkLayout = () => {
      // Switch to vertical nav when window width is less than 900px
      // This ensures horizontal tabs don't push controls out of view
      setUseVerticalNav(window.innerWidth < 900);
    };

    checkLayout();
    window.addEventListener('resize', checkLayout);
    
    return () => window.removeEventListener('resize', checkLayout);
  }, []);
  
  const availableNetworks = [
    { name: 'Ethereum', chainId: 1, functional: false, icon: '/assets/icons/eth-svgrepo-com.svg' },
    { name: 'Sepolia', chainId: 11155111, functional: true, icon: '/assets/icons/ethereum.svg' },
    { name: 'Polygon', chainId: 137, functional: false, icon: '/assets/icons/polygon-matic-logo.svg' },
    { name: 'Arbitrum', chainId: 42161, functional: false, icon: '/assets/icons/arbitrum-arb-logo.svg' },
    { name: 'Optimism', chainId: 10, functional: false, icon: '/assets/icons/optimism-ethereum-op-logo.svg' },
    { name: 'Base', chainId: 8453, functional: false, icon: '/assets/icons/base_logo.jpg' }
  ];
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [supplySubTab, setSupplySubTab] = useState('supply'); // 'supply' or 'position'
  const [borrowSubTab, setBorrowSubTab] = useState('borrow'); // 'borrow' or 'position'
  const [portfolioSubTab, setPortfolioSubTab] = useState('overview'); // 'overview' or 'history'
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);
  const [swapAmount, setSwapAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [showBalanceError, setShowBalanceError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // true = night mode, false = day mode

  // Swap functionality hooks
  const { writeContract: writeSwapContract, data: swapHash, isPending: isSwapPending, error: swapError } = useWriteContract();
  const { isLoading: isSwapConfirming, isSuccess: isSwapSuccess } = useWaitForTransactionReceipt({ hash: swapHash });

  // Contract addresses
  const CWETH_ADDRESS = process.env.NEXT_PUBLIC_CWETH_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Available tokens for swap
  const availableTokens = [
    { symbol: 'ETH', name: 'Ethereum', icon: '/assets/icons/eth-svgrepo-com.svg', functional: true },
    { symbol: 'USDC', name: 'USD Coin', icon: '/assets/icons/usdc-svgrepo-com.svg', functional: false },
    { symbol: 'USDT', name: 'Tether', icon: '/assets/icons/usdt-svgrepo-com.svg', functional: false },
    { symbol: 'DAI', name: 'Dai', icon: '/assets/icons/multi-collateral-dai-dai-logo.svg', functional: false },
    { symbol: 'UNI', name: 'Uniswap', icon: '/assets/icons/uniswap-uni-logo.svg', functional: false },
    { symbol: 'BTC', name: 'Bitcoin', icon: '/assets/icons/bitcoin-svgrepo-com.svg', functional: false },
  ];

  // Handle SSR - only run hooks after component is mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);


  const handleConnect = () => {
    setShowWalletModal(true);
  };

  const handleWalletSelect = async (connector: any) => {
    if (connector) {
      try {
        await connect({ connector });
        setShowWalletModal(false);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  const handleCloseWalletModal = () => {
    setShowWalletModal(false);
  };


  const handleWalletInfoClick = (event: React.MouseEvent<HTMLElement>) => {
    setWalletInfoAnchor(event.currentTarget);
  };

  const handleCloseWalletInfo = () => {
    setWalletInfoAnchor(null);
  };

  const handleDisconnect = () => {
    disconnect();
    setWalletInfoAnchor(null);
  };

  const handleCopyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  // Swap functionality
  const handleSwap = async () => {
    if (!swapAmount || !address || parseFloat(swapAmount) <= 0) return;

    try {
      setIsSwapping(true);
      
      // Convert ETH to wei
      const amountInWei = BigInt(Math.floor(parseFloat(swapAmount) * 1e18));

      // Call the ConfidentialWETH wrap function
      await writeSwapContract({
        address: CWETH_ADDRESS as `0x${string}`,
        abi: CWETH_ABI,
        functionName: 'wrap',
        value: amountInWei,
      });
    } catch (err) {
      console.error('Swap failed:', err);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleMaxAmount = () => {
    if (balance) {
      setSwapAmount((parseFloat(balance.formatted) * 0.95).toString()); // Leave some for gas
    }
  };

  const handleSwapReversal = () => {
    setIsReversed(!isReversed);
    setSwapAmount(''); // Clear the amount when reversing
    setShowBalanceError(false); // Clear any balance error when reversing
  };

  const handleCloseSwapModal = () => {
    setShowSwapModal(false);
    setSwapAmount(''); // Clear the amount when closing
    setShowBalanceError(false); // Clear any balance error when closing
    setIsReversed(false); // Reset to forward swap
  };

  const handleNetworkSelect = (networkName: string) => {
    const network = availableNetworks.find(n => n.name === networkName);
    if (network && network.functional) {
      setSelectedNetwork(networkName);
      setShowNetworkDropdown(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside the mobile menu
      if (showMobileMenu && target.closest('[data-mobile-menu]')) {
        return;
      }
      
      if (showNetworkDropdown) {
        setShowNetworkDropdown(false);
      }
      if (showMobileMenu) {
        setShowMobileMenu(false);
      }
    };

    if (showNetworkDropdown || showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNetworkDropdown, showMobileMenu]);

  const handleAmountChange = (value: string) => {
    setSwapAmount(value);
    
    // Check if amount exceeds balance (only for forward swaps)
    if (!isReversed && balance && value && parseFloat(value) > parseFloat(balance.formatted)) {
      setShowBalanceError(true);
    } else {
      setShowBalanceError(false);
    }
  };



  // Only render after component is mounted to avoid hydration issues
  if (!isMounted) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, pb: 10 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <>
      {/* Notification Banner */}
      {showNotificationBanner && (
        <Box sx={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
            : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          color: 'white',
          py: 1,
          textAlign: 'center',
          borderBottom: isDarkMode 
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative'
        }}>
          <Typography variant="h6" sx={{ 
                        fontWeight: '600',
            fontSize: '1rem',
            letterSpacing: '0.5px'
          }}>
            Nexora - The Next Confidential Lending Protocol
          </Typography>
          <IconButton
            onClick={() => setShowNotificationBanner(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              '&:hover': {
                backgroundColor: isDarkMode 
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.2)'
              }
            }}
            size="small"
          >
            <Close />
          </IconButton>
        </Box>
      )}

      <AppBar position="static" sx={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        boxShadow: isDarkMode 
          ? '0 2px 8px rgba(0, 0, 0, 0.1)'
          : '0 2px 8px rgba(0, 0, 0, 0.05)',
        color: isDarkMode ? 'white' : '#000000'
      }}>
        <Toolbar sx={{ 
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 0,
          px: { xs: 2, sm: 3 }
        }}>
          {/* Left Side: Logo + Vertical Menu */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: { xs: 0.5, sm: 1 }
          }}>
            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: isDarkMode ? '800' : '500',
                  fontSize: { xs: '1.1rem', sm: '1.5rem' },
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-inter), "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #ffffff 0%, #8a9ba8 50%, #ffffff 100%)'
                    : 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: isDarkMode 
                    ? '0 0 20px rgba(255, 255, 255, 0.3)'
                    : '0 0 20px rgba(44, 62, 80, 0.3)',
                  position: 'relative',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: '-2px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: isDarkMode 
                      ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)'
                      : 'linear-gradient(90deg, transparent 0%, rgba(44, 62, 80, 0.4) 50%, transparent 100%)',
                    borderRadius: '1px'
                  }
                }}
              >
                Nexora
              </Typography>
            </Box>

            {/* Hamburger Menu - Dynamic based on available space */}
            <Box sx={{ 
              display: useVerticalNav ? 'block' : 'none',
              position: 'relative'
            }}>
              <IconButton
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                sx={{
                  color: isDarkMode ? 'white' : '#000000',
                  p: 0.5,
                  '&:hover': {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  width: '16px',
                  height: '12px'
                }}>
                  <Box sx={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'currentColor',
                    borderRadius: '1px'
                  }} />
                  <Box sx={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'currentColor',
                    borderRadius: '1px'
                  }} />
                  <Box sx={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'currentColor',
                    borderRadius: '1px'
                  }} />
                </Box>
              </IconButton>

              {/* Mobile Menu Dropdown */}
              {showMobileMenu && (
                <Box 
                  data-mobile-menu
                  sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  mt: 1,
                  minWidth: '120px',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  border: isDarkMode 
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(44, 62, 80, 0.1)',
                  borderRadius: '4px',
                  boxShadow: isDarkMode 
                    ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                    : '0 8px 32px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}>
                  {navigationTabs.map((tab) => (
                    <Button
                      key={tab}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTab(tab);
                        setShowMobileMenu(false);
                      }}
                      sx={{
                        width: '100%',
                        py: 1,
                        px: 2,
                        fontSize: '0.8rem',
                        fontWeight: activeTab === tab ? '600' : '400',
                        color: activeTab === tab 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'),
                        backgroundColor: activeTab === tab 
                          ? (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
                          : 'transparent',
                        borderRadius: 0,
                        textTransform: 'capitalize',
                        justifyContent: 'flex-start',
                        '&:hover': {
                          backgroundColor: activeTab === tab 
                            ? (isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)')
                            : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                        }
                      }}
                    >
                      {tab}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Desktop Navigation Tabs */}
          <Box sx={{ 
            flexGrow: 1,
            display: useVerticalNav ? 'none' : 'block'
          }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              textColor="inherit"
              indicatorColor="secondary"
              sx={{
                '& .MuiTab-root': {
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  fontWeight: '500',
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  minHeight: '48px',
                  '&.Mui-selected': {
                    color: isDarkMode ? 'white' : '#000000',
                    fontWeight: '600'
                  },
                  '&:hover': {
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: isDarkMode ? 'white' : '#2c3e50',
                  height: '2px'
                }
              }}
            >
              <Tab label="Dashboard" value="dashboard" />
              <Tab label="Supply" value="supply" />
              <Tab label="Borrow" value="borrow" />
              <Tab label="Portfolio" value="portfolio" />
            </Tabs>
          </Box>

          {/* Right Side Controls */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1.5 },
            minWidth: 0 // Prevent overflow
          }}>
          {isConnected ? (
              <>
                {/* Network Selector */}
                <Box sx={{ position: 'relative' }}>
                <Button
                  variant="outlined"
                  size="small"
                    endIcon={<ExpandMore />}
                    onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                    sx={{
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(44, 62, 80, 0.3)',
                      color: isDarkMode ? 'white' : '#000000',
                      minWidth: { xs: '40px', sm: '120px', md: 'auto' },
                      width: { xs: '40px', sm: '120px', md: 'auto' },height: '28px',
                      px: { xs: 0.5, sm: 1.5 },
                      pl: { xs: 0.5, sm: 1.5 },
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      '&:hover': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(44, 62, 80, 0.5)',
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)'
                      }
                    }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      marginRight: { xs: '0px', sm: '8px' }
                    }}>
                      <img 
                        src={availableNetworks.find(n => n.name === selectedNetwork)?.icon} 
                        alt={selectedNetwork}
                        style={{ 
                          width: '16px', 
                          height: '16px'
                        }}
                      />
                    </Box>
                    <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {selectedNetwork}
                    </Box>
                </Button>
                  
                  {/* Network Dropdown */}
                  {showNetworkDropdown && (
                    <Box sx={{
                      position: 'absolute',
                      top: '100%',
                      left: { xs: 'auto', sm: 0 },
                      right: { xs: 0, sm: 0 },
                      mt: 1,
                      minWidth: { xs: '160px', sm: 'auto' },
                      maxWidth: { xs: '180px', sm: '200px' },
                      maxHeight: '150px',
                      background: isDarkMode 
                        ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: isDarkMode 
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(44, 62, 80, 0.1)',
                      borderRadius: '4px',
                      boxShadow: isDarkMode 
                        ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                        : '0 8px 32px rgba(0, 0, 0, 0.1)',
                      zIndex: 1000,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      '&::-webkit-scrollbar': {
                        width: '6px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                        borderRadius: '3px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(44, 62, 80, 0.3)',
                        borderRadius: '3px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(44, 62, 80, 0.5)',
                      }
                    }}>
                      {availableNetworks.map((network) => (
                        <Box
                          key={network.name}
                          onClick={() => handleNetworkSelect(network.name)}
                          sx={{
                            px: 1.5,
                            py: 1,
                            cursor: network.functional ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            color: network.functional 
                              ? (isDarkMode ? 'white' : '#000000')
                              : (isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'),
                            fontSize: '0.75rem',
                            fontWeight: network.name === selectedNetwork ? '600' : '400',
                            background: network.name === selectedNetwork 
                              ? (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)')
                              : 'transparent',
                            '&:hover': network.functional ? {
                              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                            } : {},
                            borderBottom: '1px solid',
                            borderBottomColor: isDarkMode 
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(44, 62, 80, 0.05)'
                          }}
                        >
                          <img 
                            src={network.icon} 
                            alt={network.name}
                            style={{ width: '14px', height: '14px' }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ 
                              fontWeight: 'inherit',
                              fontSize: 'inherit',
                              color: 'inherit'
                            }}>
                              {network.name}
              </Typography>
                            <Typography variant="caption" sx={{ 
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                              fontSize: '0.65rem'
                            }}>
                              {network.functional ? 'Available' : 'Coming Soon'}
                            </Typography>
                          </Box>
                          {network.name === selectedNetwork && (
                            <Box sx={{ 
                              width: 6, 
                              height: 6, 
                              borderRadius: '50%', 
                              background: '#4caf50' 
                            }} />
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Lock/Unlock Icon with Status */}
                {canMasterDecrypt && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton
                      onClick={isAllDecrypted ? lockAllBalances : unlockAllBalances}
                      disabled={isMasterDecrypting}
                      sx={{
                        width: '28px',
                        height: '28px',
                        background: isDarkMode 
                          ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                          : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                        color: isAllDecrypted 
                          ? (isDarkMode ? '#e74c3c' : '#c0392b') // Red for unlock (can lock)
                          : (isDarkMode ? '#27ae60' : '#2ecc71'), // Green for lock (can unlock)
                        border: isDarkMode 
                          ? '1px solid rgba(255, 255, 255, 0.1)'
                          : '1px solid rgba(52, 152, 219, 0.2)',
                        borderRadius: '4px',
                        boxShadow: isDarkMode 
                          ? '0 4px 14px 0 rgba(52, 73, 94, 0.3)'
                          : '0 4px 14px 0 rgba(52, 152, 219, 0.3)',
                        '&:hover': {
                          background: isDarkMode 
                            ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                            : 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)',
                          boxShadow: isDarkMode 
                            ? '0 6px 20px 0 rgba(52, 73, 94, 0.4)'
                            : '0 6px 20px 0 rgba(52, 152, 219, 0.4)',
                          transform: 'translateY(-1px)',
                          color: isAllDecrypted 
                            ? (isDarkMode ? '#c0392b' : '#e74c3c')
                            : (isDarkMode ? '#2ecc71' : '#27ae60')
                        },
                        '&:disabled': {
                          opacity: 0.6,
                          cursor: 'not-allowed'
                        },
                        transition: 'all 0.3s ease'
                      }}
                      title={isAllDecrypted ? 'Lock all balances' : 'Unlock all balances'}
                    >
                      {isMasterDecrypting ? (
                        <CircularProgress size={16} sx={{ color: 'inherit' }} />
                      ) : isAllDecrypted ? (
                        <LockOpen sx={{ fontSize: '16px' }} />
                      ) : (
                        <Lock sx={{ fontSize: '16px' }} />
                      )}
                    </IconButton>
                    
                    {/* Status Indicator */}
                    <Box sx={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: isAllDecrypted 
                        ? (isDarkMode ? '#27ae60' : '#2ecc71') // Green when unlocked
                        : (isDarkMode ? '#e74c3c' : '#c0392b'), // Red when locked
                      opacity: isMasterDecrypting ? 0.5 : 1,
                      transition: 'all 0.3s ease'
                    }} 
                    title={isAllDecrypted ? 'Balances unlocked' : 'Balances locked'}
                    />
                  </Box>
                )}
              
                {/* Swap Button */}
              <Button
                variant="outlined"
                size="small"
                  onClick={() => setShowSwapModal(true)}
                  sx={{
                    background: isDarkMode 
                      ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                      : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                    color: isDarkMode ? 'white' : '#000000',
                    fontWeight: '600',
                    px: { xs: 2, sm: 3 },height: '28px',
                    textTransform: 'none',
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    boxShadow: isDarkMode 
                      ? '0 4px 14px 0 rgba(52, 73, 94, 0.3)'
                      : '0 4px 14px 0 rgba(52, 152, 219, 0.3)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(52, 152, 219, 0.2)',
                    '&:hover': {
                      background: isDarkMode 
                        ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                        : 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)',
                      boxShadow: isDarkMode 
                        ? '0 6px 20px 0 rgba(52, 73, 94, 0.4)'
                        : '0 6px 20px 0 rgba(52, 152, 219, 0.4)',
                      transform: 'translateY(-1px)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Swap
              </Button>

                {/* Wallet Address Display */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  height: '28px',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                    : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                  boxShadow: isDarkMode 
                      ? '0 4px 14px 0 rgba(52, 73, 94, 0.3)'
                      : '0 4px 14px 0 rgba(52, 152, 219, 0.3)',
                  border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(52, 152, 219, 0.2)',
                  borderRadius: '4px', // Match network selector border radius
                  px: { xs: 1, sm: 2 },
                  py: { xs: 0.5, sm: 1 },
                  cursor: 'pointer',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  '&:hover': {
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(44, 62, 80, 0.15)'
                  }
                }}
                onClick={handleWalletInfoClick}>
                  <Box sx={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: '50%', 
                    background: '#4caf50',
                    boxShadow: '0 0 6px rgba(76, 175, 80, 0.6)'
                  }} />
                  <Typography variant="body2" sx={{ 
                    fontWeight: '500',
                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                  }}>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </Typography>
                  <ExpandMore sx={{ fontSize: { xs: 12, sm: 16 }, opacity: 0.7 }} />
            </Box>
              </>
          ) : (
            <Button
              color="inherit"
              onClick={handleConnect}
              disabled={isConnecting}
              variant="outlined"
                size="small"
                sx={{
                  background: 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
                  color: isDarkMode ? 'white' : '#000000',
                        fontWeight: '600',
                  px: { xs: 2, sm: 3 },
                  py: { xs: 0.5, sm: 1 },
                  textTransform: 'none',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  boxShadow: '0 4px 14px 0 rgba(33, 150, 243, 0.3)',
                  border: '1px solid rgba(33, 150, 243, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1976d2 30%, #1cb5e0 90%)',
                    boxShadow: '0 6px 20px 0 rgba(33, 150, 243, 0.4)',
                    transform: 'translateY(-1px)'
                  },
                  '&:disabled': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    boxShadow: 'none'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {isConnecting ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={12} sx={{ color: 'white' }} />
                    <span style={{ fontSize: '0.7rem' }}>Connecting...</span>
                  </Box>
                ) : (
                  'Connect Wallet'
                )}
            </Button>
          )}
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ 
        px: { xs: 2, sm: 3, md: 4 },
        background: isDarkMode 
          ? 'transparent'
          : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        minHeight: '100vh', // Use full viewport height
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Main Content Wrapper */}
        <Box sx={{ flex: 1, pt: { xs: 2, sm: 3 } }}>
          {/* Tab Content */}
          {activeTab === 'dashboard' && (
                  <Box>
            {/* Portfolio Overview Section */}
            <Card sx={{ 
              mb: { xs: 2, sm: 3 }, 
              background: isDarkMode 
                ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #ffffff 100%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '4px',
              overflow: 'hidden',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  mb: { xs: 2, sm: 3 },
                  flexDirection: { xs: 'column', sm: 'row' }
                }}>
                  <Box>
                  </Box>
        </Box>

                    
                <Grid container spacing={{ xs: 2, sm: 3 }}>
                  <Grid item xs={6} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        opacity: isDarkMode ? 0.8 : 0.7, 
                        mb: 1,
                        fontSize: { xs: '0.7rem', sm: '0.875rem' },
                        color: isDarkMode ? 'white' : '#000000',
                        fontWeight: isDarkMode ? '500' : '300'
                      }}>
                        Wallet Balance
          </Typography>
                      <Typography variant="h5" sx={{ 
                        fontWeight: isDarkMode ? '600' : '400',
                        fontSize: { xs: '0.9rem', sm: '1.25rem' },
                        color: isDarkMode ? 'white' : '#000000'
                      }}>
                        {balance ? `${parseFloat(balance.formatted).toFixed(4)} ETH` : '0 ETH'}
                      </Typography>
        </Box>
                  </Grid>
                  <Grid item xs={6} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        opacity: isDarkMode ? 0.8 : 0.7, 
                        mb: 1,
                        fontSize: { xs: '0.7rem', sm: '0.875rem' },
                        color: isDarkMode ? 'white' : '#000000',
                        fontWeight: isDarkMode ? '500' : '300'
                      }}>
                        cWETH Balance
          </Typography>
                      <Typography variant="h5" sx={{ 
                        fontWeight: isDarkMode ? '600' : '400',
                        fontSize: { xs: '0.9rem', sm: '1.25rem' },
                        color: isDarkMode ? 'white' : '#000000'
                      }}>
                        {cWETHBalance}
                      </Typography>
        </Box>
                  </Grid>
                  <Grid item xs={6} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        opacity: isDarkMode ? 0.8 : 0.7, 
                        mb: 1,
                        fontSize: { xs: '0.7rem', sm: '0.875rem' },
                        color: isDarkMode ? 'white' : '#000000',
                        fontWeight: isDarkMode ? '500' : '300'
                      }}>
                        Your Share
                      </Typography>
                      <Typography variant="h5" sx={{ 
                        fontWeight: isDarkMode ? '600' : '400',
                        fontSize: { xs: '0.9rem', sm: '1.25rem' },
                        color: isDarkMode ? 'white' : '#000000'
                      }}>
                        {sharePercentage}
                      </Typography>
                  </Box>
                  </Grid>
                  <Grid item xs={6} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        opacity: isDarkMode ? 0.8 : 0.7, 
                        mb: 1,
                        fontSize: { xs: '0.7rem', sm: '0.875rem' },
                        color: isDarkMode ? 'white' : '#000000',
                        fontWeight: isDarkMode ? '500' : '300'
                      }}>
                        Supplied Balance
                  </Typography>
                      <Typography variant="h5" sx={{ 
                        fontWeight: isDarkMode ? '600' : '400',
                        fontSize: { xs: '0.9rem', sm: '1.25rem' },
                        color: isDarkMode ? 'white' : '#000000',
                        fontFamily: 'sans-serif'
                      }}>
                        {suppliedBalance}
                      </Typography>
        </Box>
                  </Grid>
                  <Grid item xs={6} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        opacity: isDarkMode ? 0.8 : 0.7, 
                        mb: 1,
                        fontSize: { xs: '0.7rem', sm: '0.875rem' },
                        color: isDarkMode ? 'white' : '#000000',
                        fontWeight: isDarkMode ? '500' : '300'
                      }}>
                        Protocol TVL
                  </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Typography variant="h5" sx={{ 
                          fontWeight: isDarkMode ? '600' : '400',
                          fontSize: { xs: '0.9rem', sm: '1.25rem' },
                          color: isDarkMode ? 'white' : '#000000',
                          fontFamily: 'sans-serif'
                        }}>
                          {vaultTVL}
                        </Typography>
                        {!hasTVL && (
                          <IconButton
                            size="small"
                            onClick={fetchTVL}
                            disabled={isTVLLoading}
                            sx={{
                              color: isDarkMode ? '#2196f3' : '#1976d2',
                              '&:hover': {
                                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                              },
                              minWidth: 'auto',
                              width: '24px',
                              height: '24px',
                              fontSize: '14px'
                            }}
                            title="Fetch TVL Data"
                          >
                            {isTVLLoading ? <CircularProgress size={16} /> : <TrendingUp fontSize="small" />}
                          </IconButton>
                        )}
                        {(canDecryptTVL || true) && hasTVL && (
                          <IconButton
                            size="small"
                            onClick={isTVLDecrypted ? lockTVLIndividual : decryptTVL}
                            disabled={isDecryptingTVL}
                            sx={{
                              color: isTVLDecrypted ? (isDarkMode ? '#4caf50' : '#2e7d32') : (isDarkMode ? '#ff9800' : '#f57c00'),
                              '&:hover': {
                                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                              },
                              '&:disabled': {
                                color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.26)',
                              },
                              minWidth: 'auto',
                              width: '24px',
                              height: '24px',
                              fontSize: '14px'
                            }}
                            title={isTVLDecrypted ? 'Lock TVL' : 'Decrypt TVL'}
                          >
                            {isDecryptingTVL ? (
                              <CircularProgress size={16} />
                            ) : isTVLDecrypted ? (
                              <LockOpen fontSize="small" />
                            ) : (
                              <Lock fontSize="small" />
                            )}
                          </IconButton>
                        )}
                      </Box>
        </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Supply Tab */}
        {activeTab === 'supply' && (
                  <Box>
            {/* Supply Header */}
            <Card sx={{ 
              mb: 3, 
              background: isDarkMode 
                ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '4px',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: '600', mb: 1, fontFamily: 'sans-serif' }}>
                      Supply Market
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Earn yield by supplying assets to the protocol
                      </Typography>
                </Box>
        </Box>

                <Grid container spacing={4}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                        Supply APY
          </Typography>
                      <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                        5.25%
                      </Typography>
                </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                        Total Supply
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                        {vaultTVL}
                      </Typography>
                </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Supply Token List */}
            <Card sx={{ 
              borderRadius: '4px', 
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: isDarkMode 
                ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              color: isDarkMode ? 'white' : '#000000',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)'
            }}>
              <CardContent sx={{ p: 3 }}>
                {/* Supply Sub-tabs */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    borderBottom: 1, 
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                    mb: 3
                  }}>
                    <Button
                      onClick={() => setSupplySubTab('supply')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: supplySubTab === 'supply' 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'),
                        borderBottom: supplySubTab === 'supply' ? 2 : 0,
                        borderColor: '#2196f3',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      Supply
                    </Button>
                    <Button
                      onClick={() => setSupplySubTab('position')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: supplySubTab === 'position' 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'),
                        borderBottom: supplySubTab === 'position' ? 2 : 0,
                        borderColor: '#2196f3',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      My Position
                    </Button>
                  </Box>
                </Box>
                
                {/* Supply Content */}
                {supplySubTab === 'supply' && (
                  <>
                    {/* Header Row */}
                    <Box sx={{
                      display: { xs: 'none', sm: 'flex' },
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2,
                      borderRadius: '8px',
                      background: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(44, 62, 80, 0.08)',
                      border: isDarkMode 
                        ? '1px solid rgba(255, 255, 255, 0.15)'
                        : '1px solid rgba(44, 62, 80, 0.15)',
                      mb: 1
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: '200px' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                          Assets
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            Collateral
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            APY
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            Liquidity
                          </Typography>
                        </Box>
                        <Box sx={{ minWidth: '100px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            Action
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    {/* Token List */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* cWETH - Functional */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)',
                    '&:hover': {
                      background: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(44, 62, 80, 0.08)'
                    }
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/cweth.svg" 
                        alt="cWETH"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          cWETH
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          5.25%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          2.5M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => setShowSupplyModal(true)}
                          sx={{
                            background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                            color: 'white',
                            fontWeight: '600',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)',
                              transform: 'translateY(-1px)'
                            }
                          }}
                        >
                          Supply
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  {/* cUSDT - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/usdt-svgrepo-com.svg" 
                        alt="cUSDT"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          cUSDT
                        </Typography>
                    </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
          </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          3.8%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          1.8M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
        </Box>
                    
                  {/* cUSDC - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/usdc-svgrepo-com.svg" 
                        alt="cUSDC"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          cUSDC
          </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          4.2%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          3.2M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
              size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  {/* cDAI - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/multi-collateral-dai-dai-logo.svg" 
                        alt="cDAI"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          cDAI
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          3.5%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          1.5M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
        </Box>

                  {/* cUNI - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/uniswap-uni-logo.svg" 
                        alt="cUNI"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          cUNI
          </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          6.8%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          800K
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
              size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  {/* cWBTC - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/bitcoin-svgrepo-com.svg" 
                        alt="cWBTC"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          cWBTC
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          4.9%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          1.2M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                    </Box>
                  </>
                )}
                
                {/* My Supply Position */}
                {supplySubTab === 'position' && (
                  <PositionList />
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Borrow Tab */}
        {activeTab === 'borrow' && (
          <Box>
            {/* Borrow Header */}
            <Card sx={{ 
              mb: 3, 
              background: isDarkMode 
                ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '4px',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: '600', mb: 1, fontFamily: 'sans-serif' }}>
                      Borrow Market
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Borrow assets against your supplied collateral
                  </Typography>
                </Box>
                  </Box>
                
                <Grid container spacing={4}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                        Borrow APY
                  </Typography>
                      <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                        8.50%
                      </Typography>
                </Box>
          </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                        Available to Borrow
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                        {vaultTVL}
                      </Typography>
                </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Borrow Token List */}
            <Card sx={{ 
              borderRadius: '4px', 
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: isDarkMode 
                ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              color: isDarkMode ? 'white' : '#000000',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)'
            }}>
              <CardContent sx={{ p: 3 }}>
                {/* Borrow Sub-tabs */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    borderBottom: 1, 
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                    mb: 3
                  }}>
                    <Button
                      onClick={() => setBorrowSubTab('borrow')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: borrowSubTab === 'borrow' 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'),
                        borderBottom: borrowSubTab === 'borrow' ? 2 : 0,
                        borderColor: '#9c27b0',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      Borrow
                    </Button>
                    <Button
                      onClick={() => setBorrowSubTab('position')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: borrowSubTab === 'position' 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'),
                        borderBottom: borrowSubTab === 'position' ? 2 : 0,
                        borderColor: '#9c27b0',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      My Position
                    </Button>
                  </Box>
                </Box>
                
                {/* Borrow Content */}
                {borrowSubTab === 'borrow' && (
                  <>
                
                {/* Header Row */}
                <Box sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  borderRadius: '8px',
                  background: isDarkMode 
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(44, 62, 80, 0.08)',
                  border: isDarkMode 
                    ? '1px solid rgba(255, 255, 255, 0.15)'
                    : '1px solid rgba(44, 62, 80, 0.15)',
                  mb: 1
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: '200px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                      Assets
                </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                        Collateral
                  </Typography>
                </Box>
                    <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                        APY
                  </Typography>
                </Box>
                    <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                        Liquidity
                  </Typography>
                    </Box>
                    <Box sx={{ minWidth: '100px' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                        Action
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                
                {/* Token List */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* ETH - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/eth-svgrepo-com.svg" 
                        alt="ETH"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          ETH
                  </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          8.50%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          2.5M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                </Box>
                
                  {/* USDT - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/usdt-svgrepo-com.svg" 
                        alt="USDT"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          USDT
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          6.25%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          1.8M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                  variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  {/* USDC - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/usdc-svgrepo-com.svg" 
                        alt="USDC"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          USDC
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          5.80%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          3.2M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  {/* DAI - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/multi-collateral-dai-dai-logo.svg" 
                        alt="DAI"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          DAI
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          5.50%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          1.5M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  {/* UNI - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/uniswap-uni-logo.svg" 
                        alt="UNI"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          UNI
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          9.20%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          800K
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  {/* WBTC - Coming Soon */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: '8px',
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(44, 62, 80, 0.05)',
                    border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.1)'
                      : '1px solid rgba(44, 62, 80, 0.1)'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2, 
                      minWidth: { xs: 'auto', sm: '200px' },
                      mb: { xs: 2, sm: 0 }
                    }}>
                      <img 
                        src="/assets/icons/bitcoin-svgrepo-com.svg" 
                        alt="WBTC"
                        style={{ 
                          width: '40px', 
                          height: '40px',
                          borderRadius: '50%'
                        }}
                      />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                          WBTC
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      flexWrap: 'wrap',
                      justifyContent: { xs: 'space-between', sm: 'flex-start' }
                    }}>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Collateral
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          ETH
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          APY
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', display: 'block', fontFamily: 'sans-serif' }}>
                          7.80%
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'block', sm: 'none' } }}>
                          Liquidity
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: '600', display: 'block', fontFamily: 'sans-serif' }}>
                          1.2M
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: { xs: '80px', sm: '100px' }, mt: { xs: 1, sm: 0 } }}>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(44, 62, 80, 0.6)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.8)',
                            px: 2,
                            py: 0.5,
                            borderRadius: '6px',
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            width: '100%'
                          }}
                        >
                          Coming Soon
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                    </Box>
                  </>
                )}
                
                {/* My Borrow Position */}
                {borrowSubTab === 'position' && (
                  <>
                    {/* Positions Header */}
                    <Box sx={{
                      display: { xs: 'none', sm: 'flex' },
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2,
                      borderRadius: '8px',
                      background: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(44, 62, 80, 0.08)',
                      border: isDarkMode 
                        ? '1px solid rgba(255, 255, 255, 0.15)'
                        : '1px solid rgba(44, 62, 80, 0.15)',
                      mb: 1
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: '200px' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                          Asset
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ textAlign: 'center', minWidth: '100px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            Borrowed
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: '100px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            APY
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', minWidth: '100px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            Collateral
                          </Typography>
                        </Box>
                        <Box sx={{ minWidth: '100px' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: '600', opacity: 0.8 }}>
                            Action
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    {/* Empty State */}
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      py: 6,
                      px: 3,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" sx={{ mb: 2, opacity: 0.7 }}>
                        No Borrow Positions
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.6, mb: 3 }}>
                        Start borrowing assets against your collateral
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setBorrowSubTab('borrow')}
                        sx={{
                          background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                          color: 'white',
                          fontWeight: '600',
                          px: 3,
                          py: 1,
                          borderRadius: '6px',
                          textTransform: 'none',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%)',
                            transform: 'translateY(-1px)'
                          }
                        }}
                      >
                        Start Borrowing
                      </Button>
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
                </Box>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <Box>
            {/* Portfolio Header */}
            <Card sx={{ 
              mb: 3, 
              background: isDarkMode 
                ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '4px',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: '600', mb: 1, fontFamily: 'sans-serif' }}>
                      Portfolio Overview
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      View your decrypted balances, performance metrics, and transaction history
                    </Typography>
                  </Box>
                </Box>
                
                {/* Portfolio Sub-tabs */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    borderBottom: 1, 
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                    mb: 3
                  }}>
                    <Button
                      onClick={() => setPortfolioSubTab('overview')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: portfolioSubTab === 'overview' 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'),
                        borderBottom: portfolioSubTab === 'overview' ? 2 : 0,
                        borderColor: '#2196f3',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      Overview
                    </Button>
                    <Button
                      onClick={() => setPortfolioSubTab('history')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: portfolioSubTab === 'history' 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'),
                        borderBottom: portfolioSubTab === 'history' ? 2 : 0,
                        borderColor: '#2196f3',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      History
                    </Button>
                  </Box>
                </Box>
                
                {/* Portfolio Overview Content */}
                {portfolioSubTab === 'overview' && (
                  <>
                    {/* Portfolio Summary */}
                    <Grid container spacing={4} sx={{ mb: 4 }}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{
                          background: isDarkMode 
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(44, 62, 80, 0.05)',
                          border: isDarkMode 
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(44, 62, 80, 0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', p: 3 }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                              Total Portfolio Value
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                              {suppliedBalance}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{
                          background: isDarkMode 
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(44, 62, 80, 0.05)',
                          border: isDarkMode 
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(44, 62, 80, 0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', p: 3 }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                              Supplied Assets
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                              {suppliedBalance}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{
                          background: isDarkMode 
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(44, 62, 80, 0.05)',
                          border: isDarkMode 
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(44, 62, 80, 0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', p: 3 }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                              Borrowed Assets
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                              0.0000 ETH
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{
                          background: isDarkMode 
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(44, 62, 80, 0.05)',
                          border: isDarkMode 
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(44, 62, 80, 0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', p: 3 }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                              Net Worth
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                              {suppliedBalance}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    {/* Asset Breakdown */}
                    <Card sx={{
                      mb: 3,
                      background: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(44, 62, 80, 0.05)',
                      border: isDarkMode 
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(44, 62, 80, 0.1)'
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: '600', mb: 3, fontFamily: 'sans-serif' }}>
                          Asset Breakdown
                        </Typography>
                        
                        {/* Asset List */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {/* cWETH Asset */}
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 2,
                            borderRadius: '8px',
                            background: isDarkMode 
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(44, 62, 80, 0.05)',
                            border: isDarkMode 
                              ? '1px solid rgba(255, 255, 255, 0.1)'
                              : '1px solid rgba(44, 62, 80, 0.1)'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <img 
                                src="/assets/icons/ethereum-svgrepo-com.svg" 
                                alt="cWETH"
                                style={{ width: '32px', height: '32px' }}
                              />
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                                  cWETH
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                  Wrapped Ethereum
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="h6" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                                {suppliedBalance}
                              </Typography>
                              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                100% of portfolio
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>

                    {/* Performance Metrics */}
                    <Card sx={{
                      background: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(44, 62, 80, 0.05)',
                      border: isDarkMode 
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(44, 62, 80, 0.1)'
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: '600', mb: 3, fontFamily: 'sans-serif' }}>
                          Performance Metrics
                        </Typography>
                        
                        <Grid container spacing={3}>
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ textAlign: 'center', p: 2 }}>
                              <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                                Total Yield Earned
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                                0.0000 ETH
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ textAlign: 'center', p: 2 }}>
                              <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                                Current APY
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: '600', fontFamily: 'sans-serif' }}>
                                5.25%
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </>
                )}
                
                {/* Transaction History Content */}
                {portfolioSubTab === 'history' && (
                  <TransactionHistoryTable isDarkMode={isDarkMode} />
                )}
              </CardContent>
            </Card>
          </Box>
        )}
        </Box>

        {/* Footer */}
        <Box sx={{ 
          mt: 4,
          borderTop: '1px solid #e0e0e0'
        }}>
          <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
            <Grid container spacing={2} alignItems="center">
              {/* Links Section */}
              <Grid item xs={12} md={8}>
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 1.5,
                  justifyContent: { xs: 'center', md: 'flex-start' }
                }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Terms
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Privacy
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Docs
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    FAQs
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Support
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                      fontSize: '0.75rem',
                      ml: 2
                    }}
                  >
                    © 2025
                  </Typography>
                </Box>
              </Grid>

              {/* Social Media Icons */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1,
                  justifyContent: { xs: 'center', md: 'flex-end' }
                }}>
                  <IconButton
                    sx={{
                      p: 0.5,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/telegram.svg" 
                      alt="Telegram"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                  <IconButton
                    sx={{
                      p: 1,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/discord.svg" 
                      alt="Discord"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                  <IconButton
                    sx={{
                      p: 1,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/refinedgithub.svg" 
                      alt="GitHub"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                  <IconButton
                    sx={{
                      p: 1,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/x.svg" 
                      alt="X (Twitter)"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                </Box>
          </Grid>
        </Grid>
      </Container>
        </Box>

      </Container>

      {/* Wallet Connection Modal - Center Screen */}
      {showWalletModal && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(8px)'
          }}
          onClick={handleCloseWalletModal}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              backgroundColor: isDarkMode ? '#1a1a2e' : '#ffffff',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode 
                ? '0 20px 60px rgba(0, 0, 0, 0.5)'
                : '0 20px 60px rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" sx={{ 
                color: isDarkMode ? 'white' : '#000000', 
                        fontWeight: '600',
                mb: 1,
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Connect Wallet
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Choose your wallet to connect to Nexora
              </Typography>
            </Box>

            {/* Wallet Options */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {connectors.map((connector) => (
                <Box
            key={connector.id}
            onClick={() => handleWalletSelect(connector)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                    }
                  }}
                >
                  {/* Wallet Icon */}
                  <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    background: connector.name === 'MetaMask' 
                      ? 'linear-gradient(45deg, #f6851b, #e2761b)'
                      : connector.name === 'Coinbase Wallet'
                      ? 'linear-gradient(45deg, #0052ff, #1e88e5)'
                      : connector.name === 'WalletConnect'
                      ? 'linear-gradient(45deg, #3b99fc, #1e88e5)'
                      : 'linear-gradient(45deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDarkMode ? 'white' : '#000000',
                    fontSize: '24px'
                  }}>
                    {connector.name === 'MetaMask' ? '🦊' : 
                     connector.name === 'Coinbase Wallet' ? '🔵' :
                     connector.name === 'WalletConnect' ? '🔗' : '👛'}
                  </Box>

                  {/* Wallet Info */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ 
                      color: isDarkMode ? 'white' : '#000000', 
                      fontWeight: '600',
                      mb: 0.5
                    }}>
                      {connector.name}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      {connector.name === 'MetaMask' && 'Browser extension'}
                      {connector.name === 'Coinbase Wallet' && 'Browser extension'}
                      {connector.name === 'WalletConnect' && 'Mobile & Desktop'}
                      {!['MetaMask', 'Coinbase Wallet', 'WalletConnect'].includes(connector.name) && 'Connect wallet'}
                    </Typography>
                  </Box>

                  {/* Arrow */}
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '20px' }}>
                    →
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Footer */}
            <Box sx={{ 
              mt: 4, 
              pt: 3, 
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              textAlign: 'center'
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.75rem'
              }}>
                By connecting, you agree to our Terms of Service and Privacy Policy
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Swap - Fullscreen */}
      {showSwapModal && (
        <Box 
          className={styles.overlayBackdrop} 
          onClick={handleCloseSwapModal}
          sx={{
            '--swap-backdrop-bg': isDarkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.15)',
            '--swap-panel-bg': isDarkMode 
              ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #ffffff 100%)',
            '--swap-panel-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-panel-shadow': isDarkMode 
              ? '0 16px 36px rgba(0, 0, 0, 0.7)'
              : '0 16px 36px rgba(0, 0, 0, 0.1)',
            '--swap-panel-text': isDarkMode ? '#fff' : '#000000',
            '--swap-header-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-title-gradient': isDarkMode 
              ? 'linear-gradient(45deg, #ecf0f1, #bdc3c7)'
              : 'linear-gradient(45deg, #2c3e50, #34495e)',
            '--swap-token-bg': isDarkMode 
              ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
              : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            '--swap-token-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-input-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(44, 62, 80, 0.06)',
            '--swap-input-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.15)'
              : '1px solid rgba(44, 62, 80, 0.15)',
            '--swap-input-shadow': isDarkMode 
              ? '0 2px 10px rgba(0, 0, 0, 0.15) inset'
              : '0 2px 10px rgba(0, 0, 0, 0.05) inset',
            '--swap-input-text': isDarkMode ? '#fff' : '#000000',
            '--swap-input-weight': isDarkMode ? '800' : '400',
            '--swap-amount-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(44, 62, 80, 0.08)',
            '--swap-amount-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.15)'
              : '1px solid rgba(44, 62, 80, 0.15)',
            '--swap-amount-text': isDarkMode ? '#fff' : '#000000',
            '--swap-details-bg': isDarkMode 
              ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
              : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            '--swap-details-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-button-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(44, 62, 80, 0.15)',
            '--swap-button-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.8)'
              : 'rgba(0, 0, 0, 0.9)',
            '--swap-readonly-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.8)'
              : 'rgba(0, 0, 0, 0.8)',
            '--swap-selector-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(44, 62, 80, 0.08)',
            '--swap-selector-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(44, 62, 80, 0.2)',
            '--swap-selector-text': isDarkMode ? '#fff' : '#000000',
            '--swap-max-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.85)'
              : 'rgba(0, 0, 0, 0.85)',
            '--swap-max-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(44, 62, 80, 0.05)',
            '--swap-max-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(44, 62, 80, 0.2)',
            '--swap-max-hover-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(44, 62, 80, 0.1)',
            '--swap-approx-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.6)'
              : 'rgba(0, 0, 0, 0.6)',
            '--swap-approx-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(44, 62, 80, 0.05)',
            '--swap-approx-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-dropdown-bg': isDarkMode 
              ? 'rgba(44, 62, 80, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
            '--swap-dropdown-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(44, 62, 80, 0.2)',
            '--swap-dropdown-shadow': isDarkMode 
              ? '0 4px 16px rgba(0, 0, 0, 0.3)'
              : '0 4px 16px rgba(0, 0, 0, 0.1)',
            '--swap-dropdown-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(0, 0, 0, 0.9)',
            '--swap-dropdown-item-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(44, 62, 80, 0.08)',
            '--swap-dropdown-disabled-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
            '--swap-dropdown-ticker-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(44, 62, 80, 0.08)',
            '--swap-dropdown-status-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.6)'
              : 'rgba(0, 0, 0, 0.6)',
            '--swap-scrollbar-track': isDarkMode 
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(44, 62, 80, 0.1)',
            '--swap-scrollbar-thumb': isDarkMode 
              ? 'rgba(255, 255, 255, 0.3)'
              : 'rgba(44, 62, 80, 0.3)',
            '--swap-scrollbar-thumb-hover': isDarkMode 
              ? 'rgba(255, 255, 255, 0.5)'
              : 'rgba(0, 0, 0, 0.5)',
            '--swap-switch-bg': isDarkMode 
              ? 'linear-gradient(45deg, #34495e, #2c3e50)'
              : 'linear-gradient(45deg, #e9ecef, #f8f9fa)',
            '--swap-switch-shadow': isDarkMode 
              ? '0 6px 16px rgba(52, 73, 94, 0.4)'
              : '0 6px 16px rgba(0, 0, 0, 0.1)',
            '--swap-switch-hover-bg': isDarkMode 
              ? 'linear-gradient(45deg, #2c3e50, #34495e)'
              : 'linear-gradient(45deg, #dee2e6, #e9ecef)',
            '--swap-switch-hover-shadow': isDarkMode 
              ? '0 8px 20px rgba(52, 73, 94, 0.5)'
              : '0 8px 20px rgba(0, 0, 0, 0.15)'
          }}
        >
          <div className={styles.swapLayout} onClick={(e) => e.stopPropagation()}>
            <div className={styles.swapPanel}>
              <div className={styles.swapHeader} style={{ padding: '8px 12px' }}>
                <Typography variant="h6" className={styles.swapTitle} style={{ fontSize: '15px' }}>Swap</Typography>
                <IconButton aria-label="Close swap" title="Close" onClick={handleCloseSwapModal} className={styles.closeButton} sx={{ 
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)', 
                  padding: '4px' 
                }}>
                  <Close sx={{ fontSize: '18px' }} />
                </IconButton>
              </div>
              <div className={styles.swapBody} style={{ padding: '8px 12px', gap: '6px' }}>
                <Box>
                   <div className={styles.networkRow} style={{ marginBottom: '4px' }}>
                     <Typography variant="caption" sx={{ 
                       color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)', 
                       fontWeight: '500',
                       background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)',
                       padding: '4px 8px',
                       borderRadius: '4px',
                       border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(44, 62, 80, 0.1)'
                     }}>
                       {selectedNetwork}
                     </Typography>
                   </div>
                   
                  <div className={`${styles.tokenSection} ${styles.boxSpacing}`}>
                    <div className={styles.inputRow}>
                      <input
                        type="number"
                        className={styles.inputField}
                        value={swapAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0.0"
                        step="0.001"
                        min="0"
                      />
                      <div className={styles.inputSuffix}>
                        <button type="button" className={styles.maxButtonChip} onClick={handleMaxAmount}>MAX</button>
                        <button type="button" className={styles.tokenSelectorBtn} onClick={() => setTokenDropdownOpen(!tokenDropdownOpen)}>
                          <img
                            src={isReversed ? '/assets/icons/cweth.svg' : (availableTokens.find(t => t.symbol === selectedToken)?.icon || '/assets/icons/eth-svgrepo-com.svg')}
                            alt={isReversed ? 'Confidential WETH' : (availableTokens.find(t => t.symbol === selectedToken)?.name || 'Ethereum')}
                          />
                          <span className={styles.suffixSymbol}>{isReversed ? 'cWETH' : selectedToken}</span>
                          <span className={styles.caret}>▾</span>
                        </button>
                      </div>
                    </div>
                    {tokenDropdownOpen && (
                      <div className={styles.inlineDropdown}>
                        {availableTokens.map((token) => (
                          <button
                            key={token.symbol}
                            className={styles.dropdownItem}
                            onClick={() => {
                              if (token.functional) {
                                setSelectedToken(token.symbol);
                                setTokenDropdownOpen(false);
                              }
                            }}
                            disabled={!token.functional}
                          >
                            <span className={styles.dropdownLeft}>
                              <img 
                                src={token.icon} 
                                alt={token.name}
                              />
                              <span className={styles.dropdownName}>{isReversed ? `Confidential ${token.name}` : token.name}</span>
                              <span className={styles.dropdownTicker}>{isReversed ? `c${token.symbol}` : token.symbol}</span>
                            </span>
                            <span className={styles.dropdownStatus}>{token.functional ? 'Available' : 'Soon'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Balance Display - Only show for forward swaps (ETH → cWETH) */}
                  {balance && !isReversed && (
                    <Box sx={{ 
                      mt: 1, 
                      mb: 1,
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      px: 1
                    }}>
                      <Typography variant="caption" sx={{ 
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                        fontSize: '12px'
                      }}>
                        Balance: {parseFloat(balance.formatted).toFixed(4)} {selectedToken}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                        fontSize: '11px'
                      }}>
                        ≈ ${(parseFloat(balance.formatted) * 4000).toFixed(2)}
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Balance Error Notification - Only show for forward swaps */}
                  {showBalanceError && !isReversed && (
                    <Box sx={{ 
                      mt: 1, 
                      mb: 1,
                      p: 1.5,
                      background: 'rgba(231, 76, 60, 0.1)',
                      border: '1px solid rgba(231, 76, 60, 0.3)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <Typography sx={{ color: '#e74c3c', fontSize: '16px' }}>⚠️</Typography>
                      <Typography variant="caption" sx={{ 
                        color: '#e74c3c',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        Amount exceeds your balance of {balance?.formatted} {isReversed ? 'cWETH' : selectedToken}
                      </Typography>
                    </Box>
                  )}
                  
                  <div className={`${styles.switchWrap} ${styles.switchGap}`} style={{ marginBottom: '4px' }}>
                    <div className={styles.switchButton} onClick={handleSwapReversal}>
                      <SwapHoriz sx={{ color: isDarkMode ? 'white' : '#000000', fontSize: 24 }} />
                    </div>
                  </div>
                  <div className={`${styles.tokenSection} ${styles.boxSpacing}`}>
                    <div className={styles.inputRow}>
                      <input
                        type="text"
                        className={`${styles.inputField} ${styles.readOnlyField}`}
                        value={showBalanceError ? '0.0' : (swapAmount || '0.0')}
                        readOnly
                      />
                      <div className={styles.inputSuffix}>
                        <div className={styles.tokenSelectorBtn}>
                          <img 
                            src={isReversed ? (availableTokens.find(t => t.symbol === selectedToken)?.icon || '/assets/icons/eth-svgrepo-com.svg') : '/assets/icons/cweth.svg'} 
                            alt={isReversed ? (availableTokens.find(t => t.symbol === selectedToken)?.name || 'Ethereum') : 'Confidential WETH'}
                          />
                          <span className={styles.suffixSymbol}>{isReversed ? selectedToken : 'cWETH'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Box>
                <Box style={{ marginTop: '4px' }}>
                  <div className={styles.detailsCard} style={{ marginBottom: '4px' }}>
                    <Typography variant="caption" sx={{ 
                      display: 'block', 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.75)' 
                    }}>
                      {isReversed ? `1 cWETH = 1 ${selectedToken}` : `1 ${selectedToken} = 1 cWETH`} • Fee ~$2.50 • Min 0.001 {isReversed ? selectedToken : 'cWETH'}
                    </Typography>
                  </div>
                  <div className={`${styles.actionsRow} ${styles.actionsSpacer}`}>
                    <Button 
                      fullWidth 
                      size="small" 
                      variant="contained" 
                      onClick={handleSwap}
                      disabled={
                        !swapAmount || 
                        parseFloat(swapAmount) <= 0 || 
                        isSwapPending || 
                        isSwapConfirming || 
                        !availableTokens.find(t => t.symbol === selectedToken)?.functional ||
                        isReversed || // Disable for reverse swaps (not implemented yet)
                        showBalanceError // Disable if amount exceeds balance
                      }
                      className={styles.primaryAction}
                      sx={{
                        background: !isReversed && swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError
                          ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
                          : undefined,
                        color: !isReversed && swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError
                          ? 'white'
                          : undefined,
                        fontWeight: '700',
                        fontSize: '13px',
                        textTransform: 'none',
                        borderRadius: '8px',
                        py: 1,
                        boxShadow: !isReversed && swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError
                          ? '0 4px 12px rgba(52, 152, 219, 0.3)'
                          : 'none',
                        '&:hover': !isReversed && swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError ? {
                          background: 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)',
                          boxShadow: '0 6px 16px rgba(52, 152, 219, 0.4)'
                        } : {},
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isSwapPending || isSwapConfirming ? 'Processing...' : 
                       isReversed ? 'Coming Soon' : 
                       !availableTokens.find(t => t.symbol === selectedToken)?.functional ? 'Coming Soon' :
                       !swapAmount || parseFloat(swapAmount) <= 0 ? 'Enter amount' : 
                       'Swap'}
                    </Button>
                  </div>
                  <div className={styles.advancedRow}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Advanced Options</Typography>
                    <div className={styles.advancedActions}>
                      <Button size="small" sx={{ color: 'rgba(255, 255, 255, 0.7)', textTransform: 'none' }}>Settings</Button>
                      <Button size="small" sx={{ color: 'rgba(255, 255, 255, 0.7)', textTransform: 'none' }}>History</Button>
                    </div>
                  </div>
                 </Box>
               </div>
             </div>
           </div>

        </Box>
      )}

      {/* Supply Modal */}
      {showSupplyModal && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          p: 2
        }}>
          <Box sx={{
            background: isDarkMode 
              ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            color: isDarkMode ? 'white' : '#000000',
            borderRadius: '16px',
            p: 4,
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(44, 62, 80, 0.2)',
            boxShadow: isDarkMode 
              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
              : '0 8px 32px rgba(0, 0, 0, 0.15)'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000', fontFamily: 'sans-serif' }}>
                Supply cWETH
              </Typography>
              <Button
                onClick={() => setShowSupplyModal(false)}
                sx={{
                  color: isDarkMode ? 'white' : '#000000',
                  minWidth: 'auto',
                  p: 1,
                  borderRadius: '50%',
                  '&:hover': {
                    background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)'
                  }
                }}
              >
                ✕
              </Button>
            </Box>
            <SupplyForm onTransactionSuccess={refreshAllBalances} />
          </Box>
        </Box>
      )}

      {/* Wallet Info Popup */}
      <Menu
        anchorEl={walletInfoAnchor}
        open={Boolean(walletInfoAnchor)}
        onClose={handleCloseWalletInfo}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            maxWidth: 320,
            borderRadius: '4px',
            boxShadow: isDarkMode 
              ? '0 8px 32px rgba(0, 0, 0, 0.15)'
              : '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            background: isDarkMode 
              ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            backdropFilter: 'blur(10px)',
            color: isDarkMode ? 'white' : '#000000'
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ 
            mb: 2, 
            pb: 2, 
            borderBottom: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="body1" sx={{ 
                        fontWeight: '600',
              color: isDarkMode ? 'white' : '#000000' 
            }}>
              Account
            </Typography>
            
            {/* Day/Night Mode Toggle */}
            <Box
              onClick={() => setIsDarkMode(!isDarkMode)}
              sx={{
                width: 60,
                height: 28,
                borderRadius: '14px',
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                  : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                border: isDarkMode 
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 4px 12px rgba(0, 0, 0, 0.1)',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: isDarkMode 
                    ? '0 6px 16px rgba(0, 0, 0, 0.4)'
                    : '0 6px 16px rgba(0, 0, 0, 0.2)'
                }
              }}
            >
              {/* Moon Icon (Left) */}
              <Box sx={{
                position: 'absolute',
                left: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDarkMode ? 'white' : 'rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s ease'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </Box>
              
              {/* Sun Icon (Right) */}
              <Box sx={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'white',
                transition: 'all 0.3s ease'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </Box>
              
              {/* Slider */}
              <Box sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)'
                  : 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
                position: 'absolute',
                top: '3px',
                left: isDarkMode ? '3px' : '35px',
                transition: 'all 0.3s ease',
                boxShadow: isDarkMode 
                  ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                  : '0 2px 8px rgba(255, 215, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Icon inside slider */}
                {isDarkMode ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff8c00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                )}
              </Box>
            </Box>
          </Box>
          
          {/* Compact Address Section */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              p: 1.5,
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)',
              borderRadius: '8px',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(44, 62, 80, 0.1)'
            }}>
              <Box sx={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                background: '#4caf50'
              }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace', 
                  flex: 1,
                  color: isDarkMode ? 'white' : '#000000',
                  fontSize: '0.8rem'
                }}
              >
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCopyAddress}
                sx={{
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  p: 0.5,
                  '&:hover': {
                    background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                    color: isDarkMode ? 'white' : '#000000'
                  }
                }}
              >
                <ContentCopy sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Network & Balance Row */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2,
            p: 1.5,
            background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)',
            borderRadius: '8px',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(44, 62, 80, 0.1)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                background: '#4caf50'
              }} />
              <Typography variant="body2" sx={{ 
                color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)', 
                fontSize: '0.8rem',
                fontWeight: isDarkMode ? '500' : '300'
              }}>
                {selectedNetwork}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ 
              color: isDarkMode ? 'white' : '#000000', 
              fontWeight: isDarkMode ? '500' : '400', 
              fontSize: '0.8rem' 
            }}>
              {balance ? `${parseFloat(balance.formatted).toFixed(4)} ETH` : '0.0000 ETH'}
            </Typography>
          </Box>

          {/* Disconnect Button */}
          <Button
            fullWidth
            variant="outlined"
            onClick={handleDisconnect}
            sx={{
              borderRadius: '8px',
              py: 1,
              textTransform: 'none',
              fontWeight: '500',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(44, 62, 80, 0.2)',
              color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 62, 80, 0.8)',
              fontSize: '0.8rem',
              '&:hover': {
                background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(44, 62, 80, 0.3)',
                color: isDarkMode ? 'white' : '#000000'
              }
            }}
          >
            Disconnect
          </Button>
        </Box>
      </Menu>
    </>
  );
}
