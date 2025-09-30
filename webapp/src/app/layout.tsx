import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ConsoleFilter from '../components/ConsoleFilter';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Nexora - Confidential Lending Protocol',
  description: 'Privacy-first lending protocol using FHE technology',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ 
        fontFamily: 'var(--font-inter), "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontWeight: '400',
        letterSpacing: '-0.01em'
      }}>
        <ConsoleFilter />
        {children}
      </body>
    </html>
  );
}
