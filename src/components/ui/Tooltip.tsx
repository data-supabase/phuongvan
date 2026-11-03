import { useEffect, useRef, useState } from 'react';

/**
 * Tooltip dùng chung cho cả app: đặt `data-tip="nội dung"` lên bất kỳ phần tử nào.
 * Mount `<Tooltip />` đúng một lần (App.tsx). Đi theo con trỏ, không tràn ra ngoài màn hình;
 * hiện cả khi focus bằng bàn phím.
 */
export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const find = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-tip]') : null);
    const onMove = (e: MouseEvent) => {
      const el = find(e.target);
      setTip(el?.dataset.tip ? { text: el.dataset.tip, x: e.clientX, y: e.clientY } : null);
    };
    const onFocus = (e: FocusEvent) => {
      const el = find(e.target);
      if (!el?.dataset.tip) return;
      const r = el.getBoundingClientRect();
      setTip({ text: el.dataset.tip, x: r.left, y: r.bottom - 14 });
    };
    const off = () => setTip(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', off);
    document.addEventListener('scroll', off, true);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', off);
      document.removeEventListener('scroll', off, true);
    };
  }, []);

  if (!tip) return null;
  const w = box.current?.offsetWidth ?? 0;
  const left = Math.max(8, Math.min(tip.x + 12, window.innerWidth - w - 8));
  const h = box.current?.offsetHeight ?? 0;
  const top = tip.y + 14 + h > window.innerHeight ? Math.max(8, tip.y - h - 14) : tip.y + 14;
  return (
    <div
      ref={box} role="tooltip" data-testid="tooltip"
      style={{ left, top }}
      className="pointer-events-none fixed z-[70] max-w-80 whitespace-pre-line rounded-md bg-ink px-2.5 py-1.5 text-xs text-white shadow-pop animate-fade-in"
    >
      {tip.text}
    </div>
  );
}
