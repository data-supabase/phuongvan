import { statusClass, type Cat } from '@/lib/status';
import type { Task } from '@/types/app';

export function statusChange(cur: Task, prev?: Task): { from: Cat; to: Cat } | null {
  if (!prev) return null;
  const from = statusClass(prev.tinh_trang), to = statusClass(cur.tinh_trang);
  return from === to ? null : { from, to };
}

export const isImproved = (c: { from: Cat; to: Cat }) => c.to === 'done' || c.from === 'late';

export function removedTasks(rows: Task[], prevRows: Task[]): Task[] {
  const keys = new Set(rows.map((r) => r.key));
  return prevRows.filter((r) => r.units?.length && !keys.has(r.key));
}

export function diffSummary(rows: Task[], prevByKey: Map<string, Task>, prevRows: Task[]) {
  let added = 0, statusChanged = 0, improved = 0, worsened = 0;
  for (const r of rows) {
    const p = prevByKey.get(r.key);
    if (!p) { added++; continue; }
    const c = statusChange(r, p);
    if (!c) continue;
    statusChanged++;
    if (c.to === 'late') worsened++;
    else if (isImproved(c)) improved++;
  }
  return { added, statusChanged, improved, worsened, removed: removedTasks(rows, prevRows).length };
}
