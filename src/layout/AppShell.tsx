import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { RegistrationWatcher } from '@/realtime/RegistrationWatcher';
import { PageHeader } from './PageHeader';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen md:flex" data-testid="app-shell">
      <Sidebar />
      <main className="min-w-0 flex-1 px-8 pb-10 pt-7 max-md:px-4 max-md:pb-8 max-md:pt-5">
        <PageHeader />
        <div key={pathname} className="animate-rise-in">{children}</div>
      </main>
      <RegistrationWatcher />
    </div>
  );
}
