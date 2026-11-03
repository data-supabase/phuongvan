import { describe, expect, it } from 'vitest';
import { buildBatches, planImport } from '../../src/lib/importPlan';

const db = (id: number, tuan: string, key: string, units: string[] | null, ghi_chu: string | null = null) => ({ id, tuan, key, units, ghi_chu });
const k = (...keys: string[]) => keys.map((key) => ({ key }));
const weeks = ['43/2026', '44/2026', '46/2026'];

describe('planImport', () => {
  it('dòng ẩn (units rỗng) không bao giờ vào stale', () => {
    const rows = [db(1, '45/2026', 'a', ['KT']), db(2, '45/2026', 'hid', []), db(3, '45/2026', 'hid2', null), db(4, '45/2026', 'old', ['KT'], 'n')];
    const p = planImport(k('a'), '45/2026', rows, weeks);
    expect(p.stale.map((r) => r.id)).toEqual([4]);
    expect(p.staleNotes).toBe(1);
    expect(p.existing).toBe(4); // đếm cả dòng ẩn
    expect(p.needsConfirm).toBe(true);
  });

  it('tuần mới hoàn toàn: không cần xác nhận, không stale', () => {
    const p = planImport(k('a', 'b'), '45/2026', [db(1, '44/2026', 'a', ['KT'])], weeks);
    expect(p.needsConfirm).toBe(false);
    expect(p.stale).toEqual([]);
  });

  it('mang ghi chú từ tuần liền trước (theo weekNum) chỉ khi đích chưa có dòng đó', () => {
    const rows = [
      db(1, '44/2026', 'a', ['KT'], 'ghi a'), db(2, '44/2026', 'b', ['KT'], 'ghi b'), db(3, '44/2026', 'c', ['KT']),
      db(4, '43/2026', 'd', ['KT'], 'tuần xa hơn'),
      db(5, '45/2026', 'b', ['KT'], 'đã có ở đích'), // b đã tồn tại ở tuần đích -> không carry
    ];
    const p = planImport(k('a', 'b', 'c', 'd'), '45/2026', rows, weeks);
    expect(p.before).toBe('44/2026');
    expect(p.carry.map((r) => r.key)).toEqual(['a']); // c không có ghi chú, d chỉ có ở tuần xa hơn
    expect(p.rest.map((r) => r.key)).toEqual(['b', 'c', 'd']);
    expect(p.carry.length + p.rest.length).toBe(4);
  });

  it('không có tuần trước thì không carry', () => {
    const p = planImport(k('a'), '1/2026', [db(1, '44/2026', 'a', ['KT'], 'x')], weeks);
    expect(p.before).toBe('');
    expect(p.carry).toEqual([]);
    expect(p.rest).toHaveLength(1);
  });

  it('buildBatches: lô 1 không có ghi_chu, lô 2 có; không ghi đè ghi chú sẵn có', () => {
    const rows = [db(1, '44/2026', 'a', ['KT'], 'ghi a'), db(2, '45/2026', 'b', ['KT'], 'giữ nguyên')];
    const p = planImport(k('a', 'b'), '45/2026', rows, weeks);
    const [b1, b2] = buildBatches(p, '45/2026', 'NOW');
    expect(b1).toHaveLength(1);
    expect(b1[0]).not.toHaveProperty('ghi_chu');
    expect(b1[0]).toMatchObject({ key: 'b', tuan: '45/2026', updated_at: 'NOW' });
    expect(b2).toEqual([{ key: 'a', tuan: '45/2026', updated_at: 'NOW', ghi_chu: 'ghi a' }]);
  });

  it('buildBatches bỏ lô rỗng', () => {
    const p = planImport(k('a'), '45/2026', [db(1, '44/2026', 'a', ['KT'], 'x')], weeks);
    expect(buildBatches(p, '45/2026', 'N')).toHaveLength(1); // chỉ còn lô carry
  });
});
