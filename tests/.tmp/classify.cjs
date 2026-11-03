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
  AUTH_DOMAIN: () => AUTH_DOMAIN,
  CATS: () => CATS,
  CAT_FILL: () => CAT_FILL,
  CAT_LABEL: () => CAT_LABEL,
  FIELDS: () => FIELDS,
  OWNER_ID: () => OWNER_ID,
  PTGD_HAI: () => PTGD_HAI,
  PTGD_HAI_RX: () => PTGD_HAI_RX,
  ROLE_LABEL: () => ROLE_LABEL,
  UNITS: () => UNITS,
  UNIT_RX: () => UNIT_RX,
  classifyWorkbook: () => classifyWorkbook,
  cleanLead: () => cleanLead,
  countBy: () => countBy,
  genPw: () => genPw,
  loginEmail: () => loginEmail,
  makeUsername: () => makeUsername,
  matchUnits: () => matchUnits,
  meetingName: () => meetingName,
  norm: () => norm,
  normWeek: () => normWeek,
  pctOf: () => pctOf,
  riskLevel: () => riskLevel,
  sha256: () => sha256,
  statusClass: () => statusClass,
  subUnits: () => subUnits,
  uniqueUsername: () => uniqueUsername,
  weekNum: () => weekNum
});
module.exports = __toCommonJS(stdin_exports);

// ../src/lib/classify/units.ts
var PTGD_HAI = "PTG\u0110 H\u1EA3i";
var PTGD_HAI_RX = /Nguyễn\s+Duy\s+Hải/iu;
var UNITS = ["KT", "C\u0110S", "NCPT", "\u0110CM", PTGD_HAI];
var NB = "(?![\\p{L}\\p{N}_])";
var NA = "(?<![\\p{L}\\p{N}_.])";
var UNIT_RX = {
  "KT": new RegExp(`${NA}KT${NB}|Ban K\u1EF9 thu\u1EADt`, "iu"),
  // không khớp KTNB, TCKT
  "C\u0110S": new RegExp(`${NA}C\u0110S${NB}|Chuy\u1EC3n \u0111\u1ED5i s\u1ED1`, "iu"),
  "NCPT": new RegExp(`NCPT|${NA}TTNC${NB}|Trung t\xE2m nghi\xEAn c\u1EE9u`, "iu"),
  "\u0110CM": new RegExp(`${NA}\u0110CM${NB}|Nh\xE0 m\xE1y \u0110\u1EA1m C\xE0 Mau`, "iu")
};
var cleanLead = (lead) => lead.replace(/\([^)]*\)|Phòng [^;,/\n]*/g, "");
function matchUnits(lead) {
  const s = cleanLead(lead);
  return Object.keys(UNIT_RX).filter((u) => UNIT_RX[u].test(s));
}
var SUB_RX = Object.keys(UNIT_RX).map((u) => [u, new RegExp(`${NA}${u}\\s*[-\u2013]\\s*([^;,/\\n]+)`, "giu")]);
function subUnits(lead) {
  const s = cleanLead(lead);
  return SUB_RX.flatMap(([u, rx]) => [...s.matchAll(rx)].map((m) => `${u} \u203A ${m[1].trim()}`));
}

// ../src/lib/classify/classifier.ts
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
  for (const [si, name] of wb.SheetNames.entries()) {
    if (SKIP_SHEETS.has(name) || wb.Workbook?.Sheets?.[si]?.Hidden) continue;
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
    const fillDown = (col, set) => {
      for (const m of wb.Sheets[name]["!merges"] || []) {
        if (col == null || m.s.c !== m.e.c || m.s.c - rg.s.c !== col) continue;
        const v = rows[m.s.r - rg.s.r]?.[col];
        for (let r = m.s.r - rg.s.r + 1; v != null && r <= m.e.r - rg.s.r; r++)
          if (r > hi && rows[r] && rows[r][col] == null) set(r, v);
      }
    };
    fillDown(lc, (r, v) => {
      rows[r][lc] = v;
    });
    const nameFill = /* @__PURE__ */ new Map();
    fillDown(cols.noi_dung, (r, v) => nameFill.set(r, v));
    const meeting = meetingName(name, rows);
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      const rec = Object.fromEntries(keys.map((f) => [f, f in cols ? norm(r[cols[f]]) : ""]));
      if (!rec.don_vi_dau_moi || !(rec.noi_dung || rec.ket_luan)) continue;
      const units = matchUnits(rec.don_vi_dau_moi);
      if (!units.length && PTGD_HAI_RX.test(rec.ket_luan)) units.push(PTGD_HAI);
      if (!units.length) continue;
      const row = { sheet: name.trim(), thong_tin_cuoc_hop: meeting, units, ...rec, key: "" };
      row.key = await sha256([row.sheet, rec.noi_dung, rec.ket_luan, rec.don_vi_dau_moi].join("|"));
      if (!rec.noi_dung) row.noi_dung = norm(nameFill.get(i));
      out.set(row.key, row);
    }
  }
  return { rows: [...out.values()], skipped };
}

