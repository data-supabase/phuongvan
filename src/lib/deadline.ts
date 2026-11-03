import { statusClass } from './status';

const DAY = 86_400_000;
export const SOON_DAYS = 7;
// d/m/yyyy, dd/mm/yyyy, d-m-yyyy, d.m.yyyy; năm 2 chữ số (d/m/yy, có trong dữ liệu thật) hiểu là 20yy
const DATE_RE = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g;

/**
 * Hạn chót cụ thể (UTC 00:00 của ngày đó) hoặc null. Nhiều ngày → lấy ngày CUỐI.
 * Tháng/quý/năm/"Thường xuyên"... → null, không đoán.
 */
export function parseDeadline(text: string | null | undefined): Date | null {
  let last: Date | null = null;
  for (const m of (text ?? '').matchAll(DATE_RE)) {
    const d = +m[1], mo = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    // loại ngày không có thật (31/02) thay vì để JS tự cuộn sang tháng sau
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) last = dt;
  }
  return last;
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
