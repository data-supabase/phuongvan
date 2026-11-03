// Quản lý người dùng — chỉ Quản trị gọi được. Dùng service role (chỉ có ở server, không bao giờ đưa ra web).
// Body: { action: 'create' | 'update' | 'approve' | 'reset_password' | 'delete', ... }  (từ chối đăng ký = delete)
// Đăng nhập bằng tên đăng nhập (vd: vanhp); Supabase Auth cần email nên dùng email nội bộ baolt@bctuan.local.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['admin', 'editor', 'viewer'];
const BAN_FOREVER = '876000h'; // ~100 năm = khóa tài khoản
const DOMAIN = 'bctuan.local'; // phải trùng với web (index.html)
const USERNAME_RX = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const OWNER_ID = '065441d4-3465-43d4-9088-3c08e6bfa580'; // @vanhp — Quản trị cao nhất, phải trùng OWNER_ID ở index.html
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } });

    // xác thực người gọi + phải là Quản trị đang hoạt động
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !user) return json({ error: 'Chưa đăng nhập' }, 401);
    const { data: me } = await admin.from('profiles').select('role, active').eq('id', user.id).maybeSingle();
    if (!me || me.role !== 'admin' || !me.active) return json({ error: 'Chỉ Quản trị được quản lý người dùng' }, 403);

    const b = await req.json().catch(() => ({}));
    const id = typeof b.id === 'string' ? b.id : '';
    if (b.action !== 'create' && id && !UUID_RX.test(id)) return json({ error: 'id không hợp lệ' }, 400);
    const self = id === user.id;
    // Quản trị cao nhất (@vanhp): chỉ chính chủ được sửa tài khoản này (theo id, không theo username vì username đổi được)
    if (id === OWNER_ID && !self && b.action !== 'create') return json({ error: 'Không thể thay đổi tài khoản Quản trị cao nhất' }, 403);
    const cleanUsername = (v: unknown) => String(v ?? '').trim().toLowerCase();
    const usernameTaken = async (u: string, exceptId = '') => {
      const { data } = await admin.from('profiles').select('id').eq('username', u).neq('id', exceptId || '00000000-0000-0000-0000-000000000000');
      return (data ?? []).length > 0;
    };
    // ảnh nằm trong thư mục riêng của người dùng: <id>/<tên file>
    const validAvatar = (p: unknown, uid: string) => p === null ||
      (UUID_RX.test(uid) && typeof p === 'string' && p.startsWith(`${uid}/`) && /^[\w-][\w.-]{0,79}$/.test(p.slice(uid.length + 1)));

    switch (b.action) {
      case 'create': {
        const username = cleanUsername(b.username);
        const password = String(b.password ?? '');
        const role = ROLES.includes(b.role) ? b.role : 'viewer';
        const full_name = String(b.full_name ?? '').trim().slice(0, 120) || null;
        if (!USERNAME_RX.test(username)) return json({ error: 'Tên đăng nhập 2–32 ký tự: chữ thường không dấu, số, dấu . _ -' }, 400);
        if (password.length < 8) return json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, 400);
        if (await usernameTaken(username)) return json({ error: `Tên đăng nhập "${username}" đã có` }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email: `${username}@${DOMAIN}`, password, email_confirm: true });
        if (error) return json({ error: error.message.includes('already') ? `Tên đăng nhập "${username}" đã có` : error.message }, 400);
        // trigger đã tạo hồ sơ (vai trò Xem, username theo email); cập nhật tên + vai trò được chọn
        const { error: perr } = await admin.from('profiles').update({ full_name, role, username, active: true, pending: false }).eq('id', data.user.id);
        if (perr) return json({ error: perr.message }, 500);
        return json({ ok: true, id: data.user.id });
      }
      case 'update': {
        if (!id) return json({ error: 'Thiếu id' }, 400);
        const patch: Record<string, unknown> = {}, authUpd: Record<string, unknown> = {};
        if (b.role !== undefined) {
          if (!ROLES.includes(b.role)) return json({ error: 'Vai trò không hợp lệ' }, 400);
          if (self && b.role !== 'admin') return json({ error: 'Không thể tự hạ quyền Quản trị của chính mình' }, 400);
          patch.role = b.role;
        }
        if (b.username !== undefined) {
          const username = cleanUsername(b.username);
          if (!USERNAME_RX.test(username)) return json({ error: 'Tên đăng nhập 2–32 ký tự: chữ thường không dấu, số, dấu . _ -' }, 400);
          if (await usernameTaken(username, id)) return json({ error: `Tên đăng nhập "${username}" đã có` }, 400);
          const email = `${username}@${DOMAIN}`;
          authUpd.email = email; authUpd.email_confirm = true;
          patch.username = username; patch.email = email;
        }
        if (b.avatar_path !== undefined) {
          if (!validAvatar(b.avatar_path, id)) return json({ error: 'Đường dẫn ảnh không hợp lệ' }, 400);
          patch.avatar_path = b.avatar_path;
        }
        if (b.active !== undefined) {
          if (self && !b.active) return json({ error: 'Không thể tự khóa tài khoản của chính mình' }, 400);
          patch.active = !!b.active;
          authUpd.ban_duration = b.active ? 'none' : BAN_FOREVER;
        }
        if (b.full_name !== undefined) patch.full_name = String(b.full_name).trim().slice(0, 120) || null;
        if (!Object.keys(patch).length) return json({ error: 'Không có gì để cập nhật' }, 400);
        // ghi hồ sơ trước (bắt lỗi trùng tên/ràng buộc), rồi mới ghi Auth; Auth lỗi thì hoàn lại hồ sơ
        const { data: old } = await admin.from('profiles').select(Object.keys(patch).join(',')).eq('id', id).maybeSingle();
        const { error } = await admin.from('profiles').update(patch).eq('id', id);
        if (error) return json({ error: error.message }, 500);
        if (Object.keys(authUpd).length) {
          const { error: aerr } = await admin.auth.admin.updateUserById(id, authUpd);
          if (aerr) {
            if (old) await admin.from('profiles').update(old).eq('id', id);
            return json({ error: aerr.message }, 400);
          }
        }
        return json({ ok: true });
      }
      case 'approve': { // duyệt tài khoản tự đăng ký: mở quyền + gán vai trò
        if (!id) return json({ error: 'Thiếu id' }, 400);
        const role = ROLES.includes(b.role) ? b.role : 'viewer';
        const { data: p } = await admin.from('profiles').select('pending').eq('id', id).maybeSingle();
        if (!p?.pending) return json({ error: 'Tài khoản này không ở trạng thái chờ duyệt' }, 400);
        const { error } = await admin.from('profiles').update({ pending: false, active: true, role }).eq('id', id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
      case 'reset_password': {
        if (!id) return json({ error: 'Thiếu id' }, 400);
        const password = String(b.password ?? '');
        if (password.length < 8) return json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case 'delete': {
        if (!id) return json({ error: 'Thiếu id' }, 400);
        if (self) return json({ error: 'Không thể tự xóa tài khoản của chính mình' }, 400);
        // xóa ảnh trong thư mục của người đó (không chặn việc xóa tài khoản nếu lỗi)
        const { data: files } = await admin.storage.from('avatars').list(id);
        if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${id}/${f.name}`));
        // hồ sơ tự xóa theo (on delete cascade); quyền đọc dữ liệu mất ngay vì my_role() trả null
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      default:
        return json({ error: 'Hành động không hợp lệ' }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
