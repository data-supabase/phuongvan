import { describe, expect, it } from 'vitest';
import { toSheetRows } from '../../src/lib/exportXlsx';
import type { Task } from '../../src/types/app';

describe('toSheetRows', () => {
  it('header + một dòng mỗi việc, đánh số lại, ghi chú null thành rỗng', () => {
    const t = { thong_tin_cuoc_hop: 'H', noi_dung: 'N', ket_luan: 'K', tinh_hinh: 'T', don_vi_dau_moi: 'Ban KT; CĐS',
      don_vi_phoi_hop: 'P', thoi_han: '30/11', tinh_trang: 'Hoàn thành', kho_khan: '', sheet: 'S', ghi_chu: null } as Task;
    const out = toSheetRows([t, t]);
    expect(out).toHaveLength(3);
    expect(out[0]).toHaveLength(12);
    expect(out[2][0]).toBe(2);
    expect(out[1][5]).toBe('Ban KT; CĐS');
    expect(out[1][11]).toBe('');
  });
});
