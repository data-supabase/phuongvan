// ===== Phân loại file Excel báo cáo tuần (chạy trong trình duyệt) =====
const SKIP_SHEETS = new Set(['Phu luc - Don vi dau moi']);
const NB = '(?![\\p{L}\\p{N}_])', NA = '(?<![\\p{L}\\p{N}_.])'; // ranh giới từ hỗ trợ tiếng Việt
const UNIT_RX = {
  'KT': new RegExp(`${NA}KT${NB}|Ban Kỹ thuật`, 'iu'),          // không khớp KTNB, TCKT
  'CĐS': new RegExp(`${NA}CĐS${NB}|Chuyển đổi số`, 'iu'),
  'NCPT': new RegExp(`NCPT|${NA}TTNC${NB}|Trung tâm nghiên cứu`, 'iu'),
  'ĐCM': new RegExp(`${NA}ĐCM${NB}|Nhà máy Đạm Cà Mau`, 'iu'),
};
const FIELDS = {
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
const LEAD_FALLBACK = h => h === 'chủ trì' || h === 'đơn vị chủ trì';
const norm = v => v == null ? '' : String(v).normalize('NFC').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
const hdr = v => norm(v).toLowerCase().replace(/\s+/g, ' ');

// "Phòng KT" là Phòng Kỹ thuật của CN TMDV: tính vào KT nhưng ở cấp 2 riêng để phân biệt với Ban KT
const PHONG_KT = 'Phòng KT (CN TMDV)';
const isPhongKT = lead => /Phòng\s+KT(?![\p{L}\p{N}_])/iu.test(lead) ||
  [...lead.matchAll(/\(([^)]*)\)/g)].some(m => /Phòng/i.test(m[1]) && UNIT_RX.KT.test(m[1])); // "CNTMDV (Phòng TH, KT,KD)"
// bỏ ngoặc và "Phòng ..." trước khi dò đơn vị cấp 1 (đã xử lý riêng ở isPhongKT)
const cleanLead = lead => lead.replace(/\([^)]*\)|Phòng [^;,/\n]*/g, '');
function matchUnits(lead) {
  const s = cleanLead(lead);
  return Object.keys(UNIT_RX).filter(u => UNIT_RX[u].test(s) || (u === 'KT' && isPhongKT(lead)));
}
// Cấp 2: "Ban KT-Tổ NCS" -> "KT › Tổ NCS" (đơn vị cấp 1, gạch nối, bộ phận cấp 2)
const SUB_RX = Object.keys(UNIT_RX).map(u => [u, new RegExp(`${NA}${u}\\s*[-–]\\s*([^;,/\\n]+)`, 'giu')]);
function subUnits(lead) {
  const s = cleanLead(lead);
  const subs = SUB_RX.flatMap(([u, rx]) => [...s.matchAll(rx)].map(m => `${u} › ${m[1].trim()}`));
  return isPhongKT(lead) ? [...subs, `KT › ${PHONG_KT}`] : subs;
}

function meetingName(sheet, rows) {
  const m = sheet.match(/TBKLGB\s*T(\d{1,2})(?!\d)/i);
  if (m) return `TBKL Giao ban Cty tháng ${+m[1]}`;
  for (const r of rows.slice(0, 3)) for (const c of r) {
    const t = norm(c).replace(/\s+/g, ' '); // tiêu đề có \r\n, gộp về 1 dấu cách để lọc khớp
    if (t && !t.includes('A1') && !t.startsWith('(') && t !== 'PHỤ LỤC')
      return `${t.split('(Đính kèm')[0].trim()} [${sheet.trim()}]`;
  }
  return sheet.trim();
}

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function classifyWorkbook(wb) {
  const out = new Map(), skipped = [];
  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.has(name)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false, blankrows: true });
    const isLead = h => FIELDS.don_vi_dau_moi(h) || LEAD_FALLBACK(h);
    const hi = rows.slice(0, 15).findIndex(r => r.some(c => isLead(hdr(c))) && r.some(c => FIELDS.noi_dung(hdr(c))));
    if (hi < 0) { skipped.push(name.trim()); continue; }
    const cols = {};
    rows[hi].forEach((c, j) => {
      const h = hdr(c);
      const f = h && Object.keys(FIELDS).find(f => !(f in cols) && FIELDS[f](h));
      if (f) cols[f] = j;
    });
    if (!('don_vi_dau_moi' in cols)) cols.don_vi_dau_moi = rows[hi].findIndex(c => LEAD_FALLBACK(hdr(c)));
    // ô "Đơn vị đầu mối" gộp dọc: SheetJS chỉ giữ giá trị ở dòng đầu, điền xuống các dòng gộp (chỉ cột này)
    const rg = XLSX.utils.decode_range(wb.Sheets[name]['!ref'] || 'A1'), lc = cols.don_vi_dau_moi;
    for (const m of wb.Sheets[name]['!merges'] || []) {
      if (m.s.c !== m.e.c || m.s.c - rg.s.c !== lc) continue;
      const v = rows[m.s.r - rg.s.r]?.[lc];
      for (let r = m.s.r - rg.s.r + 1; v != null && r <= m.e.r - rg.s.r; r++)
        if (r > hi && rows[r] && rows[r][lc] == null) rows[r][lc] = v;
    }
    const meeting = meetingName(name, rows);
    for (const r of rows.slice(hi + 1)) {
      const rec = Object.fromEntries(Object.keys(FIELDS).map(f => [f, f in cols ? norm(r[cols[f]]) : '']));
      if (!rec.don_vi_dau_moi || !(rec.noi_dung || rec.ket_luan)) continue;
      // chỉ lấy việc có KT/CĐS/NCPT/ĐCM ở cột Đơn vị đầu mối (không tính cột phối hợp)
      const units = matchUnits(rec.don_vi_dau_moi);
      if (!units.length) continue;
      const row = { sheet: name.trim(), thong_tin_cuoc_hop: meeting, units, ...rec };
      row.key = await sha256([row.sheet, rec.noi_dung, rec.ket_luan, rec.don_vi_dau_moi].join('|'));
      out.set(row.key, row); // bỏ dòng trùng y hệt
    }
  }
  return { rows: [...out.values()], skipped };
}

// self-check bộ phân loại
console.assert(matchUnits('Ban KT-P.CNATMT') + '' === 'KT' && !matchUnits('KTNB').length && !matchUnits('TCKT').length, 'KT');
console.assert(['Phòng KT', 'CN TMDV (Phòng KT)', 'CN TMDV (Phòng KT, Phòng KD)', 'CNTMDV (Phòng TH, KT,KD)']
  .every(l => matchUnits(l) + '' === 'KT' && subUnits(l) + '' === `KT › ${PHONG_KT}`), 'Phòng KT');
console.assert(!matchUnits('Phòng KD').length && !matchUnits('CNTMDV (Phòng KD, TH)').length && !subUnits('Ban KT').length, 'không phải KT');
console.assert(matchUnits('TTNC; CĐS') + '' === 'CĐS,NCPT' && matchUnits('KT; ĐCM; KD') + '' === 'KT,ĐCM', 'multi');
console.assert(subUnits('Ban KT-P.CNATMT; Ban KT-P.NCƯD; Ban KT-Tổ NCS') + '' === 'KT › P.CNATMT,KT › P.NCƯD,KT › Tổ NCS', 'cấp 2');
console.assert(!subUnits('Ban KT').length && !subUnits('TT NCPT').length, 'cấp 1');

const db = supabase.createClient('https://mjuioravfaxpmxscnnkm.supabase.co', 'sb_publishable_OCr-0A3X5rmkn77Pks7s1g_4MMNqdBn');
const UNITS = ['KT', 'CĐS', 'NCPT', 'ĐCM'];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let rows = [];


function statusClass(s) {
  s = (s || '').toLowerCase();
  if (s.includes('chậm') || s.includes('quá hạn')) return 'st-late';
  if (s.includes('chưa')) return 'st-todo'; // trước "hoàn thành": "Chưa hoàn thành" không phải Hoàn thành
  if (s.includes('hoàn thành')) return 'st-done';
  return 'st-doing';
}

// Cấp 1 = nhãn đậm (KT), cấp 2 = nhãn nhạt bên dưới (Tổ NCS)
function unitPills(r) {
  const subs = subUnits(r.don_vi_dau_moi);
  return r.units.map(u => `<span class="pill">${esc(u)}</span>` +
    subs.filter(s => s.startsWith(u + ' ›')).map(s => `<br><span class="pill sub">${esc(s.slice(u.length + 3))}</span>`).join('')
  ).join(' ');
}

let cat = ''; // nhóm trạng thái đang lọc khi bấm thẻ ('' = tất cả)
const CATS = [['st-done', 'Hoàn thành'], ['st-doing', 'Đang thực hiện'], ['st-late', 'Triển khai chậm'], ['st-todo', 'Chưa triển khai']];

const ico = d => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  'st-done': ico('<path d="M20 6L9 17l-5-5"/>'),
  'st-doing': ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  'st-late': ico('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  'st-todo': ico('<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>'),
};

