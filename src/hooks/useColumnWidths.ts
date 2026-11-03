import { useCallback, useState } from 'react';

// Giữ đúng key và định dạng của legacy (mảng 12 chuỗi "Npx", cột 0 = #, rồi meet..gc) để không mất độ rộng đã chỉnh.
export const WIDTH_KEY = 'colWidths.v5';
export const DEFAULT_WIDTHS = [52, 160, 210, 300, 300, 130, 130, 130, 180, 220, 160, 200];
export const MIN_WIDTH = 60;

/** Đọc giá trị đã lưu; phần tử hỏng/thiếu thì dùng mặc định, phần tử nhỏ hơn MIN_WIDTH thì nâng lên MIN_WIDTH. */
export function parseWidths(raw: string | null): number[] {
  try {
    const saved: unknown = JSON.parse(raw ?? 'null');
    if (!Array.isArray(saved)) return DEFAULT_WIDTHS;
    return DEFAULT_WIDTHS.map((d, i) => {
      const n = parseInt(String(saved[i]), 10);
      // cột "#" mặc định 52px (< MIN_WIDTH) và legacy luôn lưu đủ 12 cột: không nâng riêng giá trị mặc định
      return Number.isFinite(n) ? Math.max(Math.min(MIN_WIDTH, d), n) : d;
    });
  } catch {
    return DEFAULT_WIDTHS;
  }
}
export const serializeWidths = (w: number[]) => JSON.stringify(w.map((x) => `${Math.round(x)}px`));

export function useColumnWidths() {
  const [widths, setWidths] = useState(() => {
    try { return parseWidths(localStorage.getItem(WIDTH_KEY)); } catch { return DEFAULT_WIDTHS; }
  });
  const setWidth = useCallback((i: number, w: number) => {
    setWidths((cur) => cur.map((x, j) => (j === i ? Math.max(MIN_WIDTH, Math.round(w)) : x)));
  }, []);
  /** Gọi khi thả chuột để lưu một lần. */
  const persist = useCallback((i: number, w: number) => {
    setWidths((cur) => {
      const next = cur.map((x, j) => (j === i ? Math.max(MIN_WIDTH, Math.round(w)) : x));
      try { localStorage.setItem(WIDTH_KEY, serializeWidths(next)); } catch { /* bỏ qua */ }
      return next;
    });
  }, []);
  return { widths, setWidth, persist, total: widths.reduce((a, b) => a + b, 0) };
}
