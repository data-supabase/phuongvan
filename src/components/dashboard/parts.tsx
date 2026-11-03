import type { CSSProperties } from 'react';
import { cx } from '@/components/ui/cx';
import { formatNumber } from '@/lib/format';
import { CATS, CAT_FILL, type Cat } from '@/lib/status';
import { deltaText, deltaTone, type Counts, type Tone } from './stats';

const TONE: Record<Tone, string> = {
  good: 'bg-done-bg text-done-text',
  bad: 'bg-late-bg text-late-text',
  neutral: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
};

/** Chip thay đổi: luôn có mũi tên/ký hiệu bằng chữ, màu chỉ là phụ. */
export function DeltaChip({ delta, goodUp, unit = '', tip, testId }: {
  delta: number | null; goodUp: boolean | null; unit?: string; tip: string; testId?: string;
}) {
  if (delta === null) return null;
  const tone = deltaTone(delta, goodUp);
  return (
    <span
      data-tip={tip} data-testid={testId} data-tone={tone} tabIndex={0}
      className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular', TONE[tone])}
    >
      {deltaText(delta)}{delta ? unit : ''}
    </span>
  );
}

/** Chú thích trạng thái (nhãn chữ + chấm màu). counts: kèm số lượng. */
export function StatusLegend({ counts, onDark, className }: { counts?: Counts; onDark?: boolean; className?: string }) {
  return (
    <ul className={cx('flex flex-wrap gap-x-4 gap-y-1 text-sm', onDark ? 'text-white/90' : 'text-ink-2', className)} data-testid="status-legend">
      {CATS.map(([k, label]) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm" style={{ background: CAT_FILL[k] }} aria-hidden="true" />
          {label}{counts && <b className={cx('tabular', onDark ? 'text-white' : 'text-ink')}>{formatNumber(counts[k])}</b>}
        </li>
      ))}
    </ul>
  );
}

/** Khối có hiệu ứng trồi lên; delay (ms) để các khối xuất hiện lần lượt. */
export const stagger = (i: number): CSSProperties => ({ animationDelay: `${i * 60}ms` });

export const catSegs = (
  counts: Counts, total: number, tipPrefix: string, onPick?: (c: Cat) => void,
) => CATS.filter(([k]) => counts[k] > 0).map(([k, label]) => ({
  value: counts[k], color: CAT_FILL[k], label: `${Math.round((100 * counts[k]) / total)}%`,
  tip: `${tipPrefix}${label}: ${formatNumber(counts[k])} (${Math.round((100 * counts[k]) / total)}%)`,
  onClick: onPick && (() => onPick(k)),
}));
