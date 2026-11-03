import type { ReactNode } from 'react';
import { IconInbox } from './icons';

export function EmptyState({ title, message, icon, action }: {
  title?: string; message: ReactNode; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center gap-2 px-4 py-10 text-center animate-fade-in">
      <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted">{icon ?? <IconInbox size={22} />}</span>
      {title && <p className="font-semibold text-ink">{title}</p>}
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}
