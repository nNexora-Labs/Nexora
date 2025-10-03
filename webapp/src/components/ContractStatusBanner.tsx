'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertTitle, Box, Button, Typography, Collapse } from '@mui/material';
import { Info, Refresh, Warning, CheckCircle, Error } from '@mui/icons-material';
import { useContractAddresses } from '../config/contractConfig';

interface ContractStatusBannerProps {
  isDarkMode?: boolean;
}

export default function ContractStatusBanner({ isDarkMode = false }: ContractStatusBannerProps) {
  const { addresses, status, isLatest, isEnvOverride, isValid, clearCache } = useContractAddresses();
  const [showDetails, setShowDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Clear cache and reload
    clearCache();
    
    // Reload the page to refresh all contract interactions
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
    setIsRefreshing(false);
  };

  // Only show banner if status indicates it should be shown
  if (!status.showBanner) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'error':
        return <Error sx={{ fontSize: '1.2rem' }} />;
      case 'warning':
        return <Warning sx={{ fontSize: '1.2rem' }} />;
      case 'success':
        return <CheckCircle sx={{ fontSize: '1.2rem' }} />;
      default:
        return <Info sx={{ fontSize: '1.2rem' }} />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'error':
        return isDarkMode ? '#ff5252' : '#f44336';
      case 'warning':
        return isDarkMode ? '#ff9800' : '#ff9800';
      case 'success':
        return isDarkMode ? '#4caf50' : '#2e7d32';
      default:
        return isDarkMode ? '#2196f3' : '#1976d2';
    }
  };

  return (
    <Alert
      severity={status.status === 'error' ? 'error' : status.status === 'warning' ? 'warning' : 'info'}
      sx={{
        mb: 2,
        borderRadius: '4px',
        background: isDarkMode 
          ? `linear-gradient(135deg, ${getStatusColor()}15 0%, ${getStatusColor()}08 100%)`
          : `linear-gradient(135deg, ${getStatusColor()}10 0%, ${getStatusColor()}05 100%)`,
        border: `1px solid ${getStatusColor()}40`,
        '& .MuiAlert-icon': {
          color: getStatusColor(),
        },
        '& .MuiAlert-message': {
          color: isDarkMode ? 'white' : '#2c3e50',
        },
      }}
      icon={getStatusIcon()}
      action={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {!isValid && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={isRefreshing}
              sx={{
                color: getStatusColor(),
                borderColor: `${getStatusColor()}60`,
                fontSize: '0.75rem',
                py: 0.5,
                px: 1,
                minWidth: 'auto',
                '&:hover': {
                  borderColor: getStatusColor(),
                  backgroundColor: `${getStatusColor()}10`,
                },
              }}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}
          <Button
            size="small"
            variant="text"
            onClick={() => setShowDetails(!showDetails)}
            sx={{
              color: getStatusColor(),
              fontSize: '0.75rem',
              py: 0.5,
              px: 1,
              minWidth: 'auto',
              '&:hover': {
                backgroundColor: `${getStatusColor()}10`,
              },
            }}
          >
            {showDetails ? 'Hide' : 'Details'}
          </Button>
        </Box>
      }
    >
      <AlertTitle sx={{ color: getStatusColor(), fontWeight: '600' }}>
        {status.message}
      </AlertTitle>
      
      <Typography variant="body2" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 62, 80, 0.8)' }}>
        {status.details}
      </Typography>

      <Collapse in={showDetails}>
        <Box sx={{ mt: 2, p: 2, backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)', borderRadius: '4px' }}>
          <Typography variant="body2" sx={{ 
            fontFamily: 'monospace', 
            fontSize: '0.75rem',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
            mb: 1
          }}>
            Contract Addresses:
          </Typography>
          
          {addresses && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2" sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.7rem',
                color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'
              }}>
                Vault: {addresses.VAULT_ADDRESS}
              </Typography>
              <Typography variant="body2" sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.7rem',
                color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(44, 62, 80, 0.6)'
              }}>
                cWETH: {addresses.CWETH_ADDRESS}
              </Typography>
            </Box>
          )}
          
          {!isLatest && (
            <Typography variant="body2" sx={{ 
              mt: 1,
              color: getStatusColor(),
              fontSize: '0.7rem'
            }}>
              ⚠️ You might be using an older contract deployment. Data may not be accurate.
            </Typography>
          )}
          
          {isEnvOverride && (
            <Typography variant="body2" sx={{ 
              mt: 1,
              color: getStatusColor(),
              fontSize: '0.7rem'
            }}>
              ℹ️ Using environment variable overrides from .env file
            </Typography>
          )}
        </Box>
      </Collapse>
    </Alert>
  );
}
