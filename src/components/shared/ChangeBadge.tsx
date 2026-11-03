import { CAT_LABEL } from '@/lib/status';
import { isImproved, statusChange } from '@/lib/weekDiff';
import type { Task } from '@/types/app';

export function ChangeBadge({ task, prev }: { task: Task; prev?: Task }) {
  const c = statusChange(task, prev);
  if (!c) return null;
  const worse = c.to === 'late';
  const tone = worse ? 'bg-late-bg text-late-text' : isImproved(c) ? 'bg-done-bg text-done-text' : 'bg-surface-2 text-ink-2';
  return (
    <span
      data-testid="change-badge" data-tip={`Tuần trước: ${CAT_LABEL[c.from]} → tuần này: ${CAT_LABEL[c.to]}`}
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-2xs font-bold ${tone}`}
    >
      {worse ? '↘' : isImproved(c) ? '↗' : '→'} {CAT_LABEL[c.to]}
    </span>
  );
}
