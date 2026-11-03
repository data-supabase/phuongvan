const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const { setup, newApp, makeDb, profile, sampleTasks } = require('./harness');

let env;
before(async () => { env = await setup(); });
after(async () => { await env.teardown(); });

const mk = (role = 'viewer') => makeDb({ profiles: [profile('u', role, { full_name: 'Người Dùng' })], tasks: sampleTasks() });
// cuộn nút lọc vào tầm nhìn TRƯỚC khi bấm (sự kiện scroll đến muộn sẽ tự đóng popover)
async function openFilter(p, col) {
  const b = p.getByTestId('filter-btn-' + col);
  await b.scrollIntoViewIfNeeded();
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await b.click();
  await p.getByTestId('filter-popover').waitFor();
}
const txt = async (loc) => (await loc.textContent()).replace(/\s+/g, ' ').trim();

test('dashboard: KPI + hero khớp dữ liệu tuần 44 (4/3/2/1 trên 10), có so sánh tuần 43', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u');
  const p = app.page;
  await p.getByTestId('kpi-done').waitFor();
  assert.equal(await txt(p.getByTestId('kpi-done-n')), '4');
  assert.equal(await txt(p.getByTestId('kpi-doing-n')), '3');
  assert.equal(await txt(p.getByTestId('kpi-late-n')), '2');
  assert.equal(await txt(p.getByTestId('kpi-todo-n')), '1');
  assert.equal(await txt(p.getByTestId('hero-done-pct')), '40%');
  assert.equal(await txt(p.getByTestId('hero-risk')), '3');
  assert.match(await txt(p.getByTestId('dash-total')), /Tổng: 10 công việc.*tuần 43\/2026: 6/);
  assert.match(await txt(p.getByTestId('week-title')), /Tuần 44\/2026/);
  assert.equal(await p.getByTestId('risk-row-ĐCM').getAttribute('data-level'), 'hi'); // 2/2 chậm
  assert.equal(await p.getByTestId('task-row').count(), 0);
  app.assertClean(); await app.close();
});

test('dashboard: bấm thẻ "Triển khai chậm" -> /table lọc nhóm chậm (2/10)', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u');
  await app.page.getByTestId('kpi-late').click();
  await app.page.getByTestId('page-table').waitFor();
  assert.match(app.page.url(), /#\/table$/);
  await app.page.getByTestId('cat-chip').waitFor();
  assert.match(await txt(app.page.getByTestId('table-count')), /^2 \/ 10/);
  const st = await app.page.locator('[data-testid=task-row] td:nth-child(9)').allTextContents();
  assert.deepEqual(st.map((s) => s.trim()).sort(), ['Chậm tiến độ', 'Quá hạn']);
  // bỏ chip -> đủ 10 việc
  await app.page.getByTestId('cat-chip').click();
  assert.match(await txt(app.page.getByTestId('table-count')), /^10 \/ 10/);
  app.assertClean(); await app.close();
});

test('dashboard: bấm dòng đơn vị rủi ro -> lọc đơn vị ĐCM + chậm; "Xóa tất cả bộ lọc" khôi phục', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u');
  await app.page.getByTestId('risk-row-ĐCM').click();
  await app.page.getByTestId('cat-chip').waitFor();
  assert.match(await txt(app.page.getByTestId('table-count')), /^2 \/ 10/);
  await app.page.getByTestId('clear-all').click();
  assert.match(await txt(app.page.getByTestId('table-count')), /^10 \/ 10/);
  app.assertClean(); await app.close();
});

test('dashboard: bấm biểu đồ xu hướng tuần 43 -> chuyển sang tuần 43 rồi lọc', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u');
  const seg = app.page.getByTestId('trend-col-43-2026').locator('button, [role=button], [data-tip]').first();
  await seg.click();
  await app.page.getByTestId('page-table').waitFor();
  assert.match(await txt(app.page.getByTestId('week-title')), /Tuần 43\/2026/);
  assert.match(await txt(app.page.getByTestId('table-count')), /\/ 6 /);
  app.assertClean(); await app.close();
});

