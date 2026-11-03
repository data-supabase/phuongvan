import { useMemo } from 'react';
import { Card } from '@/components/ui';
import { CAT_LABEL, statusClass } from '@/lib/status';
import { diffSummary, removedTasks } from '@/lib/weekDiff';
import type { Task } from '@/types/app';

interface Props { rows: Task[]; prevWeek: string; prevByKey: Map<string, Task>; prevRows: Task[] }

export function WeekChangesCard({ rows, prevWeek, prevByKey, prevRows }: Props) {
  const s = useMemo(() => diffSummary(rows, prevByKey, prevRows), [rows, prevByKey, prevRows]);
  const removed = useMemo(() => removedTasks(rows, prevRows), [rows, prevRows]);

  if (!prevWeek) {
    return <Card data-testid="week-changes-card"><p className="text-sm text-muted">Chưa có tuần trước để so sánh.</p></Card>;
  }
  const stat = (label: string, value: number, testId: string, hint?: string) => (
    <div className="rounded-lg border border-line bg-surface-2 p-3" data-testid={testId}>
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {hint && <div className="mt-0.5 text-xs font-semibold text-ink-2">{hint}</div>}
    </div>
  );
  return (
    <Card title={`Biến động so với tuần ${prevWeek}`} data-testid="week-changes-card">
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {stat('Việc mới', s.added, 'wc-added')}
        {stat('Đổi trạng thái', s.statusChanged, 'wc-changed', `↗ ${s.improved} cải thiện · ↘ ${s.worsened} xấu đi`)}
        {stat('Không còn trong báo cáo', s.removed, 'wc-removed')}
      </div>
      {removed.length > 0 && (
        <details className="mt-4" data-testid="wc-removed-list">
          <summary className="cursor-pointer text-sm font-semibold text-navy-900">Xem {removed.length} việc không còn trong báo cáo</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {removed.map((r) => (
              <li key={r.key} className="py-2">
                <div className="break-words font-semibold text-ink">{r.noi_dung || '(Không ghi tên công việc)'}</div>
                <div className="text-xs text-muted">{r.don_vi_dau_moi || '—'} · Trạng thái cuối: {r.tinh_trang || CAT_LABEL[statusClass(r.tinh_trang)]}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
