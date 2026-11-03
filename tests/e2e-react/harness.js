// Khung E2E cho app React: phục vụ dist/ (HashRouter) + Supabase GIẢ hoàn toàn bằng route.
// Mọi request tới *.supabase.co không có handler -> ghi vào leaks và test thất bại (assertClean).
// Cần `npm run build` ở thư mục gốc trước (dist/ nhúng URL Supabase thật từ .env.local, nhưng không bao giờ được gọi tới).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const PW = 'secret123';
const OWNER_ID = '065441d4-3465-43d4-9088-3c08e6bfa580';
const XSS_ID = 'xss-probe';
const XSS = `<img id="${XSS_ID}" src=x onerror="window.__xss=1">`;

async function startServer() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('Thiếu dist/. Chạy `npm run build` ở thư mục gốc trước.');
  const server = http.createServer((q, s) => {
    let f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
    s.setHeader('content-type', (MIME[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8');
    s.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

// ---------- dữ liệu mẫu ----------
const iso = (d) => new Date(d).toISOString();
let seq = 1000;
function task(o = {}) {
  const units = o.units ?? ['KT'];
  return {
    id: ++seq, tuan: '44/2026', key: 'k' + seq, sheet: 'PL1 Sheet', thong_tin_cuoc_hop: 'TBKL Giao ban A',
    noi_dung: 'Việc ' + seq, ket_luan: 'Kết luận ' + seq, tinh_hinh: 'Tình hình ' + seq,
    don_vi_dau_moi: units[0] ?? '', don_vi_phoi_hop: '', tinh_trang: 'Hoàn thành', kho_khan: '', thoi_han: 'Tháng 10/2026',
    ghi_chu: null, units, units_phoi_hop: [], deadline_tu: null, deadline_den: null, updated_at: iso('2026-10-30T08:00:00Z'), ...o,
  };
}
// Tuần 44: 4 done, 3 doing, 2 late, 1 todo (10 việc) + 1 dòng ẩn; tuần 43: 6 việc cùng key với 6 việc đầu.
function sampleTasks() {
  seq = 0;
  const spec = [
    ['KT', 'Hoàn thành'], ['KT', 'Hoàn thành'], ['CĐS', 'Hoàn thành'], ['CĐS', 'Đang triển khai'], ['NCPT', 'Đang triển khai'],
    ['NCPT', 'Đang triển khai'], ['ĐCM', 'Chậm tiến độ'], ['ĐCM', 'Quá hạn'], ['KT', 'Chưa triển khai'], ['CĐS', 'Hoàn thành'],
  ];
  const w44 = spec.map(([u, st], i) => task({
    id: i + 1, key: 'K' + (i + 1), units: [u], tinh_trang: st,
    thong_tin_cuoc_hop: i === 6 ? 'TBKL Giao ban B' : 'TBKL Giao ban A',
    noi_dung: i === 4 ? 'Rà soát quy trình mua sắm' : 'Công việc số ' + (i + 1),
  }));
  const w43 = spec.slice(0, 6).map(([u], i) => task({ id: 11 + i, tuan: '43/2026', key: 'K' + (i + 1), units: [u], tinh_trang: 'Đang triển khai', noi_dung: 'Công việc số ' + (i + 1) }));
  const hidden = task({ id: 17, key: 'HID', units: [], don_vi_dau_moi: '', noi_dung: 'Dòng ẩn' });
  return [...w44, ...w43, hidden];
}
function profile(username, role = 'viewer', o = {}) {
  return {
    id: o.id ?? 'id-' + username, email: `${username}@bctuan.local`, username, full_name: o.full_name ?? username.toUpperCase(),
    role, active: true, pending: false, requested_at: null, avatar_path: null, created_at: '2026-01-05T03:00:00Z', ...o,
  };
}

// ---------- Supabase giả ----------
function makeDb({ profiles = [], tasks = [] } = {}) {
  const db = {
    profiles, tasks, nextId: 5000,
    banned: new Set(), noProfile: new Set(), profileError: null,
    log: { auth: [], logout: 0, upsert: [], patch: [], del: [], fn: [], unhandled: [] },
    fn: {}, // tên hàm -> (body, db) => [status, json]
  };
  db.fn['admin-users'] = (b) => {
    const p = db.profiles.find((x) => x.id === b.id);
    if (b.action === 'delete') db.profiles = db.profiles.filter((x) => x.id !== b.id);
    else if (b.action === 'approve' && p) Object.assign(p, { pending: false, role: b.role });
    else if (b.action === 'update' && p) { const { action, id, ...rest } = b; Object.assign(p, rest); }
    return [200, { ok: true }];
  };
  return db;
}

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (id) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

const cond = (db, params) => {
  const tests = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = v.match(/^(eq|in)\.(.*)$/s);
    if (!m) { db.log.unhandled.push(`filter ${k}=${v}`); continue; }
    const set = m[1] === 'in' ? m[2].replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')) : [m[2]];
    tests.push((r) => set.includes(String(r[k])));
  }
  return (r) => tests.every((t) => t(r));
};

async function installMocks(ctx, db, leaks) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (!u.hostname.endsWith('supabase.co')) { leaks.push(req.method() + ' ' + req.url()); return route.abort(); }
    const m = req.method(), p = u.pathname, sp = u.searchParams;
    const json = (body, status = 200, h = {}) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
    const empty = (status = 204, h = {}) => route.fulfill({ status, headers: { ...cors, ...h }, body: '' });
    if (m === 'OPTIONS') return empty();

    if (p === '/auth/v1/token') {
      const b = req.postDataJSON();
      if (sp.get('grant_type') === 'password') {
        db.log.auth.push(b);
        const prof = db.profiles.find((x) => x.email === b.email);
        if (!prof || b.password !== PW) return json({ code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
        if (db.banned.has(prof.id)) return json({ code: 'user_banned', error_code: 'user_banned', msg: 'User is banned' }, 400);
        return json(session(prof));
      }
      const id = String(b.refresh_token).replace(/^r:/, '');
      const prof = db.profiles.find((x) => x.id === id);
      return prof ? json(session(prof)) : json({ msg: 'Invalid Refresh Token' }, 400);
    }
    if (p === '/auth/v1/logout') { db.log.logout++; return empty(); }
    if (p === '/auth/v1/user') return json({ id: 'x' });
    if (p.startsWith('/storage/v1/object/sign/')) return json([]);
    if (p.startsWith('/functions/v1/')) {
      const name = p.split('/')[3], body = m === 'POST' ? req.postDataJSON() : null;
      db.log.fn.push({ name, body });
      const h = db.fn[name];
      if (!h) { leaks.push('function không mock: ' + name); return json({ error: 'no mock' }, 500); }
      const [status, out] = h(body, db);
      return json(out, status);
    }
    if (p.startsWith('/rest/v1/')) {
      const table = p.split('/')[3], accept = req.headers()['accept'] || '';
      if (table === 'profiles' && db.profileError) return json({ message: db.profileError, code: 'XX000' }, 500);
      if (table === 'profiles' && m !== 'GET' && m !== 'HEAD') { db.log.unhandled.push(m + ' profiles'); return json({ message: 'no mock' }, 500); }
      if (table === 'profiles') {
        let rows = db.profiles.filter(cond(db, sp));
        if (m === 'HEAD') return empty(200, { 'content-range': `*/${rows.length}` });
        if (db.noProfile.size) rows = rows.filter((r) => !db.noProfile.has(r.id));
        if (accept.includes('vnd.pgrst.object')) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
        return json(rows);
      }
      if (table === 'tasks') {
        const f = cond(db, sp);
        if (m === 'GET') {
          if (db.tasksDelay) await new Promise((r) => setTimeout(r, db.tasksDelay));
          const off = +(sp.get('offset') || 0), lim = +(sp.get('limit') || 1000);
          return json(db.tasks.filter(f).sort((a, b) => a.id - b.id).slice(off, off + lim));
        }
        if (m === 'POST') {
          const rows = req.postDataJSON(); db.log.upsert.push(JSON.parse(JSON.stringify(rows)));
          for (const r of rows) {
            const old = db.tasks.find((t) => t.tuan === r.tuan && t.key === r.key);
            if (old) Object.assign(old, r);
            else db.tasks.push({ id: ++db.nextId, ghi_chu: null, units_phoi_hop: [], deadline_tu: null, deadline_den: null, ...r });
          }
          return empty(201);
        }
        if (m === 'PATCH') {
          const body = req.postDataJSON(); db.log.patch.push({ query: u.search, body });
          db.tasks.filter(f).forEach((t) => Object.assign(t, body));
          return empty();
        }
        if (m === 'DELETE') {
          const hits = db.tasks.filter(f); db.log.del.push({ query: decodeURIComponent(u.search), ids: hits.map((t) => t.id), unfiltered: ![...sp.keys()].length });
          db.tasks = db.tasks.filter((t) => !hits.includes(t));
          return empty();
        }
      }
    }
    leaks.push(`${m} ${u.pathname}${u.search} (supabase không mock)`);
    return route.abort();
  });
  // Realtime (admin): trả lời phx_join cho xong, không kết nối thật.
  await ctx.routeWebSocket(/supabase\.co/, (ws) => {
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      const [jr, ref, topic, ev] = Array.isArray(msg) ? msg : [msg.join_ref, msg.ref, msg.topic, msg.event];
      const reply = (payload) => ws.send(JSON.stringify(Array.isArray(msg) ? [jr, ref, topic, 'phx_reply', payload] : { topic, event: 'phx_reply', payload, ref }));
      if (ev === 'phx_join') reply({ status: 'ok', response: { postgres_changes: [] } });
      else if (ev === 'heartbeat') reply({ status: 'ok', response: {} });
    });
  });
  function session(prof) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return { access_token: jwt(prof.id), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r:' + prof.id,
      user: { id: prof.id, aud: 'authenticated', role: 'authenticated', email: prof.email, app_metadata: {}, user_metadata: {}, created_at: prof.created_at } };
  }
}

