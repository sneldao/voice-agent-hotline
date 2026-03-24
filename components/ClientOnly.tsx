'use client';

import { useState, useEffect, ReactNode } from 'react';

/**
 * ClientOnly - Prevents SSR for children components
 * Use this wrapper to avoid SSR issues with client-only SDKs
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