function renderOverview(list) {
  const count = l => { const n = Object.fromEntries(CATS.map(([k]) => [k, 0])); l.forEach(r => n[statusClass(r.tinh_trang)]++); return n; };
  const n = count(list);
  // so với tuần trước, cùng các bộ lọc đang bật
  const prevList = prevWeek ? [...prevByKey.values()] : null;
  const pn = prevList && count(prevList);
  // chip ▲/▼: Hoàn thành tăng = tốt; Chậm/Chưa triển khai tăng = xấu; Đang thực hiện trung tính
  const GOOD_UP = { 'st-done': true, 'st-late': false, 'st-todo': false };
  const delta = k => {
    if (!pn) return ''; const d = n[k] - pn[k];
    const cls = !d || !(k in GOOD_UP) ? '' : (d > 0) === GOOD_UP[k] ? 'good' : 'bad';
    return `<span class="k-delta ${cls}" title="So với tuần ${esc(prevWeek)}: ${pn[k]}">${d > 0 ? '▲ ' + d : d < 0 ? '▼ ' + -d : '='}</span>`;
  };
  const pct = k => list.length ? Math.round(100 * n[k] / list.length) : 0;
  $('overview').innerHTML = CATS.map(([k, label]) => `
<button type="button" class="kpi" data-cat="${k}" title="Bấm để xem các việc ${label.toLowerCase()} trong Bảng"
  style="--c:var(--${k.slice(3)}-t);--bg-c:var(--${k.slice(3)})">
  <span class="k-ico">${ICONS[k]}</span>
  <span class="k-lbl">${label}</span>
  <span class="k-num">${n[k]}<span class="k-pct">${pct(k)}%</span></span>
  ${delta(k)}
  <span class="k-bar"><i style="width:${pct(k)}%"></i></span>
</button>`).join('') + `<div class="total">Tổng: <b>${list.length}</b> công việc` +
    (prevList ? ` · tuần ${esc(prevWeek)}: ${prevList.length}` : '') + '</div>';
}

$('overview').addEventListener('click', e => {
  const b = e.target.closest('.kpi');
  if (!b) return;
  // bấm thẻ ở Dashboard: mở Bảng chỉ lọc theo trạng thái đó
  for (const k in colFilters) delete colFilters[k];
  $('q').value = '';
  cat = b.dataset.cat;
  goTable();
});
// đổi hash đã kéo theo render() qua 'hashchange'; chỉ render tay khi hash không đổi
function goTable() { if (location.hash === '#table') render(); else location.hash = '#table'; }

// ===== Lọc cột kiểu Excel =====
const BLANK = '(Trống)';
const COLS = {
  meet: { get: r => [r.thong_tin_cuoc_hop] },
  name: { get: r => [r.noi_dung] },
  kl: { get: r => [r.ket_luan] },
  th: { get: r => [r.tinh_hinh] },
  // KT (cấp 1) + "KT › Tổ NCS" (cấp 2): tick KT là ra mọi việc KT kể cả cấp 2
  unit: { get: r => [...r.units, ...subUnits(r.don_vi_dau_moi)], tree: true },
  ph: { get: r => [r.don_vi_phoi_hop] },
  dl: { get: r => [r.thoi_han] },
  st: { get: r => [r.tinh_trang] },
  kk: { get: r => [r.kho_khan] },
  sh: { get: r => [r.sheet] },
  gc: { get: r => [r.ghi_chu] },
};
const FUNNEL = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></svg>';
const colVals = (k, r) => COLS[k].get(r).map(v => (v || '').replace(/\s+/g, ' ').trim() || BLANK);
const colFilters = {};            // key -> Set giá trị được giữ
let sortBy = null;                // { key, dir: 1 | -1 }

function passes(r, skipKey, useCat) {
  const q = $('q').value.trim().toLowerCase();
  if (q && ![r.noi_dung, r.ket_luan, r.tinh_hinh, r.kho_khan].join(' ').toLowerCase().includes(q)) return false;
  if (useCat && cat && statusClass(r.tinh_trang) !== cat) return false;
  return Object.entries(colFilters).every(([k, set]) => k === skipKey || colVals(k, r).some(v => set.has(v)));
}

document.querySelectorAll('th[data-col]').forEach(th =>
  th.insertAdjacentHTML('beforeend', `<button type="button" class="fbtn" data-col="${th.dataset.col}" aria-label="Lọc cột ${th.textContent.trim()}">${FUNNEL}</button>`));

// ===== Kéo đổi độ rộng cột (nhớ trên trình duyệt này) =====
const COL_INDEX = { meet: 1, name: 2, kl: 3, th: 4, unit: 5, ph: 6, dl: 7, st: 8, kk: 9, sh: 10, gc: 11 };
const WIDTH_KEY = 'colWidths.v5'; // đổi khi thêm/bớt cột để bỏ độ rộng đã lưu theo bố cục cũ
const cols = [...document.querySelectorAll('colgroup col')];
const table = document.querySelector('.wrap table');
// table-layout:fixed cần độ rộng bảng = tổng các cột, nếu không cột sẽ tự giãn đều và kéo hẹp không ăn
const fitTable = () => table.style.width = cols.reduce((s, c) => s + parseInt(c.style.width), 0) + 'px';
try { (JSON.parse(localStorage.getItem(WIDTH_KEY)) || []).forEach((w, i) => cols[i] && w && (cols[i].style.width = w)); } catch { }
fitTable();
document.querySelectorAll('th[data-col]').forEach(th => {
  const col = cols[COL_INDEX[th.dataset.col]];
  const h = document.createElement('span');
  h.className = 'rz';
  h.title = 'Kéo để đổi độ rộng cột';
  th.append(h);
  h.addEventListener('pointerdown', e => {
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    h.classList.add('drag');
    const x0 = e.clientX, w0 = parseInt(col.style.width);
    const move = ev => { col.style.width = Math.max(60, w0 + ev.clientX - x0) + 'px'; fitTable(); };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', () => {
      h.removeEventListener('pointermove', move);
      h.classList.remove('drag');
      try { localStorage.setItem(WIDTH_KEY, JSON.stringify(cols.map(c => c.style.width))); } catch { }
    }, { once: true });
  });
});

let pop = null;
const closeFilter = () => { pop?.remove(); pop = null; };

function openFilter(btn) {
  closeFilter();
  const k = btn.dataset.col, c = COLS[k], set = colFilters[k];
  // giống Excel: chỉ liệt kê giá trị của các dòng đang qua các bộ lọc khác
  const counts = new Map();
  rows.filter(r => passes(r, k, true)).forEach(r => new Set(colVals(k, r)).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
  set?.forEach(v => counts.has(v) || counts.set(v, 0)); // giữ giá trị đã chọn dù hiện không còn dòng
  let list = [...counts.keys()].sort((a, b) => a === BLANK ? 1 : b === BLANK ? -1 : a.localeCompare(b, 'vi'));
  if (c.tree) list = UNITS.flatMap(u => counts.has(u) ? [u, ...list.filter(v => v.startsWith(u + ' ›'))] : []);
  const label = v => c.tree && v.includes(' › ') ? '  └ ' + v.split(' › ')[1] : v;
  pop = document.createElement('div');
  pop.className = 'fpop';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `
<button type="button" class="srt" data-dir="1">↑ Sắp xếp A → Z</button>
<button type="button" class="srt" data-dir="-1">↓ Sắp xếp Z → A</button>
<input type="search" class="fq" placeholder="Tìm…" aria-label="Tìm giá trị">
<label><input type="checkbox" class="fall"> <b>(Chọn tất cả)</b></label>
<div class="flist">${list.map((v, i) => `<label title="${esc(v)}"><input type="checkbox" data-i="${i}"${!set || set.has(v) ? ' checked' : ''}>
  <span class="v">${esc(label(v))}</span><span class="n">${counts.get(v)}</span></label>`).join('') || '<i>Không có giá trị</i>'}</div>
<div class="fact"><button type="button" data-act="cancel">Hủy</button><button type="button" data-act="ok">OK</button></div>`;
  document.body.append(pop);
  const rc = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(rc.left, innerWidth - 310)) + 'px';
  pop.style.top = Math.min(rc.bottom + 4, innerHeight - pop.offsetHeight - 8) + 'px';
  const boxes = [...pop.querySelectorAll('.flist input')];
  const visible = () => boxes.filter(b => !b.parentElement.hidden);
  const syncAll = () => { const v = visible(); pop.querySelector('.fall').checked = v.length > 0 && v.every(b => b.checked); };
  syncAll();
  pop.querySelector('.fq').focus();
  pop.querySelector('.fq').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    boxes.forEach(b => b.parentElement.hidden = q && !list[b.dataset.i].toLowerCase().includes(q));
    syncAll();
  });
  pop.querySelector('.fall').addEventListener('change', e => { visible().forEach(b => b.checked = e.target.checked); });
  pop.querySelector('.flist').addEventListener('change', syncAll);
  pop.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.dir) { sortBy = { key: k, dir: +t.dataset.dir }; closeFilter(); render(); return; }
    if (t.dataset.act === 'cancel') return closeFilter();
    if (t.dataset.act === 'ok') {
      // đang gõ tìm thì như Excel: chỉ giữ các giá trị khớp và được tick
      const keep = (pop.querySelector('.fq').value.trim() ? visible() : boxes).filter(b => b.checked).map(b => list[b.dataset.i]);
      if (keep.length === list.length) delete colFilters[k]; else colFilters[k] = new Set(keep);
    }
    closeFilter(); render();
  });
}

