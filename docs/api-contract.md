# API contract — web React gọi Supabase (02/11/2026)

Nguồn: `legacy/app.js` (hành vi đang chạy), `supabase/functions/*`, `docs/db-snapshot.md`.
Backend KHÔNG đổi. Web React chỉ được gọi đúng những gì liệt kê ở đây. Cần gọi thêm thì báo Lead.

Cập nhật so với db-snapshot.md: đã thu hồi TRUNCATE trên tasks; đã có bảng `register_attempts` (chỉ Edge Function dùng, web không đụng); trigger A2/A3 đã áp dụng (không hạ/khóa/xóa được Quản trị cuối cùng; hồ sơ mới mặc định chờ duyệt); RPC `import_week` đã bị drop, KHÔNG dùng.

## 0. Môi trường
```
VITE_SUPABASE_URL=https://mjuioravfaxpmxscnnkm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_OCr-0A3X5rmkn77Pks7s1g_4MMNqdBn
```
- Đây là khóa publishable, đưa ra trình duyệt được. KHÔNG BAO GIỜ dùng service_role trong `src/`.
- Một client duy nhất: `src/lib/supabase.ts` -> `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)` (supabase-js v2, bản legacy là 2.45.4).
- Quyền thật nằm ở DB (RLS + trigger) và Edge Function. Việc chặn theo vai trò ở web chỉ để báo sớm.

## 1. Kiểu dữ liệu
```ts
type Role = 'admin' | 'editor' | 'viewer';
const ROLE_LABEL = { admin: 'Quản trị', editor: 'Nhập liệu', viewer: 'Xem' };

interface Task {            // public.tasks (web dùng select('*'))
  id: number; tuan: string; key: string;           // unique (tuan, key)
  sheet: string; thong_tin_cuoc_hop: string; noi_dung: string; ket_luan: string;
  tinh_hinh: string; don_vi_dau_moi: string; don_vi_phoi_hop: string;
  tinh_trang: string; kho_khan: string; thoi_han: string;
  ghi_chu: string | null; units: string[]; units_phoi_hop: string[];
  deadline_tu: string | null; deadline_den: string | null; // cột cũ, không dùng, không xóa
  updated_at: string;
}
interface Profile {         // public.profiles
  id: string; email: string; username: string; full_name: string | null;
  role: Role; active: boolean; pending: boolean;
  requested_at: string | null; avatar_path: string | null; created_at: string;
}
```
- `tuan` có dạng `"<tuần>/<năm>"`, không có số 0 ở đầu: `"5/2026"`, `"44/2026"`.
- Dòng có `units` rỗng (62 dòng cũ) là **dòng ẩn**. Mọi màn hình bỏ qua chúng (`r.units?.length`), nhưng KHÔNG ĐƯỢC xóa chúng khi nạp lại tuần.
- Dòng do web ghi lên (upsert) gồm các trường của bộ phân loại: `sheet, thong_tin_cuoc_hop, units, noi_dung, ket_luan, tinh_hinh, don_vi_dau_moi, don_vi_phoi_hop, tinh_trang, kho_khan, thoi_han, key`, cộng thêm `tuan, updated_at` và có thể cả `ghi_chu`. Không gửi `id`, `units_phoi_hop`, `deadline_*`.

## 2. Auth
| Việc | Gọi | Ghi chú |
|---|---|---|
| Đọc phiên khi khởi động | `auth.getSession()` | không có phiên thì vào màn đăng nhập |
| Đăng nhập | `auth.signInWithPassword({ email: loginEmail(input), password })` | `loginEmail = v => { v = v.trim().toLowerCase(); return v.includes('@') ? v : \`${v}@bctuan.local\` }` |
| Đăng xuất | `auth.signOut()` | sau đó xóa sạch trạng thái (legacy: lưu flash vào `sessionStorage['flash']` rồi `location.reload()`) |
| Đổi mật khẩu của mình | `auth.updateUser({ password })` | |
| Hết phiên | `auth.onAuthStateChange`: nếu `SIGNED_OUT` lúc đang đăng nhập -> kết thúc phiên với thông báo "Phiên đăng nhập đã hết, vui lòng đăng nhập lại." | |

