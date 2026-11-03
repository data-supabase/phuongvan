import { useMemo } from 'react';
import { DeadlineBadge } from '@/components/shared/DeadlineBadge';
import { formatNumber } from '@/lib/format';
import { dueInfo, parseDeadline } from '@/lib/deadline';
import { useTableState } from '@/state/tableState';
import type { Task } from '@/types/app';

/** Thẻ "Sắp đến hạn & quá hạn" của tuần đang xem. */
export function DueSoonCard({ rows }: { rows: Task[] }) {
  const { drill } = useTableState();
  const { overdue, soon, groups } = useMemo(() => {
    const now = new Date();
    const flagged = rows.flatMap((t) => {
      const i = dueInfo(t.thoi_han, t.tinh_trang, now);
      return i.kind ? [{ t, kind: i.kind, at: parseDeadline(t.thoi_han)!.getTime() }] : [];
    });
    flagged.sort((a, b) => a.at - b.at);
    const soonL = flagged.filter((f) => f.kind === 'soon'), overL = flagged.filter((f) => f.kind === 'overdue');
    return { overdue: overL.length, soon: soonL.length, groups: [['Trong 7 ngày tới', soonL], ['Quá hạn', overL]] as const };
  }, [rows]);
  const top = groups.flatMap(([, l]) => l);

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
          {/* hiện TẤT CẢ việc gắn cờ; danh sách dài thì cuộn trong thẻ */}
          <div className="mt-3 max-h-96 overflow-y-auto pr-1 scroll-thin" data-testid="due-soon-list">
            {groups.map(([label, list]) => list.length > 0 && (
              <div key={label}>
                <h3 className="eyebrow sticky top-0 z-[1] bg-surface py-1.5">{label} ({formatNumber(list.length)})</h3>
                <ul className="divide-y divide-line">
                  {list.map(({ t }) => (
                    <li key={t.id} data-testid="due-soon-row">
                      <button
                        type="button" onClick={() => drill({ open: t.id })}
                        className="w-full py-2 text-left text-sm hover:bg-accent-soft focus-visible:bg-accent-soft"
                      >
                        <span className="line-clamp-2 font-bold text-ink">{t.noi_dung || '(Không ghi tên công việc)'}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
                          <span>{t.don_vi_dau_moi || '—'}</span>
                          <DeadlineBadge text={t.thoi_han} status={t.tinh_trang} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
