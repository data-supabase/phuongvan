import { statusClass, type Cat } from '@/lib/status';
import { subUnits, UNITS } from '@/lib/units';
import type { ColKey, Task } from '@/types/app';

// Logic thuần của Bảng (F-TBL-3..5), port từ legacy/app.js:178-333. Không phụ thuộc React.
export const BLANK = '(Trống)';

/** Tập giá trị được GIỮ theo cột; tập rỗng hoặc thiếu = không lọc cột đó (giống TableState). */
export type Filters = Partial<Record<ColKey, Set<string>>>;
export interface FilterState { filters: Filters; q: string; cat: Cat | '' }
export interface Sort { key: ColKey; dir: 1 | -1 }

const accessors: Record<ColKey, (r: Task) => (string | null)[]> = {
  meet: (r) => [r.thong_tin_cuoc_hop],
  name: (r) => [r.noi_dung],
  kl: (r) => [r.ket_luan],
  th: (r) => [r.tinh_hinh],
  // KT (cấp 1) + "KT › Tổ NCS" (cấp 2): tick KT là ra mọi việc KT kể cả cấp 2
  unit: (r) => [...r.units, ...subUnits(r.don_vi_dau_moi)],
  ph: (r) => [r.don_vi_phoi_hop],
  dl: (r) => [r.thoi_han],
  st: (r) => [r.tinh_trang],
  kk: (r) => [r.kho_khan],
  sh: (r) => [r.sheet],
  gc: (r) => [r.ghi_chu],
};

/** Các giá trị của dòng ở một cột: gộp khoảng trắng, rỗng -> "(Trống)". */
export const colVals = (k: ColKey, r: Task): string[] =>
  accessors[k](r).map((v) => (v || '').replace(/\s+/g, ' ').trim() || BLANK);

export const hasFilter = (s: FilterState, sort: Sort | null) =>
  Object.values(s.filters).some((v) => v && v.size > 0) || !!sort || !!s.cat || !!s.q;

/** skipKey: bỏ qua bộ lọc của cột này (để liệt kê giá trị như Excel); useCat: có áp nhóm trạng thái không. */
export function passes(r: Task, s: FilterState, skipKey: ColKey | null = null, useCat = true): boolean {
  const q = s.q.trim().toLowerCase();
  if (q && ![r.noi_dung, r.ket_luan, r.tinh_hinh, r.kho_khan].join(' ').toLowerCase().includes(q)) return false;
  if (useCat && s.cat && statusClass(r.tinh_trang) !== s.cat) return false;
  return (Object.entries(s.filters) as [ColKey, Set<string> | undefined][]).every(
    ([k, set]) => k === skipKey || !set || set.size === 0 || colVals(k, r).some((v) => set.has(v)),
  );
}

export function sortRows(rows: Task[], sort: Sort | null): Task[] {
  if (!sort) return rows;
  const key = (r: Task) => colVals(sort.key, r)[0];
  return [...rows].sort((a, b) => sort.dir * key(a).localeCompare(key(b), 'vi'));
}

export const filterRows = (rows: Task[], s: FilterState, sort: Sort | null): Task[] =>
  sortRows(rows.filter((r) => passes(r, s)), sort);

/** Danh sách giá trị cho popover lọc của một cột + số đếm, chỉ từ các dòng qua mọi bộ lọc khác. */
export function columnOptions(rows: Task[], k: ColKey, s: FilterState): { list: string[]; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  for (const r of rows) if (passes(r, s, k, true)) for (const v of new Set(colVals(k, r))) counts.set(v, (counts.get(v) ?? 0) + 1);
  s.filters[k]?.forEach((v) => counts.has(v) || counts.set(v, 0)); // giữ giá trị đã chọn dù hiện không còn dòng
  let list = [...counts.keys()].sort((a, b) => (a === BLANK ? 1 : b === BLANK ? -1 : a.localeCompare(b, 'vi')));
  if (k === 'unit') list = UNITS.flatMap((u) => (counts.has(u) ? [u, ...list.filter((v) => v.startsWith(u + ' ›'))] : []));
  return { list, counts };
}

/**
 * Bấm OK: đang gõ tìm thì chỉ giữ giá trị đang hiện và được tick (như Excel); giữ hết thì bỏ lọc (null).
 */
export function applySelection(list: string[], checked: Set<string>, search: string): Set<string> | null {
  const q = search.trim().toLowerCase();
  const pool = q ? list.filter((v) => v.toLowerCase().includes(q)) : list;
  const keep = pool.filter((v) => checked.has(v));
  return keep.length === list.length ? null : new Set(keep);
}
