import { StackBar } from '@/components/ui';
import { IconAlert, IconCheck, IconClock, IconDashed } from '@/components/ui/icons';
import { formatNumber } from '@/lib/format';
import { CATS, CAT_FILL, pctOf, type Cat } from '@/lib/status';
import { DeltaChip, StatusLegend, catSegs, stagger } from './parts';
import { GOOD_UP, type Overview } from './stats';

type Drill = (c: Cat) => void;
const ICON = { done: IconCheck, doing: IconClock, late: IconAlert, todo: IconDashed } as const;
const ICON_BG: Record<Cat, string> = { done: 'bg-done-bg text-done-text', doing: 'bg-doing-bg text-doing-text', late: 'bg-late-bg text-late-text', todo: 'bg-todo-bg text-todo-text' };

/** F-DASH-2: khối hero navy, số lớn */
export function ProgressHero({ o, prevWeek, onDrill }: { o: Overview; prevWeek: string; onDrill: Drill }) {
  const link = 'rounded font-bold underline decoration-white/40 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-white';
  return (
    <section
      data-testid="progress-hero" aria-label="Tiến độ tổng thể"
      className="animate-rise-in overflow-hidden rounded-xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-6 text-white shadow-card max-sm:p-4"
    >
      <p className="text-2xs font-bold uppercase text-navy-200">Tiến độ tổng thể</p>
      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-x-6 gap-y-4 max-sm:grid-cols-1">
        <div>
          <p className="text-sm font-semibold text-navy-100">Hoàn thành</p>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span data-testid="hero-done-pct" className="text-[3.5rem] font-extrabold leading-none tracking-tight tabular max-sm:text-5xl">{o.donePct}%</span>
            <DeltaChip delta={o.donePctDelta} goodUp unit=" điểm %" testId="hero-done-delta"
              tip={`So với tuần ${prevWeek}: ${o.prev ? pctOf(o.prev.counts.done, o.prev.total) : 0}%`} />
          </div>
          <p className="mt-1.5 text-sm text-navy-100">
            <button type="button" className={link} onClick={() => onDrill('done')} data-testid="hero-done-link">{formatNumber(o.counts.done)}</button>
            {' / '}{formatNumber(o.total)} việc{prevWeek && o.donePctDelta !== null && <span className="text-navy-300"> · so với tuần {prevWeek}</span>}
          </p>
        </div>
        <div className="border-l border-white/15 pl-6 max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-4">
          <p className="text-sm font-semibold text-navy-100">Cần chú ý</p>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span data-testid="hero-risk" className="text-5xl font-extrabold leading-none tracking-tight tabular">{formatNumber(o.risk)}</span>
            <DeltaChip delta={o.riskDelta} goodUp={false} unit=" việc" testId="hero-risk-delta"
              tip={`So với tuần ${prevWeek}: ${o.prev ? o.prev.counts.late + o.prev.counts.todo : 0}`} />
          </div>
          <p className="mt-1.5 text-sm text-navy-100">
            <button type="button" className={link} onClick={() => onDrill('late')} data-testid="hero-late-link">{formatNumber(o.counts.late)} chậm</button>
            {' · '}
            <button type="button" className={link} onClick={() => onDrill('todo')} data-testid="hero-todo-link">{formatNumber(o.counts.todo)} chưa triển khai</button>
          </p>
        </div>
      </div>
      <StackBar
        size="lg" className="mt-6" labelMinPct={8}
        ariaLabel={CATS.map(([k, l]) => `${l} ${o.counts[k]}`).join(', ')}
        segments={catSegs(o.counts, o.total, '', onDrill)}
      />
      <StatusLegend counts={o.counts} onDark className="mt-3" />
    </section>
  );
}

/** F-DASH-1: 4 thẻ KPI */
export function KpiCards({ o, prevWeek, onDrill }: { o: Overview; prevWeek: string; onDrill: Drill }) {
  return (
    <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2" data-testid="kpi-cards">
      {CATS.map(([k, label], i) => {
        const Icon = ICON[k];
        const n = o.counts[k];
        const p = pctOf(n, o.total);
        const pn = o.prev?.counts[k] ?? 0;
        return (
          <button
            key={k} type="button" onClick={() => onDrill(k)} style={stagger(i + 1)} data-testid={`kpi-${k}`}
            aria-label={`${label}: ${n} việc (${p}%). Bấm để xem danh sách`}
            className="group animate-rise-in rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-[box-shadow,transform] duration-base ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:shadow-focus max-sm:p-3"
          >
            <span className="flex items-center gap-2">
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${ICON_BG[k]}`}><Icon size={17} /></span>
              <span className="text-sm font-semibold text-ink-2">{label}</span>
            </span>
            <span className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink tabular" data-testid={`kpi-${k}-n`}>{formatNumber(n)}</span>
              <span className="text-sm font-semibold text-muted tabular">{p}%</span>
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <span className="block h-full animate-grow-x rounded-full" style={{ width: `${p}%`, background: CAT_FILL[k] }} />
            </span>
            <span className="mt-3 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {o.prev ? (
                <>
                  <DeltaChip delta={n - pn} goodUp={GOOD_UP[k]} tip={`So với tuần ${prevWeek}: ${formatNumber(pn)}`} testId={`kpi-${k}-delta`} />
                  <span>so với tuần {prevWeek}</span>
                </>
              ) : <span>Chưa có tuần trước</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
