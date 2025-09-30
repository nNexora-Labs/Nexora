'use client';

import { useEffect } from 'react';

export default function ConsoleFilter() {
  useEffect(() => {
    // Suppress network error logs from console
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      // Suppress Infura rate limiting errors and network errors
      if (message.includes('429') || 
          message.includes('Too Many Requests') || 
          message.includes('sepolia.infura.io') ||
          message.includes('POST https://sepolia.infura.io') ||
          message.includes('relayer-sdk-js.umd.cjs')) {
        return; // Don't log these errors
      }
      originalConsoleError.apply(console, args);
    };

    // Cleanup function to restore original console.error
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return null; // This component doesn't render anything
}
