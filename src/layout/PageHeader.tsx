import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { formatDateTime } from '@/lib/format';
import { useWeek } from '@/state/week';
import { routeFor } from './routes';
import { WeekNav } from './WeekNav';

export function PageHeader() {
  const { pathname } = useLocation();
  const route = routeFor(pathname);
  const { week, updatedAt } = useWeek();

  useEffect(() => { document.title = `${route.title} · Báo cáo tuần`; }, [route.title]);

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 data-testid="page-title" className="text-2xl font-bold text-ink max-sm:text-xl">{route.title}</h1>
        {route.weekNav && (
          <p data-testid="week-title" className="mt-1 text-sm text-muted">
            Tuần <b className="font-semibold text-ink-2">{week || '—'}</b>
            {updatedAt && <span data-testid="updated-at"> · cập nhật {formatDateTime(updatedAt)}</span>}
          </p>
        )}
      </div>
      {route.weekNav && <WeekNav />}
    </header>
  );
}
