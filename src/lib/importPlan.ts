// Quy tắc nạp tuần thuần (api-contract §3.1, legacy/app.js:641-663). Không gọi mạng để test được.
import { weekNum } from './week';

interface NewRow { key: string }
interface DbRow { id: number; tuan: string; key: string; units: string[] | null; ghi_chu: string | null }

export interface ImportPlan<N extends NewRow, D extends DbRow> {
  /** Dòng của tuần này CÓ units mà không còn trong file (dòng ẩn không bao giờ vào đây) */
  stale: D[];
  /** Việc mới của tuần này có ghi chú ở tuần trước -> lô 2 */
  carry: N[];
  /** Phần còn lại -> lô 1 (không có trường ghi_chu) */
  rest: N[];
  /** Tuần gần nhất trước tuần nạp ('' nếu không có) */
  before: string;
  prevNotes: Map<string, string>;
  /** Số dòng hiện có của tuần này (gồm dòng ẩn) */
  existing: number;
  /** Số dòng stale có ghi chú */
  staleNotes: number;
  needsConfirm: boolean;
}

export function planImport<N extends NewRow, D extends DbRow>(
  data: N[], tuan: string, dbRows: D[], weeks: string[],
): ImportPlan<N, D> {
  const newKeys = new Set(data.map((r) => r.key));
  const thisWeek = dbRows.filter((r) => r.tuan === tuan);
  const thisKeys = new Set(thisWeek.map((r) => r.key));
  const stale = thisWeek.filter((r) => r.units?.length && !newKeys.has(r.key));
  const before = weeks.filter((w) => weekNum(w) < weekNum(tuan)).at(-1) ?? '';
  const prevNotes = new Map<string, string>();
  if (before) for (const r of dbRows) if (r.tuan === before && r.ghi_chu) prevNotes.set(r.key, r.ghi_chu);
  const isCarry = (r: N) => !thisKeys.has(r.key) && prevNotes.has(r.key);
  return {
    stale, before, prevNotes,
    carry: data.filter(isCarry),
    rest: data.filter((r) => !isCarry(r)),
    existing: thisWeek.length,
    staleNotes: stale.filter((r) => r.ghi_chu).length,
    needsConfirm: thisWeek.length > 0,
  };
}

/** Hai lô upsert (bỏ lô rỗng). Lô 1 KHÔNG có ghi_chu: supabase-js điền null cho cột thiếu nếu trộn lô. */
export function buildBatches<N extends NewRow>(plan: Pick<ImportPlan<N, DbRow>, 'rest' | 'carry' | 'prevNotes'>, tuan: string, now: string) {
  const base = (r: N) => ({ ...r, tuan, updated_at: now });
  return [
    plan.rest.map(base),
    plan.carry.map((r) => ({ ...base(r), ghi_chu: plan.prevNotes.get(r.key) as string })),
  ].filter((b) => b.length);
}