document.querySelector('thead').addEventListener('click', e => { const b = e.target.closest('.fbtn'); if (b) { e.stopPropagation(); openFilter(b); } });
document.addEventListener('mousedown', e => { if (pop && !pop.contains(e.target) && !e.target.closest('.fbtn')) closeFilter(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFilter(); });
$('catChip').addEventListener('click', () => { cat = ''; render(); });
$('clearAll').addEventListener('click', () => { for (const k in colFilters) delete colFilters[k]; sortBy = null; cat = ''; $('q').value = ''; render(); });

function render() {
  const base = rows.filter(r => passes(r, null, false));
  const catLabel = CATS.find(([k]) => k === cat)?.[1];
  $('catChip').hidden = !catLabel;
  $('catChip').textContent = `Trạng thái: ${catLabel} ✕`;
  const shown = cat ? base.filter(r => statusClass(r.tinh_trang) === cat) : base;
  if (sortBy) {
    const key = r => colVals(sortBy.key, r)[0];
    shown.sort((a, b) => sortBy.dir * key(a).localeCompare(key(b), 'vi'));
  }
  document.querySelectorAll('.fbtn').forEach(b => {
    const on = b.dataset.col in colFilters || sortBy?.key === b.dataset.col;
    b.classList.toggle('on', on);
    b.innerHTML = FUNNEL + (sortBy?.key === b.dataset.col ? (sortBy.dir > 0 ? '↑' : '↓') : '');
  });
  $('clearAll').hidden = !(Object.keys(colFilters).length || sortBy || cat || $('q').value);
  $('count').textContent = `${shown.length} / ${rows.length} công việc`;
  // bấm dòng để mở khung chi tiết bên phải
  const cl = s => s ? `<div class="clamp">${esc(s)}</div>` : '';
  $('list').innerHTML = shown.map((r, i) => `
<tr id="r${r.id}" data-id="${r.id}" tabindex="0" class="${openId === r.id ? 'open' : ''}" aria-label="Xem chi tiết: ${esc(r.noi_dung || (r.ket_luan || '').slice(0, 60))}">
  <td class="stt">${i + 1}</td>
  <td>${cl(r.thong_tin_cuoc_hop)}</td>
  <td class="name">${cl(r.noi_dung) || '<span style="color:var(--muted);font-weight:400">(không ghi)</span>'}${prevWeek && !prevByKey.has(r.key) ? `<span class="new" title="Không có trong tuần ${esc(prevWeek)}">Mới</span>` : ''}</td>
  <td>${cl(r.ket_luan)}</td>
  <td>${cl(r.tinh_hinh)}</td>
  <td class="c" title="${esc(r.don_vi_dau_moi)}">${unitPills(r)}</td>
  <td class="c">${cl(r.don_vi_phoi_hop)}</td>
  <td class="c">${esc(r.thoi_han)}</td>
  <td><span class="status ${statusClass(r.tinh_trang)}">${esc(r.tinh_trang) || '—'}</span></td>
  <td class="kk">${cl(r.kho_khan)}</td>
  <td>${cl(r.sheet)}</td>
  <td class="note">${cl(r.ghi_chu) || '<span class="none">—</span>'}</td>
</tr>`).join('') || '<tr><td colspan="12" class="empty" style="text-align:center;padding:32px">Không có công việc phù hợp với bộ lọc.</td></tr>';
}

// ===== Khung chi tiết trượt từ phải =====
let openId = null;
function openDrawer(id) {
  const r = rows.find(x => x.id == id);
  if (!r) return;
  openId = r.id;
  document.querySelectorAll('#list tr.open').forEach(t => t.classList.remove('open'));
  $('r' + r.id)?.classList.add('open');
  $('dMeet').textContent = r.thong_tin_cuoc_hop;
  $('dName').textContent = r.noi_dung || '(Không ghi tên công việc)';
  const sec = (title, text, cls = '') => text ? `<section class="d-sec ${cls}"><h4>${title}</h4><p>${esc(text)}</p></section>` : '';
  $('dBody').innerHTML = `
<dl class="d-meta">
  <div><dt>Trạng thái</dt><dd><span class="status ${statusClass(r.tinh_trang)}">${esc(r.tinh_trang) || '—'}</span></dd></div>
  <div><dt>Deadline</dt><dd>${esc(r.thoi_han) || '—'}</dd></div>
  <div><dt>Đơn vị phụ trách</dt><dd>${unitPills(r)}<div style="color:var(--muted);font-size:12px;margin-top:4px">${esc(r.don_vi_dau_moi)}</div></dd></div>
  <div><dt>Đơn vị phối hợp</dt><dd>${esc(r.don_vi_phoi_hop) || '—'}</dd></div>
</dl>
${sec('Nội dung kết luận', r.ket_luan)}
${sec('Tình hình thực hiện', r.tinh_hinh)}
${sec('Khó khăn vướng mắc, kiến nghị', r.kho_khan, 'warn')}
<section class="d-sec"><h4>Ghi chú</h4>
  <textarea id="dNote" data-id="${r.id}" aria-label="Ghi chú" placeholder="Nhập ghi chú… (tự lưu khi bấm ra ngoài)">${esc(r.ghi_chu)}</textarea>
  <div class="d-saved" id="dSaved" role="status"></div></section>
<div style="font-size:12px;color:var(--muted)">Từ sheet: ${esc(r.sheet)} · Tuần ${esc(r.tuan)}</div>`;
  $('drawer').hidden = $('drawerBg').hidden = false;
  document.querySelector('.app').inert = true; // bẫy focus: nội dung phía sau không Tab/đọc được
  $('dClose').focus();
}
function closeDrawer() {
  if ($('drawer').hidden) return;
  if ($('drawer').contains(document.activeElement)) document.activeElement.blur(); // kích hoạt 'change' để lưu ghi chú đang gõ
  $('drawer').hidden = $('drawerBg').hidden = true;
  document.querySelector('.app').inert = false;
  $('r' + openId)?.classList.remove('open');
  $('r' + openId)?.focus();
  openId = null;
}
$('list').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr && !getSelection().toString()) openDrawer(tr.dataset.id); });
$('list').addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDrawer(tr.dataset.id); } });
$('dClose').addEventListener('click', closeDrawer);
$('drawerBg').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) closeDrawer(); });

