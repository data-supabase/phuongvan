import { StackBar } from '@/components/ui';
import { cx } from '@/components/ui/cx';
import { formatNumber } from '@/lib/format';
import { CATS, CAT_FILL, pctOf, type Cat } from '@/lib/status';
import { StatusLegend } from '../parts';
import type { WeekStat } from '../stats';

/** F-DASH-5: cột xếp chồng 8 tuần gần nhất, cột cao nhất chiếm 90% chiều cao khung. */
export function WeekTrend({ series, current, onDrill }: {
  series: WeekStat[]; current: string; onDrill: (g: { week: string; cat: Cat }) => void;
}) {
  const mx = Math.max(1, ...series.map((s) => s.total));
  return (
    <div data-testid="week-trend">
      <StatusLegend className="mb-4" />
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
        {series.map(({ week, total, counts }) => (
          <div key={week} data-testid={`trend-col-${week.replace('/', '-')}`} data-current={week === current || undefined}
            className={cx('flex h-44 flex-col justify-end rounded-md px-0.5 pt-1', week === current && 'bg-accent-soft')}>
            <span className="mb-1 text-center text-xs font-bold text-ink tabular">{formatNumber(total)}</span>
            <div className="mx-auto w-full max-w-10" style={{ height: `${(90 * total) / mx}%` }}>
              <StackBar
                direction="col" ariaLabel={`Tuần ${week}: ${total} việc`}
                segments={CATS.map(([k, l]) => ({
                  value: counts[k], color: CAT_FILL[k],
                  tip: `Tuần ${week} · ${l}: ${formatNumber(counts[k])} (${pctOf(counts[k], total)}%)`,
                  onClick: () => onDrill({ week, cat: k }),
                }))}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
        {series.map(({ week }, i) => {
          const [n, y] = week.split('/');
          const showYear = i === 0 || y !== series[i - 1].week.split('/')[1];
          return (
            <span key={week} data-tip={`Tuần ${week}`} className={cx('text-center text-xs tabular', week === current ? 'font-extrabold text-ink' : 'text-muted')}>
              {n}
              <span className="block text-2xs text-muted">{showYear ? y : ' '}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
