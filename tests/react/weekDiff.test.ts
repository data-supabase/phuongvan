import { describe, expect, it } from 'vitest';
import { diffSummary, removedTasks, statusChange } from '@/lib/weekDiff';
import type { Task } from '@/types/app';

const t = (key: string, tinh_trang: string, units: string[] = ['A']) => ({ key, tinh_trang, units }) as unknown as Task;

describe('weekDiff', () => {
  it('statusChange so theo nhóm, không theo chữ', () => {
    expect(statusChange(t('1', 'Hoàn thành'), t('1', 'Đã hoàn thành'))).toBeNull();
    expect(statusChange(t('1', 'Hoàn thành'))).toBeNull();
    expect(statusChange(t('1', 'Hoàn thành'), t('1', 'Đang thực hiện'))).toEqual({ from: 'doing', to: 'done' });
  });
  it('removedTasks bỏ dòng ẩn', () => {
    expect(removedTasks([t('1', 'x')], [t('1', 'x'), t('2', 'x'), t('3', 'x', [])]).map((r) => r.key)).toEqual(['2']);
  });
  it('diffSummary', () => {
    const prev = [t('1', 'Đang thực hiện'), t('2', 'Chậm'), t('3', 'Đang thực hiện'), t('4', 'Đang thực hiện')];
    const rows = [t('1', 'Hoàn thành'), t('2', 'Đang thực hiện'), t('3', 'Chậm'), t('9', 'Mới')];
    expect(diffSummary(rows, new Map(prev.map((p) => [p.key, p])), prev)).toEqual({
      added: 1, statusChanged: 3, improved: 2, worsened: 1, removed: 1,
    });
  });
});
