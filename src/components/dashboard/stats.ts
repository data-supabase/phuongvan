// Tính toán thuần cho Dashboard (legacy/app.js:422-493). Không phụ thuộc React.
import { countBy, pctOf, statusClass, type Cat } from '@/lib/status';
import { UNITS } from '@/lib/units';
import type { Task } from '@/types/app';

type Row = Pick<Task, 'tinh_trang'>;
export type Counts = Record<Cat, number>;

/** Tăng là tốt (true), tăng là xấu (false), trung tính (null) — như GOOD_UP của legacy. */
export const GOOD_UP: Record<Cat, boolean | null> = { done: true, doing: null, late: false, todo: false };

export type Tone = 'good' | 'bad' | 'neutral';
export const deltaTone = (d: number, goodUp: boolean | null): Tone =>
  d === 0 || goodUp === null ? 'neutral' : (d > 0) === goodUp ? 'good' : 'bad';
export const deltaText = (d: number) => (d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '=');

export interface Overview {
  total: number;
  counts: Counts;
  /** null khi không có tuần trước */
  prev: { total: number; counts: Counts } | null;
  donePct: number;
  /** điểm % so với tuần trước */
  donePctDelta: number | null;
  risk: number;
  riskDelta: number | null;
}

export function computeOverview(rows: Row[], prevRows: Row[] | null): Overview {
  const counts = countBy(rows);
  const total = rows.length;
  const prev = prevRows ? { total: prevRows.length, counts: countBy(prevRows) } : null;
  const donePct = pctOf(counts.done, total);
  const risk = counts.late + counts.todo;
  return {
    total, counts, prev, donePct, risk,
    donePctDelta: prev ? donePct - pctOf(prev.counts.done, prev.total) : null,
    riskDelta: prev ? risk - prev.counts.late - prev.counts.todo : null,
  };
}

export interface UnitStat { unit: string; total: number; counts: Counts }

/** Mọi đơn vị (kể cả 0 việc), đúng thứ tự UNITS. */
export const unitBreakdown = (rows: (Row & { units: string[] })[], units: readonly string[] = UNITS): UnitStat[] =>
  units.map((unit) => {
    const l = rows.filter((r) => r.units.includes(unit));
    return { unit, total: l.length, counts: countBy(l) };
  });

/** Chỉ đơn vị có việc; tỷ lệ chậm giảm dần, hòa thì số việc chậm giảm dần (F-DASH-3). */
export const unitRiskRanking = (stats: UnitStat[]): UnitStat[] =>
  stats.filter((s) => s.total)
    .sort((a, b) => b.counts.late / b.total - a.counts.late / a.total || b.counts.late - a.counts.late);

export interface WeekStat { week: string; total: number; counts: Counts }

/** n tuần cuối của `weeks` (đã sắp tăng dần), tính trên mọi dòng có units. */
export function weekSeries(visible: (Row & { tuan: string })[], weeks: string[], n = 8): WeekStat[] {
  const by = new Map<string, (Row & { tuan: string })[]>();
  for (const r of visible) (by.get(r.tuan) ?? by.set(r.tuan, []).get(r.tuan)!).push(r);
  return weeks.slice(-n).map((week) => {
    const l = by.get(week) ?? [];
    return { week, total: l.length, counts: countBy(l) };
  });
}

export const normSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Top cuộc họp có nhiều việc chậm nhất (F-DASH-6); tên đã gộp khoảng trắng. */
export function lateMeetings(rows: (Row & { thong_tin_cuoc_hop: string })[], limit = 8): { meet: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (statusClass(r.tinh_trang) !== 'late') continue;
    const k = normSpaces(r.thong_tin_cuoc_hop || '');
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([meet, count]) => ({ meet, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}
