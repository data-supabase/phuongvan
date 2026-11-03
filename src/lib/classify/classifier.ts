// Port NGUYÊN VĂN từ legacy/app.js:2-95 (chỉ thêm kiểu TS). Key SHA-256 lệch 1 byte là mất ghi chú mang sang tuần sau.
// Trang Nạp tải file này bằng import() động (D-006); SheetJS chỉ được kéo vào qua file này.
import { utils } from 'xlsx';
import type { WorkBook } from 'xlsx';
import { matchUnits, PTGD_HAI, PTGD_HAI_RX } from './units';

const SKIP_SHEETS = new Set(['Phu luc - Don vi dau moi']);

export type FieldKey = 'noi_dung' | 'ket_luan' | 'tinh_hinh' | 'don_vi_dau_moi' | 'don_vi_phoi_hop' | 'tinh_trang' | 'kho_khan' | 'thoi_han';
export interface ClassifiedRow extends Record<FieldKey, string> {
  sheet: string;
  thong_tin_cuoc_hop: string;
  units: string[];
  key: string;
}

export const FIELDS: Record<FieldKey, (h: string) => boolean> = {
  noi_dung: h => h.startsWith('nội dung'),
  ket_luan: h => h.startsWith('kết luận'),
  tinh_hinh: h => h.includes('tình hình thực hiện'),
  don_vi_dau_moi: h => h.includes('đầu mối'),
  don_vi_phoi_hop: h => h.includes('phối hợp'),
  tinh_trang: h => h.startsWith('tình trạng') || h.startsWith('kết quả thực hiện'),
  kho_khan: h => h.startsWith('khó khăn'),
  thoi_han: h => h.startsWith('thời hạn'),
};
// Sheet không có cột "Đơn vị đầu mối" thì dùng "Chủ trì"/"Đơn vị chủ trì". Có cả hai thì "Chủ trì" là tên người -> bỏ.
const LEAD_FALLBACK = (h: string) => h === 'chủ trì' || h === 'đơn vị chủ trì';
//   = NBSP (legacy dùng ký tự NBSP thật trong regex)
export const norm = (v: unknown): string => v == null ? '' : String(v).normalize('NFC').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
const hdr = (v: unknown) => norm(v).toLowerCase().replace(/\s+/g, ' ');

export function meetingName(sheet: string, rows: unknown[][]): string {
  const m = sheet.match(/TBKLGB\s*T(\d{1,2})(?!\d)/i);
  if (m) return `TBKL Giao ban Cty tháng ${+m[1]}`;
  for (const r of rows.slice(0, 3)) for (const c of r) {
    const t = norm(c).replace(/\s+/g, ' '); // tiêu đề có \r\n, gộp về 1 dấu cách để lọc khớp
    if (t && !t.includes('A1') && !t.startsWith('(') && t !== 'PHỤ LỤC')
      return `${t.split('(Đính kèm')[0].trim()} [${sheet.trim()}]`;
  }
  return sheet.trim();
}

export async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function classifyWorkbook(wb: WorkBook): Promise<{ rows: ClassifiedRow[]; skipped: string[] }> {
  const out = new Map<string, ClassifiedRow>(), skipped: string[] = [];
  for (const [si, name] of wb.SheetNames.entries()) {
    // Hidden: 1 = ẩn, 2 = rất ẩn → bỏ qua
    if (SKIP_SHEETS.has(name) || wb.Workbook?.Sheets?.[si]?.Hidden) continue;
    const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: false, blankrows: true });
    const isLead = (h: string) => FIELDS.don_vi_dau_moi(h) || LEAD_FALLBACK(h);
    const hi = rows.slice(0, 15).findIndex(r => r.some(c => isLead(hdr(c))) && r.some(c => FIELDS.noi_dung(hdr(c))));
    if (hi < 0) { skipped.push(name.trim()); continue; }
    const cols: Partial<Record<FieldKey, number>> = {};
    const keys = Object.keys(FIELDS) as FieldKey[];
    rows[hi].forEach((c, j) => {
      const h = hdr(c);
      const f = h && keys.find(f => !(f in cols) && FIELDS[f](h));
      if (f) cols[f] = j;
    });
    if (!('don_vi_dau_moi' in cols)) cols.don_vi_dau_moi = rows[hi].findIndex(c => LEAD_FALLBACK(hdr(c)));
    // ô gộp dọc: SheetJS chỉ giữ giá trị ở dòng đầu, điền xuống các dòng gộp
    const rg = utils.decode_range(wb.Sheets[name]['!ref'] || 'A1'), lc = cols.don_vi_dau_moi as number;
    const fillDown = (col: number | undefined, set: (r: number, v: unknown) => void) => {
      for (const m of wb.Sheets[name]['!merges'] || []) {
        if (col == null || m.s.c !== m.e.c || m.s.c - rg.s.c !== col) continue;
        const v = rows[m.s.r - rg.s.r]?.[col];
        for (let r = m.s.r - rg.s.r + 1; v != null && r <= m.e.r - rg.s.r; r++)
          if (r > hi && rows[r] && rows[r][col] == null) set(r, v);
      }
    };
    fillDown(lc, (r, v) => { rows[r][lc] = v; });
    // "Tên công việc" gộp chỉ điền để HIỂN THỊ; key + điều kiện lọc vẫn dùng ô gốc (giữ ghi chú mang sang tuần sau)
    const nameFill = new Map<number, unknown>();
    fillDown(cols.noi_dung, (r, v) => nameFill.set(r, v));
    const meeting = meetingName(name, rows);
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      const rec = Object.fromEntries(keys.map(f => [f, f in cols ? norm(r[cols[f] as number]) : ''])) as Record<FieldKey, string>;
      if (!rec.don_vi_dau_moi || !(rec.noi_dung || rec.ket_luan)) continue;
      // chỉ lấy việc có KT/CĐS/NCPT/ĐCM ở cột Đơn vị đầu mối (không tính cột phối hợp)
      const units = matchUnits(rec.don_vi_dau_moi);
      // chỉ khi đầu mối KHÔNG thuộc 4 đơn vị: việc đã thuộc KT/CĐS/NCPT/ĐCM giữ nguyên nhóm, không đếm 2 lần
      if (!units.length && PTGD_HAI_RX.test(rec.ket_luan)) units.push(PTGD_HAI);
      if (!units.length) continue;
      const row = { sheet: name.trim(), thong_tin_cuoc_hop: meeting, units, ...rec, key: '' } as ClassifiedRow;
      row.key = await sha256([row.sheet, rec.noi_dung, rec.ket_luan, rec.don_vi_dau_moi].join('|'));
      if (!rec.noi_dung) row.noi_dung = norm(nameFill.get(i));
      out.set(row.key, row); // bỏ dòng trùng y hệt
    }
  }
  return { rows: [...out.values()], skipped };
}
