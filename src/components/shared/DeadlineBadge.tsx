import { cx } from '@/components/ui/cx';
import { dueInfo } from '@/lib/deadline';

/** Hiện nguyên văn thời hạn + nhãn "Quá hạn N ngày" / "Còn N ngày" / "Hôm nay" (chữ + màu). */
export function DeadlineBadge({ text, status, today }: { text: string; status: string; today?: Date }) {
  const { kind, days } = dueInfo(text, status, today);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{text}</span>
      {kind && (
        <span
          data-testid="deadline-badge" data-kind={kind}
          className={cx(
            'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold tabular',
            kind === 'overdue' ? 'bg-late-bg text-late-text' : 'bg-doing-bg text-doing-text',
          )}
        >
          {kind === 'overdue' ? `Quá hạn ${days} ngày` : days === 0 ? 'Hôm nay' : `Còn ${days} ngày`}
        </span>
      )}
    </span>
  );
}
