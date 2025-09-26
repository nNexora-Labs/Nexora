'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { walletConnect, injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import Dashboard from '../components/Dashboard';

// Create wagmi config
const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected({
      target: 'metaMask',
    }),
    injected({
      target: 'rabby',
    }),
    injected({
      target: 'coinbaseWallet',
    }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
      metadata: {
        name: 'Confidential Lending Protocol',
        description: 'Fully encrypted lending protocol using Zama FHEVM',
        url: 'https://confidential-lending.vercel.app',
        icons: ['https://confidential-lending.vercel.app/icon.png'],
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
});

// Create query client
const queryClient = new QueryClient();

// Create theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <Dashboard />
          </Box>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
