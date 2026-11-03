// Port NGUYÊN VĂN từ legacy/app.js:3-41. Không import xlsx. Không "dọn dẹp" regex.
// Ký tự đặc biệt viết bằng escape: › = "›", ̀-ͯ = dấu kết hợp.
export const UNITS = ['KT', 'CĐS', 'NCPT', 'ĐCM'];

const NB = '(?![\\p{L}\\p{N}_])', NA = '(?<![\\p{L}\\p{N}_.])'; // ranh giới từ hỗ trợ tiếng Việt
export const UNIT_RX: Record<string, RegExp> = {
  'KT': new RegExp(`${NA}KT${NB}|Ban Kỹ thuật`, 'iu'),          // không khớp KTNB, TCKT
  'CĐS': new RegExp(`${NA}CĐS${NB}|Chuyển đổi số`, 'iu'),
  'NCPT': new RegExp(`NCPT|${NA}TTNC${NB}|Trung tâm nghiên cứu`, 'iu'),
  'ĐCM': new RegExp(`${NA}ĐCM${NB}|Nhà máy Đạm Cà Mau`, 'iu'),
};

// "Phòng KT" là Phòng Kỹ thuật của CN TMDV: tính vào KT nhưng ở cấp 2 riêng để phân biệt với Ban KT
export const PHONG_KT = 'Phòng KT (CN TMDV)';
export const isPhongKT = (lead: string): boolean => /Phòng\s+KT(?![\p{L}\p{N}_])/iu.test(lead) ||
  [...lead.matchAll(/\(([^)]*)\)/g)].some(m => /Phòng/i.test(m[1]) && UNIT_RX.KT.test(m[1])); // "CNTMDV (Phòng TH, KT,KD)"
// bỏ ngoặc và "Phòng ..." trước khi dò đơn vị cấp 1 (đã xử lý riêng ở isPhongKT)
export const cleanLead = (lead: string): string => lead.replace(/\([^)]*\)|Phòng [^;,/\n]*/g, '');

export function matchUnits(lead: string): string[] {
  const s = cleanLead(lead);
  return Object.keys(UNIT_RX).filter(u => UNIT_RX[u].test(s) || (u === 'KT' && isPhongKT(lead)));
}

// Cấp 2: "Ban KT-Tổ NCS" -> "KT › Tổ NCS" (đơn vị cấp 1, gạch nối, bộ phận cấp 2)
const SUB_RX: [string, RegExp][] = Object.keys(UNIT_RX).map(u => [u, new RegExp(`${NA}${u}\\s*[-–]\\s*([^;,/\\n]+)`, 'giu')]);
export function subUnits(lead: string): string[] {
  const s = cleanLead(lead);
  const subs = SUB_RX.flatMap(([u, rx]) => [...s.matchAll(rx)].map(m => `${u} › ${m[1].trim()}`));
  return isPhongKT(lead) ? [...subs, `KT › ${PHONG_KT}`] : subs;
}
