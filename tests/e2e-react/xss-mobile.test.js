const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const { setup, newApp, makeDb, profile, task, sampleTasks, XSS, XSS_ID, OWNER_ID } = require('./harness');

let env;
before(async () => { env = await setup(); });
after(async () => { await env.teardown(); });

const LONG = 'Dai'.repeat(200); // 600 ký tự liền, không khoảng trắng
function evilDb({ long = false } = {}) {
  const x = long ? LONG : XSS;
  const evil = task({
    id: 900, tuan: long ? '46/2026' : '46/2026' + XSS, key: 'evil', // tuần chứa HTML chỉ ở ca XSS (giá trị không hợp lệ làm select năm rất rộng)
    sheet: x, thong_tin_cuoc_hop: x, noi_dung: x, ket_luan: x, tinh_hinh: x,
    don_vi_dau_moi: x, don_vi_phoi_hop: x, tinh_trang: 'Chậm ' + x, kho_khan: x, thoi_han: x, ghi_chu: x, units: ['KT'],
  });
  const profiles = [
    profile('ad', 'admin', { full_name: x }),
    profile('vanhp', 'admin', { id: OWNER_ID, full_name: 'Văn HP' }),
    profile('ngkhac', 'viewer', { full_name: x }),
    profile('cho', 'viewer', { full_name: x, pending: true, requested_at: '2026-10-30T01:00:00Z' }),
  ];
  return makeDb({ profiles, tasks: [...sampleTasks(), evil] }); // dòng độc cuối cùng -> là tuần mới nhất, được chọn mặc định
}
const clean = async (p, where) => {
  assert.equal(await p.evaluate(() => window.__xss), undefined, `${where}: payload đã chạy script`);
  assert.equal(await p.locator('#' + XSS_ID).count(), 0, `${where}: payload được dựng thành phần tử HTML`);
  assert.equal(await p.locator('script:not([src])').count(), 0);
};
const showsLiteral = async (p, where) =>
  assert.ok((await p.evaluate(() => document.body.innerText)).includes(`<img id="${XSS_ID}"`), `${where}: không thấy payload hiển thị dạng chữ`);

test('XSS: tuần/đơn vị/họ tên/ghi chú/sheet hiện như chữ ở mọi trang, kể cả drawer, hộp thoại, bộ lọc', async () => {
  const app = await newApp(env.browser, env.url, evilDb()), p = app.page;
  await app.login('ad');
  // dashboard
  await p.getByTestId('page-dashboard').waitFor();
  await p.getByTestId('late-meetings').waitFor();
  await clean(p, 'dashboard'); await showsLiteral(p, 'dashboard');
  assert.match(await p.getByTestId('late-meetings').innerText(), /<img id="xss-probe"/);
  // sidebar (họ tên của chính mình)
  assert.match(await p.getByTestId('me-name').textContent(), /<img id="xss-probe"/);
  // bảng
  await app.goto('/table');
  await p.getByTestId('task-row').waitFor();
  await clean(p, 'table'); await showsLiteral(p, 'table');
  const cells = await p.locator('[data-testid=task-row] td').allInnerTexts();
  assert.ok(cells.filter((c) => c.includes('<img id="xss-probe"')).length >= 9, 'các cột phải hiện payload dạng chữ');
  // popover lọc (giá trị cột) + drawer
  const b = p.getByTestId('filter-btn-sh'); await b.scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await b.click();
  await p.getByTestId('filter-popover').waitFor(); await clean(p, 'filter'); await p.keyboard.press('Escape');
  await p.getByTestId('task-row').click();
  await p.getByTestId('task-drawer').waitFor();
  await clean(p, 'drawer');
  assert.equal(await p.getByTestId('drawer-note').inputValue(), XSS);
  await p.getByTestId('drawer-close').click();
  assert.equal(app.db.log.patch.length, 0, 'không đổi ghi chú thì không PATCH');
  // nạp dữ liệu: danh sách tuần + nút/aria có tên tuần chứa payload
  await app.goto('/import');
  await p.getByTestId('week-table').waitFor();
  await clean(p, 'import'); await showsLiteral(p, 'import');
  await p.locator('[data-testid=week-delete]').first().click(); // tuần độc là dòng đầu (mới nhất)
  await p.getByTestId('dialog').waitFor();
  await clean(p, 'dialog xóa tuần');
  await p.keyboard.press('Escape');
  // người dùng
  await app.goto('/users');
  await p.getByTestId('user-list').waitFor();
  await p.getByTestId('pending-list').waitFor();
  await clean(p, 'users'); await showsLiteral(p, 'users');
  await p.getByTestId('user-row-ngkhac').getByTestId('act-delete').click();
  await p.getByTestId('dialog').waitFor();
  await clean(p, 'dialog xóa user');
  assert.match(await p.getByTestId('dialog').innerText(), /<img id="xss-probe"/);
  await p.keyboard.press('Escape');
  await p.getByTestId('pending-reject').click();
  await clean(p, 'dialog từ chối');
  await p.keyboard.press('Escape');
  assert.equal(app.db.log.fn.length, 0);
  app.assertClean(); await app.close();
});