test('bảng: lọc cột Trạng thái kiểu Excel (OK áp dụng, Hủy giữ nguyên) + tìm kiếm', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u', undefined, '/table');
  const p = app.page, count = () => txt(p.getByTestId('table-count'));
  await p.getByTestId('task-row').first().waitFor();
  assert.match(await count(), /^10 \/ 10/);

  // Hủy: bỏ tick mọi giá trị rồi Hủy -> không đổi
  await openFilter(p, 'st');
  await p.getByTestId('filter-all').uncheck();
  await p.getByTestId('filter-list').locator('label', { hasText: 'Quá hạn' }).locator('input').check();
  await p.getByTestId('filter-cancel').click();
  assert.equal(await p.getByTestId('filter-popover').count(), 0);
  assert.match(await count(), /^10 \/ 10/);

  // OK: chỉ giữ "Quá hạn"
  await openFilter(p, 'st');
  assert.equal(await p.getByTestId('filter-ok').isEnabled(), true);
  await p.getByTestId('filter-all').uncheck();
  assert.equal(await p.getByTestId('filter-ok').isDisabled(), true, 'không tick gì thì OK phải bị khóa');
  await p.getByTestId('filter-list').locator('label', { hasText: 'Quá hạn' }).locator('input').check();
  await p.getByTestId('filter-ok').click();
  assert.match(await count(), /^1 \/ 10/);
  assert.equal(await p.getByTestId('filter-btn-st').getAttribute('data-on'), 'true');

  // tìm kiếm (debounce) kết hợp với lọc -> trống
  await p.getByTestId('table-search').fill('mua sắm');
  await p.getByTestId('table-empty').waitFor();
  assert.match(await count(), /^0 \/ 10/);
  await p.getByTestId('clear-all').click();
  await p.getByTestId('table-search').fill('mua sắm');
  await p.waitForFunction(() => /^1 \/ 10/.test(document.querySelector('[data-testid=table-count]').textContent.trim()));
  assert.match(await txt(p.getByTestId('task-row').first()), /Rà soát quy trình mua sắm/);
  // ký tự đặc biệt + khoảng trắng đầu/cuối không làm vỡ
  await p.getByTestId('table-search').fill('  %[(*\\ ');
  await p.getByTestId('table-empty').waitFor();
  app.assertClean(); await app.close();
});

const colW = (p, i = 2) => p.locator('[data-testid=task-table] col').nth(i).evaluate((c) => parseInt(c.style.width));
async function drag(p, dx) {
  const h = await p.getByTestId('th-name-resize').boundingBox();
  await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await p.mouse.down(); await p.mouse.move(h.x + h.width / 2 + dx / 2, h.y + 5, { steps: 4 }); await p.mouse.move(h.x + h.width / 2 + dx, h.y + 5, { steps: 4 }); await p.mouse.up();
}

test('bảng: kéo đổi độ rộng cột "Tên công việc" -> đổi ngay, lưu localStorage v5 (12 chuỗi Npx), tối thiểu 60px', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u', undefined, '/table');
  const p = app.page;
  await p.getByTestId('task-row').first().waitFor();
  assert.equal(await colW(p), 210);
  await drag(p, 90);
  const w = await colW(p);
  assert.ok(w > 270, `chưa nới cột: 210 -> ${w}`);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('colWidths.v5')));
  assert.equal(saved.length, 12);
  assert.equal(saved[2], w + 'px'); // định dạng legacy: mảng chuỗi "Npx"
  await drag(p, -900);
  assert.equal(await colW(p), 60);
  app.assertClean(); await app.close();
});

test('bảng: độ rộng cột đã kéo được giữ sau khi tải lại trang', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u', undefined, '/table');
  const p = app.page;
  await p.getByTestId('task-row').first().waitFor();
  await drag(p, 90);
  const w = await colW(p);
  await p.reload();
  await p.getByTestId('task-row').first().waitFor();
  assert.equal(await colW(p), w, 'sau reload cột quay về mặc định dù localStorage còn giá trị');
  app.assertClean(); await app.close();
});

