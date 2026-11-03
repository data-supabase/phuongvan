import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Skeleton } from '@/components/ui';
import { canOpen, routeFor } from '@/layout/routes';
import type { ReactNode } from 'react';

// R-11: mỗi trang một chunk riêng để bundle chính nhỏ lại
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TablePage = lazy(() => import('@/pages/TablePage').then((m) => ({ default: m.TablePage })));
const ImportPage = lazy(() => import('@/pages/ImportPage').then((m) => ({ default: m.ImportPage })));
const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })));

// Trang xem thử bộ UI, chỉ có khi chạy dev (không vào bundle production)
const UiKit = import.meta.env.DEV ? lazy(() => import('@/pages/UiKitPage')) : null;

/** Vào route không đủ quyền thì về Dashboard (F-SHELL-2). Quyền thật nằm ở DB; đây chỉ báo sớm. */
function Guard({ path, children }: { path: string; children: ReactNode }) {
  const { me } = useAuth();
  return canOpen(routeFor(path), me?.role) ? <>{children}</> : <Navigate to="/" replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<div data-testid="page-loading" className="grid gap-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>}>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/table" element={<TablePage />} />
      <Route path="/import" element={<Guard path="/import"><ImportPage /></Guard>} />
      <Route path="/users" element={<Guard path="/users"><UsersPage /></Guard>} />
      {UiKit && (
        <Route path="/__ui" element={<Suspense fallback={<Skeleton className="h-40" />}><UiKit /></Suspense>} />
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
