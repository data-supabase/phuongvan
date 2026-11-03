import type { ReactNode } from 'react';
import { cx } from './cx';

/** Nhãn nhỏ: 'unit' = đơn vị cấp 1 (đậm), 'sub' = cấp 2 (nhạt), 'role' = vai trò. */
export function Pill({ children, variant = 'unit', className }: {
  children: ReactNode; variant?: 'unit' | 'sub' | 'role' | 'neutral'; className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-block whitespace-nowrap rounded-md px-2 py-px text-xs',
        variant === 'unit' && 'bg-pill font-semibold text-pill-text',
        variant === 'sub' && 'border border-line bg-surface-2 font-medium text-ink-2',
        variant === 'role' && 'rounded-full border border-line bg-surface-2 px-2 font-semibold text-ink-2',
        variant === 'neutral' && 'bg-surface-2 font-medium text-ink-2',
        className,
      )}
    >
      {children}
    </span>
  );
}
