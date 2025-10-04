'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box } from '@mui/material';
import { ConnectKitProvider } from 'connectkit';
import Dashboard from '../../components/Dashboard';
import { config } from '../../config/wagmi';

// Create query client
const queryClient = new QueryClient();

export default function DashboardPage() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <Dashboard />
          </Box>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}