// lưu ghi chú khi rời ô
$('dBody').addEventListener('change', async e => {
  if (e.target.id !== 'dNote') return;
  const el = e.target, r = rows.find(x => x.id == el.dataset.id);
  if (!r) return; // tuần đã đổi / dữ liệu vừa nạp lại
  $('dSaved').textContent = 'Đang lưu…';
  const { error } = await db.from('tasks').update({ ghi_chu: el.value || null }).eq('id', r.id);
  if (error) { $('dSaved').textContent = ''; uiError('Lưu lỗi: ' + error.message); el.value = r.ghi_chu ?? ''; return; }
  r.ghi_chu = el.value || null;
  $('dSaved').textContent = '✓ Đã lưu';
  const cell = $('r' + r.id)?.querySelector('td.note');
  if (cell) cell.innerHTML = r.ghi_chu ? `<div class="clamp">${esc(r.ghi_chu)}</div>` : '<span class="none">—</span>';
});
let qTimer;
$('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(render, 150); });

// ===== Sidebar: 2 trang Dashboard / Bảng công việc (nhớ theo #hash) =====
let view = 'dash';
let me = null; // hồ sơ người đang đăng nhập: { id, email, full_name, role, active }
// trang có data-roles chỉ mở cho các vai trò đó (quyền thật vẫn do database kiểm)
const allowed = v => {
  const roles = document.querySelector(`.side a[data-view="${v}"]`)?.dataset.roles;
  return !roles || (!!me && roles.split(' ').includes(me.role));
};
function showView(v) {
  view = ['table', 'import', 'users'].includes(v) ? v : 'dash';
  if (!allowed(view)) view = 'dash';
  $('v-users').hidden = view !== 'users';
  if (view === 'users') loadUsers();
  $('v-dash').hidden = $('overview').hidden = view !== 'dash'; // thẻ Tổng quan chỉ thuộc Dashboard
  $('v-table').hidden = view !== 'table';
  $('v-import').hidden = view !== 'import';
  $('pageTitle').textContent = { dash: 'Dashboard', table: 'Bảng công việc', import: 'Nạp dữ liệu', users: 'Người dùng' }[view];
  // trang Nạp dữ liệu / Người dùng không theo tuần -> ẩn bộ chọn tuần
  document.querySelector('.wnav').hidden = document.querySelector('.psub').hidden = ['import', 'users'].includes(view);
  document.querySelectorAll('.side a').forEach(a => a.setAttribute('aria-current', a.dataset.view === view ? 'page' : 'false'));
  closeFilter();
}
window.addEventListener('hashchange', () => { showView(location.hash.slice(1)); render(); });
showView(location.hash.slice(1));

// ===== Dashboard =====
const FILL = { 'st-done': 'var(--f-done)', 'st-doing': 'var(--f-doing)', 'st-late': 'var(--f-late)', 'st-todo': 'var(--f-todo)' };
const countBy = l => { const n = Object.fromEntries(CATS.map(([k]) => [k, 0])); l.forEach(r => n[statusClass(r.tinh_trang)]++); return n; };
const pctOf = (a, b) => b ? Math.round(100 * a / b) : 0;
// mỗi đoạn biểu đồ: tooltip + bấm để mở Bảng đã lọc
const seg = (style, tip, go) => `<span style="${style}" data-tip="${esc(tip)}" data-go="${esc(JSON.stringify(go))}"></span>`;
const EMPTY = '<p class="empty">Chưa có dữ liệu.</p>';

const go = o => `data-go="${esc(JSON.stringify(o))}"`;
// mức rủi ro theo tỷ lệ việc chậm; shortcut: ngưỡng 20% / 10% cố định, khi lãnh đạo có ngưỡng chính thức thì sửa ở đây
const riskLevel = ratio => ratio >= 0.2 ? ['lv-hi', '⚠ Cao'] : ratio >= 0.1 ? ['lv-mid', '● Trung bình'] : ['lv-lo', '✓ Thấp'];
console.assert(riskLevel(0.2)[0] === 'lv-hi' && riskLevel(0.1)[0] === 'lv-mid' && riskLevel(0.09)[0] === 'lv-lo', 'rủi ro');

// "▲3 điểm % so với tuần 44" — xanh nếu thay đổi theo hướng tốt, đỏ nếu xấu
function trend(d, unit, upIsGood) {
  if (d === null) return '';
  const cls = d === 0 ? '' : (d > 0) === upIsGood ? 'good' : 'bad';
  return `<span class="trend ${cls}">${d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '= không đổi'}${d ? unit : ''} so với tuần ${esc(prevWeek)}</span>`;
}

function renderDash() {
  // 0a. Tiến độ tổng thể (tuần đang xem, so với tuần trước)
  const t = rows.length, ns = countBy(rows);
  const prev = prevWeek ? [...prevByKey.values()] : null, pn = prev && countBy(prev);
  const done = pctOf(ns['st-done'], t), risk = ns['st-late'] + ns['st-todo'];
  $('pStatus').innerHTML = !t ? EMPTY : `
<div class="hero">
  <div><div class="hl">Hoàn thành</div><div class="hv">${done}%</div>
    <div class="hs"><span ${go({ cat: 'st-done' })}>${ns['st-done']}</span> / ${t} việc
      ${trend(prev ? done - pctOf(pn['st-done'], prev.length) : null, ' điểm %', true)}</div></div>
  <div class="hrisk"><div class="hl">Cần chú ý</div><div class="hv bad">${risk}</div>
    <div class="hs"><span ${go({ cat: 'st-late' })}>${ns['st-late']} chậm</span> · <span ${go({ cat: 'st-todo' })}>${ns['st-todo']} chưa triển khai</span>
      ${trend(prev ? risk - pn['st-late'] - pn['st-todo'] : null, ' việc', false)}</div></div>
</div>
<div class="pbar" role="img" aria-label="${esc(CATS.map(([k, l]) => `${l} ${ns[k]}`).join(', '))}">${CATS.filter(([k]) => ns[k]).map(([k, l]) =>
    `<span style="flex:${ns[k]};background:${FILL[k]}" data-tip="${esc(`${l}: ${ns[k]} (${pctOf(ns[k], t)}%)`)}" ${go({ cat: k })}>${pctOf(ns[k], t) >= 8 ? pctOf(ns[k], t) + '%' : ''}</span>`).join('')}</div>
<div class="pleg">${CATS.map(([k, l]) => `<span><i style="background:${FILL[k]}"></i>${l} <b>${ns[k]}</b></span>`).join('')}</div>`;

  // 0b. Đơn vị cần chú ý: xếp theo tỷ lệ việc chậm
  const sc = UNITS.map(u => { const l = rows.filter(r => r.units.includes(u)), n = countBy(l); return { u, t: l.length, n }; })
    .filter(x => x.t).sort((a, b) => b.n['st-late'] / b.t - a.n['st-late'] / a.t || b.n['st-late'] - a.n['st-late']);
  $('pUnit').innerHTML = !sc.length ? EMPTY : `<table class="score"><thead><tr><th>Đơn vị</th><th class="n">Số việc</th><th>Hoàn thành</th>
  <th class="n">Chậm</th><th class="n">Chưa TK</th><th>Rủi ro</th></tr></thead><tbody>${sc.map(({ u, t, n }) => {
    const [cls, txt] = riskLevel(n['st-late'] / t), d = pctOf(n['st-done'], t);
    return `<tr ${go({ unit: u, cat: 'st-late' })} title="Bấm để xem việc chậm của ${u}"><td><b>${u}</b></td><td class="n">${t}</td>
  <td class="n" style="text-align:left"><span class="mini"><i style="width:${d}%"></i></span>${d}%</td>
  <td class="n">${n['st-late']} <span style="color:var(--muted)">(${pctOf(n['st-late'], t)}%)</span></td><td class="n">${n['st-todo']}</td>
  <td><span class="lv ${cls}">${txt}</span></td></tr>`;
  }).join('')}</tbody></table>`;

  $('dLegend').innerHTML = CATS.map(([k, l]) => `<span><i style="background:${FILL[k]}"></i>${l}</span>`).join('');
  // 1. trạng thái theo đơn vị (tuần đang xem)
  const per = UNITS.map(u => { const l = rows.filter(r => r.units.includes(u)); return [u, l.length, countBy(l)]; });
  const mx = Math.max(1, ...per.map(p => p[1]));
  $('cUnit').innerHTML = rows.length ? per.map(([u, t, n]) => `<div class="hrow"><b>${u}</b>
<div style="width:${100 * t / mx}%"><div class="stack">${CATS.filter(([k]) => n[k]).map(([k, l]) =>
    seg(`flex:${n[k]};background:${FILL[k]}`, `${u} · ${l}: ${n[k]} (${pctOf(n[k], t)}%)`, { unit: u, cat: k })).join('')}</div></div>
<span class="num">${t}</span></div>`).join('') : EMPTY;
  // 2. xu hướng 8 tuần gần nhất
  const visible = dbRows.filter(r => r.units?.length), wk = weeks.slice(-8);
  const per2 = wk.map(w => { const l = visible.filter(r => r.tuan === w); return [w, l.length, countBy(l)]; });
  const mx2 = Math.max(1, ...per2.map(p => p[1]));
  $('cTrend').innerHTML = wk.length ? `<div class="cols">${per2.map(([w, t, n]) => `<div class="col"><span class="ctot">${t}</span>
  <div class="cbar" style="height:${100 * t / mx2 * 0.9}%">${CATS.filter(([k]) => n[k]).map(([k, l]) =>
    seg(`flex:${n[k]};background:${FILL[k]}`, `Tuần ${w} · ${l}: ${n[k]} (${pctOf(n[k], t)}%)`, { week: w, cat: k })).join('')}</div></div>`).join('')}</div>
<div class="xls">${wk.map(w => `<span class="${w === week ? 'cur' : ''}">${esc(w)}</span>`).join('')}</div>` : EMPTY;
  // 3. cuộc họp nhiều việc chậm nhất (tuần đang xem)
  const byM = new Map();
  rows.filter(r => statusClass(r.tinh_trang) === 'st-late').forEach(r => byM.set(r.thong_tin_cuoc_hop, (byM.get(r.thong_tin_cuoc_hop) || 0) + 1));
  const top = [...byM].sort((a, b) => b[1] - a[1]).slice(0, 8), mx3 = top[0]?.[1] || 1;
  $('cLate').innerHTML = !rows.length ? EMPTY : top.length ? top.map(([m, c]) => `<div class="hrow wide">
  <span class="lbl" title="${esc(m)}">${esc(m)}</span>
  <div>${seg(`display:block;height:18px;border-radius:0 4px 4px 0;width:${100 * c / mx3}%;background:${FILL['st-late']}`, `${m}: ${c} việc chậm`, { meet: m, cat: 'st-late' })}</div>
  <span class="num">${c}</span></div>`).join('') : '<p class="empty">Tuần này không có việc triển khai chậm.</p>';
}

// bấm biểu đồ -> sang Bảng với đúng bộ lọc đó
$('v-dash').addEventListener('click', e => {
  const el = e.target.closest('[data-go]');
  if (!el) return;
  const go = JSON.parse(el.dataset.go);
  for (const k in colFilters) delete colFilters[k];
  $('q').value = '';
  if (go.week && go.week !== week) setWeek(go.week);
  if (go.unit) colFilters.unit = new Set([go.unit]);
  if (go.meet) colFilters.meet = new Set([go.meet.replace(/\s+/g, ' ').trim()]);
  cat = go.cat || '';
  goTable();
});

// tooltip chung cho mọi [data-tip]
document.addEventListener('mousemove', e => {
  const el = e.target.closest?.('[data-tip]'), tip = $('tip');
  if (!el) { tip.hidden = true; return; }
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = (e.clientY + 14) + 'px';
});

// ===== Theo tuần: mỗi file Excel = 1 tuần, xem lại được các tuần trước =====
let dbRows = [], weeks = [], week = '', prevWeek = '', prevByKey = new Map();
const weekNum = t => { const [w, y] = t.split('/').map(Number); return y * 100 + w; };
const normWeek = s => { const m = s.match(/^\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/); return m ? `${+m[1]}/${m[2]}` : null; };
console.assert(normWeek(' 05 / 2026 ') === '5/2026' && weekNum('52/2025') < weekNum('1/2026') && !normWeek('45'), 'tuần');

function setWeek(w) {
  closeDrawer(); // trước khi đổi rows để ghi chú đang gõ còn lưu được
  week = w;
  // ẩn dòng không có đơn vị đầu mối của mình (còn sót từ lần nạp thử "đầu mối + phối hợp")
  const visible = dbRows.filter(r => r.units?.length);
  rows = visible.filter(r => r.tuan === w);
  const i = weeks.indexOf(w);
  prevWeek = i > 0 ? weeks[i - 1] : '';
  prevByKey = new Map(visible.filter(r => r.tuan === prevWeek).map(r => [r.key, r]));
  $('weekTitle').textContent = w || '—';
  // 2 ô chọn: Năm, rồi Tuần trong năm đó
  const y = w.split('/')[1] || '';
  $('yearSel').innerHTML = [...new Set(weeks.map(x => x.split('/')[1]))].sort().reverse()
    .map(v => `<option value="${esc(v)}">Năm ${esc(v)}</option>`).join('');
  $('yearSel').value = y;
  $('weekSel').innerHTML = weeks.filter(x => x.endsWith('/' + y)).reverse()
    .map(x => `<option value="${esc(x)}">Tuần ${esc(x.split('/')[0])}</option>`).join('');
  $('weekSel').value = w;
  $('prevW').disabled = i <= 0;
  $('nextW').disabled = i < 0 || i >= weeks.length - 1;
  const at = rows.reduce((a, r) => r.updated_at > a ? r.updated_at : a, '');
  $('updatedAt').textContent = at ? ` · cập nhật ${new Date(at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}` : '';
  closeFilter();
  render();
  renderOverview(rows); // Tổng quan + biểu đồ chỉ phụ thuộc tuần đang xem, không theo bộ lọc của Bảng
  renderDash();
}
$('weekSel').addEventListener('change', e => setWeek(e.target.value));
// đổi năm -> mở tuần mới nhất của năm đó
$('yearSel').addEventListener('change', e => setWeek(weeks.filter(x => x.endsWith('/' + e.target.value)).at(-1)));
$('prevW').addEventListener('click', () => setWeek(weeks[weeks.indexOf(week) - 1]));
$('nextW').addEventListener('click', () => setWeek(weeks[weeks.indexOf(week) + 1]));

async function load() {
  // shortcut: tải mọi tuần một lần; khi dữ liệu lên vài chục nghìn dòng thì chuyển sang tải theo tuần đang chọn
  const data = []; let error;
  for (let from = 0; ; from += 1000) { // PostgREST cắt ở 1000 dòng/lần
    const r = await db.from('tasks').select('*').order('id').range(from, from + 999);
    if (r.error) { error = r.error; break; }
    data.push(...r.data);
    if (r.data.length < 1000) break;
  }
  if (error) {
    $('list').innerHTML = `<tr><td colspan="12">Lỗi tải dữ liệu: ${esc(error.message)} <button type="button" class="ghost-btn" id="retryLoad">Thử lại</button></td></tr>`;
    $('retryLoad').addEventListener('click', load);
    return;
  }
  dbRows = data;
  weeks = [...new Set(data.filter(r => r.units?.length).map(r => r.tuan))].sort((a, b) => weekNum(a) - weekNum(b));
  setWeek(weeks.includes(week) ? week : weeks.at(-1) || '');
  renderWeekList();
  $('dataInfo').textContent = weeks.length ? `${weeks.length} tuần dữ liệu · mới nhất ${weeks.at(-1)}` : 'Chưa có dữ liệu';
}

// điền sẵn số tuần từ tên file "Tuan 44.2026 - ..." (vẫn sửa được)
$('file').addEventListener('change', () => {
  const m = $('file').files[0]?.name.match(/Tu[aầ]n\s*(\d{1,2})[.\-_ /](\d{4})/i);
  if (m) $('weekIn').value = `${+m[1]}/${m[2]}`;
});

const msg = t => $('importMsg').textContent = t;
// quyền thật nằm ở database (RLS + trigger); kiểm tra ở web chỉ để báo sớm cho người dùng
function ensureLogin() {
  if (me && ['admin', 'editor'].includes(me.role)) return true;
  msg('Chỉ Quản trị và Nhập liệu được nạp hoặc xóa dữ liệu.');
  return false;
}

// danh sách các tuần đã nạp (trang Nạp dữ liệu)
function renderWeekList() {
  const visible = dbRows.filter(r => r.units?.length);
  $('weekList').innerHTML = weeks.length ? `<table class="wtable"><thead><tr><th>Tuần</th><th style="text-align:right">Số việc</th>
  <th style="text-align:right">Có ghi chú</th><th>Nạp lúc</th><th></th></tr></thead><tbody>${[...weeks].reverse().map(w => {
    const l = visible.filter(r => r.tuan === w);
    const at = l.reduce((a, r) => r.updated_at > a ? r.updated_at : a, '');
    return `<tr><td><b>${esc(w)}</b></td><td class="n">${l.length}</td><td class="n">${l.filter(r => r.ghi_chu).length}</td>
  <td>${at ? new Date(at).toLocaleString('vi-VN') : '—'}</td>
  <td style="text-align:right;white-space:nowrap"><button type="button" data-open="${esc(w)}">Xem</button>
    <button type="button" class="del" data-del="${esc(w)}">Xóa</button></td></tr>`;
  }).join('')}</tbody></table>` : '<p class="empty">Chưa nạp tuần nào.</p>';
}

$('weekList').addEventListener('click', async e => {
  const open = e.target.closest('[data-open]')?.dataset.open, w = e.target.closest('[data-del]')?.dataset.del;
  if (open) { setWeek(open); location.hash = '#dash'; return; }
  if (!w) return;
  const n = dbRows.filter(r => r.tuan === w).length;
  const typed = await uiDialog({ title: `Xóa dữ liệu tuần ${w}`, danger: true, ok: 'Xóa tuần', input: '', needs: w,
    message: `Xóa toàn bộ ${n} việc của tuần ${w}, kể cả ghi chú. Thao tác này không hoàn tác được.\n\nGõ ${w} để xác nhận:` });
  if (typed === null) return;
  if (normWeek(typed) !== w) return msg('Số tuần gõ lại không khớp, chưa xóa gì.');
  try {
    if (!(await ensureLogin())) return;
    const { error } = await db.from('tasks').delete().eq('tuan', w);
    if (error) return msg('Xóa lỗi: ' + error.message);
    msg(`✓ Đã xóa dữ liệu tuần ${w}.`);
    if (w === week) week = '';
    await load();
  } catch (err) { msg('Lỗi: ' + err.message); }
});

$('importForm').addEventListener('submit', async e => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('[type=submit]');
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;
  try {
    if (!(await ensureLogin())) return;
    const tuan = normWeek($('weekIn').value);
    if (!tuan) return msg('Nhập số tuần dạng 45/2026.');
    msg('Đang đọc và phân loại…');
    const { rows: data, skipped } = await classifyWorkbook(XLSX.read(await $('file').files[0].arrayBuffer()));
    const skipNote = skipped.length ? ` Bỏ qua (không có cột Đơn vị đầu mối): ${skipped.join(', ')}.` : '';
    if (!data.length) return msg('Không tìm thấy công việc nào của KT/CĐS/NCPT/ĐCM trong file.');

    const newKeys = new Set(data.map(r => r.key));
    const thisWeek = dbRows.filter(r => r.tuan === tuan);
    const thisKeys = new Set(thisWeek.map(r => r.key));
    // chỉ xóa việc có đơn vị mà không còn trong file; dòng ẩn (units rỗng) không bao giờ bị xóa
    const stale = thisWeek.filter(r => r.units?.length && !newKeys.has(r.key));
    if (thisWeek.length && !await uiDialog({ title: `Cập nhật tuần ${tuan}?`, ok: 'Cập nhật', message: `Tuần ${tuan} đã có dữ liệu. Nạp file này sẽ cập nhật tuần ${tuan}:\n` +
      `• giữ ghi chú của việc còn trong file\n• xóa ${stale.length} việc không còn trong file` +
      (stale.some(r => r.ghi_chu) ? ` (${stale.filter(r => r.ghi_chu).length} việc có ghi chú)` : '') + '\n\nTiếp tục?' }))
      return msg('Đã hủy.');

    // việc mới của tuần này: mang ghi chú từ tuần gần nhất trước đó (nếu cùng việc)
    const before = weeks.filter(w => weekNum(w) < weekNum(tuan)).at(-1);
    const prevNotes = new Map(dbRows.filter(r => r.tuan === before && r.ghi_chu).map(r => [r.key, r.ghi_chu]));
    const now = new Date().toISOString();
    const base = r => ({ ...r, tuan, updated_at: now });
    // tách 2 lô: supabase-js điền null cho cột thiếu khi các dòng khác cột -> lô có ghi_chu chỉ gồm dòng mới, không đè ghi chú cũ
    const carry = data.filter(r => !thisKeys.has(r.key) && prevNotes.has(r.key));
    const rest = data.filter(r => !carry.includes(r));
    for (const batch of [rest.map(base), carry.map(r => ({ ...base(r), ghi_chu: prevNotes.get(r.key) }))]) {
      if (!batch.length) continue;
      const { error } = await db.from('tasks').upsert(batch, { onConflict: 'tuan,key' });
      if (error) return msg('Lưu lỗi: ' + error.message);
    }
    if (stale.length) {
      const { error } = await db.from('tasks').delete().in('id', stale.map(r => r.id));
      if (error) return msg('Đã nạp nhưng xóa việc cũ lỗi: ' + error.message);
    }
    msg(`✓ Tuần ${tuan}: đã nạp ${data.length} công việc` + (carry.length ? `, mang sang ${carry.length} ghi chú từ tuần ${before}` : '') +
      (stale.length ? `, xóa ${stale.length} việc không còn trong file` : '') + `.${skipNote}`);
    week = tuan;
    await load();
  } catch (err) { msg('Lỗi: ' + err.message); }
  finally { submitBtn.disabled = false; }
});

