import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  /** Góc phải tiêu đề (nút, badge…) */
  action?: ReactNode;
  padded?: boolean;
}

export function Card({ title, description, action, padded = true, className, children, ...rest }: CardProps) {
  return (
    <section
      className={cx('min-w-0 rounded-xl border border-line bg-surface shadow-card', padded && 'p-5 max-sm:p-4', className)}
      {...rest}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-md font-bold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