Lỗi đăng nhập trả về cho người dùng:
- message khớp `/banned/i` -> "Tài khoản đã bị khóa. Liên hệ Quản trị."
- khớp `/invalid login/i` -> "Sai tên đăng nhập hoặc mật khẩu."
- còn lại -> "Đăng nhập lỗi: " + message
- `updateUser` khớp `/should be different/i` -> "Mật khẩu mới phải khác mật khẩu cũ."

Khởi động sau khi có phiên (`bootNow`), các bước theo thứ tự:
1. `from('profiles').select('*').eq('id', session.user.id).maybeSingle()`
2. Lỗi -> hiện màn đăng nhập "Lỗi tải hồ sơ: … Kiểm tra kết nối rồi bấm Thử lại." kèm nút **Thử lại**. GIỮ phiên, KHÔNG signOut.
3. `p.pending` -> signOut, báo "Tài khoản @{username} đang chờ Quản trị duyệt. Vui lòng quay lại sau."
4. `!p` -> signOut, báo "Tài khoản chưa được cấp quyền. Liên hệ Quản trị." `!p.active` -> signOut, báo "Tài khoản đã bị khóa. Liên hệ Quản trị."
5. OK -> `me = p`, ký link ảnh đại diện, admin thì đếm số chờ duyệt và đăng ký realtime, rồi tải tasks.
- Không cho boot chạy chồng nhau (legacy dùng `booting ??=`).

Hằng số:
- `AUTH_DOMAIN = 'bctuan.local'` (phải trùng `DOMAIN` trong cả 2 Edge Function).
- `OWNER_ID = '065441d4-3465-43d4-9088-3c08e6bfa580'` (@vanhp, nhãn "Quản trị cao nhất"). Server cũng chặn ở admin-users.

## 3. Bảng `tasks`
| Mã | Thao tác | Gọi chính xác | Vai trò |
|---|---|---|---|
| T1 | Tải toàn bộ | lặp `from('tasks').select('*').order('id').range(from, from+999)` với from = 0, 1000, …; dừng khi một trang trả về < 1000 dòng. Có lỗi ở trang nào thì dừng và báo lỗi + nút Thử lại | mọi vai trò đang hoạt động |
| T2 | Lưu ghi chú | `from('tasks').update({ ghi_chu: value \|\| null }).eq('id', id)` | admin, editor, viewer (trigger chỉ cho viewer sửa `ghi_chu`) |
| T3 | Upsert khi nạp tuần | `from('tasks').upsert(batch, { onConflict: 'tuan,key' })`, gọi đúng 2 lô (xem §3.1) | admin, editor |
| T4 | Xóa việc cũ sau khi nạp | `from('tasks').delete().in('id', stale.map(r => r.id))` | admin, editor |
| T5 | Xóa cả tuần | `from('tasks').delete().eq('tuan', w)` (hiện xóa luôn dòng ẩn của tuần đó, xem D-002) | admin, editor |

Sau T3/T4/T5 thì tải lại T1 (invalidate query `['tasks']`). Sau T2 thì cập nhật dòng đó trong cache, không cần tải lại.

