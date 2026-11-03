import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { controlClass, Field, useFieldIds } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, wrapperClassName, className, id: idProp, ...rest }, ref,
) {
  const ids = useFieldIds();
  const id = idProp ?? ids.id;
  return (
    <Field id={id} label={label} hint={hint} error={error} hintId={ids.hintId} errId={ids.errId} className={wrapperClassName}>
      <input
        ref={ref} id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ids.errId : hint ? ids.hintId : undefined}
        className={cx(controlClass(error), className)}
        {...rest}
      />
    </Field>
  );
});
