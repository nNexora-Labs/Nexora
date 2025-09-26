'use client';

import { Suspense } from 'react';

// Simple FHE Provider component
const FHEProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Wrapper component for FHE operations
export const FHEWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={<div>Loading FHE components...</div>}>
      <FHEProvider>
        {children}
      </FHEProvider>
    </Suspense>
  );
};

export default FHEProvider;
