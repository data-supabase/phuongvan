import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ChangeBadge } from '@/components/shared/ChangeBadge';
import { DeadlineBadge } from '@/components/shared/DeadlineBadge';
import { UnitPills } from '@/components/shared/UnitPills';
import { IconFunnel, StatusPill } from '@/components/ui';
import { MIN_WIDTH } from '@/hooks/useColumnWidths';
import type { ColKey, Task } from '@/types/app';
import type { Sort, FilterState } from './filtering';
import { FilterPopover } from './FilterPopover';

// Thứ tự cột như legacy (F-TBL-1); cột đầu "#" không có lọc.
export const COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'meet', label: 'Thông tin cuộc họp' },
  { key: 'name', label: 'Tên công việc' },
  { key: 'kl', label: 'Nội dung kết luận' },
  { key: 'th', label: 'Tình hình thực hiện' },
  { key: 'unit', label: 'Đơn vị phụ trách' },
  { key: 'ph', label: 'Đơn vị phối hợp' },
  { key: 'dl', label: 'Deadline' },
  { key: 'st', label: 'Trạng thái' },
  { key: 'kk', label: 'Khó khăn, kiến nghị' },
  { key: 'sh', label: 'Từ sheet' },
  { key: 'gc', label: 'Ghi chú' },
];

interface Props {
  /** Dòng đã lọc + sắp xếp */
  shown: Task[];
  /** Mọi dòng của tuần (để liệt kê giá trị lọc) */
  allRows: Task[];
  state: FilterState;
  sort: Sort | null;
  onSort: (s: Sort) => void;
  onApplyFilter: (col: ColKey, set: Set<string> | null) => void;
  prevWeek: string;
  prevByKey: Map<string, Task>;
  openId: number | null;
  onOpen: (id: number) => void;
  widths: number[];
  total: number;
  onResize: (i: number, w: number) => void;
  onResizeEnd: (i: number, w: number) => void;
}

