const { test, before, after } = require('node:test'), assert = require('node:assert/strict');
const { setup, newApp, makeDb, profile, sampleTasks, OWNER_ID } = require('./harness');

let env;
before(async () => { env = await setup(); });
after(async () => { await env.teardown(); });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const txt = async (loc) => (await loc.textContent()).replace(/\s+/g, ' ').trim();

function usersDb() {
  return makeDb({
    profiles: [
      profile('vanhp', 'admin', { id: OWNER_ID, full_name: 'Văn HP' }),
      profile('ad', 'admin', { full_name: 'Quản Trị' }),
      profile('lanvt', 'editor', { full_name: 'Lan VT' }),
      profile('binh', 'viewer', { full_name: 'Bình', active: false }),
      profile('chovd', 'viewer', { full_name: 'Chờ Duyệt', pending: true, requested_at: '2026-10-30T01:00:00Z' }),
    ],
    tasks: sampleTasks(),
  });
}
const row = (p, u) => p.getByTestId(`user-actions-${u}`);

test('trang người dùng (admin): chủ tài khoản không có thao tác; bản thân không có Khóa/Xóa; người khác đủ nút', async () => {
  const db = usersDb(), app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/users');
  await p.getByTestId('user-list').waitFor();
  assert.equal(await p.getByTestId('user-row-vanhp').count(), 1);
  assert.equal(await row(p, 'vanhp').count(), 0, 'dòng chủ tài khoản không được có thao tác');
  assert.equal(await p.getByTestId('user-row-vanhp').getByTestId('role-select').isDisabled(), true);
  assert.equal(await p.getByTestId('user-row-vanhp').getByTestId('avatar-btn').isDisabled(), true);
  // bản thân
  assert.equal(await row(p, 'ad').getByTestId('act-rename').count(), 1);
  assert.equal(await row(p, 'ad').getByTestId('act-password').count(), 1);
  assert.equal(await row(p, 'ad').getByTestId('act-toggle').count(), 0);
  assert.equal(await row(p, 'ad').getByTestId('act-delete').count(), 0);
  assert.equal(await p.getByTestId('user-row-ad').getByTestId('role-select').isDisabled(), true, 'không tự đổi vai trò của mình');
  // người khác
  assert.equal(await row(p, 'lanvt').getByTestId('act-toggle').textContent(), 'Khóa');
  assert.equal(await row(p, 'lanvt').getByTestId('act-delete').count(), 1);
  assert.equal(await row(p, 'binh').getByTestId('act-toggle').textContent(), 'Mở khóa');
  assert.match(await txt(p.getByTestId('user-row-binh').getByTestId('user-status')), /Đã khóa/);
  assert.match(await txt(p.getByTestId('user-list')), /Người dùng \(4\)/); // không đếm người chờ duyệt
  assert.equal(await p.getByTestId('nav-pending-badge').textContent(), '1');
  app.assertClean(); await app.close();
});

test('xóa người dùng: bắt buộc gõ đúng tên đăng nhập; Esc không gọi server; đúng thì gửi action delete', async () => {
  const db = usersDb(), app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/users');
  await row(p, 'lanvt').getByTestId('act-delete').click();
  const ok = p.getByTestId('dialog-ok');
  assert.equal(await ok.isDisabled(), true);
  await p.getByTestId('dialog-input').fill('lan');
  assert.equal(await ok.isDisabled(), true);
  await p.keyboard.press('Escape');
  await p.getByTestId('dialog').waitFor({ state: 'detached' });
  assert.equal(db.log.fn.length, 0);

  await row(p, 'lanvt').getByTestId('act-delete').click();
  await p.getByTestId('dialog-input').fill('  LANVT ');
  assert.equal(await ok.isEnabled(), true);
  await ok.click();
  await p.getByTestId('user-row-lanvt').waitFor({ state: 'detached' });
  assert.deepEqual(db.log.fn, [{ name: 'admin-users', body: { action: 'delete', id: 'id-lanvt' } }]);
  assert.equal(await p.getByTestId('toast').first().textContent().then((t) => /Đã xóa tài khoản/.test(t)), true);
  app.assertClean(); await app.close();
});

