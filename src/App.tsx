import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { AuthGate } from '@/auth/AuthGate';
import { AuthProvider } from '@/auth/AuthProvider';
import { DialogProvider, ToastProvider, Tooltip } from '@/components/ui';
import { AppShell } from '@/layout/AppShell';
import { AppRoutes } from '@/router';
import { TableStateProvider } from '@/state/tableState';
import { WeekProvider } from '@/state/week';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ToastProvider>
          <DialogProvider>
            <AuthProvider>
              <AuthGate>
                <WeekProvider>
                  <TableStateProvider>
                    <AppShell>
                      <AppRoutes />
                    </AppShell>
                  </TableStateProvider>
                </WeekProvider>
              </AuthGate>
            </AuthProvider>
            <Tooltip />
          </DialogProvider>
        </ToastProvider>
      </HashRouter>
    </QueryClientProvider>
  );
}
