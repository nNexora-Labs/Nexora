import type { Metadata } from 'next';
import './globals.css';
import ConsoleFilter from '../components/ConsoleFilter';

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
    <html lang="en">
      <body style={{ 
        fontFamily: 'sans-serif',
        fontWeight: '400',
        letterSpacing: '-0.01em'
      }}>
        <ConsoleFilter />
        {children}
      </body>
    </html>
  );
}