### 3.1 Quy tắc nạp tuần (phải giữ nguyên)
Đầu vào: `data` (kết quả của bộ phân loại), `tuan = normWeek(input)`, `dbRows` (toàn bộ tasks đã tải), `weeks` (các tuần có dòng hiển thị, đã sắp xếp).
```
newKeys  = Set(data.key)
thisWeek = dbRows.filter(r => r.tuan === tuan)              // GỒM CẢ dòng ẩn
thisKeys = Set(thisWeek.key)
stale    = thisWeek.filter(r => r.units?.length && !newKeys.has(r.key))   // dòng ẩn KHÔNG BAO GIỜ bị xóa
nếu thisWeek.length > 0 -> modal xác nhận "Cập nhật tuần {tuan}?" (giữ ghi chú của việc còn trong file;
   xóa {stale.length} việc không còn trong file [(k việc có ghi chú)]). Hủy -> "Đã hủy."
before    = weeks.filter(w => weekNum(w) < weekNum(tuan)).at(-1)
prevNotes = Map(key -> ghi_chu) của dbRows có tuan === before và có ghi_chu
now = new Date().toISOString(); base(r) = { ...r, tuan, updated_at: now }
carry = data.filter(r => !thisKeys.has(r.key) && prevNotes.has(r.key))   // việc mới của tuần này, có ghi chú ở tuần trước
rest  = data - carry
lô 1: rest.map(base)                                   // KHÔNG có trường ghi_chu -> giữ ghi chú đang có
lô 2: carry.map(r => ({ ...base(r), ghi_chu: prevNotes.get(r.key) }))
bỏ qua lô rỗng; lô nào lỗi -> dừng, "Lưu lỗi: …"
stale.length > 0 -> T4; lỗi -> "Đã nạp nhưng xóa việc cũ lỗi: …"
```
Lý do phải tách 2 lô: supabase-js điền `null` cho cột thiếu khi các dòng trong cùng lô có tập cột khác nhau. Gộp chung thì sẽ xóa mất ghi chú cũ.
Báo thành công: `✓ Tuần {tuan}: đã nạp {n} công việc[, mang sang {c} ghi chú từ tuần {before}][, xóa {s} việc không còn trong file].[ Bỏ qua (không có cột Đơn vị đầu mối): {sheets}.]`

`weekNum = t => { const [w, y] = t.split('/').map(Number); return y * 100 + w; }`
`normWeek = s => { const m = s.match(/^\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/); return m ? \`${+m[1]}/${m[2]}\` : null; }`

## 4. Bảng `profiles`
| Mã | Thao tác | Gọi chính xác | Vai trò |
|---|---|---|---|
| P1 | Hồ sơ của mình | `select('*').eq('id', uid).maybeSingle()` | mọi người |
| P2 | Danh sách người dùng | `select('*').order('created_at')`; chia thành `users = !pending` và `pendingUsers = pending` | admin (RLS: người khác chỉ thấy chính mình) |
| P3 | Đếm số chờ duyệt (badge) | `select('id', { count: 'exact', head: true }).eq('pending', true)` | admin |

Mọi thao tác ghi profiles đều đi qua Edge Function `admin-users` (§6). Web không ghi thẳng vào bảng.

## 5. Storage bucket `avatars` (private, 1 MB, jpeg/png/webp; ghi/xóa: chỉ admin)
| Mã | Thao tác | Gọi |
|---|---|---|
| S1 | Ký link xem | `storage.from('avatars').createSignedUrls(paths, 3600)`; chỉ ký những path chưa có link hoặc link đã hơn 50 phút; cache theo `path -> { url, at }`; khi tab hiện lại thì ký lại ảnh của mình nếu link đã cũ |
| S2 | Tải ảnh lên | `upload(\`${uid}/${Date.now()}.jpg\`, blob, { contentType: 'image/jpeg' })` rồi `admin-users {action:'update', id: uid, avatar_path: path}` |
| S3 | Xóa ảnh cũ | `remove([oldPath])` sau khi S2 thành công; lỗi thì bỏ qua |

Xử lý ảnh trước khi tải lên (`resizeImage`): chỉ nhận `image/(jpeg|png|webp)` ("Chỉ nhận ảnh JPG, PNG hoặc WEBP"), tối đa 10 MB ("Ảnh quá lớn (tối đa 10 MB)"). Cắt vuông ở giữa, thu về 256×256, `canvas.toBlob('image/jpeg', 0.85)`.
Khi không có ảnh: hiện chữ cái đầu của từ cuối trong `full_name || username || email`, viết hoa.