export function TaskTable(p: Props) {
  const [pop, setPop] = useState<{ col: ColKey; rect: DOMRect } | null>(null);
  const closePop = useCallback(() => setPop(null), []);
  const popCol = pop && COLUMNS.find((c) => c.key === pop.col);
  const fitRef = useFitHeight();

  const onRowClick = (id: number) => { if (!window.getSelection()?.toString()) p.onOpen(id); };
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onOpen(id); }
  };

  return (
    <div
      ref={fitRef} onScroll={closePop} data-testid="table-scroll"
      className="min-h-64 overflow-auto rounded-xl border border-line bg-surface shadow-card scroll-thin"
    >
      <table className="table-fixed border-separate border-spacing-0 text-sm" style={{ width: p.total }} data-testid="task-table">
        <colgroup>{p.widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr>
            <Th>#</Th>
            {COLUMNS.map((c, i) => {
              const on = (p.state.filters[c.key]?.size ?? 0) > 0 || p.sort?.key === c.key;
              return (
                <Th key={c.key} width={p.widths[i + 1]} onResize={(w) => p.onResize(i + 1, w)} onResizeEnd={(w) => p.onResizeEnd(i + 1, w)} testId={`th-${c.key}`}>
                  <span className="min-w-0 flex-1 break-words text-center">{c.label}</span>
                  <button
                    type="button" data-filter-btn aria-label={`Lọc cột ${c.label}`} aria-haspopup="dialog" data-testid={`filter-btn-${c.key}`} data-on={on || undefined}
                    onClick={(e) => { e.stopPropagation(); setPop(pop?.col === c.key ? null : { col: c.key, rect: e.currentTarget.getBoundingClientRect() }); }}
                    className={`flex h-6 flex-none items-center gap-0.5 rounded px-1 text-xs font-bold transition-colors duration-fast ${on ? 'bg-accent text-white' : 'text-navy-200 hover:bg-white/10 hover:text-white'}`}
                  >
                    <IconFunnel size={14} />
                    {p.sort?.key === c.key && (p.sort.dir > 0 ? '↑' : '↓')}
                  </button>
                </Th>
              );
            })}
          </tr>
        </thead>
        <tbody data-testid="task-rows">
          {p.shown.length === 0 ? (
            <tr><td colSpan={12} className="px-3 py-10 text-center text-muted" data-testid="table-empty">Không có công việc phù hợp với bộ lọc.</td></tr>
          ) : p.shown.map((r, i) => {
            const open = p.openId === r.id;
            return (
              <tr
                key={r.id} id={`row-${r.id}`} data-testid="task-row" data-id={r.id} tabIndex={0}
                aria-label={`Xem chi tiết: ${r.noi_dung || r.ket_luan.slice(0, 60)}`}
                onClick={() => onRowClick(r.id)} onKeyDown={(e) => onRowKey(e, r.id)}
                className={`group cursor-pointer transition-colors duration-fast hover:bg-accent-soft ${open ? 'bg-accent-soft shadow-[inset_3px_0_0_#2563eb]' : i % 2 ? 'bg-surface-2/70' : ''}`}
              >
                <Td className="text-center text-muted tabular">{i + 1}</Td>
                <Td><Txt s={r.thong_tin_cuoc_hop} /></Td>
                <Td className="font-semibold text-ink">
                  {r.noi_dung ? <Txt s={r.noi_dung} /> : <span className="font-normal text-muted">(không ghi)</span>}
                  {p.prevWeek && !p.prevByKey.has(r.key) && (
                    <span data-tip={`Không có trong tuần ${p.prevWeek}`} className="ml-1.5 inline-block rounded-full bg-accent px-1.5 align-[1px] text-2xs font-bold normal-case tracking-normal text-white">Mới</span>
                  )}
                  <ChangeBadge task={r} prev={p.prevByKey.get(r.key)} />
                </Td>
                <Td><Txt s={r.ket_luan} /></Td>
                <Td><Txt s={r.tinh_hinh} /></Td>
                <Td><div data-tip={r.don_vi_dau_moi || undefined}><UnitPills units={r.units} lead={r.don_vi_dau_moi} /></div></Td>
                <Td><Txt s={r.don_vi_phoi_hop} /></Td>
                <Td><DeadlineBadge text={r.thoi_han} status={r.tinh_trang} /></Td>
                <Td><StatusPill text={r.tinh_trang} /></Td>
                <Td className="text-warn-cell"><Txt s={r.kho_khan} /></Td>
                <Td><Txt s={r.sheet} /></Td>
                <Td className="text-ink">{r.ghi_chu ? <Txt s={r.ghi_chu} /> : <span className="text-line-2">—</span>}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pop && popCol && (
        <FilterPopover
          key={pop.col} col={pop.col} label={popCol.label} anchor={pop.rect} rows={p.allRows} state={p.state}
          sortDir={p.sort?.key === pop.col ? p.sort.dir : null}
          onSort={(dir) => { p.onSort({ key: pop.col, dir }); closePop(); }}
          onApply={(set) => { p.onApplyFilter(pop.col, set); closePop(); }}
          onClose={closePop}
        />
      )}
    </div>
  );
}

// Bảng cao tới sát đáy cửa sổ (chừa 16px), đo vị trí thật thay vì đoán chiều cao header/thanh tìm kiếm
function useFitHeight(gap = 16) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => { el.style.maxHeight = `${Math.max(256, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - gap)}px`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [gap]);
  return ref;
}

const Txt = ({ s }: { s: string | null }) => <div className="whitespace-pre-line">{s}</div>;
const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <td className={`break-words border-b border-line px-3 py-2.5 align-top text-ink-2 [overflow-wrap:anywhere] ${className}`}>{children}</td>
);

function Th({ children, width, onResize, onResizeEnd, testId }: {
  children: ReactNode; width?: number; onResize?: (w: number) => void; onResizeEnd?: (w: number) => void; testId?: string;
}) {
  const [drag, setDrag] = useState<{ x: number; w: number } | null>(null);
  const start = (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, w: width ?? MIN_WIDTH });
  };
  const next = (e: PointerEvent) => Math.max(MIN_WIDTH, (drag?.w ?? 0) + e.clientX - (drag?.x ?? 0));
  return (
    <th
      data-testid={testId}
      className="sticky top-0 z-10 border-b border-navy-700 bg-navy-900 px-3 py-2.5 text-center align-middle text-xs font-semibold text-white"
    >
      <div className="flex items-center justify-center gap-1">{children}</div>
      {onResize && (
        <span
          role="separator" aria-orientation="vertical" aria-label="Kéo để đổi độ rộng cột" data-tip="Kéo để đổi độ rộng cột" data-testid={testId && `${testId}-resize`}
          onPointerDown={start}
          onPointerMove={(e) => drag && onResize(next(e))}
          onPointerUp={(e) => { if (drag) { onResizeEnd?.(next(e)); setDrag(null); } }}
          className={`absolute inset-y-0 right-0 w-1.5 cursor-col-resize touch-none transition-colors duration-fast hover:bg-accent-light ${drag ? 'bg-accent-light' : ''}`}
        />
      )}
    </th>
  );
}
