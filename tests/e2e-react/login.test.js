const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const { setup, newApp, makeDb, profile, sampleTasks } = require('./harness');

let env;
before(async () => { env = await setup(); });
after(async () => { await env.teardown(); });

const mk = (extra = []) => makeDb({ profiles: [profile('baolt', 'admin', { full_name: 'Lê Thái Bão' }), ...extra], tasks: sampleTasks() });
const msg = (app) => app.page.getByTestId('login-message');

test('đăng nhập: tên đăng nhập -> email tổng hợp @bctuan.local (trim + chữ thường), vào được shell', async () => {
  const db = mk(), app = await newApp(env.browser, env.url, db);
  await app.login('  BaoLT ');
  assert.equal(db.log.auth.length, 1);
  assert.equal(db.log.auth[0].email, 'baolt@bctuan.local');
  assert.equal(db.log.auth[0].password, 'secret123');
  assert.equal(await app.page.getByTestId('me-name').textContent(), 'Lê Thái Bão');
  assert.equal(await app.page.getByTestId('me-username').textContent(), '@baolt');
  app.assertClean(); await app.close();
});

test('đăng nhập: có @ thì giữ nguyên email cũ', async () => {
  const db = mk([profile('cu', 'viewer', { email: 'cu@congty.vn' })]), app = await newApp(env.browser, env.url, db);
  await app.login('Cu@Congty.vn');
  assert.equal(db.log.auth[0].email, 'cu@congty.vn');
  app.assertClean(); await app.close();
});

test('đăng nhập: sai mật khẩu -> thông báo tiếng Việt, ở lại màn đăng nhập', async () => {
  const db = mk(), app = await newApp(env.browser, env.url, db);
  await app.goto();
  await app.page.getByTestId('login-id').fill('baolt');
  await app.page.getByTestId('login-password').fill('sai-mat-khau');
  await app.page.getByTestId('login-submit').click();
  await msg(app).filter({ hasText: 'Sai tên đăng nhập hoặc mật khẩu.' }).waitFor();
  assert.equal(await msg(app).getAttribute('data-kind'), 'error');
  assert.equal(await app.page.getByTestId('app-shell').count(), 0);
  app.assertClean(); await app.close();
});

test('đăng nhập: bấm gửi 2 lần liên tiếp chỉ gửi 1 yêu cầu', async () => {
  const db = mk(), app = await newApp(env.browser, env.url, db);
  await app.goto();
  await app.page.getByTestId('login-id').fill('baolt');
  await app.page.getByTestId('login-password').fill('secret123');
  await app.page.getByTestId('login-submit').dblclick();
  await app.page.getByTestId('app-shell').waitFor();
  assert.equal(db.log.auth.length, 1, 'auth bị gọi ' + db.log.auth.length + ' lần');
  app.assertClean(); await app.close();
});

test('tài khoản chờ duyệt: báo chờ duyệt, tự đăng xuất, không vào shell', async () => {
  const db = mk([profile('chovd', 'viewer', { pending: true })]), app = await newApp(env.browser, env.url, db);
  await app.goto();
  await app.page.getByTestId('login-id').fill('chovd');
  await app.page.getByTestId('login-password').fill('secret123');
  await app.page.getByTestId('login-submit').click();
  await msg(app).filter({ hasText: 'Tài khoản @chovd đang chờ Quản trị duyệt' }).waitFor();
  assert.equal(await app.page.getByTestId('app-shell').count(), 0);
  assert.ok(db.log.logout >= 1, 'phải gọi signOut');
  app.assertClean(); await app.close();
});

test('tài khoản bị khóa (active=false): báo khóa; bị ban ở Auth cũng báo khóa', async () => {
  const lock = profile('khoa', 'viewer', { active: false }), ban = profile('ban', 'viewer');
  const db = mk([lock, ban]); db.banned.add(ban.id);
  const app = await newApp(env.browser, env.url, db);
  for (const u of ['khoa', 'ban']) {
    await app.goto();
    await app.page.getByTestId('login-id').fill(u);
    await app.page.getByTestId('login-password').fill('secret123');
    await app.page.getByTestId('login-submit').click();
    await msg(app).filter({ hasText: 'Tài khoản đã bị khóa.' }).waitFor();
    assert.equal(await app.page.getByTestId('app-shell').count(), 0, u);
    await app.page.reload();
  }
  app.assertClean(); await app.close();
});

test('có tài khoản Auth nhưng chưa có hồ sơ -> "chưa được cấp quyền"', async () => {
  const u = profile('mo', 'viewer'), db = mk([u]); db.noProfile.add(u.id);
  const app = await newApp(env.browser, env.url, db);
  await app.goto();
  await app.page.getByTestId('login-id').fill('mo');
  await app.page.getByTestId('login-password').fill('secret123');
  await app.page.getByTestId('login-submit').click();
  await msg(app).filter({ hasText: 'chưa được cấp quyền' }).waitFor();
  app.assertClean(); await app.close();
});

test('lỗi tải hồ sơ khi mở lại phiên: giữ phiên, hiện Thử lại, bấm Thử lại thì vào được', async () => {
  const db = mk(), app = await newApp(env.browser, env.url, db);
  await app.login('baolt');
  db.profileError = 'mất kết nối';
  await app.page.reload();
  await msg(app).filter({ hasText: 'Lỗi tải hồ sơ' }).waitFor();
  assert.equal(db.log.logout, 0, 'không được đăng xuất khi chỉ lỗi mạng');
  db.profileError = null;
  await app.page.getByTestId('login-retry').click();
  await app.page.getByTestId('app-shell').waitFor();
  app.assertClean(); await app.close();
});

test('đăng xuất: tải lại trang, xóa phiên + state, hiện "Đã đăng xuất." (thông tin, không đỏ)', async () => {
  const db = mk(), app = await newApp(env.browser, env.url, db);
  await app.login('baolt', undefined, '/table');
  await app.page.getByTestId('table-search').fill('abc'); // state sẽ phải mất sau reload
  await app.page.evaluate(() => { window.__marker = 1; });
  await app.page.getByTestId('logout').click();
  await msg(app).filter({ hasText: 'Đã đăng xuất.' }).waitFor();
  assert.equal(await app.page.evaluate(() => window.__marker), undefined, 'trang phải được tải lại');
  assert.equal(await msg(app).getAttribute('data-kind'), 'info');
  assert.equal(db.log.logout, 1);
  const keys = await app.page.evaluate(() => Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k) && localStorage.getItem(k)));
  assert.deepEqual(keys, [], 'token còn trong localStorage');
  assert.equal(await app.page.evaluate(() => sessionStorage.getItem('flash')), null, 'flash phải dùng một lần');
  // vào lại link sâu khi chưa đăng nhập vẫn là màn đăng nhập; reload không còn thông báo cũ
  await app.goto('/users'); await app.page.reload();
  await app.page.getByTestId('login-form').waitFor();
  assert.equal(await app.page.getByTestId('app-shell').count(), 0);
  assert.equal((await msg(app).textContent()).trim(), '');
  app.assertClean(); await app.close();
});