test('XSS: ô tìm kiếm / họ tên đăng ký / tên đăng nhập không chạy script và không vỡ giao diện', async () => {
  const app = await newApp(env.browser, env.url, evilDb()), p = app.page;
  await app.goto();
  await p.getByTestId('to-register').click();
  await p.getByTestId('reg-name').fill(XSS);
  await clean(p, 'form đăng ký');
  assert.doesNotMatch(await p.getByTestId('reg-username').textContent(), /[<>"=]/, 'tên đăng nhập dự kiến chỉ gồm a-z0-9');
  await p.getByTestId('to-login').click();
  await p.getByTestId('login-id').fill(XSS);
  await p.getByTestId('login-password').fill('x');
  await p.getByTestId('login-submit').click();
  await p.getByTestId('login-message').filter({ hasText: 'Sai tên đăng nhập hoặc mật khẩu.' }).waitFor();
  await clean(p, 'đăng nhập');
  app.assertClean(); await app.close();
});

// ---------- 375px ----------
const overflow = (p) => p.evaluate(() => ({
  doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, vw: innerWidth,
  wide: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && r.width > 0 && !e.closest('[data-testid=table-scroll],[data-testid=sidebar] nav,.overflow-x-auto'); })
    .slice(0, 5).map((e) => (e.getAttribute('data-testid') || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right)),
}));
const fails = [];
const assertNoHScroll = async (p, where) => {
  const o = await overflow(p);
  if (!(o.doc <= o.vw && o.body <= o.vw)) fails.push(`${where}: cuộn ngang cả trang (doc=${o.doc}, body=${o.body}, viewport=${o.vw}); phần tử tràn: ${o.wide.join(', ')}`);
};

for (const [label, long] of [['dữ liệu thường', false], ['chuỗi rất dài 600 ký tự', true]]) {
  test(`375px (${label}): không có trang nào cuộn ngang toàn trang`, async () => {
    const app = await newApp(env.browser, env.url, long ? evilDb({ long }) : makeDb({
      profiles: [profile('ad', 'admin', { full_name: 'Quản Trị' }), profile('ngkhac', 'viewer'), profile('cho', 'viewer', { pending: true, requested_at: '2026-10-30T01:00:00Z' })],
      tasks: sampleTasks(),
    }), { width: 375, height: 700 });
    const p = app.page;
    await app.goto();
    await assertNoHScroll(p, 'đăng nhập');
    await p.getByTestId('to-register').click();
    await p.getByTestId('register-form').waitFor();
    await assertNoHScroll(p, 'đăng ký');
    await p.getByTestId('to-login').click();
    await p.getByTestId('login-id').fill('ad'); await p.getByTestId('login-password').fill('secret123'); await p.getByTestId('login-submit').click();
    await p.getByTestId('app-shell').waitFor();
    await p.getByTestId('page-dashboard').waitFor();
    await p.waitForTimeout(700); // đợi hiệu ứng vào trang
    await assertNoHScroll(p, 'dashboard');
    for (const [hash, id] of [['/table', 'page-table'], ['/import', 'week-list-card'], ['/users', 'page-users']]) {
      await app.goto(hash);
      await p.getByTestId(id).waitFor();
      await p.waitForTimeout(700);
      await assertNoHScroll(p, hash);
    }
    // drawer ở khổ hẹp
    await app.goto('/table');
    await p.getByTestId('task-row').first().click();
    await p.getByTestId('task-drawer').waitFor();
    await assertNoHScroll(p, 'drawer');
    await p.waitForTimeout(600); // đợi hiệu ứng trượt vào
    const box = await p.getByTestId('task-drawer').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 376, 'drawer vượt khung hình');
    await p.keyboard.press('Escape');
    app.assertClean(); await app.close();
    assert.deepEqual(fails.splice(0), []);
  });
}

test('375px: thanh điều hướng của shell (admin) hiện đủ 4 mục + nút tài khoản trong khung hình, không bị cắt', async () => {
  const db = makeDb({ profiles: [profile('ad', 'admin', { full_name: 'Quản Trị' })], tasks: sampleTasks() });
  const app = await newApp(env.browser, env.url, db, { width: 375, height: 700 }), p = app.page;
  await app.login('ad');
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const nav = document.querySelector('[data-testid=sidebar] nav'), toggle = document.querySelector('[data-testid=account-toggle]').getBoundingClientRect();
    return {
      navScroll: nav.scrollWidth, navClient: nav.clientWidth, toggleRight: Math.round(toggle.right),
      items: ['nav-dashboard', 'nav-table', 'nav-import', 'nav-users'].map((t) => { const r = document.querySelector(`[data-testid=${t}]`).getBoundingClientRect(); return [t, Math.round(r.left), Math.round(r.right)]; }),
    };
  });
  const hidden = m.items.filter(([, l, r]) => l < 0 || r > 375).map(([t]) => t);
  assert.ok(m.toggleRight <= 375, 'nút tài khoản ra ngoài khung hình: ' + JSON.stringify(m));
  assert.deepEqual(hidden, [], `mục điều hướng bị cắt/ẩn ngoài khung 375px (nav scrollWidth=${m.navScroll} > clientWidth=${m.navClient}): ${hidden.join(', ')}`);
  app.assertClean(); await app.close();
});

test('375px: menu tài khoản mở được, Đăng xuất bấm được trong khung hình', async () => {
  const db = makeDb({ profiles: [profile('ad', 'admin')], tasks: sampleTasks() });
  const app = await newApp(env.browser, env.url, db, { width: 375, height: 700 }), p = app.page;
  await app.login('ad');
  await p.getByTestId('account-toggle').click();
  const r = await p.getByTestId('logout').boundingBox();
  assert.ok(r.x >= 0 && r.x + r.width <= 375, 'nút Đăng xuất ngoài khung hình: ' + JSON.stringify(r));
  await p.getByTestId('logout').click();
  await p.getByTestId('login-form').waitFor();
  app.assertClean(); await app.close();
});



