import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Cat } from '@/lib/status';
import type { ColKey } from '@/types/app';
import { useWeek } from './week';

/** Tập giá trị được GIỮ cho từng cột; tập rỗng = không lọc cột đó. */
export type ColFilters = Record<ColKey, Set<string>>;
/** dir: 1 = A→Z, -1 = Z→A (như legacy) */
export type SortBy = { key: ColKey; dir: 1 | -1 } | null;
export interface DrillTarget { week?: string; unit?: string; meet?: string; cat?: Cat }

export interface TableStateValue {
  colFilters: ColFilters;
  setColFilters: Dispatch<SetStateAction<ColFilters>>;
  /** Nhóm trạng thái đang lọc ('' = tất cả) */
  cat: Cat | '';
  setCat: (c: Cat | '') => void;
  q: string;
  setQ: (q: string) => void;
  sortBy: SortBy;
  setSortBy: Dispatch<SetStateAction<SortBy>>;
  /**
   * Bấm biểu đồ/thẻ ở Dashboard: xóa colFilters và q, đặt unit/meet/cat, KHÔNG xóa sortBy (giống legacy),
   * đổi tuần nếu cần (trước khi lọc), rồi điều hướng tới /table.
   */
  drill: (go: DrillTarget) => void;
}

export const COL_KEYS: ColKey[] = ['meet', 'name', 'kl', 'th', 'unit', 'ph', 'dl', 'st', 'kk', 'sh', 'gc'];
export const emptyColFilters = (): ColFilters =>
  Object.fromEntries(COL_KEYS.map((k) => [k, new Set<string>()])) as ColFilters;

const Ctx = createContext<TableStateValue | null>(null);
export const useTableState = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTableState phải nằm trong <TableStateProvider>');
  return v;
};

export function TableStateProvider({ children }: { children: ReactNode }) {
  const [colFilters, setColFilters] = useState(emptyColFilters);
  const [cat, setCat] = useState<Cat | ''>('');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>(null);
  const { week, setWeek } = useWeek();
  const navigate = useNavigate();

  const drill = useCallback((go: DrillTarget) => {
    const f = emptyColFilters();
    if (go.unit) f.unit = new Set([go.unit]);
    // meet '' = nhóm "(Trống)", cùng giá trị mà bộ lọc cột dùng (BLANK trong filtering.ts)
    if (go.meet !== undefined) f.meet = new Set([go.meet.replace(/\s+/g, ' ').trim() || '(Trống)']);
    if (go.week && go.week !== week) setWeek(go.week);
    setColFilters(f);
    setQ('');
    setCat(go.cat ?? '');
    navigate('/table');
  }, [week, setWeek, navigate]);

  const value = useMemo(
    () => ({ colFilters, setColFilters, cat, setCat, q, setQ, sortBy, setSortBy, drill }),
    [colFilters, cat, q, sortBy, drill],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