test('bảng: localStorage độ rộng bị hỏng -> dùng mặc định, không lỗi', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.login('u', undefined, '/table');
  await app.page.evaluate(() => localStorage.setItem('colWidths.v5', '{"x":'));
  await app.page.reload();
  await app.page.getByTestId('task-row').first().waitFor();
  assert.equal(await colW(app.page), 210);
  app.assertClean(); await app.close();
});
test('bảng + drawer (VIEWER): mở drawer, gõ ghi chú, Esc -> PATCH ghi_chu đúng dòng, drawer đóng, bảng cập nhật', async () => {
  const db = mk('viewer'), app = await newApp(env.browser, env.url, db);
  await app.login('u', undefined, '/table');
  const p = app.page;
  assert.equal(await p.getByTestId('nav-import').count(), 0);
  assert.equal(await p.getByTestId('nav-users').count(), 0);
  await p.locator('[data-testid=task-row][data-id="3"]').click();
  await p.getByTestId('task-drawer').waitFor();
  assert.match(await txt(p.getByTestId('drawer-title')), /Công việc số 3/);
  await p.getByTestId('drawer-note').fill('  Ghi chú có dấu: ắ ờ ử, "ngoặc" & <b>x</b>  ');
  await p.keyboard.press('Escape');
  await p.getByTestId('task-drawer').waitFor({ state: 'detached' });
  await p.waitForFunction(() => document.querySelectorAll('[data-testid=task-row][data-id="3"] td')[11].textContent.includes('Ghi chú có dấu'));
  assert.equal(db.log.patch.length, 1, 'phải đúng 1 PATCH, blur + Esc không gửi trùng');
  assert.match(db.log.patch[0].query, /id=eq\.3$/);
  assert.deepEqual(db.log.patch[0].body, { ghi_chu: '  Ghi chú có dấu: ắ ờ ử, "ngoặc" & <b>x</b>  ' });
  // không đổi gì -> đóng không PATCH; xóa trống -> null
  await p.locator('[data-testid=task-row][data-id="3"]').click();
  await p.keyboard.press('Escape');
  await p.getByTestId('task-drawer').waitFor({ state: 'detached' });
  assert.equal(db.log.patch.length, 1);
  await p.locator('[data-testid=task-row][data-id="3"]').click();
  await p.getByTestId('drawer-note').fill('');
  await p.getByTestId('drawer-close').click();
  await p.waitForFunction(() => document.querySelectorAll('[data-testid=task-row][data-id="3"] td')[11].textContent.trim() === '—');
  assert.deepEqual(db.log.patch[1].body, { ghi_chu: null });
  // viewer vào /import, /users -> đưa về dashboard
  await app.goto('/import'); await p.getByTestId('page-dashboard').waitFor();
  assert.match(p.url(), /#\/$/);
  app.assertClean(); await app.close();
});

test('mất mạng khi lưu ghi chú: báo lỗi và trả ghi chú về giá trị cũ', async () => {
  const db = mk('viewer'), app = await newApp(env.browser, env.url, db);
  await app.login('u', undefined, '/table');
  const p = app.page;
  await p.locator('[data-testid=task-row][data-id="2"]').click();
  await p.getByTestId('drawer-note').fill('sẽ mất');
  await app.ctx.route('**/rest/v1/tasks?id=eq.2', (r) => r.abort('failed'));
  await p.getByTestId('drawer-close').click();
  await p.getByTestId('dialog').waitFor();
  assert.match(await txt(p.getByTestId('dialog')), /Lưu lỗi/);
  await p.getByTestId('dialog-ok').click();
  assert.equal(db.tasks.find((t) => t.id === 2).ghi_chu, null);
  assert.equal((await p.locator('[data-testid=task-row][data-id="2"] td').nth(11).textContent()).trim(), '—');
  app.errors.length = 0; app.leaks.length = 0; // abort chủ động
  await app.close();
});


test('bảng: giá trị colWidths.v5 có sẵn (định dạng legacy "Npx") được áp dụng cho cột', async () => {
  const app = await newApp(env.browser, env.url, mk());
  await app.ctx.addInitScript(() => localStorage.setItem('colWidths.v5', JSON.stringify(['52px', '160px', '333px', '300px', '300px', '130px', '130px', '130px', '180px', '220px', '160px', '77px'])));
  await app.login('u', undefined, '/table');
  await app.page.getByTestId('task-row').first().waitFor();
  assert.equal(await colW(app.page, 2), 333);
  assert.equal(await colW(app.page, 11), 77);
  assert.equal(await colW(app.page, 0), 52, 'cột # giữ 52 dù < tối thiểu 60');
  app.assertClean(); await app.close();
});
