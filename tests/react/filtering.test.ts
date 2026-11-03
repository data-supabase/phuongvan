import { describe, expect, it } from 'vitest';
import { applySelection, BLANK, columnOptions, filterRows } from '@/components/table/filtering';
import { DEFAULT_WIDTHS, MIN_WIDTH, parseWidths, serializeWidths } from '@/hooks/useColumnWidths';
import type { Task } from '@/types/app';

const t = (id: number, o: Partial<Task>): Task => ({
  id, tuan: '44/2026', key: 'k' + id, sheet: 'S', thong_tin_cuoc_hop: 'Họp A', noi_dung: 'n' + id, ket_luan: '', tinh_hinh: '',
  don_vi_dau_moi: 'KT', don_vi_phoi_hop: '', tinh_trang: 'Hoàn thành', kho_khan: '', thoi_han: '', ghi_chu: null,
  units: ['KT'], units_phoi_hop: [], deadline_tu: null, deadline_den: null, updated_at: '', ...o,
});
const rows = [
  t(1, { tinh_trang: 'Chậm', ghi_chu: 'abc' }),
  t(2, { tinh_trang: 'Hoàn thành', units: ['CĐS'], don_vi_dau_moi: 'CĐS' }),
  t(3, { tinh_trang: 'Hoàn thành', don_vi_dau_moi: 'Ban KT-Tổ NCS' }),
];
const none = { filters: {}, q: '', cat: '' as const };

describe('colWidths v5', () => {
  it('đọc "Npx", nâng lên tối thiểu, bỏ qua dữ liệu hỏng', () => {
    const bad = parseWidths('["52px","10px","abc",250]');
    expect(bad.slice(0, 4)).toEqual([52, MIN_WIDTH, DEFAULT_WIDTHS[2], 250]);
    expect(bad).toHaveLength(12);
    expect(parseWidths('không phải json')).toEqual(DEFAULT_WIDTHS);
    expect(parseWidths(null)).toEqual(DEFAULT_WIDTHS);
    expect(parseWidths(serializeWidths(DEFAULT_WIDTHS))).toEqual(DEFAULT_WIDTHS);
    expect(JSON.parse(serializeWidths([52.4]))).toEqual(['52px']);
  });
});

describe('filtering', () => {
  it('lọc theo cat, q và cột', () => {
    expect(filterRows(rows, { ...none, cat: 'late' }, null).map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, { ...none, q: 'N2' }, null).map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, { ...none, filters: { unit: new Set(['KT']) } }, null).map((r) => r.id)).toEqual([1, 3]);
    expect(filterRows(rows, { ...none, filters: { unit: new Set(['KT › Tổ NCS']) } }, null).map((r) => r.id)).toEqual([3]);
  });
  it('sắp xếp theo giá trị đầu, (Trống) là chuỗi thường', () => {
    expect(filterRows(rows, none, { key: 'st', dir: -1 }).map((r) => r.id)).toEqual([2, 3, 1]);
  });
  it('liệt kê giá trị: cây đơn vị, (Trống) ở cuối, bỏ qua bộ lọc của chính cột', () => {
    const { list, counts } = columnOptions(rows, 'unit', { ...none, filters: { unit: new Set(['CĐS']) } });
    expect(list).toEqual(['KT', 'KT › Tổ NCS', 'CĐS']);
    expect(counts.get('KT')).toBe(2);
    expect(columnOptions(rows, 'gc', none).list).toEqual(['abc', BLANK]);
  });
  it('OK: giữ hết thì bỏ lọc; đang tìm thì chỉ giữ giá trị hiện và tick', () => {
    const list = ['a', 'b', 'ab'];
    expect(applySelection(list, new Set(list), '')).toBeNull();
    expect([...applySelection(list, new Set(list), 'b')!]).toEqual(['b', 'ab']);
  });
});