## 6. Edge Function `admin-users` (POST, cần JWT của Quản trị đang hoạt động)
Gọi bằng `functions.invoke('admin-users', { body })`. Khi có lỗi: lấy thông báo từ `(await error.context.json()).error`, nếu không đọc được thì dùng `error.message`, rồi throw.
| action | body | thành công | lỗi server chặn (thông báo tiếng Việt) |
|---|---|---|---|
| `create` | `{ action, username, password, full_name, role }` | `{ ok: true, id }` | username sai `^[a-z0-9][a-z0-9._-]{1,31}$`, mật khẩu < 8, trùng tên |
| `update` | `{ action, id, role? , username?, full_name?, active?, avatar_path? }` (chỉ gửi trường cần đổi) | `{ ok: true }` | tự hạ quyền, tự khóa, trùng tên, avatar_path không nằm trong `${id}/`, sửa OWNER_ID khi mình không phải chủ tài khoản |
| `approve` | `{ action, id, role }` | `{ ok: true }` | tài khoản không ở trạng thái chờ duyệt |
| `reset_password` | `{ action, id, password }` | `{ ok: true }` | mật khẩu < 8 |
| `delete` | `{ action, id }` (từ chối đăng ký cũng dùng action này) | `{ ok: true }` | tự xóa mình; server tự xóa thư mục ảnh |

## 7. Edge Function `register` (POST, ai cũng gọi được bằng khóa publishable)
- body: `{ full_name, password, avatar? }`. `avatar` là data URL `data:image/jpeg;base64,…` lấy từ `resizeImage` (JPEG 256px); chỉ gửi khi người dùng có chọn ảnh.
- thành công: `{ ok: true, username, avatarSaved }`. Server tự tạo tên đăng nhập (baolt, baolt1, …), tạo tài khoản `pending = true, active = false, role = viewer`.
- lỗi: 400 (dữ liệu sai), 413/429 (quá lớn / quá 10 lần mỗi IP mỗi giờ / quá 50 yêu cầu đang chờ), 503. Đọc thông báo giống §6.
- Web kiểm tra trước khi gửi: 2 ô mật khẩu phải khớp ("Hai lần nhập mật khẩu không khớp."); ảnh phải hợp lệ.
- Gửi xong: reset form, quay về form đăng nhập, điền sẵn ô tên đăng nhập = `data.username`, hiện thông báo: "✓ Đã gửi đăng ký. Tên đăng nhập của bạn: {username} (hãy ghi nhớ). Bạn đăng nhập được sau khi Quản trị duyệt." Nếu có ảnh mà `!avatarSaved` thì thêm " Ảnh đại diện chưa lưu được, Quản trị có thể thêm sau."

## 8. Realtime (chỉ khi `me.role === 'admin'`)
```
channel('dang-ky-moi').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, ({ new: n }) => …).subscribe()
```
- Mỗi sự kiện: làm mới badge (P3), đang ở trang Người dùng thì tải lại P2.
- Nếu `n.pending` và id này chưa báo lần nào -> toast "Có đăng ký mới: **{full_name || username} (@username)** đang chờ duyệt." kèm nút Xem (mở /users). Toast tự đóng sau 15 giây. Nếu tab đang ẩn và đã có quyền thông báo -> `new Notification('Báo cáo tuần — đăng ký mới', { body, tag: 'reg-' + id })`, bấm vào thì focus tab và mở /users.
- Xin quyền thông báo ở lần click đầu tiên sau khi đăng nhập, nếu `Notification.permission === 'default'`.
- Khi đăng xuất hoặc vai trò không còn là admin: `removeChannel`.

## 9. Hàm thuần dùng chung (port nguyên văn từ legacy/app.js)
- `makeUsername(fullName)`: NFD, bỏ dấu `[̀-ͯ]`, đ/Đ -> d, chữ thường, tách theo khoảng trắng, mỗi phần chỉ giữ `[a-z0-9]`. Kết quả = phần cuối + chữ cái đầu của các phần trước ("Lê Thái Bão" -> "baolt").
- `uniqueUsername(base, taken)`: base, base1, base2, …
- `genPw()`: 12 ký tự lấy ngẫu nhiên từ `abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789` bằng `crypto.getRandomValues`.
- `statusClass(s)`: chữ thường; chứa 'chậm' hoặc 'quá hạn' -> late; chứa 'chưa' -> todo; chứa 'hoàn thành' -> done; còn lại -> doing. Thứ tự kiểm tra phải giữ nguyên.
- `riskLevel(ratio)`: ≥ 0,2 -> Cao; ≥ 0,1 -> Trung bình; còn lại -> Thấp.
- Bộ phân loại Excel: xem plan.md, mục F-IMP.
