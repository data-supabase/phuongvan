// Phân nhóm trạng thái công việc (legacy/app.js:113-130, 422-431).
export type Cat = 'done' | 'doing' | 'late' | 'todo';

export const CATS: [Cat, string][] = [
  ['done', 'Hoàn thành'],
  ['doing', 'Đang thực hiện'],
  ['late', 'Triển khai chậm'],
  ['todo', 'Chưa triển khai'],
];

export const CAT_LABEL: Record<Cat, string> = Object.fromEntries(CATS) as Record<Cat, string>;

/** Màu đặc cho biểu đồ; đồng bộ với colors.*.fill trong tailwind.config.ts */
export const CAT_FILL: Record<Cat, string> = { done: '#4caf6e', doing: '#e9b02b', late: '#d9483b', todo: '#9b86d6' };

export function statusClass(s: string | null | undefined): Cat {
  const t = (s || '').toLowerCase();
  if (t.includes('chậm') || t.includes('quá hạn')) return 'late';
  if (t.includes('chưa')) return 'todo'; // trước "hoàn thành": "Chưa hoàn thành" không phải Hoàn thành
  if (t.includes('hoàn thành')) return 'done';
  return 'doing';
}

export function countBy(rows: { tinh_trang: string }[]): Record<Cat, number> {
  const n: Record<Cat, number> = { done: 0, doing: 0, late: 0, todo: 0 };
  for (const r of rows) n[statusClass(r.tinh_trang)]++;
  return n;
}

export const pctOf = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

// shortcut: ngưỡng 20% / 10% cố định; khi lãnh đạo có ngưỡng chính thức thì sửa ở đây
export const riskLevel = (ratio: number): ['hi' | 'mid' | 'lo', string] =>
  ratio >= 0.2 ? ['hi', '⚠ Cao'] : ratio >= 0.1 ? ['mid', '● Trung bình'] : ['lo', '✓ Thấp'];
