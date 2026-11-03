import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Task } from '@/types/app';

export const TASKS_KEY = ['tasks'] as const;

// shortcut: tải mọi tuần một lần (PostgREST cắt ở 1000 dòng/lần nên lặp theo trang); khi dữ liệu lên vài
// chục nghìn dòng thì chuyển sang tải theo tuần đang chọn (D-007)
export async function fetchAllTasks(): Promise<Task[]> {
  const data: Task[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await db.from('tasks').select('*').order('id').range(from, from + 999);
    if (r.error) throw new Error(r.error.message);
    data.push(...(r.data as Task[]));
    if (r.data.length < 1000) break;
  }
  return data;
}

/** Query key ['tasks'] (contract T1). Sau T3/T4/T5: invalidateQueries({ queryKey: ['tasks'] }). */
export const useTasks = () => useQuery({ queryKey: TASKS_KEY, queryFn: fetchAllTasks });
