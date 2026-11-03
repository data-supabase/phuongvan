import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@/components/ui';
import type { ColKey, Task } from '@/types/app';
import { applySelection, columnOptions, type FilterState } from './filtering';

interface Props {
  col: ColKey;
  label: string;
  anchor: DOMRect;
  rows: Task[];
  state: FilterState;
  sortDir: 1 | -1 | null;
  onSort: (dir: 1 | -1) => void;
  /** null = bỏ lọc cột này */
  onApply: (set: Set<string> | null) => void;
  onClose: () => void;
}

/** Lọc cột kiểu Excel (F-TBL-4): sắp xếp, ô tìm, (Chọn tất cả), danh sách có số đếm, chỉ Hủy / OK. */
export function FilterPopover({ col, label, anchor, rows, state, sortDir, onSort, onApply, onClose }: Props) {
  const { list, counts } = useMemo(() => columnOptions(rows, col, state), [rows, col, state]);
  const current = state.filters[col];
  const [checked, setChecked] = useState<Set<string>>(() => (current && current.size ? new Set(current) : new Set(list)));
  const [search, setSearch] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 8, top: 8 });
  const tree = col === 'unit';

  const q = search.trim().toLowerCase();
  const visible = q ? list.filter((v) => v.toLowerCase().includes(q)) : list;
  const allOn = visible.length > 0 && visible.every((v) => checked.has(v));
  const keepCount = applySelection(list, checked, search);
  // Excel không cho OK khi không tick gì: tập rỗng trong TableState nghĩa là "không lọc"
  const nothing = (keepCount ? keepCount.size : list.length) === 0;

  // không tràn màn hình
  useLayoutEffect(() => {
    const h = box.current?.offsetHeight ?? 0, w = box.current?.offsetWidth ?? 300;
    setPos({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - h - 8)),
    });
  }, [anchor, visible.length]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (box.current && !box.current.contains(t) && !t?.closest('[data-filter-btn]')) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const toggle = (v: string) => setChecked((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const toggleAll = () => setChecked((s) => { const n = new Set(s); for (const v of visible) { if (allOn) n.delete(v); else n.add(v); } return n; });
  const labelOf = (v: string) => (tree && v.includes(' › ') ? v.split(' › ')[1] : v);

  return createPortal(
    <div
      ref={box} role="dialog" aria-label={`Lọc cột ${label}`} data-testid="filter-popover" style={pos}
      className="fixed z-[60] grid w-[300px] max-w-[calc(100vw-16px)] gap-2 rounded-lg border border-line bg-surface p-3 shadow-pop animate-pop-in"
    >
      <div className="grid grid-cols-2 gap-2">
        {([1, -1] as const).map((d) => (
          <button
            key={d} type="button" onClick={() => onSort(d)} data-testid={d === 1 ? 'sort-asc' : 'sort-desc'}
            className={`rounded-md border px-2 py-1.5 text-left text-sm font-semibold transition-colors duration-fast hover:bg-surface-2 ${sortDir === d ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-line text-ink-2'}`}
          >
            {d === 1 ? '↑ Sắp xếp A → Z' : '↓ Sắp xếp Z → A'}
          </button>
        ))}
      </div>
      <Input
        type="search" aria-label="Tìm giá trị" placeholder="Tìm…" value={search} onChange={(e) => setSearch(e.target.value)}
        data-autofocus="" autoFocus data-testid="filter-search" className="min-h-9"
      />
      <label className="flex cursor-pointer items-center gap-2 border-b border-line px-1 pb-2 text-sm font-bold">
        <input type="checkbox" checked={allOn} onChange={toggleAll} data-testid="filter-all" className="size-4 accent-accent" />
        (Chọn tất cả)
      </label>
      <div className="scroll-thin max-h-60 overflow-y-auto" data-testid="filter-list">
        {visible.length === 0 && <p className="px-1 py-2 text-sm italic text-muted">Không có giá trị</p>}
        {visible.map((v) => (
          <label
            key={v} title={v}
            className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent-soft ${tree && v.includes(' › ') ? 'pl-5' : ''}`}
          >
            <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} className="size-4 flex-none accent-accent" />
            <span className="min-w-0 flex-1 truncate">{tree && v.includes(' › ') ? '└ ' : ''}{labelOf(v)}</span>
            <span className="tabular flex-none text-xs text-muted">{counts.get(v)}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-2">
        <Button size="sm" onClick={onClose} data-testid="filter-cancel">Hủy</Button>
        <Button size="sm" variant="primary" disabled={nothing} onClick={() => onApply(applySelection(list, checked, search))} data-testid="filter-ok">OK</Button>
      </div>
    </div>,
    document.body,
  );
}