test('khóa / mở khóa / duyệt / từ chối / đổi vai trò gửi đúng payload tới admin-users', async () => {
  const db = usersDb(), app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/users');
  await row(p, 'lanvt').getByTestId('act-toggle').click(); // khóa: có hộp xác nhận
  await p.getByTestId('dialog-ok').click();
  await p.getByTestId('user-row-lanvt').getByTestId('user-status').filter({ hasText: 'Đã khóa' }).waitFor();
  await row(p, 'binh').getByTestId('act-toggle').click(); // mở khóa: không hỏi
  await p.getByTestId('user-row-binh').getByTestId('user-status').filter({ hasText: 'Hoạt động' }).waitFor();
  await p.getByTestId('user-row-binh').getByTestId('role-select').selectOption('editor');
  await p.getByTestId('pending-chovd').getByTestId('pending-role').selectOption('editor');
  await p.getByTestId('pending-chovd').getByTestId('pending-approve').click();
  await p.getByTestId('pending-list').waitFor({ state: 'detached' });
  assert.deepEqual(db.log.fn.map((f) => f.body), [
    { action: 'update', id: 'id-lanvt', active: false },
    { action: 'update', id: 'id-binh', active: true },
    { action: 'update', id: 'id-binh', role: 'editor' },
    { action: 'approve', id: 'id-chovd', role: 'editor' },
  ]);
  assert.equal(await p.getByTestId('nav-pending-badge').count(), 0);
  app.assertClean(); await app.close();
});

test('server từ chối thao tác (vd. xóa chủ tài khoản): hiện lỗi của server, danh sách không đổi', async () => {
  const db = usersDb(); db.fn['admin-users'] = () => [403, { error: 'Không được sửa Quản trị cao nhất.' }];
  const app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/users');
  await row(p, 'lanvt').getByTestId('act-delete').click();
  await p.getByTestId('dialog-input').fill('lanvt');
  await p.getByTestId('dialog-ok').click();
  await p.getByTestId('dialog').filter({ hasText: 'Không được sửa Quản trị cao nhất.' }).waitFor();
  await p.getByTestId('dialog-ok').click();
  assert.equal(await p.getByTestId('user-row-lanvt').count(), 1);
  app.assertClean(); await app.close();
});

test('tạo tài khoản: họ tên sinh tên đăng nhập (baolt, trùng thì baolt1), kiểm tra mật khẩu, gửi payload create', async () => {
  const db = usersDb(); db.profiles.push(profile('baolt', 'viewer'));
  db.fn['admin-users'] = (b, d) => { if (b.action === 'create') { d.profiles.push(profile(b.username, b.role, { full_name: b.full_name })); return [200, { id: 'id-' + b.username }]; } return [200, {}]; };
  const app = await newApp(env.browser, env.url, db), p = app.page;
  await app.login('ad', undefined, '/users');
  await p.getByTestId('create-name').fill('  Lê Thái Bão  ');
  assert.equal(await p.getByTestId('create-username').inputValue(), 'baolt1');
  await p.getByTestId('create-password').fill('ngan');
  await p.getByTestId('create-submit').click();
  await p.getByText('Mật khẩu tối thiểu 8 ký tự.').waitFor();
  assert.equal(db.log.fn.length, 0);
  await p.getByTestId('create-password').fill('matkhau-tam-1');
  await p.getByTestId('create-role').selectOption('editor');
  await p.getByTestId('create-submit').dblclick(); // gửi 2 lần liên tiếp
  await p.getByTestId('create-result').waitFor();
  assert.equal(db.log.fn.filter((f) => f.body.action === 'create').length, 1);
  assert.deepEqual(db.log.fn[0].body, { action: 'create', username: 'baolt1', password: 'matkhau-tam-1', full_name: 'Lê Thái Bão', role: 'editor' });
  assert.match(await txt(p.getByTestId('create-result')), /Đã tạo baolt1 \(Nhập liệu\).*Mật khẩu tạm: matkhau-tam-1/);
  await p.getByTestId('user-row-baolt1').waitFor();
  app.assertClean(); await app.close();
});

