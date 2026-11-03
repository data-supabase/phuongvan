// Port NGUYÊN VĂN từ legacy/app.js:3-41. Không import xlsx. Không "dọn dẹp" regex.
// Ký tự đặc biệt viết bằng escape: › = "›", ̀-ͯ = dấu kết hợp.
// Nhóm riêng: việc có tên PTGĐ Nguyễn Duy Hải ở cột Kết luận mà đầu mối ngoài 4 đơn vị trên
export const PTGD_HAI = 'PTGĐ Hải';
export const PTGD_HAI_RX = /Nguyễn\s+Duy\s+Hải/iu;
export const UNITS = ['KT', 'CĐS', 'NCPT', 'ĐCM', PTGD_HAI];

const NB = '(?![\\p{L}\\p{N}_])', NA = '(?<![\\p{L}\\p{N}_.])'; // ranh giới từ hỗ trợ tiếng Việt
export const UNIT_RX: Record<string, RegExp> = {
  'KT': new RegExp(`${NA}KT${NB}|Ban Kỹ thuật`, 'iu'),          // không khớp KTNB, TCKT
  'CĐS': new RegExp(`${NA}CĐS${NB}|Chuyển đổi số`, 'iu'),
  'NCPT': new RegExp(`NCPT|${NA}TTNC${NB}|Trung tâm nghiên cứu`, 'iu'),
  'ĐCM': new RegExp(`${NA}ĐCM${NB}|Nhà máy Đạm Cà Mau`, 'iu'),
};

// bỏ ngoặc và "Phòng ..." trước khi dò: "Phòng KT" (CN TMDV) KHÔNG thuộc Ban KT, không lấy
export const cleanLead = (lead: string): string => lead.replace(/\([^)]*\)|Phòng [^;,/\n]*/g, '');

export function matchUnits(lead: string): string[] {
  const s = cleanLead(lead);
  return Object.keys(UNIT_RX).filter(u => UNIT_RX[u].test(s));
}

// Cấp 2: "Ban KT-Tổ NCS" -> "KT › Tổ NCS" (đơn vị cấp 1, gạch nối, bộ phận cấp 2)
const SUB_RX: [string, RegExp][] = Object.keys(UNIT_RX).map(u => [u, new RegExp(`${NA}${u}\\s*[-–]\\s*([^;,/\\n]+)`, 'giu')]);
export function subUnits(lead: string): string[] {
  const s = cleanLead(lead);
  return SUB_RX.flatMap(([u, rx]) => [...s.matchAll(rx)].map(m => `${u} › ${m[1].trim()}`));
}
