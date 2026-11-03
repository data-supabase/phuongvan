import { EmptyState } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { CAT_FILL } from '@/lib/status';

/** F-DASH-6: top cuộc họp có nhiều việc chậm; thanh tỉ lệ với cuộc họp đứng đầu. */
export function LateMeetings({ items, onDrill }: {
  items: { meet: string; count: number }[]; onDrill: (g: { meet: string; cat: 'late' }) => void;
}) {
  if (!items.length) return <EmptyState message="Tuần này không có việc triển khai chậm." />;
  const mx = items[0].count;
  return (
    <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3.5" data-testid="late-meetings">
      {items.map(({ meet, count }, i) => (
        <li key={meet} className="min-w-0" data-testid={`late-meet-${i}`}>
          <p className="mb-1 line-clamp-2 break-words text-sm text-ink-2 [overflow-wrap:anywhere]" title={meet}>{meet || '(Không ghi cuộc họp)'}</p>
          <div className="grid grid-cols-[1fr_2rem] items-center gap-3">
            <div className="h-3.5 min-w-0">
              <button
                type="button" onClick={() => onDrill({ meet, cat: 'late' })}
                aria-label={`${meet}: ${count} việc chậm`} data-tip={`${meet}: ${count} việc chậm`}
                className="block h-full max-w-full animate-grow-x rounded-r-md transition-[filter] duration-fast hover:brightness-90 focus-visible:brightness-90"
                style={{ width: `${(100 * count) / mx}%`, background: CAT_FILL.late }}
              />
            </div>
            <span className="text-right text-sm font-bold text-ink tabular">{formatNumber(count)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
