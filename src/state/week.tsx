import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { weekNum } from '@/lib/week';
import type { Task } from '@/types/app';

export interface WeekValue {
  /** Mọi dòng đã tải, GỒM CẢ dòng ẩn (units rỗng) */
  dbRows: Task[];
  /** Các tuần có dòng hiển thị, sắp tăng dần theo weekNum */
  weeks: string[];
  /** Tuần đang xem ('' khi chưa có dữ liệu) */
  week: string;
  setWeek: (w: string) => void;
  /** Dòng hiển thị của tuần đang xem */
  rows: Task[];
  /** Tuần liền trước trong `weeks` ('' nếu không có) */
  prevWeek: string;
  /** key -> dòng của tuần trước */
  prevByKey: Map<string, Task>;
  /** updated_at lớn nhất của `rows` (ISO) hoặc '' */
  updatedAt: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const Ctx = createContext<WeekValue | null>(null);
export const useWeek = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWeek phải nằm trong <WeekProvider>');
  return v;
};

const EMPTY: Task[] = [];

export function WeekProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refetch } = useTasks();
  const dbRows = data ?? EMPTY;
  const [selected, setSelected] = useState('');

  const value = useMemo<WeekValue>(() => {
    // ẩn dòng không có đơn vị đầu mối của mình (62 dòng cũ, KHÔNG được xóa)
    const visible = dbRows.filter((r) => r.units?.length);
    const weeks = [...new Set(visible.map((r) => r.tuan))].sort((a, b) => weekNum(a) - weekNum(b));
    // giữ tuần đang xem nếu còn, không thì tuần mới nhất (F-WEEK-1)
    const week = weeks.includes(selected) ? selected : weeks.at(-1) ?? '';
    const i = weeks.indexOf(week);
    const prevWeek = i > 0 ? weeks[i - 1] : '';
    const rows = visible.filter((r) => r.tuan === week);
    return {
      dbRows, weeks, week, rows, prevWeek,
      setWeek: setSelected,
      prevByKey: new Map(visible.filter((r) => r.tuan === prevWeek).map((r) => [r.key, r])),
      updatedAt: rows.reduce((a, r) => (r.updated_at > a ? r.updated_at : a), ''),
      isLoading,
      error,
      refetch: () => void refetch(),
    };
  }, [dbRows, selected, isLoading, error, refetch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook tiện cho WeekNav: danh sách năm giảm dần, tuần trong năm giảm dần. */
export function useWeekOptions() {
  const { weeks, week } = useWeek();
  return useMemo(() => {
    const years = [...new Set(weeks.map((x) => x.split('/')[1]))].sort().reverse();
    const year = week.split('/')[1] ?? '';
    const inYear = weeks.filter((x) => x.endsWith('/' + year)).reverse();
    return { years, year, inYear };
  }, [weeks, week]);
}

export const useSetWeekByStep = () => {
  const { weeks, week, setWeek } = useWeek();
  return useCallback((step: -1 | 1) => { const w = weeks[weeks.indexOf(week) + step]; if (w) setWeek(w); }, [weeks, week, setWeek]);
};
