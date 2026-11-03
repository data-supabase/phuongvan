import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Task } from '@/types/app';
import { TASKS_KEY } from './useTasks';

/** Contract T2: lưu ghi chú (mọi vai trò), rồi cập nhật dòng đó trong cache ['tasks'] (không tải lại). */
export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: number; value: string }) => {
      const ghi_chu = value || null;
      const { error } = await db.from('tasks').update({ ghi_chu }).eq('id', id);
      if (error) throw new Error(error.message);
      return { id, ghi_chu };
    },
    onSuccess: ({ id, ghi_chu }) => {
      qc.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map((r) => (r.id === id ? { ...r, ghi_chu } : r)));
    },
  });
}
