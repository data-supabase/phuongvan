const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const path = require('path');
const { setup, newApp, makeDb, profile, task, sampleTasks } = require('./harness');
const { XLSX } = require('../lib.js');
const esbuild = require('esbuild');

const XLSX_FILE = path.join(__dirname, '..', 'fixtures', 'week44.xlsx');
let env, FILE_ROWS, N;
before(async () => {
  env = await setup();
  // bộ phân loại TS của app (khác legacy: bỏ sheet ẩn, Phòng KT; thêm PTGĐ Hải)
  const out = path.join(__dirname, '..', '.tmp', 'classify-import.cjs');
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '..', '..', 'src', 'lib', 'classify', 'index.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, external: ['xlsx'], logLevel: 'silent' });
  FILE_ROWS = (await require(out).classifyWorkbook(XLSX.readFile(XLSX_FILE))).rows;
  N = FILE_ROWS.length;
  assert.equal(N, require('../golden-week44-ts.json').total);
});
after(async () => { await env.teardown(); });

const txt = async (loc) => (await loc.textContent()).replace(/\s+/g, ' ').trim();
const admin = () => profile('ad', 'admin', { full_name: 'Quản Trị' });

// Tuần 43 có ghi chú ở 3 việc đầu của file; tuần 44 đã có: k0 (có trong file), 1 việc cũ (stale, có ghi chú), 1 dòng ẩn.
function seeded() {
  const k = FILE_ROWS.map((r) => r.key);
  const t = [
    ...[0, 1, 2].map((i) => task({ id: 100 + i, tuan: '43/2026', key: k[i], units: ['KT'], ghi_chu: 'ghi chú tuần trước ' + i })),
    task({ id: 200, tuan: '44/2026', key: k[0], units: ['KT'], ghi_chu: 'giữ lại' }),
    task({ id: 201, tuan: '44/2026', key: 'viec-cu', units: ['KT'], ghi_chu: 'sắp xóa' }),
    task({ id: 202, tuan: '44/2026', key: 'dong-an', units: [], ghi_chu: 'dòng ẩn có ghi chú' }),
  ];
  return makeDb({ profiles: [admin()], tasks: t });
}
async function pickFile(app, week = '44/2026', file = XLSX_FILE) {
  await app.page.getByTestId('import-file').setInputFiles(file);
  await app.page.getByTestId('import-week').fill(week);
}

test('nạp tuần 44 (cả file): xác nhận -> upsert 2 lô đúng quy tắc, chỉ xóa việc cũ có units, KHÔNG xóa dòng ẩn', async () => {
  const db = seeded(), app = await newApp(env.browser, env.url, db);
  await app.login('ad', undefined, '/import');
  const p = app.page;
  assert.match(await txt(p.getByTestId('week-row-44-2026')), /^44\/20262\d/, 'tuần 44 hiện 2 việc (không đếm dòng ẩn)');
  await pickFile(app);
  await p.getByTestId('import-submit').click();
  const dlg = p.getByTestId('dialog');
  await dlg.waitFor();
  assert.match(await txt(dlg), /Cập nhật tuần 44\/2026\?.*xóa 1 việc không còn trong file \(1 việc có ghi chú\)/);
  await p.getByTestId('dialog-ok').click();
  await p.getByTestId('import-msg').filter({ hasText: '✓ Tuần 44/2026' }).waitFor();
  const msg = await txt(p.getByTestId('import-msg'));
  assert.match(msg, new RegExp(`đã nạp ${N} công việc,`));
  assert.match(msg, / mang sang 2 ghi chú từ tuần 43\/2026, xóa 1 việc không còn trong file/);
  // các sheet thiếu cột Đơn vị đầu mối của tuần 44 đều là sheet ẩn -> không quét, không báo bỏ qua
  assert.doesNotMatch(msg, /Bỏ qua/);

  const batches = db.log.upsert;
  assert.equal(batches.length, 2, 'phải 2 lô (không trộn ghi_chu)');
  const [rest, carry] = batches;
  assert.equal(rest.length + carry.length, N);
  assert.equal(carry.length, 2, 'chỉ k1,k2 được mang ghi chú (k0 đã có ở tuần này)');
  assert.ok(rest.every((r) => !('ghi_chu' in r)), 'lô 1 không được có ghi_chu (supabase-js sẽ ghi đè null)');
  assert.deepEqual(carry.map((r) => r.ghi_chu).sort(), ['ghi chú tuần trước 1', 'ghi chú tuần trước 2']);
  assert.ok([...rest, ...carry].every((r) => r.tuan === '44/2026' && r.updated_at && r.key && Array.isArray(r.units)));
  assert.equal(new Set([...rest, ...carry].map((r) => r.key)).size, N);

  assert.equal(db.log.del.length, 1);
  assert.deepEqual(db.log.del[0].ids, [201], 'chỉ xóa việc cũ có units');
  assert.ok(!db.log.del[0].unfiltered);
  assert.ok(db.tasks.some((t) => t.id === 202), 'dòng ẩn phải còn');
  assert.equal(db.tasks.find((t) => t.id === 200).ghi_chu, 'giữ lại', 'ghi chú dòng đã có phải giữ nguyên');
  // danh sách tuần cập nhật số việc sau khi nạp
  await p.getByTestId('week-row-44-2026').filter({ hasText: new RegExp(`^44/2026${N}`) }).waitFor();
  app.assertClean(); await app.close();
});

