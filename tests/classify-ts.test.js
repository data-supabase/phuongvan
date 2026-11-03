// So bản TS (src/lib/classify) với legacy: kết quả và key phải giống từng byte.
const { test, before } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const esbuild = require('esbuild');
const L = require('./lib');

const TMP = path.join(__dirname, '.tmp');
let T; // module TS đã bundle
before(() => {
  fs.mkdirSync(TMP, { recursive: true });
  const out = path.join(TMP, 'classify.cjs'); // nằm trong tests/ để require('xlsx') tìm được
  esbuild.buildSync({
    // bộ phân loại + status/week/username của src/lib
    stdin: { contents: ['classify/index', 'status', 'week', 'username'].map(f => `export * from './${f}';`).join('\n'), resolveDir: path.join(__dirname, '..', 'src', 'lib'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', outfile: out, external: ['xlsx'], logLevel: 'silent',
  });
  T = require(out);
});

const wbOf = () => L.XLSX.read(fs.readFileSync(path.join(__dirname, 'fixtures', 'week44.xlsx')));
const Cat = { 'st-done': 'done', 'st-doing': 'doing', 'st-late': 'late', 'st-todo': 'todo' };

test('TS: nguồn .ts giữ dạng NFC như legacy', () => {
  for (const f of ['classify/units.ts', 'classify/classifier.ts', 'status.ts', 'week.ts', 'username.ts']) {
    const s = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', f), 'utf8');
    assert.equal(s, s.normalize('NFC'), f);
  }
});

// Bản TS khác legacy có chủ ý: bỏ sheet ẩn, bỏ "Phòng KT" → golden riêng. Ghi lại: UPDATE_GOLDEN=1
const GOLD_TS = path.join(__dirname, 'golden-week44-ts.json');
test('TS: classifyWorkbook khớp golden tuần 44/2026', async () => {
  const { rows, skipped } = await T.classifyWorkbook(wbOf());
  const count = (f) => { const o = {}; rows.forEach(r => [].concat(f(r)).forEach(k => o[k] = (o[k] || 0) + 1)); return Object.fromEntries(Object.entries(o).sort()); };
  const got = {
    total: rows.length, skipped: [...skipped].sort(),
    perSheet: count(r => r.sheet), perUnit: count(r => [...r.units]),
    perStatusClass: count(r => 'st-' + T.statusClass(r.tinh_trang)),
    perStatusRaw: count(r => r.tinh_trang || '(trống)'),
    perSubUnit: count(r => [...T.subUnits(r.don_vi_dau_moi)]),
  };
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLD_TS, JSON.stringify(got, null, 2) + '\n');
  assert.deepEqual(JSON.parse(JSON.stringify(got)), JSON.parse(fs.readFileSync(GOLD_TS, 'utf8')));
  assert.ok(!Object.keys(got.perSheet).some(s => s.startsWith('PL1.TBKLGBT9')), 'sheet ẩn không được quét');
  assert.ok(!rows.some(r => /^(CN ?TMDV \(.*\)|Phòng KT)$/.test(r.don_vi_dau_moi)), 'không lấy Phòng KT');
});

test('TS: mỗi dòng giống legacy từng byte (trừ tên điền từ ô gộp), key giữ nguyên', async () => {
  const a = await T.classifyWorkbook(wbOf()), b = await L.classifyWorkbook(wbOf());
  const byKey = new Map(b.rows.map(r => [r.key, r]));
  let filled = 0;
  for (const r of a.rows) {
    const l = byKey.get(r.key);
    assert.ok(l, 'key phải trùng legacy: ' + r.noi_dung);
    if (!l.noi_dung && r.noi_dung) filled++;
    // so chuỗi để cả thứ tự khóa cũng phải giống
    assert.equal(JSON.stringify({ ...r, noi_dung: l.noi_dung ? r.noi_dung : '' }), JSON.stringify(l));
  }
  assert.ok(filled > 0, 'tuần 44 có ô "Tên công việc" gộp cần điền');
  a.rows.forEach(r => assert.match(r.key, /^[0-9a-f]{64}$/));
});

test('TS: console.assert tự kiểm của bộ phân loại', () => {
  const eq = (a, b) => assert.equal(String(a), b);
  eq(T.matchUnits('Ban KT-P.CNATMT'), 'KT');
  assert.equal(T.matchUnits('KTNB').length + T.matchUnits('TCKT').length, 0);
  // "Phòng KT" (CN TMDV) không thuộc Ban KT
  for (const l of ['Phòng KT', 'CN TMDV (Phòng KT)', 'CN TMDV (Phòng KT, Phòng KD)', 'CNTMDV (Phòng TH, KT,KD)', 'Phòng KD'])
    assert.equal(T.matchUnits(l).length + T.subUnits(l).length, 0, l);
  eq(T.matchUnits('Ban KT; Phòng KT'), 'KT'); eq(T.matchUnits('Ban KT/ TMDV'), 'KT');
  assert.equal(T.subUnits('Ban KT').length, 0);
  eq(T.matchUnits('TTNC; CĐS'), 'CĐS,NCPT'); eq(T.matchUnits('KT; ĐCM; KD'), 'KT,ĐCM');
  eq(T.subUnits('Ban KT-P.CNATMT; Ban KT-P.NCƯD; Ban KT-Tổ NCS'), 'KT › P.CNATMT,KT › P.NCƯD,KT › Tổ NCS');
  assert.equal(T.subUnits('Ban KT').length + T.subUnits('TT NCPT').length, 0);
});

test('TS: matchUnits/subUnits/meetingName giống legacy trên nhiều mẫu', () => {
  const samples = ['Ban KT', 'Ban KT-Tổ NCS', 'Phòng KT', 'CĐS', 'Ban Chuyển đổi số', 'Ban NCPT', 'TTNC', 'ĐCM', 'Nhà máy Đạm Cà Mau',
    'Ban TCKT', 'KTNB', 'Ban KT, CĐS', 'KT; ĐCM; KD', 'Phòng KD', '', 'ban kt', 'Ban KT – Tổ A; CĐS-Nhóm B', 'Ban Kỹ thuật', 'Trung tâm nghiên cứu', 'KT.TT'];
  for (const s of samples.filter(s => !/Phòng/.test(s))) { // Phòng KT: TS bỏ có chủ ý
    assert.deepEqual(T.matchUnits(s), [...L.matchUnits(s)], s);
    assert.deepEqual(T.subUnits(s), [...L.subUnits(s)], s);
  }
  assert.equal(T.meetingName('TBKLGB T9', []), 'TBKL Giao ban Cty tháng 9');
  assert.equal(T.meetingName('TBKLGB T10', []), 'TBKL Giao ban Cty tháng 10');
  assert.equal(T.meetingName('Sheet1 ', [['Họp A (Đính kèm x)']]), 'Họp A [Sheet1]');
  assert.equal(T.meetingName(' S ', []), 'S');
  const odd = [['Họp A\r\nB (Đính kèm x)']];
  assert.equal(T.meetingName('Sheet1 ', odd), L.meetingName('Sheet1 ', odd));
});

test('TS: makeUsername / uniqueUsername / loginEmail', () => {
  const m = T.makeUsername;
  for (const [i, o] of [['Lê Thái Bão', 'baolt'], ['Huỳnh Phương Vân', 'vanhp'], ['Đặng Đức Anh', 'anhdd'], ['đinh', 'dinh'], ['Vân', 'van'],
    ['  Lê   Thái  Bão  ', 'baolt'], ['Nguyễn Văn A2', 'a2nv'], ['', ''], ['   ', ''], ['!!! ???', ''], ['Lê Thái Bão'.normalize('NFD'), 'baolt'], ['Nguyễn Văn A', 'anv']]) {
    assert.equal(m(i), o); assert.equal(m(i), L.makeUsername(i));
  }
  const u = T.uniqueUsername;
  assert.equal(u('baolt', new Set()), 'baolt');
  assert.equal(u('baolt', new Set(['baolt'])), 'baolt1');
  assert.equal(u('baolt', new Set(['baolt', 'baolt1', 'baolt2'])), 'baolt3');
  assert.equal(u('', new Set()), '');
  assert.equal(T.loginEmail(' BaoLT '), 'baolt@bctuan.local');
  assert.equal(T.loginEmail('A@x.com'), 'a@x.com');
});

test('TS: normWeek / weekNum', () => {
  assert.equal(T.normWeek(' 05 / 2026 '), '5/2026');
  assert.equal(T.normWeek('44/2026'), '44/2026');
  for (const s of ['45', '1/26', '123/2026', '']) assert.equal(T.normWeek(s), null);
  assert.ok(T.weekNum('52/2025') < T.weekNum('1/2026'));
  assert.ok(T.weekNum('9/2026') < T.weekNum('10/2026'));
});

test('TS: statusClass (Cat không tiền tố) khớp legacy', () => {
  for (const s of ['Hoàn thành', 'Triển khai chậm', 'Quá hạn', 'Chưa triển khai', 'Đang thực hiện', null, '', 'Chưa hoàn thành'])
    assert.equal(T.statusClass(s), Cat[L.statusClass(s)], String(s));
});