// ===== Đăng nhập & vai trò =====
const ROLE_LABEL = { admin: 'Quản trị', editor: 'Nhập liệu', viewer: 'Xem' };
// đăng nhập bằng tên đăng nhập; Supabase Auth cần email nên dùng email nội bộ (phải trùng DOMAIN trong Edge Function)
const AUTH_DOMAIN = 'bctuan.local';
const OWNER_ID = '065441d4-3465-43d4-9088-3c08e6bfa580'; // @vanhp — Quản trị cao nhất; server chặn thật ở admin-users
const loginEmail = v => { v = v.trim().toLowerCase(); return v.includes('@') ? v : `${v}@${AUTH_DOMAIN}`; }; // có @ = email cũ (vd tài khoản tạo trước)

// "Lê Thái Bão" -> "baolt": tên chính + chữ cái đầu của họ & tên đệm, bỏ dấu
function makeUsername(fullName) {
  const parts = fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .split(/\s+/).map(p => p.replace(/[^a-z0-9]/g, '')).filter(Boolean);
  return parts.length ? parts.at(-1) + parts.slice(0, -1).map(p => p[0]).join('') : '';
}
// thêm số nếu trùng, bắt đầu từ 1: baolt, baolt1, baolt2… (giống Edge Function register)
const uniqueUsername = (base, taken) => { if (!base) return ''; let u = base, i = 1; while (taken.has(u)) u = base + i++; return u; };
console.assert(makeUsername('Lê Thái Bão') === 'baolt' && makeUsername('  Đặng Đức  Anh ') === 'anhdd' && makeUsername('Nguyễn Văn A') === 'anv', 'username');
console.assert(uniqueUsername('baolt', new Set(['baolt'])) === 'baolt1' && uniqueUsername('baolt', new Set(['baolt', 'baolt1'])) === 'baolt2' && loginEmail(' BaoLT ') === 'baolt@bctuan.local' && loginEmail('a@gmail.com') === 'a@gmail.com', 'username 2');

