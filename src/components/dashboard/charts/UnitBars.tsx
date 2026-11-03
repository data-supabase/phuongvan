import { StackBar } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { CATS, CAT_FILL, pctOf, type Cat } from '@/lib/status';
import { StatusLegend } from '../parts';
import type { UnitStat } from '../stats';

/** F-DASH-4: thanh xếp chồng theo đơn vị; độ dài tỉ lệ với đơn vị nhiều việc nhất. */
export function UnitBars({ stats, onDrill }: { stats: UnitStat[]; onDrill: (g: { unit: string; cat: Cat }) => void }) {
  const mx = Math.max(1, ...stats.map((s) => s.total));
  return (
    <div data-testid="unit-bars">
      <StatusLegend className="mb-4" />
      <ul className="grid gap-3">
        {stats.map(({ unit, total, counts }) => (
          <li key={unit} data-testid={`unit-bar-${unit}`} className="grid grid-cols-[3.25rem_1fr_2.5rem] items-center gap-3">
            <b className="text-sm text-ink">{unit}</b>
            <div className="min-w-0">
              {total > 0 ? (
                <div style={{ width: `${(100 * total) / mx}%`, minWidth: '1.25rem' }}>
                  <StackBar
                    size="md"
                    ariaLabel={`${unit}: ${CATS.map(([k, l]) => `${l} ${counts[k]}`).join(', ')}`}
                    segments={CATS.map(([k, l]) => ({
                      value: counts[k], color: CAT_FILL[k],
                      tip: `${unit} · ${l}: ${formatNumber(counts[k])} (${pctOf(counts[k], total)}%)`,
                      onClick: () => onDrill({ unit, cat: k }),
                    }))}
                  />
                </div>
              ) : <span className="block h-px bg-line" aria-hidden="true" />}
            </div>
            <span className="text-right text-sm font-bold text-ink tabular">{formatNumber(total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