// ---------- đăng ký tự phục vụ ----------
async function openRegister(app) {
  await app.goto();
  await app.page.getByTestId('to-register').click();
  await app.page.getByTestId('register-form').waitFor();
}

test('đăng ký: kiểm tra đầu vào; gửi {full_name,password} (không avatar); hiện tên đăng nhập do SERVER cấp và điền sẵn vào ô đăng nhập', async () => {
  const db = makeDb({ profiles: [], tasks: [] });
  db.fn.register = () => [200, { username: 'baolt2', avatarSaved: false }];
  const app = await newApp(env.browser, env.url, db), p = app.page;
  await openRegister(app);
  await p.getByTestId('reg-name').fill('  Lê Thái Bão ');
  assert.equal(await p.getByTestId('reg-username').textContent(), 'baolt'); // dự kiến phía client
  await p.getByTestId('reg-submit').click(); // thiếu mật khẩu
  await p.getByText('Mật khẩu tối thiểu 8 ký tự.').waitFor();
  await p.getByTestId('reg-pw').fill('matkhau123');
  await p.getByTestId('reg-pw2').fill('khac-hoan-toan');
  await p.getByTestId('reg-submit').click();
  await p.getByText('Hai lần nhập mật khẩu không khớp.').waitFor();
  assert.equal(db.log.fn.length, 0);
  await p.getByTestId('reg-pw2').fill('matkhau123');
  await p.getByTestId('reg-submit').click();
  await p.getByTestId('login-form').waitFor();
  assert.equal(db.log.fn.length, 1);
  assert.equal(db.log.fn[0].name, 'register');
  assert.deepEqual(db.log.fn[0].body, { full_name: 'Lê Thái Bão', password: 'matkhau123' });
  const m = p.getByTestId('login-message');
  assert.equal(await m.getAttribute('data-kind'), 'ok');
  assert.match(await txt(m), /Tên đăng nhập của bạn: baolt2 .*sau khi Quản trị duyệt/, 'phải hiện username do server trả về');
  assert.equal(await p.getByTestId('login-id').inputValue(), 'baolt2');
  app.assertClean(); await app.close();
});

test('đăng ký có ảnh: avatar gửi dạng data:image/jpeg;base64; lỗi từ server hiện nguyên văn; file không phải ảnh bị chặn', async () => {
  const db = makeDb({ profiles: [], tasks: [] });
  let n = 0;
  db.fn.register = () => (++n === 1 ? [409, { error: 'Họ tên này đã đăng ký, đang chờ duyệt.' }] : [200, { username: 'an', avatarSaved: false }]);
  const app = await newApp(env.browser, env.url, db), p = app.page;
  await openRegister(app);
  await p.getByTestId('reg-name').fill('An');
  await p.getByTestId('reg-pw').fill('matkhau123'); await p.getByTestId('reg-pw2').fill('matkhau123');
  await p.getByTestId('reg-avatar').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await p.getByTestId('reg-submit').click();
  await p.getByText('Chỉ nhận ảnh JPG, PNG hoặc WEBP').waitFor();
  assert.equal(db.log.fn.length, 0);
  await p.getByTestId('reg-avatar').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await p.getByTestId('reg-submit').click();
  await p.getByTestId('register-message').filter({ hasText: 'Họ tên này đã đăng ký, đang chờ duyệt.' }).waitFor();
  assert.equal(Object.keys(db.log.fn[0].body).sort().join(), 'avatar,full_name,password');
  assert.match(db.log.fn[0].body.avatar, /^data:image\/jpeg;base64,/);
  await p.getByTestId('reg-submit').click(); // thử lại
  await p.getByTestId('login-form').waitFor();
  assert.match(await txt(p.getByTestId('login-message')), /Ảnh đại diện chưa lưu được/);
  app.assertClean(); await app.close();
});
