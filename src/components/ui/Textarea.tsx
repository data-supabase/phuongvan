import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import { controlClass, Field, useFieldIds } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, className, id: idProp, ...rest }, ref,
) {
  const ids = useFieldIds();
  const id = idProp ?? ids.id;
  return (
    <Field id={id} label={label} hint={hint} error={error} hintId={ids.hintId} errId={ids.errId} className={wrapperClassName}>
      <textarea
        ref={ref} id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ids.errId : hint ? ids.hintId : undefined}
        className={cx(controlClass(error), 'min-h-28 resize-y', className)}
        {...rest}
      />
    </Field>
  );
});
