import { useId, type ReactNode } from 'react';
import { cx } from './cx';

/** Vỏ chung cho Input/Select/Textarea: nhãn gắn với ô nhập, lỗi hiện ngay bên dưới. */
export function useFieldIds() {
  const id = useId();
  return { id, hintId: `${id}-hint`, errId: `${id}-err` };
}

export function Field({ id, label, hint, error, hintId, errId, className, children }: {
  id: string; label?: ReactNode; hint?: ReactNode; error?: string; hintId: string; errId: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={cx('grid gap-1.5', className)}>
      {label && <label htmlFor={id} className="text-sm font-semibold text-ink-2">{label}</label>}
      {children}
      {error ? (
        <p id={errId} role="alert" className="text-xs font-medium text-late-text">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const controlClass = (error?: string) =>
  cx(
    'w-full rounded-lg border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/70',
    'transition-[border-color,box-shadow] duration-fast ease-out',
    'focus:border-accent focus:outline-none focus:shadow-focus',
    'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
    error ? 'border-late-fill' : 'border-line hover:border-line-2',
  );
