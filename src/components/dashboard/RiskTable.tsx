import { formatNumber } from '@/lib/format';
import { CAT_FILL, pctOf, riskLevel } from '@/lib/status';
import type { DrillTarget } from '@/state/tableState';
import { cx } from '@/components/ui/cx';
import type { UnitStat } from './stats';

const LV = { hi: 'bg-late-bg text-late-text', mid: 'bg-doing-bg text-doing-text', lo: 'bg-done-bg text-done-text' } as const;

/** F-DASH-3: nhận danh sách đã xếp (unitRiskRanking). */
export function RiskTable({ stats, onDrill }: { stats: UnitStat[]; onDrill: (g: DrillTarget) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto scroll-thin px-1">
      <table className="w-full border-separate border-spacing-0 text-sm" data-testid="risk-table">
        <thead>
          <tr className="text-left text-2xs font-bold uppercase text-muted">
            <th className="border-b border-line pb-2 pr-3">Đơn vị</th>
            <th className="border-b border-line pb-2 pr-3 text-right max-sm:hidden">Số việc</th>
            <th className="border-b border-line pb-2 pr-3">Hoàn thành</th>
            <th className="border-b border-line pb-2 pr-3 text-right">Chậm</th>
            <th className="border-b border-line pb-2 pr-3 text-right max-sm:hidden">Chưa TK</th>
            <th className="border-b border-line pb-2">Rủi ro</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(({ unit, total, counts }) => {
            const [lv, text] = riskLevel(counts.late / total);
            const done = pctOf(counts.done, total);
            const go = () => onDrill({ unit, cat: 'late' });
            return (
              <tr
                key={unit} data-testid={`risk-row-${unit}`} data-level={lv} tabIndex={0} onClick={go}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
                data-tip={`Bấm để xem việc chậm của ${unit}`}
                className="group cursor-pointer outline-none transition-colors duration-fast hover:bg-accent-soft focus-visible:bg-accent-soft"
              >
                <td className="border-b border-line py-3 pr-3 font-bold text-ink">
                  {unit}<span className="hidden text-xs font-normal text-muted max-sm:block">{formatNumber(total)} việc</span>
                </td>
                <td className="border-b border-line py-3 pr-3 text-right tabular max-sm:hidden">{formatNumber(total)}</td>
                <td className="border-b border-line py-3 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2 max-sm:w-10" aria-hidden="true">
                      <span className="block h-full animate-grow-x rounded-full" style={{ width: `${done}%`, background: CAT_FILL.done }} />
                    </span>
                    <span className="tabular">{done}%</span>
                  </span>
                </td>
                <td className="border-b border-line py-3 pr-3 text-right tabular">
                  <b>{formatNumber(counts.late)}</b> <span className="text-muted">({pctOf(counts.late, total)}%)</span>
                </td>
                <td className="border-b border-line py-3 pr-3 text-right tabular max-sm:hidden">{formatNumber(counts.todo)}</td>
                <td className="border-b border-line py-3">
                  <span className={cx('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', LV[lv])}>{text}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
