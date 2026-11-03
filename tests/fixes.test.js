const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const L = require('./lib');
const ROOT = path.join(__dirname, '..', 'legacy'), SB = 'https://mjuioravfaxpmxscnnkm.supabase.co';
const P = '<img src=x onerror=window.__xss=1>', Q = '" onmouseover="window.__xss=1" x="';
const PROFILE = { id: 'u1', username: 'baolt', full_name: 'Lê Thái Bão', role: 'admin', active: true, pending: false, avatar_path: null };
const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
const mkTask = (id, o = {}) => ({ id, tuan: '44/2026', key: 'k' + id, units: ['KT'], thong_tin_cuoc_hop: 'Họp', noi_dung: `Việc ${id}`, ket_luan: 'KL', tinh_hinh: '', don_vi_dau_moi: 'KT', don_vi_phoi_hop: '', tinh_trang: 'Đang triển khai', kho_khan: '', thoi_han: '', ghi_chu: null, updated_at: '2026-11-01T00:00:00Z', ...o });

let server, browser, port;
before(async () => {
  server = http.createServer((q, s) => { const f = (q.url.split('?')[0].replace(/^\//, '') || 'index.html'); const ext = path.extname(f); s.setHeader('content-type', (({ '.css': 'text/css', '.js': 'application/javascript' })[ext] || 'text/html') + '; charset=utf-8'); s.end(fs.readFileSync(path.join(ROOT, ['index.html', 'style.css', 'app.js'].includes(f) ? f : 'index.html'))); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); port = server.address().port;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

// st: { tasks, profiles, profileFail } có thể đổi giữa chừng; st.log ghi mọi request tới supabase giả
async function newPage(st, viewport = { width: 1280, height: 800 }) {
  st.log = []; st.errors = []; st.profile ??= PROFILE;
  const ctx = await browser.newContext({ viewport }), page = await ctx.newPage();
  page.on('pageerror', e => st.errors.push(e.message));
  await ctx.route('**/*', route => {
    const req = route.request(), u = req.url();
    if (u.startsWith(`http://127.0.0.1:${port}`)) return route.continue();
    if (u.includes('@supabase/supabase-js')) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js')) });
    if (u.includes('/xlsx@')) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js')) });
    if (!u.startsWith(SB)) return route.abort();
    const url = new URL(u), p = url.pathname, m = req.method(), accept = req.headers()['accept'] || '';
    st.log.push({ m, p, q: url.search, body: req.postData() });
    if (p.includes('/auth/v1/token')) return json(route, { access_token: 'fake', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: { id: 'u1', email: 'baolt@bctuan.local', aud: 'authenticated' } });
    if (p.includes('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    if (p.includes('/auth/v1/')) return json(route, { id: 'u1', email: 'baolt@bctuan.local' });
    if (p.endsWith('/profiles')) {
      if (m === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' });
      if (st.profileFail) return route.abort();
      return json(route, url.searchParams.get('id') ? [st.profile] : (st.profiles || [st.profile]));
    }
    if (p.endsWith('/tasks')) {
      if (m === 'GET') {
        const rng = (req.headers()['range'] || '').match(/(\d+)-(\d+)/);
        const off = +(url.searchParams.get('offset') ?? (rng ? rng[1] : 0)), lim = url.searchParams.get('limit');
        const end = lim ? off + +lim : rng ? +rng[2] + 1 : off + 1000; // máy chủ thật cắt tối đa 1000 dòng
        return json(route, st.tasks.slice(off, Math.min(end, off + 1000)));
      }
      return json(route, [], 201);
    }
    return json(route, []);
  });
  return page;
}
const login = async (page, view = 'table') => {
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.fill('#loginEmail', 'baolt'); await page.fill('#loginPw', 'x'); await page.click('#loginBtn');
  await page.waitForSelector('#app:not([hidden])');
  if (view) { await page.click(`.side a[data-view=${view}]`); await page.waitForSelector(`#v-${view}:not([hidden])`); }
};

test('load(): phân trang > 1000 dòng, bảng hiện đủ dòng của tuần mới nhất', async () => {
  const tasks = [];
  for (let i = 1; i <= 1500; i++) tasks.push(mkTask(i, { tuan: i <= 300 ? '43/2026' : '44/2026' }));
  const st = { tasks }, page = await newPage(st);
  await login(page);
  await page.waitForFunction(() => document.querySelectorAll('#list tr').length > 0);
  const gets = st.log.filter(r => r.m === 'GET' && r.p.endsWith('/tasks'));
  assert.ok(gets.length >= 2, 'phải gọi >= 2 lần');
  const info = await page.textContent('#dataInfo');
  assert.match(info, /mới nhất 44\/2026/);
  // đếm tổng số dòng qua dbRows (biến toàn cục của trang)
  assert.equal(await page.evaluate(() => dbRows.length), 1500);
  assert.equal(await page.evaluate(() => dbRows.filter(r => r.tuan === week).length), 1200);
});

test('import lại tuần: không xóa dòng units rỗng; số xóa chỉ tính dòng có units', async () => {
  const wb = L.XLSX.read(fs.readFileSync(path.join(__dirname, 'fixtures', 'week44.xlsx')));
  const { rows } = await L.classifyWorkbook(wb);
  const inFile = rows.slice(0, 5).map((r, i) => mkTask(i + 1, { key: r.key, units: ['KT'] }));
  const stale = [mkTask(101, { key: 'old1' }), mkTask(102, { key: 'old2', ghi_chu: 'ghi chú' })];
  const hidden = [mkTask(201, { key: 'h1', units: [] }), mkTask(202, { key: 'h2', units: [] }), mkTask(203, { key: 'h3', units: [] })];
  const st = { tasks: [...inFile, ...stale, ...hidden] }, page = await newPage(st);
  await login(page, 'import');
  await page.setInputFiles('#file', path.join(__dirname, 'fixtures', 'week44.xlsx'));
  await page.fill('#weekIn', '44/2026');
  await page.click('#importForm [type=submit]');
  await page.waitForSelector('#uiDlg[open]');
  const text = await page.textContent('#uiMsg');
  assert.match(text, /xóa 2 việc không còn trong file/);
  assert.match(text, /1 việc có ghi chú/);
  await page.click('#uiOk');
  await page.waitForFunction(() => /✓/.test(document.getElementById('importMsg').textContent), null, { timeout: 20000 });
  const del = st.log.filter(r => r.m === 'DELETE');
  assert.equal(del.length, 1);
  const ids = decodeURIComponent(del[0].q).match(/in\.\(([^)]*)\)/)[1].split(',').map(Number).sort();
  assert.deepEqual(ids, [101, 102]);
  for (const h of [201, 202, 203]) assert.ok(!ids.includes(h));
});

test('XSS: payload trong tuan/units/full_name/ghi_chu/sheet không chạy ở mọi view', async () => {
  const tasks = [
    mkTask(1, { tuan: '44/2026', units: ['KT', P], ghi_chu: P + Q, thong_tin_cuoc_hop: P, noi_dung: P, ket_luan: Q, tinh_hinh: P, don_vi_dau_moi: P + Q, don_vi_phoi_hop: P, kho_khan: P, thoi_han: P, tinh_trang: P }),
    mkTask(2, { tuan: '1/2020' + P, units: [P] }),
    mkTask(3, { tuan: '2/2020' + Q, units: ['KT'] }),
  ];
  const profiles = [{ ...PROFILE, full_name: P, username: Q }, { id: 'u2', username: 'x' + P, full_name: Q + P, role: 'viewer', active: true, pending: false, avatar_path: null, created_at: '2026-01-01T00:00:00Z' }];
  const st = { tasks, profiles, profile: { ...PROFILE, full_name: P } }, page = await newPage(st);
  const check = async where => {
    await page.waitForTimeout(150);
    const bad = await page.evaluate(() => ({ xss: window.__xss, img: !!document.querySelector('img[src="x"]'), ev: !!document.querySelector('[onmouseover],[onerror]') }));
    assert.deepEqual(bad, { xss: undefined, img: false, ev: false }, where);
  };
  await login(page, 'dash'); await check('dash');
  await page.click('.side a[data-view=table]'); await page.waitForSelector('#list tr'); await check('table'); for (const w of await page.evaluate(() => weeks)) { await page.evaluate(w => setWeek(w), w); await check('table ' + w); }
  await page.evaluate(() => setWeek('44/2026'));
  assert.ok((await page.textContent('#list')).includes('<img src=x'), 'payload phải hiện dạng chữ');
  await page.locator('#list tr').first().click(); await page.waitForTimeout(300); await check('drawer');
  await page.keyboard.press('Escape');
  await page.click('.side a[data-view=users]'); await check('users');
  await page.click('.side a[data-view=import]'); await check('import');
  await check('week select');
  assert.deepEqual(st.errors, []);
});

test('đăng xuất: tải lại trang, DOM sạch, drawer biến mất', async () => {
  const st = { tasks: [mkTask(1), mkTask(2)] }, page = await newPage(st);
  await login(page);
  await page.locator('#list tr').first().click(); await page.waitForTimeout(300);
  await Promise.all([page.waitForNavigation(), page.evaluate(() => document.getElementById('logout').click())]); // drawerBg che nút khi drawer mở
  await page.waitForSelector('#login:not([hidden])');
  assert.equal(await page.locator('#app:not([hidden])').count(), 0);
  assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('Việc 1'));
  assert.equal(await page.locator('#drawer:visible, .drawer.open:visible').count(), 0);
  assert.match(await page.textContent('#loginMsg'), /Đã đăng xuất/);
});

test('lỗi mạng khi tải hồ sơ: hiện Thử lại, không đăng xuất, bấm lại thì vào được', async () => {
  const st = { tasks: [mkTask(1)], profileFail: true }, page = await newPage(st);
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.fill('#loginEmail', 'baolt'); await page.fill('#loginPw', 'x'); await page.click('#loginBtn');
  await page.waitForSelector('#loginRetry:not([hidden])');
  assert.match(await page.textContent('#loginMsg'), /Lỗi tải hồ sơ/);
  assert.equal(st.log.filter(r => r.p.includes('/auth/v1/logout')).length, 0, 'không được signOut');
  st.profileFail = false;
  await page.click('#loginRetry');
  await page.waitForSelector('#app:not([hidden])');
});

test('uiDialog: hai lời gọi đồng thời đều resolve', async () => {
  const page = await newPage({ tasks: [mkTask(1)] });
  await login(page, null);
  await page.evaluate(() => { window.__r = Promise.all([uiDialog({ title: 'A', message: 'AAA' }), uiDialog({ title: 'B', message: 'BBB' })]); });
  await page.waitForFunction(() => document.getElementById('uiMsg').textContent === 'AAA');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('uiMsg').textContent === 'BBB' && document.getElementById('uiDlg').open);
  await page.click('#uiOk');
  assert.deepEqual(await page.evaluate(() => window.__r), [false, true]);
});










