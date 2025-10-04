'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ReactNode } from 'react';

// Create theme for consistent styling
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F5DCC6',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: 'sans-serif',
    h1: {
      fontFamily: 'sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    body1: {
      fontFamily: 'sans-serif',
      fontWeight: 400,
      letterSpacing: '-0.01em',
    },
    body2: {
      fontFamily: 'sans-serif',
      fontWeight: 400,
      letterSpacing: '-0.01em',
    },
    button: {
      fontFamily: 'sans-serif',
      fontWeight: 500,
      letterSpacing: '-0.01em',
      textTransform: 'none',
    },
    caption: {
      fontFamily: 'sans-serif',
      fontWeight: 400,
      letterSpacing: '-0.01em',
    },
  },
});

interface ClientThemeProviderProps {
  children: ReactNode;
}

export default function ClientThemeProvider({ children }: ClientThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