// ===== Ảnh đại diện: lưu trên Supabase Storage (kho "avatars" riêng tư, xem qua link có hạn 1 giờ) =====
const avatarUrl = new Map(); // path -> { url, at }; ký lại khi đã quá 50 phút (link sống 60 phút)
const avatarFresh = p => Date.now() - (avatarUrl.get(p)?.at ?? 0) < 50 * 60e3;
async function signAvatars(paths) {
  const need = [...new Set(paths.filter(p => p && !avatarFresh(p)))];
  if (!need.length) return;
  const { data } = await db.storage.from('avatars').createSignedUrls(need, 3600);
  (data || []).forEach(d => d.signedUrl && avatarUrl.set(d.path, { url: d.signedUrl, at: Date.now() }));
}
// ảnh ở sidebar: làm mới link khi người dùng quay lại tab
document.addEventListener('visibilitychange', async () => {
  const p = me?.avatar_path;
  if (document.visibilityState !== 'visible' || !p || avatarFresh(p)) return;
  await signAvatars([p]);
  const img = $('meAvatar').querySelector('img'), u = avatarUrl.get(p)?.url;
  if (img && u) img.src = u;
});
const initialOf = u => ((u.full_name || u.username || u.email || '?').trim().split(/\s+/).at(-1)[0] || '?').toUpperCase();
const avatarHtml = (u, cls = '') => {
  const url = avatarUrl.get(u.avatar_path)?.url;
  return `<span class="avatar ${cls}">${url ? `<img src="${esc(url)}" alt="">` : esc(initialOf(u))}</span>`;
};
// cắt vuông giữa ảnh, thu về 256px JPEG (~20–40 KB) trước khi tải lên
async function resizeImage(file, size = 256) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WEBP');
  if (file.size > 10e6) throw new Error('Ảnh quá lớn (tối đa 10 MB)');
  const img = await createImageBitmap(file), s = Math.min(img.width, img.height);
  const c = Object.assign(document.createElement('canvas'), { width: size, height: size });
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}
async function uploadAvatar(uid, file, oldPath) {
  const path = `${uid}/${Date.now()}.jpg`; // tên mới mỗi lần để trình duyệt không giữ ảnh cũ
  const { error } = await db.storage.from('avatars').upload(path, await resizeImage(file), { contentType: 'image/jpeg' });
  if (error) throw new Error('Tải ảnh lỗi: ' + error.message);
  await adminCall({ action: 'update', id: uid, avatar_path: path });
  if (oldPath) await db.storage.from('avatars').remove([oldPath]); // dọn ảnh cũ, lỗi cũng không sao
  return path;
}

// kết thúc phiên: tải lại trang để xóa sạch DOM/bộ nhớ (drawer, bảng, danh sách người dùng, mật khẩu tạm…)
function endSession(text) {
  me = null;
  try { sessionStorage.setItem('flash', text); } catch { }
  location.reload();
}
function showLogin(text = '', canRetry = false) {
  if (regChannel) { db.removeChannel(regChannel); regChannel = null; } // thôi nghe đăng ký mới khi đăng xuất
  me = null; dbRows = []; rows = [];
  try { text = text || sessionStorage.getItem('flash') || ''; sessionStorage.removeItem('flash'); } catch { }
  $('app').hidden = true; $('login').hidden = false;
  $('loginRetry').hidden = !canRetry;
  $('loginMsg').textContent = text;
  $('loginPw').value = '';
  $('loginEmail').focus();
}

let booting = null; // chặn boot() chạy chồng (bấm đăng nhập 2 lần, đổi ảnh của chính mình…)
const boot = () => booting ??= bootNow().finally(() => { booting = null; });
$('loginRetry').addEventListener('click', () => { $('loginRetry').hidden = true; boot(); });
async function bootNow() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return showLogin();
  const { data: p, error } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) return showLogin('Lỗi tải hồ sơ: ' + error.message + ' Kiểm tra kết nối rồi bấm Thử lại.', true); // giữ phiên, không đăng xuất
  if (p?.pending) { // tự đăng ký, chưa được duyệt
    await db.auth.signOut();
    return showLogin(`Tài khoản @${p.username} đang chờ Quản trị duyệt. Vui lòng quay lại sau.`);
  }
  if (!p || !p.active) {
    await db.auth.signOut();
    return showLogin(!p ? 'Tài khoản chưa được cấp quyền. Liên hệ Quản trị.' : 'Tài khoản đã bị khóa. Liên hệ Quản trị.');
  }
  me = p;
  $('meName').textContent = p.full_name || p.username;
  $('meRole').innerHTML = `<span class="role-tag ${esc(p.role)}">${esc(ROLE_LABEL[p.role])}</span> <span style="color:var(--muted)">@${esc(p.username)}</span>`;
  await signAvatars([p.avatar_path]);
  $('meAvatar').outerHTML = avatarHtml(p).replace('<span class="avatar ', '<span id="meAvatar" aria-hidden="true" class="avatar ');
  document.querySelectorAll('.side a[data-roles]').forEach(a => a.hidden = !allowed(a.dataset.view));
  $('login').hidden = true; $('app').hidden = false;
  showView(location.hash.slice(1));
  refreshPendingBadge(); // Quản trị: số yêu cầu đăng ký chờ duyệt trên menu
  watchRegistrations();  // Quản trị: báo ngay khi có người đăng ký
  await load();
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('loginBtn').disabled = true; $('loginMsg').textContent = '';
  const { error } = await db.auth.signInWithPassword({ email: loginEmail($('loginEmail').value), password: $('loginPw').value });
  if (error) {
    $('loginBtn').disabled = false;
    return $('loginMsg').textContent = /banned/i.test(error.message) ? 'Tài khoản đã bị khóa. Liên hệ Quản trị.'
      : /invalid login/i.test(error.message) ? 'Sai tên đăng nhập hoặc mật khẩu.' : 'Đăng nhập lỗi: ' + error.message;
  }
  try { await boot(); } finally { $('loginBtn').disabled = false; }
});
$('logout').addEventListener('click', async () => { me = null; await db.auth.signOut(); endSession('Đã đăng xuất.'); });

