import { cx } from './cx';

export interface StackSegment {
  value: number;
  /** Màu CSS (vd CAT_FILL[cat]) */
  color: string;
  tip?: string;
  onClick?: () => void;
  /** Chữ in trên đoạn (chỉ hiện khi đoạn đủ rộng, xem labelMinPct) */
  label?: string;
}

const H = { sm: 'h-3.5', md: 'h-5', lg: 'h-7' } as const;

/**
 * Thanh xếp chồng tự vẽ (D-005). direction 'row' = thanh ngang; 'col' = cột dọc (đoạn đầu ở dưới cùng,
 * chiều cao do khung cha quyết định). Đoạn tăng dần từ 0 khi xuất hiện (tắt khi giảm chuyển động).
 */
export function StackBar({ segments, size = 'sm', direction = 'row', labelMinPct = 8, ariaLabel, className }: {
  segments: StackSegment[]; size?: keyof typeof H; direction?: 'row' | 'col'; labelMinPct?: number; ariaLabel?: string; className?: string;
}) {
  const segs = segments.filter((s) => s.value > 0);
  const total = segs.reduce((a, s) => a + s.value, 0);
  const row = direction === 'row';
  return (
    <div
      role="img" aria-label={ariaLabel}
      className={cx(
        'flex gap-0.5 overflow-hidden',
        row ? cx('rounded-full', H[size], 'animate-grow-x') : 'size-full flex-col-reverse rounded-t-md animate-grow-y',
        !total && 'bg-surface-2', className,
      )}
    >
      {segs.map((s, i) => {
        const pct = (100 * s.value) / total;
        const cls = cx(
          'flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap text-xs font-bold text-ink',
          s.onClick && 'cursor-pointer transition-[filter] duration-fast hover:brightness-90 focus-visible:brightness-90',
        );
        const style = { flexGrow: s.value, flexBasis: 0, background: s.color };
        const label = s.label && pct >= labelMinPct ? s.label : null;
        return s.onClick ? (
          <button key={i} type="button" className={cls} style={style} data-tip={s.tip} aria-label={s.tip ?? s.label} onClick={s.onClick}>{label}</button>
        ) : (
          <span key={i} className={cls} style={style} data-tip={s.tip}>{label}</span>
        );
      })}
    </div>
  );
}
