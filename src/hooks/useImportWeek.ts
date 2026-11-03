import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import { buildBatches, planImport, type ImportPlan } from '@/lib/importPlan';
import { TASKS_KEY } from '@/hooks/useTasks';
import type { Task } from '@/types/app';

export interface ImportArgs {
  file: File;
  tuan: string;
  dbRows: Task[];
  weeks: string[];
  onProgress: (text: string) => void;
  /** Hỏi người dùng khi tuần đã có dữ liệu; false = hủy */
  confirm: (plan: ImportPlan<{ key: string }, Task>) => Promise<boolean>;
}
export interface ImportResult { ok: boolean; message: string }

/** T3 (2 lô) + T4 theo api-contract §3.1. Trả về thông điệp; chỉ throw khi lỗi bất ngờ. */
export function useImportWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, tuan, dbRows, weeks, onProgress, confirm }: ImportArgs): Promise<ImportResult> => {
      onProgress('Đang đọc và phân loại…');
      // D-006: SheetJS chỉ tải khi cần (classifier kéo theo xlsx)
      const [{ read }, { classifyWorkbook }] = await Promise.all([import('xlsx'), import('@/lib/classifier')]);
      const { rows: data, skipped } = await classifyWorkbook(read(await file.arrayBuffer()));
      const skipNote = skipped.length ? ` Bỏ qua (không có cột Đơn vị đầu mối): ${skipped.join(', ')}.` : '';
      if (!data.length) return { ok: false, message: 'Không tìm thấy công việc nào của KT/CĐS/NCPT/ĐCM trong file.' };

      const plan = planImport(data, tuan, dbRows, weeks);
      if (plan.needsConfirm && !(await confirm(plan))) return { ok: false, message: 'Đã hủy.' };

      onProgress('Đang lưu…');
      for (const batch of buildBatches(plan, tuan, new Date().toISOString())) {
        const { error } = await db.from('tasks').upsert(batch, { onConflict: 'tuan,key' });
        if (error) return { ok: false, message: 'Lưu lỗi: ' + error.message };
      }
      const { stale, carry, before } = plan;
      if (stale.length) {
        const { error } = await db.from('tasks').delete().in('id', stale.map((r) => r.id));
        if (error) return { ok: false, message: 'Đã nạp nhưng xóa việc cũ lỗi: ' + error.message };
      }
      return {
        ok: true,
        message: `✓ Tuần ${tuan}: đã nạp ${data.length} công việc` +
          (carry.length ? `, mang sang ${carry.length} ghi chú từ tuần ${before}` : '') +
          (stale.length ? `, xóa ${stale.length} việc không còn trong file` : '') + `.${skipNote}`,
      };
    },
    // dữ liệu có thể đã đổi dù lỗi giữa chừng -> luôn tải lại
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
