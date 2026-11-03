# Audit back-end (chỉ đọc, chưa sửa/ chạy gì)

Nguồn: docs/db-snapshot.md, supabase/auth_roles.sql, hai Edge Function, index.html. SQL đề xuất: docs/proposed-migration.sql (mã [A1]...[A5]).
Không đề xuất xóa 62 dòng cũ hay bỏ cột deadline_tu/deadline_den.

## 1. Đã kiểm tra và ổn
- Tự sửa vai trò: profiles chỉ có SELECT cho authenticated, không có policy insert/update/delete, nên user không tự nâng quyền được. Đã xác nhận qua snapshot. Vai trò không đọc từ JWT/user_metadata.
- Tài khoản chờ duyệt/khóa còn JWT hợp lệ: `my_role()` trả null nên tasks (select/insert/update/delete) và storage.objects (read/insert/...) bị chặn; profiles chỉ đọc được hồ sơ của chính mình. Realtime postgres_changes áp RLS nên chỉ thấy dòng của mình.
- Viewer upsert: ON CONFLICT DO UPDATE vẫn phải qua WITH CHECK của policy insert (admin/editor) nên viewer bị chặn. Insert path của tasks_guard không cần vì policy insert đã chặn. Phép so sánh `to_jsonb(new)-'ghi_chu'` đúng (kể cả đổi id/updated_at đều bị chặn).
- Upsert của editor không đè ghi_chu: lô `rest` không có khóa ghi_chu nên PostgREST không đặt cột này (index.html:2926-2929). Xem mục 3.9 cho rủi ro còn lại.
- Hàm private.* không expose qua Data API, revoke from public; handle_new_user có search_path rỗng.

## 2. Vấn đề, xếp theo mức độ

### 2.1 [Trung bình] TRUNCATE (và TRIGGER, REFERENCES) cấp cho authenticated trên tasks  - snapshot "Grant"
- Mức độ thật: TRUNCATE bỏ qua RLS và trigger, nhưng PostgREST không có động từ TRUNCATE, nên KHÔNG khai thác được qua Data API hiện tại. Rủi ro xuất hiện khi có kết nối SQL dưới role authenticated, hoặc khi sau này thêm hàm SECURITY INVOKER/RPC. Tôi không xếp "Cao" vì không dựng được kịch bản tấn công thực.
- Quyền TRIGGER cho phép tạo trigger riêng trên tasks (cũng cần có hàm trigger gọi được). Không ai cần.
- Fix: [A1] `revoke truncate, references, trigger on public.tasks from authenticated, anon;`

### 2.2 [Trung bình] handle_new_user "fail-open"  - auth_roles.sql:28-38 (live: thêm username)
- Hồ sơ mới mặc định active=true. `register` (index register/index.ts:57-66) tạo user trước rồi mới UPDATE sang pending. Nếu hàm bị timeout/crash giữa hai bước (hoặc UPDATE lỗi và deleteUser cũng lỗi), tài khoản tự đăng ký còn lại là viewer ĐANG HOẠT ĐỘNG, bỏ qua duyệt. Ngoài ra có cửa sổ vài ms mà tài khoản vừa tạo đọc được dữ liệu.
- Khi không còn admin nào (ví dụ hai admin hạ nhau cùng lúc, mục 2.3), user kế tiếp (kể cả qua `register`) được trigger gán admin + active=true trong cửa sổ đó. `exists(...)` cũng không an toàn khi hai insert song song.
- Fix: [A2] trigger tạo hồ sơ viewer + active=false + pending=true; chỉ người đầu tiên khi profiles rỗng là admin (có advisory lock). Kèm diff admin-users create (xem 4.1) để tài khoản admin tạo ra có active=true, pending=false. `register` vẫn UPDATE như cũ (idempotent).

### 2.3 [Trung bình] Có thể mất hết Quản trị  - admin-users/index.ts:63-86, 109-117
- Chỉ chặn tự hạ/khóa/xóa mình. Admin A hạ B và B hạ A đồng thời, hoặc A xóa B khi B là người cuối... Admin này xóa/khóa/hạ admin kia thì còn lại 1 là ổn, nhưng hai thao tác đồng thời về 0 admin (kết hợp 2.2 thành đường chiếm quyền).
- Fix: [A3] trigger `keep_one_admin` chặn ở DB, có advisory lock.