// ../src/lib/status.ts
var CATS = [
  ["done", "Ho\xE0n th\xE0nh"],
  ["doing", "\u0110ang th\u1EF1c hi\u1EC7n"],
  ["late", "Tri\u1EC3n khai ch\u1EADm"],
  ["todo", "Ch\u01B0a tri\u1EC3n khai"]
];
var CAT_LABEL = Object.fromEntries(CATS);
var CAT_FILL = { done: "#4caf6e", doing: "#e9b02b", late: "#d9483b", todo: "#9b86d6" };
function statusClass(s) {
  const t = (s || "").toLowerCase();
  if (t.includes("ch\u1EADm") || t.includes("qu\xE1 h\u1EA1n")) return "late";
  if (t.includes("ch\u01B0a")) return "todo";
  if (t.includes("ho\xE0n th\xE0nh")) return "done";
  return "doing";
}
function countBy(rows) {
  const n = { done: 0, doing: 0, late: 0, todo: 0 };
  for (const r of rows) n[statusClass(r.tinh_trang)]++;
  return n;
}
var pctOf = (a, b) => b ? Math.round(100 * a / b) : 0;
var riskLevel = (ratio) => ratio >= 0.2 ? ["hi", "\u26A0 Cao"] : ratio >= 0.1 ? ["mid", "\u25CF Trung b\xECnh"] : ["lo", "\u2713 Th\u1EA5p"];

// ../src/lib/week.ts
var weekNum = (t) => {
  const [w, y] = t.split("/").map(Number);
  return y * 100 + w;
};
var normWeek = (s) => {
  const m = s.match(/^\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/);
  return m ? `${+m[1]}/${m[2]}` : null;
};

// ../src/lib/username.ts
var ROLE_LABEL = { admin: "Qu\u1EA3n tr\u1ECB", editor: "Nh\u1EADp li\u1EC7u", viewer: "Xem" };
var AUTH_DOMAIN = "bctuan.local";
var OWNER_ID = "065441d4-3465-43d4-9088-3c08e6bfa580";
var loginEmail = (v) => {
  v = v.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${AUTH_DOMAIN}`;
};
function makeUsername(fullName) {
  const parts = fullName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().split(/\s+/).map((p) => p.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  return parts.length ? parts.at(-1) + parts.slice(0, -1).map((p) => p[0]).join("") : "";
}
function uniqueUsername(base, taken) {
  if (!base) return "";
  let u = base;
  let i = 1;
  while (taken.has(u)) u = base + i++;
  return u;
}
var genPw = () => {
  const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const v = crypto.getRandomValues(new Uint32Array(12));
  return [...v].map((x) => a[x % a.length]).join("");
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AUTH_DOMAIN,
  CATS,
  CAT_FILL,
  CAT_LABEL,
  FIELDS,
  OWNER_ID,
  PTGD_HAI,
  PTGD_HAI_RX,
  ROLE_LABEL,
  UNITS,
  UNIT_RX,
  classifyWorkbook,
  cleanLead,
  countBy,
  genPw,
  loginEmail,
  makeUsername,
  matchUnits,
  meetingName,
  norm,
  normWeek,
  pctOf,
  riskLevel,
  sha256,
  statusClass,
  subUnits,
  uniqueUsername,
  weekNum
});
