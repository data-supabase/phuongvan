import { useMemo } from 'react';
import { DeadlineBadge } from '@/components/shared/DeadlineBadge';
import { formatNumber } from '@/lib/format';
import { dueInfo, parseDeadline } from '@/lib/deadline';
import { useTableState } from '@/state/tableState';
import type { Task } from '@/types/app';

/** Thẻ "Sắp đến hạn & quá hạn" của tuần đang xem. */
export function DueSoonCard({ rows }: { rows: Task[] }) {
  const { drill } = useTableState();
  const { overdue, soon, top } = useMemo(() => {
    const now = new Date();
    const flagged = rows.flatMap((t) => {
      const i = dueInfo(t.thoi_han, t.tinh_trang, now);
      return i.kind ? [{ t, kind: i.kind, at: parseDeadline(t.thoi_han)!.getTime() }] : [];
    });
    flagged.sort((a, b) => (a.kind === b.kind ? a.at - b.at : a.kind === 'overdue' ? -1 : 1));
    return {
      overdue: flagged.filter((f) => f.kind === 'overdue').length,
      soon: flagged.filter((f) => f.kind === 'soon').length,
      top: flagged.slice(0, 6),
    };
  }, [rows]);

  // shortcut: drill chưa có bộ lọc "hạn", mở Bảng không lọc; thêm khi cần
  const go = () => drill({});

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card max-sm:p-3" data-testid="due-soon-card" aria-labelledby="due-soon-title">
      <h2 id="due-soon-title" className="text-base font-bold text-ink">Sắp đến hạn &amp; quá hạn</h2>
      {top.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Không có việc sắp đến hạn.</p>
      ) : (
        <>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={go} data-testid="due-overdue-count" className="flex-1 rounded-lg bg-late-bg px-3 py-2 text-left text-late-text">
              <b className="block text-2xl tabular">{formatNumber(overdue)}</b>
              <span className="text-xs font-bold">Quá hạn</span>
            </button>
            <button type="button" onClick={go} data-testid="due-soon-count" className="flex-1 rounded-lg bg-doing-bg px-3 py-2 text-left text-doing-text">
              <b className="block text-2xl tabular">{formatNumber(soon)}</b>
              <span className="text-xs font-bold">Trong 7 ngày tới</span>
            </button>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {top.map(({ t }) => (
              <li key={t.id} data-testid="due-soon-row">
                <button
                  type="button" onClick={() => drill({ meet: t.thong_tin_cuoc_hop })}
                  className="w-full py-2 text-left text-sm hover:bg-accent-soft focus-visible:bg-accent-soft"
                >
                  <span className="line-clamp-2 font-bold text-ink">{t.noi_dung}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
                    <span>{t.don_vi_dau_moi || '—'}</span>
                    <DeadlineBadge text={t.thoi_han} status={t.tinh_trang} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
