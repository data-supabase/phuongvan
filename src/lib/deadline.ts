import { statusClass } from './status';

const DAY = 86_400_000;
export const SOON_DAYS = 7;
// d/m/yyyy, dd/mm/yyyy, d-m-yyyy, d.m.yyyy; năm 2 chữ số (d/m/yy, có trong dữ liệu thật) hiểu là 20yy
const DATE_RE = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g;

const QUARTER: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, 1: 1, 2: 2, 3: 3, 4: 4 };
// ngày cuối của tháng m (1-12): ngày 0 của tháng sau
const endOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0));

/**
 * Hạn chót (UTC 00:00) hoặc null. Nhiều ngày → lấy ngày CUỐI.
 * Không có ngày cụ thể: "Tháng M/YYYY", "Quý X/YYYY", "Năm YYYY" → ngày cuối chu kỳ.
 * "Từ tháng...", "Thường xuyên", "Theo tiến độ..." → null, không đoán.
 */
export function parseDeadline(text: string | null | undefined): Date | null {
  const s = text ?? '';
  let last: Date | null = null;
  for (const m of s.matchAll(DATE_RE)) {
    const d = +m[1], mo = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    // loại ngày không có thật (31/02) thay vì để JS tự cuộn sang tháng sau
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) last = dt;
  }
  if (last || /từ\s+(tháng|quý|năm)/iu.test(s)) return last;
  const mo = s.match(/tháng\s*(\d{1,2})\s*\/\s*(\d{4})/iu);
  if (mo && +mo[1] >= 1 && +mo[1] <= 12) return endOfMonth(+mo[2], +mo[1]);
  const q = s.match(/quý\s*(iv|iii|ii|i|[1-4])\s*\/\s*(\d{4})/iu);
  if (q) return endOfMonth(+q[2], QUARTER[q[1].toLowerCase()] * 3);
  const y = s.match(/năm\s*(\d{4})/iu);
  return y ? endOfMonth(+y[1], 12) : null;
}

/** Số ngày (UTC) của ngày hiện tại theo múi giờ Asia/Ho_Chi_Minh. */
function todayDay(today: Date): number {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(today).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

/** overdue: days = số ngày đã quá; soon: days = số ngày còn lại (0 = hôm nay). */
export function dueInfo(
  text: string | null | undefined,
  status: string | null | undefined,
  today: Date = new Date(),
): { kind: 'overdue' | 'soon' | null; days: number } {
  const dl = parseDeadline(text);
  if (!dl || statusClass(status) === 'done') return { kind: null, days: 0 };
  const diff = dl.getTime() / DAY - todayDay(today);
  if (diff < 0) return { kind: 'overdue', days: -diff };
  if (diff <= SOON_DAYS) return { kind: 'soon', days: diff };
  return { kind: null, days: diff };
}