// ===== Tự đăng ký (Quản trị duyệt) =====
const showForm = reg => {
  $('loginForm').hidden = reg; $('regForm').hidden = !reg;
  (reg ? $('rName') : $('loginEmail')).focus();
};
$('toReg').addEventListener('click', () => showForm(true));
$('toLogin').addEventListener('click', () => showForm(false));
// xem trước tên đăng nhập (tên chính thức do server tạo, có thể thêm số nếu trùng)
$('rName').addEventListener('input', () => { $('rUser').textContent = makeUsername($('rName').value) || '—'; });
const R_AV_EMPTY = $('rAvPrev').innerHTML;
$('rAv').addEventListener('change', () => {
  const f = $('rAv').files[0];
  $('rAvPrev').innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="">` : R_AV_EMPTY;
});
const toDataUrl = blob => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(blob); });
$('regForm').addEventListener('submit', async e => {
  e.preventDefault();
  const m = $('regMsg'); m.className = 'login-msg';
  if ($('rPw1').value !== $('rPw2').value) return m.textContent = 'Hai lần nhập mật khẩu không khớp.';
  let avatar;
  try { if ($('rAv').files[0]) avatar = await toDataUrl(await resizeImage($('rAv').files[0])); } // JPEG 256px, ~20–40 KB
  catch (err) { return m.textContent = err.message; }
  $('regBtn').disabled = true; m.textContent = 'Đang gửi…';
  const { data, error } = await db.functions.invoke('register', { body: { full_name: $('rName').value, password: $('rPw1').value, avatar } });
  $('regBtn').disabled = false;
  if (error) { let t = error.message; try { t = (await error.context.json()).error || t; } catch { } return m.textContent = t; }
  $('regForm').reset(); $('rUser').textContent = '—'; $('rAvPrev').innerHTML = R_AV_EMPTY;
  showForm(false);
  $('loginEmail').value = data.username;
  $('loginMsg').className = 'login-msg ok';
  $('loginMsg').textContent = `✓ Đã gửi đăng ký. Tên đăng nhập của bạn: ${data.username} (hãy ghi nhớ). Bạn đăng nhập được sau khi Quản trị duyệt.`
    + (avatar && !data.avatarSaved ? ' Ảnh đại diện chưa lưu được, Quản trị có thể thêm sau.' : '');
});

// ===== Modal dùng chung (thay alert/confirm/prompt) — trả về Promise =====
// input = null: hộp xác nhận (true/false); input = chuỗi: hộp nhập (giá trị hoặc null khi hủy)
// needs: phải gõ đúng chuỗi này thì nút OK mới bật (dùng cho thao tác xóa không hoàn tác)
let dlgChain = Promise.resolve(); // xếp hàng: một <dialog> dùng chung, không để lời gọi sau ghi đè lời gọi trước
const uiDialog = opts => { const p = dlgChain.then(() => uiDialogNow(opts)); dlgChain = p.catch(() => { }); return p; };
function uiDialogNow({ title = 'Xác nhận', message = '', input = null, ok = 'Đồng ý', cancel = 'Hủy', danger = false, needs = null }) {
  return new Promise(resolve => {
    const d = $('uiDlg'), inp = $('uiInput'), okBtn = $('uiOk');
    $('uiTitle').textContent = title; $('uiMsg').textContent = message;
    inp.hidden = input === null; inp.value = input ?? ''; inp.placeholder = needs ?? '';
    okBtn.textContent = ok; okBtn.classList.toggle('danger', danger);
    $('uiCancel').hidden = cancel === null; $('uiCancel').textContent = cancel ?? '';
    const check = () => okBtn.disabled = needs != null && inp.value.trim().toLowerCase() !== needs.toLowerCase();
    inp.oninput = check; check();
    const done = v => { d.close(); resolve(v); };
    $('uiForm').onsubmit = e => { e.preventDefault(); if (!okBtn.disabled) done(input === null ? true : inp.value); };
    $('uiCancel').onclick = () => done(input === null ? false : null);
    d.oncancel = e => { e.preventDefault(); done(input === null ? (cancel === null) : null); }; // Esc = hủy
    d.showModal(); (input === null ? okBtn : inp).focus();
  });
}
const uiAlert = (message, title = 'Thông báo') => uiDialog({ title, message, ok: 'Đóng', cancel: null });
const uiError = message => uiDialog({ title: 'Có lỗi', message, ok: 'Đóng', cancel: null });

// ===== Báo Quản trị ngay khi có đăng ký mới (Supabase Realtime, tuân RLS: chỉ Quản trị thấy hồ sơ người khác) =====
let regChannel = null;
const notified = new Set();
function toast(html, onOpen) {
  const t = $('toast');
  t.innerHTML = `<span class="toast-txt">${html}</span>` + (onOpen ? ' <button type="button" class="toast-btn">Xem</button>' : '') + '<button type="button" class="toast-x" aria-label="Đóng">✕</button>';
  t.hidden = false;
  t.querySelector('.toast-btn')?.addEventListener('click', () => { t.hidden = true; onOpen(); });
  t.querySelector('.toast-x').addEventListener('click', () => t.hidden = true);
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.hidden = true, 15000);
}
function watchRegistrations() {
  if (regChannel) { db.removeChannel(regChannel); regChannel = null; }
  if (me?.role !== 'admin') return;
  // xin quyền thông báo trình duyệt ở lần bấm đầu tiên (trình duyệt chỉ cho hỏi sau một thao tác của người dùng)
  if ('Notification' in window && Notification.permission === 'default')
    document.addEventListener('click', () => Notification.requestPermission(), { once: true });
  regChannel = db.channel('dang-ky-moi')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, ({ new: n }) => {
      refreshPendingBadge();
      if (view === 'users') loadUsers();
      // hàm register tạo hồ sơ rồi mới đặt pending = true -> báo ở sự kiện đó, mỗi người 1 lần
      if (!n?.pending || notified.has(n.id)) return;
      notified.add(n.id);
      const who = `${n.full_name || n.username} (@${n.username})`;
      const open = () => { location.hash = '#users'; };
      toast(`🔔 Có đăng ký mới: <b>${esc(who)}</b> đang chờ duyệt.`, open);
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const nt = new Notification('Báo cáo tuần — đăng ký mới', { body: `${who} đang chờ duyệt`, tag: 'reg-' + n.id });
        nt.onclick = () => { window.focus(); open(); nt.close(); };
      }
    })
    .subscribe();
}

// ===== Duyệt đăng ký (Quản trị) =====
let pendingUsers = [];
async function refreshPendingBadge() {
  if (me?.role !== 'admin') return $('navPending').hidden = true;
  const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('pending', true);
  $('navPending').textContent = count || '';
  $('navPending').hidden = !count;
}
function renderPending() {
  $('pendingCard').hidden = !pendingUsers.length;
  $('pendingCount').textContent = pendingUsers.length;
  $('navPending').textContent = pendingUsers.length || ''; $('navPending').hidden = !pendingUsers.length;
  $('pendingList').innerHTML = `<table class="wtable"><thead><tr><th>Người đăng ký</th><th>Đăng ký lúc</th><th>Cấp vai trò</th><th></th></tr></thead><tbody>${pendingUsers.map(u => `<tr data-uid="${u.id}">
      <td><div class="who">${avatarHtml(u, 'md')}<div><b>${esc(u.full_name || '—')}</b><small>@${esc(u.username)}</small></div></div></td>
      <td>${new Date(u.requested_at || u.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
      <td><select data-act="prole" aria-label="Vai trò cấp cho ${esc(u.username)}">${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}"${k === 'viewer' ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td style="text-align:right;white-space:nowrap"><button type="button" class="btn-primary" data-act="approve">Duyệt</button>
        <button type="button" class="del" data-act="reject">Từ chối</button></td></tr>`).join('')}</tbody></table>`;
}
$('pendingList').addEventListener('click', async e => {
  const act = e.target.closest('button')?.dataset.act, tr = e.target.closest('tr');
  if (!act || !tr) return;
  const u = pendingUsers.find(x => x.id === tr.dataset.uid);
  try {
    if (act === 'approve') {
      const role = tr.querySelector('select').value;
      await adminCall({ action: 'approve', id: u.id, role });
      $('userMsg').textContent = `✓ Đã duyệt @${u.username} với vai trò ${ROLE_LABEL[role]}.`;
    }
    if (act === 'reject') {
      if (!await uiDialog({ title: 'Từ chối đăng ký', danger: true, ok: 'Từ chối', message: `Từ chối và xóa yêu cầu đăng ký của ${u.full_name || u.username} (@${u.username})?` })) return;
      await adminCall({ action: 'delete', id: u.id });
      $('userMsg').textContent = `Đã từ chối @${u.username}.`;
    }
    await loadUsers();
  } catch (err) { uiError(err.message); }
});
db.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && me) endSession('Phiên đăng nhập đã hết, vui lòng đăng nhập lại.'); });

// hộp mật khẩu dùng chung: tự đổi của mình, hoặc Quản trị đặt lại cho người khác
let pwSubmit = null;
function openPw(title, onSubmit) {
  $('pwTitle').textContent = title; $('pw1').value = $('pw2').value = ''; $('pwMsg').textContent = '';
  pwSubmit = onSubmit; $('pwDlg').showModal(); $('pw1').focus();
}
$('pwCancel').addEventListener('click', () => $('pwDlg').close());
$('pwForm').addEventListener('submit', async e => {
  e.preventDefault();
  if ($('pw1').value !== $('pw2').value) return $('pwMsg').textContent = 'Hai lần nhập không khớp.';
  try { await pwSubmit($('pw1').value); $('pwDlg').close(); }
  catch (err) { $('pwMsg').textContent = err.message; }
});
$('changePw').addEventListener('click', () => openPw('Đổi mật khẩu của bạn', async pw => {
  const { error } = await db.auth.updateUser({ password: pw });
  if (error) throw new Error(/should be different/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu cũ.' : error.message);
  uiAlert('Đã đổi mật khẩu.');
}));

// ===== Quản lý người dùng (chỉ Quản trị). Ghi qua Edge Function admin-users vì cần service role =====
async function adminCall(body) {
  const { data, error } = await db.functions.invoke('admin-users', { body });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch { } throw new Error(m); }
  return data;
}
const genPw = () => {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; const v = crypto.getRandomValues(new Uint32Array(12));
  return [...v].map(x => a[x % a.length]).join('');
};
console.assert(genPw().length === 12 && /^[A-Za-z2-9]+$/.test(genPw()), 'mật khẩu ngẫu nhiên');
$('uGen').addEventListener('click', () => { $('uPw').value = genPw(); });

let users = [];
async function loadUsers() {
  if (!me || me.role !== 'admin') return;
  const { data, error } = await db.from('profiles').select('*').order('created_at');
  if (error) return $('userList').innerHTML = `<p class="empty">Lỗi tải danh sách: ${esc(error.message)}</p>`;
  users = data.filter(u => !u.pending);
  pendingUsers = data.filter(u => u.pending);
  await signAvatars(data.map(u => u.avatar_path)); // lấy link ảnh cho cả người chờ duyệt, trước khi vẽ
  renderPending();
  $('userList').innerHTML = `<table class="wtable"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead><tbody>${users.map(u => {
    const self = u.id === me.id, owner = u.id === OWNER_ID, locked = owner && !self; return `<tr class="${u.active ? '' : 'off'}" data-uid="${u.id}">
  <td><div class="who">
    ${locked ? avatarHtml(u, 'md') : `<label class="av-edit" title="Bấm để đổi ảnh đại diện">${avatarHtml(u, 'md')}<input type="file" data-act="avatar" accept="image/jpeg,image/png,image/webp" class="sr-only" aria-label="Đổi ảnh đại diện của ${esc(u.username)}"></label>`}
    <div><b>${esc(u.full_name || '—')}${self ? ' <span class="role-tag">Bạn</span>' : ''}${owner ? ' <span class="role-tag">Quản trị cao nhất</span>' : ''}</b><small>@${esc(u.username)}</small></div>
  </div></td>
  <td><select data-act="role" aria-label="Vai trò của ${esc(u.username)}" ${self || locked ? 'disabled title="Không thể đổi vai trò tài khoản này"' : ''}>${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}"${k === u.role ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
  <td>${u.active ? '<span class="st-on">● Hoạt động</span>' : '<span class="st-off">● Đã khóa</span>'}</td>
  <td>${new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
  <td style="text-align:right;white-space:nowrap">${locked ? '' : `
    <button type="button" data-act="name">Sửa tên</button>
    <button type="button" data-act="user">Đổi tên ĐN</button>
    <button type="button" data-act="pw">Đặt lại mật khẩu</button>`}
    ${self || locked ? '' : `<button type="button" data-act="lock">${u.active ? 'Khóa' : 'Mở khóa'}</button>
    <button type="button" class="del" data-act="del">Xóa</button>`}
  </td></tr>`;
  }).join('')}</tbody></table>`;
}

const AV_EMPTY = $('uAvPrev').innerHTML; // biểu tượng máy ảnh ban đầu
// gõ họ tên -> tự đề xuất tên đăng nhập (đến khi người dùng tự sửa ô tên đăng nhập)
let userTouched = false;
$('uName').addEventListener('input', () => {
  if (!userTouched) $('uUser').value = uniqueUsername(makeUsername($('uName').value), new Set(users.map(u => u.username)));
});
$('uUser').addEventListener('input', () => { userTouched = $('uUser').value !== ''; $('uUser').value = $('uUser').value.toLowerCase(); });
// xem trước ảnh đại diện đã chọn
$('uAv').addEventListener('change', () => {
  const f = $('uAv').files[0];
  $('uAvPrev').innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="">` : AV_EMPTY;
});

