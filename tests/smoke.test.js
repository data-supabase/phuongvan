const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'legacy'), SB = 'https://mjuioravfaxpmxscnnkm.supabase.co';
const CDN = { 'supabase-js': 'node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'xlsx': 'node_modules/xlsx/dist/xlsx.full.min.js' };
const PROFILE = { id: 'u1', username: 'baolt', full_name: 'Lê Thái Bão', role: 'admin', active: true, pending: false, avatar_path: null };
const TASKS = [
  ['Hoàn thành', ['KT']], ['Đang triển khai', ['CĐS']], ['Chưa triển khai', ['NCPT']], ['Quá hạn', ['ĐCM']],
].map(([st, units], i) => ({ id: i + 1, tuan: '44/2026', key: 'k' + i, units, thong_tin_cuoc_hop: 'Họp thử', noi_dung: `Việc số ${i + 1}`, ket_luan: 'Kết luận', tinh_hinh: '', don_vi_dau_moi: units[0], don_vi_phoi_hop: '', tinh_trang: st, kho_khan: '', thoi_han: '', ghi_chu: null }));
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

let server, browser, port;
before(async () => {
  server = http.createServer((q, s) => { const f = (q.url.split('?')[0].replace(/^\//, '') || 'index.html'); const ext = path.extname(f); s.setHeader('content-type', (({ '.css': 'text/css', '.js': 'application/javascript' })[ext] || 'text/html') + '; charset=utf-8'); s.end(fs.readFileSync(path.join(ROOT, ['index.html', 'style.css', 'app.js'].includes(f) ? f : 'index.html'))); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); port = server.address().port;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage(), errors = [], leaked = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(`http://127.0.0.1:${port}`)) return route.continue();
    if (u.includes('@supabase/supabase-js')) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, CDN['supabase-js'])) });
    if (u.includes('/xlsx@')) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, CDN.xlsx)) });
    if (u.startsWith(SB)) {
      const p = new URL(u).pathname, accept = route.request().headers()['accept'] || '';
      if (p.includes('/auth/v1/token')) return json(route, { access_token: 'fake', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: { id: 'u1', email: 'baolt@bctuan.local', aud: 'authenticated' } });
      if (p.includes('/auth/v1/')) return json(route, { id: 'u1', email: 'baolt@bctuan.local' });
      if (p.endsWith('/profiles')) return route.request().method() === 'HEAD' ? route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
        : json(route, accept.includes('vnd.pgrst.object') ? PROFILE : [PROFILE]);
      if (p.endsWith('/tasks')) return json(route, TASKS);
      return json(route, []);
    }
    leaked.push(u); return route.abort(); // chặn mọi request ngoài (font, ...)
  });
  return { page, errors, leaked };
}
const login = async page => { await page.fill('#loginEmail', 'baolt'); await page.fill('#loginPw', 'x'); await page.click('#loginBtn'); await page.waitForSelector('#app:not([hidden])'); await page.waitForSelector('#v-dash:not([hidden])'); await page.click('.side a[data-view=table]'); await page.waitForSelector('#list tr', { state: 'visible' }); };
// lỗi do ta chủ động chặn font/CDN khác không tính
const real = errs => errs.filter(e => !/Failed to load resource|net::ERR/.test(e));

for (const [name, vp] of [['desktop', { width: 1280, height: 800 }], ['375px', { width: 375, height: 700 }]]) {
  test(`smoke ${name}: đăng nhập -> dashboard + bảng`, async () => {
    const { page, errors } = await newPage(vp);
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('#login:not([hidden])');
    assert.ok(await page.isVisible('#loginBtn'));
    await login(page);
    assert.equal(await page.locator('#list tr').count(), TASKS.length);
    assert.ok((await page.textContent('#list')).includes('Việc số 1'));
    assert.deepEqual(real(errors), []);
  });
}

test('smoke: phễu lọc mở được, Esc đóng uiDialog', async () => {
  const { page, errors } = await newPage({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${port}/`);
  await login(page);
  await page.locator('.fbtn[data-col="st"]').click();
  await page.waitForSelector('.fpop', { state: 'visible' });
  await page.keyboard.press('Escape');
  // modal: gọi trực tiếp uiDialog (hàm toàn cục của trang)
  const p = page.evaluate(() => uiDialog({ title: 'T', message: 'M' }).then(v => v));
  await page.waitForSelector('#uiDlg[open]');
  assert.equal(await page.textContent('#uiTitle'), 'T');
  await page.keyboard.press('Escape');
  assert.equal(await p, false);
  assert.equal(await page.locator('#uiDlg[open]').count(), 0);
  assert.deepEqual(real(errors), []);
});

