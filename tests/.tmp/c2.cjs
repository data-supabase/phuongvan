var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  FIELDS: () => FIELDS,
  PHONG_KT: () => PHONG_KT,
  UNITS: () => UNITS,
  UNIT_RX: () => UNIT_RX,
  classifyWorkbook: () => classifyWorkbook,
  cleanLead: () => cleanLead,
  isPhongKT: () => isPhongKT,
  matchUnits: () => matchUnits,
  meetingName: () => meetingName,
  norm: () => norm,
  sha256: () => sha256,
  subUnits: () => subUnits
});
module.exports = __toCommonJS(stdin_exports);

// src/lib/classify/units.ts
var UNITS = ["KT", "C\u0110S", "NCPT", "\u0110CM"];
var NB = "(?![\\p{L}\\p{N}_])";
var NA = "(?<![\\p{L}\\p{N}_.])";
var UNIT_RX = {
  "KT": new RegExp(`${NA}KT${NB}|Ban K\u1EF9 thu\u1EADt`, "iu"),
  // không khớp KTNB, TCKT
  "C\u0110S": new RegExp(`${NA}C\u0110S${NB}|Chuy\u1EC3n \u0111\u1ED5i s\u1ED1`, "iu"),
  "NCPT": new RegExp(`NCPT|${NA}TTNC${NB}|Trung t\xE2m nghi\xEAn c\u1EE9u`, "iu"),
  "\u0110CM": new RegExp(`${NA}\u0110CM${NB}|Nh\xE0 m\xE1y \u0110\u1EA1m C\xE0 Mau`, "iu")
};
var PHONG_KT = "Ph\xF2ng KT (CN TMDV)";
var isPhongKT = (lead) => /Phòng\s+KT(?![\p{L}\p{N}_])/iu.test(lead) || [...lead.matchAll(/\(([^)]*)\)/g)].some((m) => /Phòng/i.test(m[1]) && UNIT_RX.KT.test(m[1]));
var cleanLead = (lead) => lead.replace(/\([^)]*\)|Phòng [^;,/\n]*/g, "");
function matchUnits(lead) {
  const s = cleanLead(lead);
  return Object.keys(UNIT_RX).filter((u) => UNIT_RX[u].test(s) || u === "KT" && isPhongKT(lead));
}
var SUB_RX = Object.keys(UNIT_RX).map((u) => [u, new RegExp(`${NA}${u}\\s*[-\u2013]\\s*([^;,/\\n]+)`, "giu")]);
function subUnits(lead) {
  const s = cleanLead(lead);
  const subs = SUB_RX.flatMap(([u, rx]) => [...s.matchAll(rx)].map((m) => `${u} \u203A ${m[1].trim()}`));
  return isPhongKT(lead) ? [...subs, `KT \u203A ${PHONG_KT}`] : subs;
}

// src/lib/classify/classifier.ts
var import_xlsx = require("xlsx");
var SKIP_SHEETS = /* @__PURE__ */ new Set(["Phu luc - Don vi dau moi"]);
var FIELDS = {
  noi_dung: (h) => h.startsWith("n\u1ED9i dung"),
  ket_luan: (h) => h.startsWith("k\u1EBFt lu\u1EADn"),
  tinh_hinh: (h) => h.includes("t\xECnh h\xECnh th\u1EF1c hi\u1EC7n"),
  don_vi_dau_moi: (h) => h.includes("\u0111\u1EA7u m\u1ED1i"),
  don_vi_phoi_hop: (h) => h.includes("ph\u1ED1i h\u1EE3p"),
  tinh_trang: (h) => h.startsWith("t\xECnh tr\u1EA1ng") || h.startsWith("k\u1EBFt qu\u1EA3 th\u1EF1c hi\u1EC7n"),
  kho_khan: (h) => h.startsWith("kh\xF3 kh\u0103n"),
  thoi_han: (h) => h.startsWith("th\u1EDDi h\u1EA1n")
};
var LEAD_FALLBACK = (h) => h === "ch\u1EE7 tr\xEC" || h === "\u0111\u01A1n v\u1ECB ch\u1EE7 tr\xEC";
var norm = (v) => v == null ? "" : String(v).normalize("NFC").replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();
var hdr = (v) => norm(v).toLowerCase().replace(/\s+/g, " ");
function meetingName(sheet, rows) {
  const m = sheet.match(/TBKLGB\s*T(\d{1,2})(?!\d)/i);
  if (m) return `TBKL Giao ban Cty th\xE1ng ${+m[1]}`;
  for (const r of rows.slice(0, 3)) for (const c of r) {
    const t = norm(c).replace(/\s+/g, " ");
    if (t && !t.includes("A1") && !t.startsWith("(") && t !== "PH\u1EE4 L\u1EE4C")
      return `${t.split("(\u0110\xEDnh k\xE8m")[0].trim()} [${sheet.trim()}]`;
  }
  return sheet.trim();
}
async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function classifyWorkbook(wb) {
  const out = /* @__PURE__ */ new Map(), skipped = [];
  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.has(name)) continue;
    const rows = import_xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false, blankrows: true });
    const isLead = (h) => FIELDS.don_vi_dau_moi(h) || LEAD_FALLBACK(h);
    const hi = rows.slice(0, 15).findIndex((r) => r.some((c) => isLead(hdr(c))) && r.some((c) => FIELDS.noi_dung(hdr(c))));
    if (hi < 0) {
      skipped.push(name.trim());
      continue;
    }
    const cols = {};
    const keys = Object.keys(FIELDS);
    rows[hi].forEach((c, j) => {
      const h = hdr(c);
      const f = h && keys.find((f2) => !(f2 in cols) && FIELDS[f2](h));
      if (f) cols[f] = j;
    });
    if (!("don_vi_dau_moi" in cols)) cols.don_vi_dau_moi = rows[hi].findIndex((c) => LEAD_FALLBACK(hdr(c)));
    const rg = import_xlsx.utils.decode_range(wb.Sheets[name]["!ref"] || "A1"), lc = cols.don_vi_dau_moi;
    for (const m of wb.Sheets[name]["!merges"] || []) {
      if (m.s.c !== m.e.c || m.s.c - rg.s.c !== lc) continue;
      const v = rows[m.s.r - rg.s.r]?.[lc];
      for (let r = m.s.r - rg.s.r + 1; v != null && r <= m.e.r - rg.s.r; r++)
        if (r > hi && rows[r] && rows[r][lc] == null) rows[r][lc] = v;
    }
    const meeting = meetingName(name, rows);
    for (const r of rows.slice(hi + 1)) {
      const rec = Object.fromEntries(keys.map((f) => [f, f in cols ? norm(r[cols[f]]) : ""]));
      if (!rec.don_vi_dau_moi || !(rec.noi_dung || rec.ket_luan)) continue;
      const units = matchUnits(rec.don_vi_dau_moi);
      if (!units.length) continue;
      const row = { sheet: name.trim(), thong_tin_cuoc_hop: meeting, units, ...rec, key: "" };
      row.key = await sha256([row.sheet, rec.noi_dung, rec.ket_luan, rec.don_vi_dau_moi].join("|"));
      out.set(row.key, row);
    }
  }
  return { rows: [...out.values()], skipped };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FIELDS,
  PHONG_KT,
  UNITS,
  UNIT_RX,
  classifyWorkbook,
  cleanLead,
  isPhongKT,
  matchUnits,
  meetingName,
  norm,
  sha256,
  subUnits
});