test('nạp: Hủy ở hộp xác nhận -> không ghi gì', async () => {
  const db = seeded(), app = await newApp(env.browser, env.url, db);
  await app.login('ad', undefined, '/import');
  await pickFile(app);
  await app.page.getByTestId('import-submit').click();
  await app.page.getByTestId('dialog-cancel').click();
  await app.page.getByTestId('import-msg').filter({ hasText: 'Đã hủy.' }).waitFor();
  assert.equal(db.log.upsert.length + db.log.del.length, 0);
  app.assertClean(); await app.close();
});

test('nạp tuần mới (chưa có dữ liệu): không hỏi xác nhận, 1 lô (không có ghi chú để mang), bấm gửi 2 lần chỉ ghi 1 lần', async () => {
  const db = makeDb({ profiles: [admin()], tasks: [task({ id: 1, tuan: '40/2026', key: 'x', units: ['KT'] })] });
  const app = await newApp(env.browser, env.url, db);
  await app.login('ad', undefined, '/import');
  await app.page.getByTestId('import-file').setInputFiles(XLSX_FILE);
  await app.page.getByTestId('import-week').fill(' 45 / 2026 '); // khoảng trắng đầu/cuối được chuẩn hóa
  await app.page.getByTestId('import-submit').dblclick();
  await app.page.getByTestId('import-msg').filter({ hasText: '✓ Tuần 45/2026' }).waitFor();
  assert.equal(await app.page.getByTestId('dialog').count(), 0);
  assert.equal(db.log.upsert.length, 1);
  assert.equal(db.log.upsert[0].length, N);
  assert.equal(db.log.del.length, 0);
  app.assertClean(); await app.close();
});

