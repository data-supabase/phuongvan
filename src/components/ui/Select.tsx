import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from './cx';
import { controlClass, Field, useFieldIds } from './Field';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** 'bare': không viền, dùng trong thanh công cụ (vd WeekNav) */
  variant?: 'field' | 'bare';
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, variant = 'field', wrapperClassName, className, id: idProp, children, ...rest }, ref,
) {
  const ids = useFieldIds();
  const id = idProp ?? ids.id;
  return (
    <Field id={id} label={label} hint={hint} error={error} hintId={ids.hintId} errId={ids.errId} className={wrapperClassName}>
      <select
        ref={ref} id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ids.errId : hint ? ids.hintId : undefined}
        className={cx(
          variant === 'bare'
            ? 'cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 font-semibold text-ink hover:bg-surface-2 focus:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50'
            : cx(controlClass(error), 'cursor-pointer'),
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
});
