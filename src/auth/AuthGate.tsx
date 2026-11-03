import type { ReactNode } from 'react';
import { LoginPage } from '@/pages/LoginPage';
import { Skeleton } from '@/components/ui';
import { Brand } from '@/layout/Brand';
import { useAuth } from './AuthProvider';

/** Chưa đăng nhập thì hiện màn đăng nhập ở mọi URL (D-004). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { phase } = useAuth();
  if (phase === 'loading') {
    return (
      <div data-testid="auth-loading" role="status" aria-label="Đang tải" className="grid min-h-screen place-items-center bg-bg">
        <div className="grid w-60 gap-4 animate-fade-in">
          <Brand tone="dark" />
          <Skeleton className="h-2" />
          <Skeleton className="h-2 w-2/3" />
        </div>
      </div>
    );
  }
  return phase === 'ready' ? <>{children}</> : <LoginPage />;
}