### 2.4 [Trung bình] `register` dễ bị spam / MAX_PENDING bị vượt  - register/index.ts:48-49, 57-66
- Không giới hạn theo IP; kẻ xấu lấp đầy 50 chỗ chờ duyệt (hậu quả: người thật bị 429 và admin ngập hồ sơ rác). Đây là DoS chức năng đăng ký.
- Bypass đếm: `pending=true` chỉ được đặt SAU createUser (dòng 63-65) nên khi gửi song song, mọi request đều thấy count < 50 và cùng tạo tài khoản. Sau fix [A2] (pending=true ngay khi tạo) vượt chỉ còn bằng số request thực sự đồng thời.
- Fix: [A4] bảng `register_attempts` + diff 4.2 (tối đa 5 lượt/IP/giờ). Cân nhắc thêm CAPTCHA (Cloudflare Turnstile) nếu vẫn bị spam; không làm được chỉ bằng DB.

### 2.5 [Trung bình] `load()` chỉ lấy tối đa 1000 dòng  - index.html:2845
- PostgREST của Supabase mặc định max-rows = 1000. Hiện 275 dòng (~213 dòng hiển thị/tuần); sau ~4-5 tuần `select('*').order('id')` bị cắt im lặng, tuần MỚI NHẤT mất (vì order id tăng dần) mà không có lỗi. Tôi chưa xác nhận cấu hình max_rows thực tế của project; kiểm tra trong Dashboard > Settings > API.
- Fix phía web (thuộc front-end, ngoài phạm vi của tôi), thay dòng 2845:
```js
let data = [], from = 0, error;
for (;;) {
  const r = await db.from('tasks').select('*').order('id').range(from, from + 999);
  if (r.error) { error = r.error; break; }
  data = data.concat(r.data); if (r.data.length < 1000) break; from += 1000;
}
```

### 2.6 [Thấp] Pending vẫn đăng nhập được, thông tin chỉ chặn ở web
- `register` không ban; web chỉ signOut sau khi đọc profile (index.html:3006). Mọi chặn dữ liệu dựa vào RLS (đủ an toàn nếu 2.2 sửa). Tùy chọn (defense in depth): `ban_duration` khi tạo + gỡ ban khi `approve`. Đổi lại web không còn hiện thông báo "đang chờ duyệt" (signIn trả "User is banned"), nên chỉ làm nếu front-end sửa kèm. Mặc định: không làm.

### 2.7 [Thấp] `usernameTaken` dùng ilike  - admin-users/index.ts:38
- USERNAME_RX cho phép `_` và `.`; trong ilike `_` là ký tự đại diện một ký tự. Tạo "a_b" bị báo trùng với "a.b", "a-b", "a1b" (chặn nhầm). `%` bị regex loại nên không có injection. Username luôn lưu chữ thường (unique lower(username)) nên dùng so sánh bằng.
- register dòng 51 dùng ilike với `base` chỉ gồm [a-z0-9] nên không bị.

### 2.8 [Thấp] `validAvatar` dựng RegExp từ `id` không kiểm tra  - admin-users/index.ts:34, 42
- `id` là chuỗi bất kỳ từ body, không phải UUID, ghép thẳng vào RegExp (id=".*" khớp mọi đường dẫn). Chỉ admin gọi được nên Thấp. Tên file `[\w.-]` cho phép "..".
- Fix: kiểm tra `id` là UUID và dùng so sánh chuỗi (diff 4.3).

### 2.9 [Thấp] `register` avatar/atob  - register/index.ts:41-46
- `atob` chạy trên chuỗi base64 bất kỳ độ dài trước khi kiểm tra kích thước; `Uint8Array.from` trên chuỗi lớn tốn RAM/CPU. Base64 sai (ví dụ `=` giữa chuỗi) ném lỗi → 500 với thông điệp kỹ thuật. Chỉ kiểm tra 3 byte JPEG đầu; được lưu private với contentType cố định nên rủi ro thấp.
- Fix: diff 4.2 (giới hạn độ dài trước atob, try/catch, giới hạn body).

### 2.10 [Thấp] Chính sách mật khẩu và rò tên đăng nhập
- Chỉ ≥ 8 ký tự (register:37, admin-users create/reset); Leaked Password Protection đang tắt (cần gói Pro). Không giới hạn trên (bcrypt chỉ dùng 72 byte đầu). Fix: thêm `password.length > 72` → 400, và bật Leaked Password Protection nếu gói cho phép; cân nhắc tăng độ dài tối thiểu lên 10 (cũng chỉnh ở Auth settings).
- `register` trả `username` đã chọn (baolt1 → baolt đã tồn tại): lộ tên đăng nhập đang có. Tên không bí mật trong cơ quan nên chấp nhận được; ghi nhận.

### 2.11 [Thấp] CORS `*` ở cả hai hàm  - register:6, admin-users:6
- Không dùng cookie, JWT nằm ở header nên `*` không mở thêm lỗ hổng CSRF; nhưng nên giới hạn về origin của web khi đã biết domain, ví dụ `Access-Control-Allow-Origin: https://<domain>`. Không đổi nếu chưa có domain cố định (tránh gãy).