const IGNORED = /Failed to load resource|net::ERR|WebSocket/i; // 400/500 do ta chủ động trả, chặn ngoài
async function newApp(browser, url, db, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport, locale: 'vi-VN', serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [], leaks = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await installMocks(ctx, db, leaks);
  const app = {
    ctx, page, db, errors, leaks, url,
    goto: (hash = '') => page.goto(url + (hash ? '#' + hash : '')),
    /** Đăng nhập bằng form rồi đợi vào được shell. */
    async login(username, pw = PW, hash = '') {
      await app.goto(hash);
      await page.getByTestId('login-id').fill(username);
      await page.getByTestId('login-password').fill(pw);
      await page.getByTestId('login-submit').click();
      await page.getByTestId('app-shell').waitFor();
    },
    assertClean() {
      assert.deepEqual(leaks, [], 'Có request tới Supabase/mạng ngoài chưa được mock');
      assert.deepEqual(db.log.unhandled, [], 'Có thao tác DB chưa mock');
      assert.deepEqual(errors, [], 'Có lỗi console/pageerror');
    },
    close: () => ctx.close(),
  };
  return app;
}

/** Bật/tắt chế độ test: một browser dùng chung cho cả file. */
async function setup() {
  const { server, url } = await startServer();
  const browser = await chromium.launch();
  return { server, url, browser, teardown: async () => { await browser.close(); server.close(); } };
}

module.exports = { setup, newApp, makeDb, profile, task, sampleTasks, PW, OWNER_ID, XSS, XSS_ID, ROOT };

