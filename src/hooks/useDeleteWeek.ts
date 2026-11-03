import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import { TASKS_KEY } from '@/hooks/useTasks';

/** T5: xóa cả tuần (kể cả dòng ẩn, quyết định của người dùng). Xong thì tải lại ['tasks']. */
export function useDeleteWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tuan: string) => {
      const { error } = await db.from('tasks').delete().eq('tuan', tuan);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