### 2.12 [Thấp] admin-users không nguyên tử khi đổi tên đăng nhập/khóa  - admin-users:72-76, 81-88
- Đổi username: gọi updateUserById(email) trước, UPDATE profiles sau; nếu profiles lỗi (ví dụ vi phạm unique do đua) thì email đăng nhập đã đổi mà profiles giữ tên cũ, user không đăng nhập bằng tên đang hiển thị. Tương tự active: ban trước, profiles sau. Fix: UPDATE profiles trước (bắt lỗi unique), rồi mới gọi Auth; nếu Auth lỗi thì UPDATE hoàn lại.
- Đổi email: chỉ admin đổi qua `updateUserById` (email_confirm: true), không gửi thư; một user thường tự gọi `auth.updateUser({email})` được (xem rủi ro bên dưới).
- Rủi ro cần kiểm tra trong Dashboard: Auth > "Allow users to change email"/Secure email change; nếu user tự đổi email được thì đăng nhập (email bctuan.local) lệch với profiles.username/email. Chưa xác minh được từ code.

### 2.13 [Thấp] Phiên cũ sau khi khóa/xóa
- Ban chặn làm mới token; access token cũ còn hiệu lực tới hết hạn (mặc định 1 giờ) nhưng `my_role()` kiểm tra `active` ở mỗi truy vấn, và xóa user cascade profile nên dữ liệu bị chặn ngay. Signed URL ảnh còn sống tối đa 1 giờ (index.html:2967). Chấp nhận được; không cần sửa. Nếu muốn chặt hơn: hạ JWT expiry xuống 15-30 phút trong Auth settings.

### 2.14 [Thấp] Realtime profiles
- postgres_changes áp RLS cho INSERT/UPDATE nên người không phải admin chỉ nhận dòng của mình. Sự kiện DELETE không lọc theo RLS (chỉ lộ `id`, không có dữ liệu khác). Chấp nhận. Việc chỉ admin đăng ký kênh là kiểm tra ở web (index.html:3107), không phải ràng buộc bảo mật, nhưng không thêm quyền gì.

### 2.15 [Thấp] Storage
- Policy đọc cho mọi tài khoản active: ai cũng liệt kê và ký URL mọi ảnh trong bucket (hợp lý cho danh bạ nội bộ). Ghi chỉ admin. Cần xác minh policy có `bucket_id = 'avatars'` và `to authenticated`: dùng truy vấn pg_policies ở cuối proposed-migration.sql (snapshot không nêu chi tiết).
- `delete` trong admin-users dùng `list(id)` mặc định 100 file; hồ sơ nhiều ảnh sẽ sót file mồ côi (không ảnh hưởng bảo mật).

### 2.16 [Trung bình, tùy chọn] Nạp tuần không nguyên tử; có thể đè ghi_chu; xóa 62 dòng cũ khi nạp lại tuần 44  - index.html:2912-2937
- Hai lệnh upsert + delete rời nhau; lỗi giữa chừng để tuần ở trạng thái dở. `thisKeys` lấy từ cache `dbRows` của trình duyệt: nếu người khác vừa thêm/ghi chú dòng ấy, lô `carry` đè `ghi_chu` bằng ghi chú tuần trước.
- QUAN TRỌNG cho ràng buộc của người dùng: `stale = thisWeek.filter(!newKeys.has(key))` (dòng 2915, 2934-2935) sẽ XÓA 62 dòng cũ (units rỗng) của tuần 44 ngay lần nạp lại tuần 44 vì chúng không có trong file. Cần sửa web hoặc dùng RPC mới, nơi chỉ xóa dòng `cardinality(units) > 0`.
- Fix: [A5] `import_week(p_tuan, p_rows, p_carry)`, security definer có kiểm tra vai trò, một transaction, không đụng ghi_chu/deadline_*, chỉ mang ghi chú sang khi `ghi_chu is null`. Web gọi `db.rpc('import_week', { p_tuan: tuan, p_rows: data, p_carry: Object.fromEntries(prevNotes) })` (front-end làm). Nếu không dùng RPC, ít nhất đổi dòng 2915 thành `thisWeek.filter(r => r.units?.length && !newKeys.has(r.key))`.
- Cần xác minh: quyền UPDATE theo cột của authenticated trên tasks (snapshot chỉ nói "có thể có grant theo cột"); upsert của web cập nhật nhiều cột hơn ghi_chu nên chắc chắn đã được cấp, truy vấn kiểm tra ở cuối proposed-migration.sql.