$('userForm').addEventListener('submit', async e => {
  e.preventDefault();
  const um = t => $('userMsg').textContent = t;
  um('Đang tạo…');
  try {
    const username = $('uUser').value.trim().toLowerCase(), pw = $('uPw').value, role = $('uRole').value, file = $('uAv').files[0];
    if (file) await resizeImage(file); // kiểm tra ảnh hợp lệ trước khi tạo tài khoản
    const { id } = await adminCall({ action: 'create', username, password: pw, full_name: $('uName').value, role });
    let avatarNote = '';
    if (file) { try { await uploadAvatar(id, file); } catch (err) { avatarNote = ` (Ảnh chưa lưu được: ${err.message} — bấm vào ảnh trong danh sách để thử lại.)`; } }
    um(`✓ Đã tạo ${username} (${ROLE_LABEL[role]}). Tên đăng nhập: ${username} · Mật khẩu tạm: ${pw} — gửi riêng cho người dùng.${avatarNote}`);
    $('userForm').reset(); userTouched = false; $('uAvPrev').innerHTML = AV_EMPTY;
    await loadUsers();
  } catch (err) { um('Lỗi: ' + err.message); }
});

$('userList').addEventListener('change', async e => {
  if (e.target.dataset.act === 'avatar') { // đổi ảnh đại diện
    const u = users.find(x => x.id === e.target.closest('tr').dataset.uid), f = e.target.files[0];
    if (!f) return;
    try { await uploadAvatar(u.id, f, u.avatar_path); $('userMsg').textContent = `✓ Đã đổi ảnh của ${u.username}.`; }
    catch (err) { uiError(err.message); }
    await loadUsers();
    if (u.id === me.id) await boot(); // cập nhật ảnh ở sidebar
    return;
  }
  if (e.target.dataset.act !== 'role') return;
  const u = users.find(x => x.id === e.target.closest('tr').dataset.uid);
  try { await adminCall({ action: 'update', id: u.id, role: e.target.value }); $('userMsg').textContent = `✓ Đã đổi vai trò của ${u.username} thành ${ROLE_LABEL[e.target.value]}.`; }
  catch (err) { uiError(err.message); e.target.value = u.role; return; }
  await loadUsers();
});

$('userList').addEventListener('click', async e => {
  const act = e.target.closest('button')?.dataset.act;
  if (!act) return;
  const u = users.find(x => x.id === e.target.closest('tr').dataset.uid);
  try {
    if (act === 'pw') return openPw(`Đặt lại mật khẩu cho ${u.username}`, async pw => { await adminCall({ action: 'reset_password', id: u.id, password: pw }); uiAlert('Đã đặt lại mật khẩu. Gửi mật khẩu mới cho người dùng.'); });
    if (act === 'name') { const n = await uiDialog({ title: 'Sửa họ và tên', ok: 'Lưu', message: `Họ và tên của @${u.username}:`, input: u.full_name || '' }); if (n === null) return; await adminCall({ action: 'update', id: u.id, full_name: n }); }
    if (act === 'user') {
      const n = await uiDialog({ title: 'Đổi tên đăng nhập', ok: 'Lưu', message: `Tên đăng nhập mới cho ${u.full_name || u.username}. Người này sẽ đăng nhập bằng tên mới.`, input:
        uniqueUsername(makeUsername(u.full_name || ''), new Set(users.filter(x => x.id !== u.id).map(x => x.username))) || u.username });
      if (n === null || n.trim().toLowerCase() === u.username) return;
      await adminCall({ action: 'update', id: u.id, username: n });
      if (u.id === me.id) uiAlert(`Từ lần sau bạn đăng nhập bằng: ${n.trim().toLowerCase()}`);
    }
    if (act === 'lock') {
      if (u.active && !await uiDialog({ title: `Khóa @${u.username}?`, danger: true, ok: 'Khóa', message: 'Người này sẽ không xem được dữ liệu và không đăng nhập được cho tới khi mở khóa.' })) return;
      await adminCall({ action: 'update', id: u.id, active: !u.active });
    }
    if (act === 'del') {
      if ((await uiDialog({ title: 'Xóa tài khoản', danger: true, ok: 'Xóa vĩnh viễn', input: '', needs: u.username,
        message: `Xóa vĩnh viễn tài khoản ${u.full_name || ''} (@${u.username}) và ảnh đại diện. Không hoàn tác được.\n\nGõ ${u.username} để xác nhận:` }))?.trim().toLowerCase() !== u.username) return;
      await adminCall({ action: 'delete', id: u.id });
    }
    await loadUsers();
  } catch (err) { uiError(err.message); }
});

boot();