test('nạp: kiểm tra đầu vào (thiếu file, sai số tuần, sai đuôi file) -> báo lỗi, không ghi gì', async () => {
  const db = seeded(), app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/import');
  await p.getByTestId('import-submit').click();
  await p.getByText('Chọn file Excel báo cáo tuần.').waitFor();
  await p.getByText('Nhập số tuần dạng 45/2026.').waitFor();
  await p.getByTestId('import-file').setInputFiles({ name: 'ghi-chu.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await p.getByText('Chỉ nhận file .xlsx, .xlsm hoặc .xls.').waitFor();
  await p.getByTestId('import-file').setInputFiles(XLSX_FILE);
  await p.getByTestId('import-week').fill('44-2026');
  await p.getByTestId('import-submit').click();
  await p.getByText('Nhập số tuần dạng 45/2026.').waitFor();
  // file hỏng .xlsx
  await p.getByTestId('import-file').setInputFiles({ name: 'hong.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('không phải excel') });
  await p.getByTestId('import-week').fill('44/2026');
  await p.getByTestId('import-submit').click();
  await p.getByTestId('import-msg').waitFor();
  assert.equal(db.log.upsert.length + db.log.del.length, 0);
  app.assertClean(); await app.close();
});

test('tên file "Tuan 44.2026 - ..." tự điền số tuần', async () => {
  const app = await newApp(env.browser, env.url, seeded());
  await app.login('ad', undefined, '/import');
  await app.page.getByTestId('import-file').setInputFiles({ name: 'Tuan 7.2027 - Bao cao tuan.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
  assert.equal(await app.page.getByTestId('import-week').inputValue(), '7/2027');
  app.assertClean(); await app.close();
});

test('xóa tuần: phải gõ lại số tuần; Esc/gõ sai không xóa; đúng thì xóa cả dòng ẩn và cập nhật danh sách', async () => {
  const db = seeded(), app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/import');
  await p.getByTestId('week-row-44-2026').getByTestId('week-delete').click();
  const dlg = p.getByTestId('dialog');
  assert.match(await txt(dlg), /Xóa toàn bộ 3 việc của tuần 44\/2026, kể cả ghi chú/); // 3 = gồm dòng ẩn
  assert.equal(await p.getByTestId('dialog-ok').isDisabled(), true);
  await p.getByTestId('dialog-input').fill('43/2026');
  assert.equal(await p.getByTestId('dialog-ok').isDisabled(), true, 'gõ tuần khác vẫn phải khóa');
  await p.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
  assert.equal(db.log.del.length, 0);

  await p.getByTestId('week-row-44-2026').getByTestId('week-delete').click();
  await p.getByTestId('dialog-input').fill(' 44/2026 ');
  assert.equal(await p.getByTestId('dialog-ok').isEnabled(), true);
  await p.getByTestId('dialog-ok').click();
  await p.getByTestId('week-msg').filter({ hasText: '✓ Đã xóa dữ liệu tuần 44/2026.' }).waitFor();
  assert.equal(db.log.del.length, 1);
  assert.match(db.log.del[0].query, /tuan=eq\.44\/2026$/);
  assert.deepEqual(db.log.del[0].ids.sort(), [200, 201, 202]);
  assert.ok(db.tasks.every((t) => t.tuan !== '44/2026') && db.tasks.some((t) => t.tuan === '43/2026'), 'tuần khác phải còn');
  await p.getByTestId('week-row-44-2026').waitFor({ state: 'detached' });
  app.assertClean(); await app.close();
});

test('editor vào được /import; viewer bị đưa về dashboard', async () => {
  const db = makeDb({ profiles: [profile('ed', 'editor'), profile('vw', 'viewer')], tasks: sampleTasks() });
  let app = await newApp(env.browser, env.url, db);
  await app.login('ed', undefined, '/import');
  await app.page.getByTestId('import-form-card').waitFor();
  assert.equal(await app.page.getByTestId('nav-users').count(), 0);
  await app.close();
  app = await newApp(env.browser, env.url, db);
  await app.login('vw', undefined, '/import');
  await app.page.getByTestId('page-dashboard').waitFor();
  assert.match(app.page.url(), /#\/$/);
  app.assertClean(); await app.close();
});



test('nút Nạp bị khóa khi danh sách việc còn đang tải (mock /rest/v1/tasks chậm), mở khóa khi tải xong', async () => {
  const db = seeded(); db.tasksDelay = 2500;
  const app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/import');
  await p.getByTestId('import-submit').waitFor();
  assert.equal(await p.getByTestId('import-submit').isDisabled(), true, 'phải khóa khi tasks chưa về');
  await p.getByTestId('import-file').setInputFiles(XLSX_FILE);
  await p.getByTestId('import-week').fill('44/2026');
  await p.getByTestId('import-submit').click({ force: true, noWaitAfter: true }).catch(() => {});
  assert.equal(db.log.upsert.length, 0);
  await p.waitForFunction(() => !document.querySelector('[data-testid=import-submit]').disabled, null, { timeout: 8000 });
  assert.equal(db.log.upsert.length, 0);
  app.assertClean(); await app.close();
});