## 3. Chỉ mục
Web chỉ truy vấn tasks theo `id` (pk), `tuan` (đầu của unique (tuan,key)) và `id in (...)`; profiles theo `id`, `pending`, `created_at` (bảng vài dòng). Không thiếu chỉ mục cần thiết; không thêm. FK duy nhất (profiles.id → auth.users) đã là pk.

## 4. Diff TS đề xuất (chưa áp dụng)

### 4.1 admin-users/index.ts
```diff
@@ usernameTaken (dòng 38)
-      const { data } = await admin.from('profiles').select('id').ilike('username', u).neq('id', exceptId || '00000000-0000-0000-0000-000000000000');
+      const { data } = await admin.from('profiles').select('id').eq('username', u).neq('id', exceptId || '00000000-0000-0000-0000-000000000000');
@@ validAvatar (dòng 42)
-    const validAvatar = (p: unknown, uid: string) => p === null || (typeof p === 'string' && new RegExp(`^${uid}/[\\w.-]{1,80}$`).test(p));
+    const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
+    const validAvatar = (p: unknown, uid: string) => p === null || (typeof p === 'string' && p.startsWith(`${uid}/`) && /^[\w-][\w.-]{0,79}$/.test(p.slice(uid.length + 1)));
@@ sau dòng 34
+    if (b.action !== 'create' && id && !UUID_RX.test(id)) return json({ error: 'id không hợp lệ' }, 400);
@@ create, dòng 56 (bắt buộc đi kèm [A2])
-        const { error: perr } = await admin.from('profiles').update({ full_name, role, username }).eq('id', data.user.id);
+        const { error: perr } = await admin.from('profiles').update({ full_name, role, username, active: true, pending: false }).eq('id', data.user.id);
@@ mật khẩu (create dòng 51, reset_password dòng 104)
-        if (password.length < 8) return json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, 400);
+        if (password.length < 8 || password.length > 72) return json({ error: 'Mật khẩu từ 8 đến 72 ký tự' }, 400);
```
Lưu ý: dòng thêm kiểm tra UUID phải đặt sau khi khai báo `UUID_RX` (di chuyển khai báo lên trên dòng 35).

### 4.2 register/index.ts
```diff
@@ trước dòng 31
+    if (Number(req.headers.get('content-length') ?? 0) > 450_000) return json({ error: 'Yêu cầu quá lớn' }, 413);
+    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
+    await admin.from('register_attempts').delete().lt('at', new Date(Date.now() - 864e5).toISOString());
+    const { count: tries } = await admin.from('register_attempts').select('id', { count: 'exact', head: true })
+      .eq('ip', ip).gte('at', new Date(Date.now() - 36e5).toISOString());
+    if ((tries ?? 0) >= 5) return json({ error: 'Bạn đăng ký quá nhiều lần, vui lòng thử lại sau' }, 429);
+    await admin.from('register_attempts').insert({ ip });
@@ mật khẩu (dòng 37)
-    if (password.length < 8) return json({ error: 'Mật khẩu tối thiểu 8 ký tự' }, 400);
+    if (password.length < 8 || password.length > 72) return json({ error: 'Mật khẩu từ 8 đến 72 ký tự' }, 400);
@@ avatar (dòng 41-43)
-      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.avatar));
-      if (!m) return json({ error: 'Ảnh đại diện không hợp lệ' }, 400);
-      avatar = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
+      const s = String(b.avatar);
+      if (s.length > 420_000) return json({ error: 'Ảnh đại diện quá lớn' }, 400);
+      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(s);
+      if (!m) return json({ error: 'Ảnh đại diện không hợp lệ' }, 400);
+      try { avatar = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)); } catch { return json({ error: 'Ảnh đại diện không hợp lệ' }, 400); }
```
Ghi chú: giới hạn 420 000 ký tự khớp 300 000 byte sau giải mã (base64 phình 4/3). Lỗi 429 của IP dùng chung (NAT cơ quan) có thể chặn nhầm; chỉnh ngưỡng nếu cần.

## 5. Việc cần Lead/người dùng quyết định
1. Duyệt chạy [A1] (an toàn, không ảnh hưởng web) và [A2]+[A3] (đi cùng diff 4.1 create; triển khai Edge Function admin-users TRƯỚC hoặc cùng lúc với [A2], nếu không tài khoản admin tạo ra sẽ ở trạng thái chờ duyệt).
2. Front-end: phân trang `load()` (2.5), tránh xóa 62 dòng cũ khi nạp lại tuần 44 (2.16), có thể chuyển sang `import_week`.
3. Dashboard: kiểm tra max_rows (Settings > API), Leaked Password Protection, cài đặt tự đổi email, JWT expiry.

Chưa kiểm tra: hành vi thực tế của project (không có DB), nội dung chính xác policy storage, grant cột của tasks, cấu hình Auth.
