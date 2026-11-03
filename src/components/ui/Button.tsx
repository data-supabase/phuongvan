import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md';
  /** Đang gửi: vô hiệu nút và hiện vòng xoay */
  loading?: boolean;
}

const VARIANT = {
  primary: 'bg-accent text-white shadow-[0_1px_2px_rgba(37,99,235,.3)] hover:bg-accent-ink',
  secondary: 'border border-line bg-surface text-ink-2 hover:border-line-2 hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2',
  danger: 'bg-late-text text-white hover:bg-[#8f1c12]',
  link: 'px-0 text-accent-ink hover:underline',
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold',
        'transition-[background-color,border-color,box-shadow,color] duration-fast ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'min-h-8 px-3 text-sm' : 'min-h-10 px-4 text-base',
        VARIANT[variant], className,
      )}
      {...rest}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
});
