'use client';

import { lazy, Suspense } from 'react';

// Lazy load FHE components to reduce initial bundle size
export const LazyFHEProvider = lazy(() => import('./FHEProvider'));

// Wrapper component for FHE operations
export const FHEWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={<div>Loading FHE components...</div>}>
      <LazyFHEProvider>
        {children}
      </LazyFHEProvider>
    </Suspense>
  );
};

// Simple FHE Provider component
const FHEProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default FHEProvider;
