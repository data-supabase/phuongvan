import { statusClass, type Cat } from '@/lib/status';
import { cx } from './cx';

export const CAT_PILL: Record<Cat, string> = {
  done: 'bg-done-bg text-done-text',
  doing: 'bg-doing-bg text-doing-text',
  late: 'bg-late-bg text-late-text',
  todo: 'bg-todo-bg text-todo-text',
};

export function StatusPill({ text }: { text: string | null | undefined }) {
  const cat = statusClass(text);
  return (
    <span
      data-cat={cat}
      className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', CAT_PILL[cat])}
    >
      <span className="size-[7px] flex-none rounded-full bg-current" aria-hidden="true" />
      {text || '—'}
    </span>
  );
}
