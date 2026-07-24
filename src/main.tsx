import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import '@/styles/globals.css';
import { AppShell } from '@/app/AppShell';
import { AppCrashFallback } from '@/app/ErrorFallbacks';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initTheme } from '@/features/settings/theme';

initTheme();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={(error, reset) => <AppCrashFallback error={error} reset={reset} />}>
      <AppShell />
    </ErrorBoundary>
  </StrictMode>,
);
