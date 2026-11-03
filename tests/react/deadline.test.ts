import { describe, expect, it } from 'vitest';
import { dueInfo, parseDeadline } from '../../src/lib/deadline';

const iso = (s: string) => parseDeadline(s)?.toISOString().slice(0, 10) ?? null;
const TODAY = new Date('2026-11-03T05:00:00Z'); // 12:00 ngày 03/11/2026 (UTC+7)

describe('parseDeadline', () => {
  it('ngày cụ thể các dạng phân cách', () => {
    expect(iso('15/11/2026')).toBe('2026-11-15');
    expect(iso('5/9/2026')).toBe('2026-09-05');
    expect(iso('05-09-2026')).toBe('2026-09-05');
    expect(iso('5.9.2026')).toBe('2026-09-05');
    expect(iso('6/11/26')).toBe('2026-11-06'); // năm 2 chữ số có trong dữ liệu tuần 44
  });
  it('nhiều ngày / nhiều dòng / có chữ thừa: lấy ngày cuối', () => {
    expect(iso('15/11/2026 - 30/11/2026')).toBe('2026-11-30');
    expect(iso('Hoàn thành trước 20/12/2026\n(gia hạn 10/01/2027)')).toBe('2027-01-10');
  });
  it('tháng/quý/năm -> ngày cuối chu kỳ', () => {
    expect(iso('Tháng 08/2026')).toBe('2026-08-31');
    expect(iso('Tháng 2/2028')).toBe('2028-02-29');
    expect(iso('Tháng 12/2027')).toBe('2027-12-31');
    expect(iso('Quý I/2027')).toBe('2027-03-31');
    expect(iso('Quý III/2026')).toBe('2026-09-30');
    expect(iso('Quý 2/2026')).toBe('2026-06-30');
    expect(iso('Quý IV/ 2026')).toBe('2026-12-31');
    expect(iso('Năm 2026')).toBe('2026-12-31');
    expect(iso('Trong năm 2026')).toBe('2026-12-31');
  });
  it('mơ hồ/rỗng -> null', () => {
    for (const s of ['Từ tháng 9/2026', 'Tháng 13/2026', 'Thường xuyên', 'Hàng quý / Hàng năm', 'Theo tiến độ dự án', '', '  '])
      expect(parseDeadline(s), s).toBeNull();
    expect(parseDeadline(null)).toBeNull();
  });
  it('ngày không có thật -> null', () => {
    expect(parseDeadline('31/02/2026')).toBeNull();
    expect(parseDeadline('15/13/2026')).toBeNull();
  });
});

describe('dueInfo', () => {
  it('quá hạn / sắp hạn / hôm nay / biên 7 ngày', () => {
    expect(dueInfo('02/11/2026', 'Đang thực hiện', TODAY)).toEqual({ kind: 'overdue', days: 1 });
    expect(dueInfo('03/11/2026', 'Đang thực hiện', TODAY)).toEqual({ kind: 'soon', days: 0 });
    expect(dueInfo('10/11/2026', 'Đang thực hiện', TODAY)).toEqual({ kind: 'soon', days: 7 });
    expect(dueInfo('11/11/2026', 'Đang thực hiện', TODAY).kind).toBeNull();
    expect(dueInfo('20/10/2026', 'Triển khai chậm', TODAY)).toEqual({ kind: 'overdue', days: 14 });
  });
  it('việc hoàn thành không bị gắn cờ', () => {
    expect(dueInfo('01/01/2020', 'Hoàn thành', TODAY).kind).toBeNull();
    expect(dueInfo('01/01/2020', 'Chưa hoàn thành', TODAY).kind).toBe('overdue');
  });
  it('thời hạn theo chu kỳ / không cụ thể', () => {
    expect(dueInfo('Quý III/2026', 'Đang thực hiện', TODAY)).toEqual({ kind: 'overdue', days: 34 });
    expect(dueInfo('Tháng 11/2026', 'Đang thực hiện', TODAY).kind).toBeNull(); // 30/11 còn 27 ngày
    expect(dueInfo('Thường xuyên', 'Đang thực hiện', TODAY).kind).toBeNull();
    expect(dueInfo('', 'Đang thực hiện', TODAY).kind).toBeNull();
  });
  it('tính theo ngày Asia/Ho_Chi_Minh, không theo UTC', () => {
    // 20:00 UTC 02/11 = 03:00 ngày 03/11 giờ VN
    expect(dueInfo('03/11/2026', 'x', new Date('2026-11-02T20:00:00Z'))).toEqual({ kind: 'soon', days: 0 });
    expect(dueInfo('02/11/2026', 'x', new Date('2026-11-02T20:00:00Z')).kind).toBe('overdue');
  });
});
