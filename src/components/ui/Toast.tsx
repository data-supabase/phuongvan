import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconClose } from './icons';

export interface ToastOptions {
  action?: { label: string; onClick: () => void };
  /** ms; mặc định 5000 */
  duration?: number;
}
type ToastFn = (content: ReactNode, opts?: ToastOptions) => void;

const Ctx = createContext<ToastFn | null>(null);
export const useToast = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast phải nằm trong <ToastProvider>');
  return v;
};

interface Item extends ToastOptions { id: number; content: ReactNode }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback<ToastFn>((content, opts) => setItems((l) => [...l, { id: ++seq.current, content, ...opts }]), []);
  const api = useMemo(() => toast, [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="status" aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[60] grid w-[min(420px,calc(100vw-2.5rem))] gap-2 max-sm:bottom-3 max-sm:right-3 max-sm:w-[calc(100vw-1.5rem)]"
      >
        {items.map((t) => <ToastItem key={t.id} item={t} onClose={() => remove(t.id)} />)}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ item, onClose }: { item: Item; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const h = setTimeout(() => close.current(), item.duration ?? 5000);
    return () => clearTimeout(h);
  }, [item.duration]);
  return (
    <div data-testid="toast" className="pointer-events-auto flex items-center gap-3 rounded-xl bg-navy-900 py-3 pl-4 pr-2 text-sm text-white shadow-pop animate-slide-in">
      <div className="min-w-0 flex-1 [&_b]:font-semibold">{item.content}</div>
      {item.action && (
        <button
          type="button" data-testid="toast-action"
          onClick={() => { onClose(); item.action!.onClick(); }}
          className="flex-none rounded-md bg-accent-light px-3 py-1.5 font-bold text-navy-900 transition-colors duration-fast hover:bg-white"
        >
          {item.action.label}
        </button>
      )}
      <button type="button" aria-label="Đóng thông báo" onClick={onClose} className="flex-none rounded-md p-1.5 text-navy-300 transition-colors duration-fast hover:text-white">
        <IconClose size={14} />
      </button>
    </div>
  );
}
