// Tự đăng ký tài khoản — ai cũng gọi được, nhưng tài khoản tạo ra ở trạng thái CHỜ DUYỆT
// (active = false, pending = true) nên không đọc được dữ liệu cho tới khi Quản trị duyệt.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const DOMAIN = 'bctuan.local'; // phải trùng với web và admin-users
const USERNAME_RX = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const MAX_PENDING = 50; // chặn spam: quá nhiều yêu cầu đang chờ thì tạm ngưng nhận

// tên đăng nhập do hệ thống tạo (người đăng ký không chọn): "Lê Thái Bão" -> "baolt" (giống makeUsername ở web)
function makeUsername(fullName: string) {
  const parts = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .split(/\s+/).map((p) => p.replace(/[^a-z0-9]/g, '')).filter(Boolean);
  const u = parts.length ? parts.at(-1)! + parts.slice(0, -1).map((p) => p[0]).join('') : '';
  return u.slice(0, 28);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } });
    if (Number(req.headers.get('content-length') ?? 0) > 450_000) return json({ error: 'Yêu cầu quá lớn' }, 413);
    const b = await req.json().catch(() => ({}));
    const full_name = String(b.full_name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const password = String(b.password ?? '');
    if (full_name.length < 2) return json({ error: 'Nhập họ và tên' }, 400);
    const base = makeUsername(full_name);
    if (!base) return json({ error: 'Họ và tên phải có chữ cái' }, 400);
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) return json({ error: 'Mật khẩu từ 8 đến 72 ký tự' }, 400);
    // ảnh đại diện (tùy chọn): web đã thu về JPEG 256px và gửi dạng data URL; kiểm tra lại ở server
    let avatar: Uint8Array | null = null;
    if (b.avatar) {
      const s = String(b.avatar);
      if (s.length > 420_000) return json({ error: 'Ảnh đại diện quá lớn' }, 400);
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(s);
      if (!m) return json({ error: 'Ảnh đại diện không hợp lệ' }, 400);
      try { avatar = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)); } catch { return json({ error: 'Ảnh đại diện không hợp lệ' }, 400); }
      if (avatar.length > 300_000) return json({ error: 'Ảnh đại diện quá lớn' }, 400);
      if (avatar[0] !== 0xff || avatar[1] !== 0xd8 || avatar[2] !== 0xff) return json({ error: 'Ảnh đại diện không phải JPEG' }, 400);
    }

    // giới hạn 10 lượt/IP/giờ, chỉ tính khi dữ liệu đã hợp lệ; bảng chưa có (42P01/PGRST205) thì bỏ qua giới hạn
    // shortcut: IP lấy từ header, chưa xác minh được việc có bị giả mạo hay không
    const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const { count: tries, error: terr } = await admin.from('register_attempts').select('id', { count: 'exact', head: true })
      .eq('ip', ip).gte('at', new Date(Date.now() - 36e5).toISOString());
    if (terr && terr.code !== '42P01' && terr.code !== 'PGRST205') return json({ error: 'Tạm thời không đăng ký được, thử lại sau' }, 503);
    if (!terr) {
      if ((tries ?? 0) >= 10) return json({ error: 'Bạn đăng ký quá nhiều lần, vui lòng thử lại sau' }, 429);
      const { error: ierr } = await admin.from('register_attempts').insert({ ip });
      if (ierr) return json({ error: 'Tạm thời không đăng ký được, thử lại sau' }, 503);
      await admin.from('register_attempts').delete().lt('at', new Date(Date.now() - 864e5).toISOString());
    }

    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('pending', true);
    if ((count ?? 0) >= MAX_PENDING) return json({ error: 'Đang có quá nhiều yêu cầu chờ duyệt, vui lòng thử lại sau hoặc liên hệ Quản trị' }, 429);
    // chọn tên chưa ai dùng: baolt, baolt1, baolt2…; thử lại nếu bị người khác lấy cùng lúc
    const { data: rows } = await admin.from('profiles').select('username').ilike('username', `${base}%`);
    const taken = new Set((rows ?? []).map((r) => r.username.toLowerCase()));
    let n = base.length < 2 ? 1 : 0, username = '', data = null as Awaited<ReturnType<typeof admin.auth.admin.createUser>>['data'] | null;
    for (let attempt = 0; attempt < 5 && !data; attempt++) {
      do { username = n ? `${base}${n}` : base; n++; } while (taken.has(username)); // baolt, baolt1, baolt2…
      if (!USERNAME_RX.test(username)) return json({ error: 'Không tạo được tên đăng nhập từ họ tên này' }, 400);
      const res = await admin.auth.admin.createUser({ email: `${username}@${DOMAIN}`, password, email_confirm: true });
      if (res.error && !res.error.message.includes('already')) return json({ error: res.error.message }, 400);
      if (res.error) taken.add(username); else data = res.data;
    }
    if (!data) return json({ error: 'Không tạo được tên đăng nhập, vui lòng thử lại' }, 409);
    // trigger đã tạo hồ sơ; đặt về trạng thái chờ duyệt, vai trò Xem
    const { error: perr } = await admin.from('profiles')
      .update({ full_name, username, role: 'viewer', active: false, pending: true, requested_at: new Date().toISOString() })
      .eq('id', data.user.id);
    if (perr) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: perr.message }, 500); }
    // lưu ảnh vào Storage; lỗi ảnh không làm hỏng đơn đăng ký
    let avatarSaved = false;
    if (avatar) {
      const path = `${data.user.id}/${Date.now()}.jpg`;
      const { error: aerr } = await admin.storage.from('avatars').upload(path, avatar, { contentType: 'image/jpeg' });
      if (!aerr) avatarSaved = !(await admin.from('profiles').update({ avatar_path: path }).eq('id', data.user.id)).error;
    }
    return json({ ok: true, username, avatarSaved });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
