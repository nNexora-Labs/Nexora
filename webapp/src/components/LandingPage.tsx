'use client';

import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  IconButton,
  useTheme,
  useMediaQuery,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import {
  Lock,
  TrendingUp,
  Security,
  Speed,
  AccountBalanceWallet,
  ArrowForward,
  Menu as MenuIcon,
  Close,
  GitHub,
  Twitter,
  Telegram,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLaunchApp = () => {
    console.log('Launch App button clicked, navigating to /dashboard...');
    console.log('Router object:', router);
    console.log('Current URL:', window.location.href);
    
    try {
      router.push('/dashboard');
      console.log('Navigation initiated successfully');
    } catch (error) {
      console.error('Navigation failed:', error);
      // Fallback to window.location if router fails
      window.location.href = '/dashboard';
    }
  };


  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)' }}>
      {/* Navigation */}
      <AppBar 
        position="static" 
        sx={{ 
          bgcolor: 'transparent',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 800,
                fontSize: { xs: '1.1rem', sm: '1.5rem' },
                letterSpacing: '-0.02em',
                fontFamily: 'sans-serif',
                background: 'linear-gradient(135deg, #ffffff 0%, #8a9ba8 50%, #ffffff 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
                position: 'relative',
              }}
            >
              Nexora
            </Typography>
          </Box>
          
          {!isMobile ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <Button color="inherit" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)' }}>
                Features
              </Button>
              <Button color="inherit" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)' }}>
                Documentation
              </Button>
              <Button color="inherit" sx={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)' }}>
                About
              </Button>
              <Button
                variant="contained"
                onClick={handleLaunchApp}
                sx={{
                  bgcolor: '#1976d2',
                  borderRadius: '4px',
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  minWidth: '140px',
                  '&:hover': {
                    bgcolor: '#1565c0',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Launch App
              </Button>
            </Stack>
          ) : (
            <IconButton
              color="inherit"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <Close /> : <MenuIcon />}
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Menu */}
      {mobileMenuOpen && isMobile && (
        <Box
          sx={{
            position: 'fixed',
            top: 64,
            left: 0,
            right: 0,
            bgcolor: '#121212',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 1000,
            p: 2,
          }}
        >
          <Stack spacing={2}>
            <Button color="inherit" sx={{ fontWeight: 500, justifyContent: 'flex-start', color: 'rgba(255, 255, 255, 0.7)' }}>
              Features
            </Button>
            <Button color="inherit" sx={{ fontWeight: 500, justifyContent: 'flex-start', color: 'rgba(255, 255, 255, 0.7)' }}>
              Documentation
            </Button>
            <Button color="inherit" sx={{ fontWeight: 500, justifyContent: 'flex-start', color: 'rgba(255, 255, 255, 0.7)' }}>
              About
            </Button>
            <Button
              variant="contained"
              onClick={handleLaunchApp}
              sx={{
                bgcolor: '#1976d2',
                borderRadius: '4px',
                py: 1.5,
                fontWeight: 600,
                fontSize: '0.95rem',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#1565c0',
                },
              }}
            >
              Launch App
            </Button>
          </Stack>
        </Box>
      )}

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: 8, pb: 6 }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', md: '4rem', lg: '5rem' },
              fontWeight: 700,
              mb: 3,
              background: 'linear-gradient(45deg, #ffffff, #e3f2fd)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
              fontFamily: 'sans-serif',
            }}
          >
            Confidential Lending
            <br />
            Protocol
          </Typography>
          
          <Typography
            variant="h5"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              mb: 4,
              maxWidth: '600px',
              mx: 'auto',
              fontWeight: 400,
              lineHeight: 1.6,
              fontFamily: 'sans-serif',
            }}
          >
            The first fully encrypted lending protocol using Zama&apos;s FHE technology. 
            Supply tokens privately and earn yields while maintaining complete confidentiality.
          </Typography>
          
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            sx={{ mb: 6 }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={handleLaunchApp}
              sx={{
                bgcolor: '#1976d2',
                borderRadius: '4px',
                px: 4,
                py: 2,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                minWidth: '180px',
                '&:hover': {
                  bgcolor: '#1565c0',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(25, 118, 210, 0.3)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Launch App
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: 'white',
                borderRadius: '4px',
                px: 4,
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                textTransform: 'none',
                minWidth: '200px',
                '&:hover': {
                  borderColor: '#1976d2',
                  bgcolor: 'rgba(25, 118, 210, 0.05)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              View Documentation
            </Button>
          </Stack>
        </Box>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          py: 4,
          mt: 8,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    letterSpacing: '-0.02em',
                    fontFamily: 'sans-serif',
                    background: 'linear-gradient(135deg, #ffffff 0%, #8a9ba8 50%, #ffffff 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
                    position: 'relative',
                  }}
                >
                  Nexora
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                Confidential lending protocol powered by Zama FHEVM
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                © 2025 Nexora. Built by Nexora-Labs. All rights reserved.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-end' }}>
                <IconButton
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': { color: '#1976d2' },
                  }}
                >
                  <GitHub />
                </IconButton>
                <IconButton
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': { color: '#1976d2' },
                  }}
                >
                  <Twitter />
                </IconButton>
                <IconButton
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': { color: '#1976d2' },
                  }}
                >
                  <Telegram />
                </IconButton>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
