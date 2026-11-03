import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';

/**
 * Hộp thoại dựa trên <dialog> native: bẫy focus, phần nền `inert` và Esc do trình duyệt lo.
 * Phần tử có `data-autofocus` sẽ nhận focus khi mở (mặc định: ô nhập/nút đầu tiên).
 */
export function Modal({ open, onClose, title, children, footer, size = 'md', testId = 'modal' }: {
  open: boolean; onClose: () => void; title: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'md' | 'lg'; testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!open || !d) return;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={ref} aria-labelledby={titleId} data-testid={testId}
      onCancel={(e) => { e.preventDefault(); onClose(); }} // Esc = hủy
      className={cx('w-[calc(100vw-2rem)] rounded-2xl', size === 'lg' ? 'max-w-[560px]' : 'max-w-[440px]')}
    >
      <div className="grid gap-4 rounded-2xl bg-surface p-6 shadow-pop animate-pop-in max-sm:p-5">
        <h2 id={titleId} className="text-lg font-bold text-ink">{title}</h2>
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}
