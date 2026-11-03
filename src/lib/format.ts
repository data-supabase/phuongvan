// F-UI-3: số theo vi-VN, ngày giờ theo vi-VN và múi giờ Asia/Ho_Chi_Minh.
const TZ = 'Asia/Ho_Chi_Minh';

const numberFmt = new Intl.NumberFormat('vi-VN');
export const formatNumber = (n: number) => numberFmt.format(n);

export const formatPercent = (n: number) => `${numberFmt.format(Math.round(n))}%`;

const partsFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function parts(d: Date | string | number) {
  const o: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(new Date(d))) o[p.type] = p.value;
  return o;
}

/** dd/MM/yyyy */
export function formatDate(d: Date | string | number | null | undefined) {
  if (d == null || d === '') return '';
  const p = parts(d);
  return `${p.day}/${p.month}/${p.year}`;
}

/** HH:mm dd/MM/yyyy */
export function formatDateTime(d: Date | string | number | null | undefined) {
  if (d == null || d === '') return '';
  const p = parts(d);
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`;
}
