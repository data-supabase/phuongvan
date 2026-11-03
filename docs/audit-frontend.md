# Audit front-end: index.html

Phạm vi: đọc tĩnh toàn bộ `index.html` (3305 dòng). Chưa chạy trình duyệt và chưa đăng nhập thật. Mức độ: Cao / Trung bình / Thấp. Số dòng theo file hiện tại.

---

## 1. Lỗi logic, race, trạng thái cũ

### 1.1 [Cao] `load()` chỉ lấy tối đa 1000 dòng (L2845)
Kịch bản: `select('*')` không phân trang. PostgREST của Supabase mặc định cắt ở 1000 dòng. Mỗi tuần 300-2000 dòng thì chỉ 1-3 tuần là đã vượt. Vì `order('id')` tăng dần, tuần mới nhất bị cắt đầu tiên. Hậu quả:
- Tuần mới nạp không hiện.
- Khi nạp lại một tuần, `thisWeek` và `thisKeys` (L2913-2915) thiếu dòng. Dòng đã có bị coi là "mới", bị mang ghi chú từ tuần trước sang (`carry`, L2927) và upsert ghi đè ghi chú hiện có.
- Hộp xác nhận "Tuần đã có dữ liệu" không hiện.

Sửa (kiểm tra `max-rows` ở Supabase trước; dù đã tăng vẫn nên phân trang):
```diff
-      const { data, error } = await db.from('tasks').select('*').order('id');
+      const data = []; let error;
+      for (let from = 0; ; from += 1000) {
+        const r = await db.from('tasks').select('*').order('id').range(from, from + 999);
+        if (r.error) { error = r.error; break; }
+        data.push(...r.data);
+        if (r.data.length < 1000) break;
+      }
       if (error) { ...
```
Lâu dài: chỉ tải tuần đang chọn và danh sách tuần riêng (bảng hoặc view `distinct tuan`).

### 1.2 [Cao] Đăng xuất / hết phiên không dọn DOM và trạng thái (L2993-3000)
`showLogin` chỉ đặt `me=null; dbRows=[]; rows=[]` và ẩn `#app`. Phần còn lại vẫn nằm trong bộ nhớ hoặc DOM:
- `#drawer` và `#drawerBg` nằm ngoài `#app` (L2271-2281). Nếu drawer đang mở lúc phiên hết hạn (sự kiện `SIGNED_OUT`, L3166), lớp phủ và nội dung việc + ghi chú vẫn che lên màn hình đăng nhập. `#pwDlg` và `#toast` cũng vậy.
- `#list`, `#overview`, `#pStatus`, `#userList`, `#pendingList`, `#weekList` còn nguyên HTML. Người đăng nhập kế tiếp thấy dữ liệu người trước cho tới khi `load()` xong. `boot()` hiện `#app` trước khi `await load()` (L3020-3024).
- `#userMsg` còn dòng "Mật khẩu tạm: ..." (L3251). `#importMsg` còn nguyên.
- `colFilters`, `cat`, `sortBy`, `#q`, `week`, `weeks`, `users`, `pendingUsers`, `notified`, `avatarUrl` cũng không được xóa.

Sửa gọn nhất (máy dùng chung ở xưởng): tải lại trang sau khi đăng xuất.
```diff
-    $('logout').addEventListener('click', async () => { await db.auth.signOut(); showLogin('Đã đăng xuất.'); });
+    $('logout').addEventListener('click', async () => { await db.auth.signOut(); sessionStorage.setItem('flash', 'Đã đăng xuất.'); location.reload(); });
```
và trong `showLogin` đọc `sessionStorage.flash` làm `text` mặc định. Làm tương tự ở nhánh `SIGNED_OUT` (L3166). Nếu không muốn reload thì tối thiểu gọi `closeDrawer(); $('pwDlg').close(); $('toast').hidden = true;`, đặt `innerHTML = ''` cho các vùng trên, rồi reset `colFilters`/`cat`/`sortBy`/`q`.

### 1.3 [Trung bình] Lỗi mạng thoáng qua khi lấy hồ sơ làm đăng xuất người dùng (L3005-3013)
Nếu `profiles` trả `error` (mạng yếu, 5xx), code vẫn gọi `db.auth.signOut()` rồi hiện "Lỗi tải hồ sơ". Phiên bị hủy, công nhân phải đăng nhập lại ở chỗ sóng yếu. Chỉ nên signOut khi `!p` hoặc `!p.active`.
```diff
-      if (error || !p || !p.active) {
-        await db.auth.signOut();
-        return showLogin(error ? ...
+      if (error) return showLogin('Lỗi tải hồ sơ: ' + error.message); // giữ phiên để thử lại
+      if (!p || !p.active) {
+        await db.auth.signOut();
+        return showLogin(!p ? ... : ...);
```

### 1.4 [Trung bình] Đăng nhập có thể chạy `boot()` hai lần (L3027-3035)
`loginBtn` được bật lại ngay sau `signInWithPassword`, trước `await boot()` (có thêm 2 truy vấn và `load()`). Bấm hoặc Enter lần hai thì có hai `boot()` song song, hai `load()` và hai lần `watchRegistrations`. `onAuthStateChange` thì không gây boot hai lần (chỉ xử lý `SIGNED_OUT`).
```diff
-      $('loginBtn').disabled = false;
-      if (error) return ...
-      await boot();
+      if (error) { $('loginBtn').disabled = false; return ...; }
+      try { await boot(); } finally { $('loginBtn').disabled = false; }
```
Ngoài ra L3264 gọi cả `boot()` chỉ để đổi ảnh sidebar. Nên tách `renderMe()`.

### 1.5 [Trung bình] Ảnh đại diện hết hạn sau 1 giờ nhưng cache mãi (L2963-2969)
`avatarUrl` là Map path -> URL, không bao giờ hết hạn. App mở trên điện thoại hơn 1 giờ thì ảnh ở sidebar và `loadUsers` (L3207, bỏ qua path đã có trong cache) bị vỡ hình. `<img>` cũng không có `onerror`.
```diff
-    const avatarUrl = new Map();
+    const avatarUrl = new Map(); // path -> { url, exp }
+    const fresh = p => avatarUrl.get(p)?.exp > Date.now() + 60e3;
 ...
-      const need = [...new Set(paths.filter(p => p && !avatarUrl.has(p)))];
+      const need = [...new Set(paths.filter(p => p && !fresh(p)))];
 ...
-      (data || []).forEach(d => d.signedUrl && avatarUrl.set(d.path, d.signedUrl));
+      (data || []).forEach(d => d.signedUrl && avatarUrl.set(d.path, { url: d.signedUrl, exp: Date.now() + 3600e3 }));
 ...
-      const url = avatarUrl.get(u.avatar_path);
+      const url = avatarUrl.get(u.avatar_path)?.url;
```
Làm mới avatar sidebar khi tab hiện lại (`visibilitychange`). `URL.createObjectURL` ở L3050 và L3238 không `revokeObjectURL` (rò nhỏ).

### 1.6 [Trung bình] Mất ghi chú khi nhấn Esc lúc đang gõ (L2664, L2667, L2653)
Ghi chú chỉ lưu ở sự kiện `change` (khi blur). Esc gọi `closeDrawer()` đặt `hidden` lên drawer. Blur/change của textarea bị ẩn không được đảm bảo trước khi `openDrawer` lần sau thay `dBody.innerHTML`, khi đó chữ vừa gõ mất. Sửa: blur có chủ đích khi đóng, và chặn lỗi khi `rows` đã đổi.
```diff
     function closeDrawer() {
       if ($('drawer').hidden) return;
+      document.activeElement?.blur(); // kích hoạt 'change' lưu ghi chú khi drawer còn hiện
       $('drawer').hidden = ...
 ...
       const el = e.target, r = rows.find(x => x.id == el.dataset.id);
+      if (!r) return; // tuần đã đổi / dữ liệu đã nạp lại
```
Lưu ý `setWeek` gán `rows` mới trước khi gọi `closeDrawer()` (L2816 so với L2834). Nên đảo thứ tự: `closeDrawer()` trước, rồi mới gán `rows`.

### 1.7 [Trung bình] `statusClass` phân loại sai "Chưa hoàn thành" (L2402-2408)
Chuỗi chứa "hoàn thành" được trả `st-done` trước khi xét "chưa". "Chưa hoàn thành" bị đếm là Hoàn thành, làm sai KPI và Dashboard. Đổi thứ tự (xác nhận lại các giá trị tình trạng thật trong file Excel):
```diff
-      if (s.includes('hoàn thành')) return 'st-done';
       if (s.includes('chậm') || s.includes('quá hạn')) return 'st-late';
-      if (s.includes('chưa')) return 'st-todo';
+      if (s.includes('chưa') || s.includes('không')) return 'st-todo';
+      if (s.includes('hoàn thành')) return 'st-done';
       return 'st-doing';
```
Nhánh "Hoàn thành chậm" sẽ thành late. Hỏi nghiệp vụ nếu muốn tính là done.

### 1.8 [Trung bình] `uiDialog` dùng một `<dialog>` chung, không chịu được gọi chồng (L3075-3090)
Hai lời gọi chồng nhau (nhấn đúp "Nạp", `uiError` từ lưu ghi chú trong lúc hộp khác đang mở) ghi đè `onsubmit`/`onclick`/`oncancel` của lời gọi trước. Promise đầu không bao giờ resolve, `showModal()` lần hai có thể ném `InvalidStateError`. Cách ngắn nhất: xếp hàng.
```diff
+    let dlgChain = Promise.resolve();
-    function uiDialog(opts) { return new Promise(resolve => { ... }); }
+    const uiDialog = opts => (dlgChain = dlgChain.then(() => uiDialogNow(opts)));
+    function uiDialogNow({ ... }) { return new Promise(resolve => { ... }); } // thân hàm cũ
```
Đồng thời vô hiệu nút Nạp / Xóa tuần trong lúc xử lý. Hiện `importForm` (L2901) không khóa nút, nhấn đúp thì chạy hai lượt nạp song song.

### 1.9 [Thấp] Không tuần tự hóa `loadUsers()` và `load()` (L3201, L2843)
Mỗi thao tác duyệt/xóa tự gọi `loadUsers()` và sự kiện realtime `*` trên `profiles` (L3112-3114) gọi thêm một lần nữa, nên hai lượt chạy chồng và lượt cũ về sau có thể ghi đè lượt mới. Thêm token:
```js
let usersSeq = 0;
async function loadUsers() { const my = ++usersSeq; ...await...; if (my !== usersSeq) return; ... }
```
Làm tương tự cho `load()`. Realtime nên debounce 300ms (`refreshPendingBadge` là một truy vấn count cho mỗi event).

### 1.10 [Thấp] Kênh realtime
- `watchRegistrations` gỡ kênh cũ rồi tạo lại cùng tên `dang-ky-moi` mà không `await db.removeChannel(...)` (L3106). Hiếm khi ra lỗi nhưng nên `await`.
- `showLogin` đã gỡ kênh khi đăng xuất, nên không rò. Mỗi lần `boot()` lại thêm một listener `click` `{once}` xin quyền Notification (L3110), vô hại.
- Sự kiện DELETE có `new = {}`, đã được `n?.pending` xử lý đúng.

### 1.11 [Thấp] Lỗi khác
- L2608: `r.ket_luan.slice(0,60)` ném lỗi nếu `ket_luan` là null (dòng do API ghi trực tiếp). Dùng `(r.ket_luan || '').slice(0, 60)`.
- L2845-2846: khi `load()` lỗi chỉ bảng báo lỗi, Dashboard và `#weekList` vẫn skeleton mãi và không có nút "Thử lại". Thêm nút gọi lại `load()`.
- L2886: số "n việc" dùng `dbRows` (gồm cả dòng ẩn không có `units`), còn danh sách dùng `visible`, nên số có thể lệch.
- L2512-2524: `pointercancel` không gỡ listener `pointermove` và để lại class `drag`. Nên nghe cả `pointercancel`.
- L2929-2937: upsert nhiều lô rồi xóa không nằm trong transaction. Lỗi giữa chừng để tuần ở trạng thái nửa vời (thông báo đã có, nhưng nên chia lô 500 dòng).
- L2350: `crypto.subtle` chỉ có trên HTTPS hoặc localhost. Nếu có người mở bằng `http://ip-lan` thì nạp Excel lỗi. Hiện lỗi sẽ chỉ báo "Lỗi: ..." khó hiểu.

---

## 2. XSS

`esc()` (L2398) được áp dụng đúng cho mọi nội dung từ Excel: `noi_dung`, `ket_luan`, `tinh_hinh`, `kho_khan`, `thong_tin_cuoc_hop`, `sheet`, `ghi_chu`, `don_vi_*`, `thoi_han`, `tinh_trang`. Các thuộc tính `title=`, `aria-label=`, `data-go`, `data-tip`, `value=` đều dùng `esc`. Giá trị trong `esc` luôn nằm trong dấu nháy kép nên không cần escape `'`. `full_name`, `username`, `error.message` cũng được escape. `uiDialog`, `msg`, `textContent` an toàn. Tên sheet và tiêu đề Excel chỉ vào DB rồi hiển thị qua `esc`.

Còn các chỗ nội suy KHÔNG `esc` các giá trị đến từ DB (không phải từ lượt nạp của giao diện này, vì `tuan` qua `normWeek` chỉ gồm chữ số và `units` chỉ là 4 mã cố định). Một tài khoản nhập liệu gọi thẳng API Supabase bằng JWT của mình có thể ghi `tuan` hoặc `units` tùy ý:

### 2.1 [Cao] Stored XSS qua `tuan` và `units`, có thể leo thang lên Quản trị
Vị trí (không escape):
- L2413: `<span class="pill">${u}</span>` (từ `r.units`).
- L2440: `title="So với tuần ${prevWeek}: ..."` (chèn thuộc tính `" onmouseover=...`).
- L2451-2452, L2611, L2722: `${prevWeek}` (thân và thuộc tính `title`).
- L2824: `<option value="${v}">Năm ${v}</option>`.
- L2827: `Tuần ${x.split('/')[0]}`.
- L2767-2770: `${w}` trong cột xu hướng (hai chỗ).
- L3016: `class="role-tag ${p.role}"`.

Kịch bản: Nhập liệu ghi một dòng `tuan = '1/2026"><img src=x onerror=...>'`. Khi Quản trị mở Dashboard, script chạy với JWT của Quản trị và gọi `admin-users` để tạo hoặc nâng quyền. Sửa phía FE (nhỏ):
```diff
-const esc = s => (s ?? '').replace(...
+const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
```
rồi bọc `esc()` quanh toàn bộ các vị trí trên (và `${u}` ở L2413). Sửa phía DB bắt buộc (xem mục 3): `check (tuan ~ '^[0-9]{1,2}/[0-9]{4}$')` và `check (units <@ array['KT','CĐS','NCPT','ĐCM'])`.

### 2.2 [Trung bình] CDN không có SRI, không có CSP (L2294-2295, L8-11)
`supabase-js` và `xlsx` nạp từ jsDelivr, chạy cùng nguồn gốc với token phiên (localStorage). Thêm `integrity="sha384-..." crossorigin="anonymous"` cho cả hai, và `<meta http-equiv="Content-Security-Policy" ...>` giới hạn `script-src` về jsdelivr + `'unsafe-inline'`. Tốt hơn là tự host hai file này. xlsx 0.18.5 có CVE đã biết (prototype pollution CVE-2023-30533, ReDoS CVE-2024-22363). Mức rủi ro thấp vì file chỉ do Quản trị hoặc Nhập liệu nạp, nhưng nên nâng lên bản SheetJS mới.

---

## 3. Phân quyền chỉ có ở UI, bắt buộc kiểm ở server (chỉ liệt kê)

1. `data-roles` và `allowed()` (L2684, L2063, L2055) chỉ ẩn menu `import` và `users`. Cần RLS: `tasks` insert/delete chỉ admin và editor; `profiles` select toàn bộ chỉ admin.
2. `ensureLogin()` (L2862) kiểm `me.role` ở client. RLS phải chặn insert/update/delete của `tasks` theo `profiles.role` của người gọi, gồm cả `delete ... eq('tuan', w)` (L2893) và `upsert` (L2931).
3. Viewer được phép sửa `ghi_chu` (L2671). Cần quyền cột hoặc trigger chỉ cho phép đổi `ghi_chu` (và `updated_at`), không cho viewer đổi cột khác.
4. `me` chỉ nạp một lần ở `boot()` (L3014): tài khoản bị khóa hoặc hạ quyền vẫn dùng được JWT tới 1 giờ. RLS và Edge Function phải kiểm `profiles.active = true and pending = false` và vai trò hiện tại ở mỗi truy vấn, không dựa vào claim trong JWT.
5. Edge Function `admin-users` (L3188): xác thực người gọi là admin đang `active`; chặn tự xóa, tự khóa, tự hạ quyền, xóa admin cuối cùng (UI chỉ ẩn nút bằng `self ? ''`, L3222, và `disabled` select, L3215); kiểm `avatar_path` thuộc thư mục `uid/` của người đó.
6. Edge Function `register` (L3061) gọi không cần đăng nhập: ép `role=viewer`, `pending=true`; kiểm độ dài mật khẩu ≥ 8 (client chỉ có `minlength`), độ dài `full_name`, MIME và kích thước `avatar` (data URL), giới hạn tần suất / captcha.
7. Storage bucket `avatars`: chính sách upload chỉ vào `uid/*` của chính mình hoặc admin; không cho đọc chéo.
8. Ràng buộc DB cho `tuan` và `units` (mục 2.1), và unique `(tuan, key)` cho upsert.
9. Realtime `profiles`: chỉ admin nhận được sự kiện (đã ghi trong comment L3094, cần xác nhận lại bằng RLS).

---

## 4. Truy cập (accessibility)

| # | Mức | Vấn đề | Sửa |
|---|---|---|---|
| 4.1 | Trung bình | Drawer có `aria-modal="true"` nhưng không bẫy focus. Tab chạy ra bảng phía sau (L2272, L2650). | Khi mở: `document.querySelector('.app').inert = true`; khi đóng: `= false`. Drawer nằm ngoài `.app` nên dùng được. |
| 4.2 | Trung bình | 2000 hàng `tabindex="0"` (L2608) thành 2000 điểm Tab; hàng không có `role="button"`. | Chỉ để `tabindex="0"` ở hàng đầu hoặc dùng một ô "Xem" trong cột #. Tối thiểu thêm `role="button"`. |
| 4.3 | Trung bình | Input ảnh đại diện dùng `hidden` (L2016, L2230, L3212) nên không focus được bằng phím. | Dùng class `.sr-only` (position:absolute; clip) thay `hidden`, và cho `label` có `:focus-within` viền focus. |
| 4.4 | Trung bình | Biểu đồ (`data-go` trên `<span>`/`<tr>` ở L2740, 2746, 2761, 2769, 2777) chỉ dùng chuột. Tooltip chỉ ở `mousemove` (L2797), điện thoại và bàn phím không thấy. | Thêm `role="button" tabindex="0"` và `aria-label` bằng nội dung `data-tip`; ủy quyền thêm `keydown` Enter/Space cho `#v-dash`. Tooltip: nghe cả `focusin`. |
| 4.5 | Thấp | Popup lọc (L2542): `role="dialog"` không có tên, Tab ra ngoài được, đóng xong focus không về nút lọc. | `aria-label="Lọc cột ..."`; sau `closeFilter()` gọi `btn.focus()`. |
| 4.6 | Thấp | Esc đóng cả drawer phía sau khi `uiDlg` đang mở (L2583, L2664 là listener `document`). | Trong hai handler thêm `if (document.querySelector('dialog[open]')) return;`. |
| 4.7 | Thấp | `#uiInput` không có nhãn (L2289). | `aria-labelledby="uiMsg"`. |
| 4.8 | Thấp | Bảng không có `aria-sort`; trạng thái sắp xếp chỉ là mũi tên trong nút. | `th.setAttribute('aria-sort', ...)` trong `render()`. |
| 4.9 | Thấp | Focus ring bị `outline:none` ở `.search input:focus`, `.login-card input:focus`, `#uiInput:focus`, `.d-sec textarea:focus`, thay bằng `box-shadow` alpha .15 rất nhạt. | Bỏ `outline:none` hoặc tăng alpha lên .4. |
| 4.10 | Thấp | Tương phản: chữ `#0f172a` trên đoạn đỏ `--f-late` của thanh tiến độ ≈ 4.2:1 (L675-684) và dấu "—" ghi chú rỗng (`--line-2` trên trắng, L945) quá nhạt. Còn lại màu chữ chính đạt AA. | Dấu "—" dùng `--muted`; chữ trên nền đỏ dùng trắng đậm hoặc làm đậm `--f-late` nhẹ. |
| 4.11 | Thấp | `title` đang là cách duy nhất cho nút "Tạo" mật khẩu (L2241), `.rz` kéo cột chỉ dùng chuột/cảm ứng. | Thêm `aria-label`; chấp nhận không có phím cho resize hoặc thêm nút ←/→. |

Đã đúng: nhãn gắn với input (bọc label), `role="alert"` / `role="status"` cho thông báo, `aria-current` ở menu, `aria-label` cho nút icon, `<dialog>` native cho modal và Esc, trả focus về hàng khi đóng drawer, `prefers-reduced-motion`.

---

## 5. Hiệu năng với 300-2000 dòng

### 5.1 [Trung bình] Mỗi lần gõ ô tìm kiếm dựng lại toàn bộ (L2678, L2587-2623)
`$('q').addEventListener('input', render)` không debounce. `render()` dựng lại toàn bộ `<tbody>` (2000 hàng x 12 ô bằng `innerHTML`), rồi gọi thêm `renderOverview(rows)` và `renderDash()`, trong khi hai hàm này không phụ thuộc bộ lọc của Bảng. Sửa:
```diff
-    $('q').addEventListener('input', render);
+    let qT; $('q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(render, 150); });
```
và chuyển `renderOverview(rows)` cùng `renderDash()` ra khỏi `render()`, vào cuối `setWeek()` (dữ liệu chỉ đổi ở đó và sau `load()`). Khi đổi bộ lọc chỉ cần vẽ lại bảng.

### 5.2 [Trung bình] Render 2-3 lần cho mỗi lần điều hướng
L2460-2463, L2786-2793: `location.hash = '#table'; render();` rồi `hashchange` (L2702) lại `showView + render()`. Nhấp biểu đồ chạy 2-3 lần, riêng `setWeek` thêm một lần. Bỏ `render()` thủ công sau khi đổi hash (hashchange đã gọi), sau khi 5.1 xong thì rất rẻ.

### 5.3 [Thấp] Tính lại nặng mỗi hàng, mỗi lần
- `subUnits()` (4 regex `matchAll` + `isPhongKT`) chạy cho mỗi hàng ở `unitPills` (L2412) và `COLS.unit.get` (L2474), mỗi lần lọc hoặc vẽ. Lưu kết quả vào `r._subs` một lần ở `setWeek`.
- `passes()` đọc `$('q').value` cho mỗi hàng (L2488) và `join` + `toLowerCase` mỗi lần. Đọc `q` ngoài vòng lặp.
- Sắp xếp dùng `localeCompare(..., 'vi')` trong comparator (L2596, L2537). Dùng `const col = new Intl.Collator('vi'); ... col.compare(a, b)` và tính trước khóa sắp xếp.
- `renderOverview` có hàm `count` trùng `countBy` (L2430 so với L2707). Dùng `countBy`.
- Listener: tốt, không có listener theo hàng (ủy quyền ở `#list`). 2000 hàng ≈ 25-30k node, nhưng không cần ảo hóa nếu 5.1 xong. Nếu vượt ~3000 thì phân trang 200 dòng/trang.

### 5.4 [Thấp] Nạp Excel
`await sha256` tuần tự cho từng dòng (L2378) và `sheet_to_json` chạy trên luồng chính nên giao diện đứng vài giây. Chấp nhận được; gộp bằng `Promise.all` theo sheet nếu chậm. Tải tuần-một-lần ở 1.1 cũng giảm mạnh dung lượng đầu vào.

---

## 6. Mã thừa, CSS bị đè hoàn toàn

CSS (xóa an toàn, hoặc gộp vào quy tắc gốc):
- L89-90 `.side { background: var(--surface); border-right: 1px solid ... }`: bị L1861-1862 đè hoàn toàn. Gộp: giữ gradient và `border-right:0` ở khối gốc.
- L148 `.side a { color }`, L154-157 `.side a:hover { background; color }`, L159-163 phần `background`/`color` của `.side a[aria-current=page]`, L173 `background: var(--accent)` của `::before`: đều bị L1880-1896 đè. Chỉ giữ `font-weight:600`.
- L132-139 `.side .navlbl { color: var(--muted) }`: bị L1871 đè. L184 `.side .foot { color }` và `border-top` màu: bị L1898-1901 đè.
- L886-887 `.wrap thead th { background; color }` và phần màu của `border-bottom`: bị L1929-1932 đè.
- L1040-1050 `.fbtn:hover` và `.fbtn.on`, màu `.fbtn` (L1033): mọi `.fbtn` đều nằm trong `thead` nên chỉ `.wrap thead .fbtn*` (L1935-1948) còn tác dụng. L1146-1149 `.rz:hover, .rz.drag` cũng bị L1950-1953 đè (`.rz` chỉ nằm trong thead). Gộp lại một lần.
- L1979-1980 `#uiInput` (padding, border, radius, focus): trùng hoàn toàn `.dlg input` / `.dlg input:focus` ở L1486-1498.
- L1692-1694 `.avatar { overflow:hidden }` tách riêng: gộp vào L1565. Selector `img.avatar` (L1697) không dùng ở đâu.
- L357-359 `.kpi { transition }` tách rời: gộp vào L336. L1319-1320 `input[type=email]`, `input[type=password]` trong `.iform` không còn phần tử nào; chỉ giữ `#weekIn`.
- `.hb` trong L531, L538 không được dùng ở đâu (chỉ có `.stack span`, `.cbar span`).
- Khối `.wtable button.btn-primary` (L1956-1964): cần giữ, nhưng gọn hơn là đổi L1390 thành `.wtable button:not(.btn-primary)` rồi xóa khối đè.

Lưu ý khi xóa: `.brand .logo` gradient (L111) vẫn dùng cho màn hình đăng nhập, vì L1875 chỉ đè trong `.side`. Không xóa.

JS thừa:
- `c.sort ? c.sort(r) : ...` (L2595): không cột nào có `sort`. Rút gọn còn `colVals(sortBy.key, r)[0]`.
- `count` trong `renderOverview` (L2430) trùng `countBy` (L2707).
- Các `console.assert` tự kiểm (L2386-2392, 2716, 2810, 2959-2960, 3197) chạy mỗi lần mở trang. Có thể giữ cho dev, hoặc chuyển sau `if (location.hostname === 'localhost')`.
- `ensureLogin` được `await` (L2892, 2904) dù là hàm đồng bộ. Vô hại.

---

## 7. Giao diện 375px

1. [Trung bình] Thanh menu trên cùng (L194-241): logo + 4 liên kết (chữ không xuống dòng) + "Đổi mật khẩu" / "Đăng xuất" rộng quá 375px. `.foot` có `margin-left:auto` nhưng nằm cuối hàng cuộn ngang, nên nút **Đăng xuất / Đổi mật khẩu bị đẩy ra ngoài màn hình**, không có dấu hiệu cuộn. Tên và vai trò (`.me`) cũng bị ẩn. Sửa: trên ≤ 860px chỉ hiện icon cho liên kết (`.side a { font-size:0 } .side a svg{...}` hoặc ẩn chữ qua `span`), hoặc đưa Đăng xuất / Đổi mật khẩu vào cuối hàng cố định `position: sticky; right:0`.
2. [Trung bình] iOS Safari phóng to khi focus ô nhập vì cỡ chữ 14px (`button, input { font: inherit }`, L63-69). Thêm:
   ```css
   @media (max-width:860px){ input, select, textarea { font-size:16px; } }
   ```
3. [Thấp] `.wrap { max-height: calc(100vh - 170px) }` (L860) trên điện thoại: thanh menu sticky + tiêu đề + ô tìm kiếm đã vượt 170px, tạo hai vùng cuộn lồng nhau. Trên ≤ 860px dùng `max-height: 70vh` hoặc bỏ max-height và dùng `thead` sticky theo trang (`top: <chiều cao menu>`).
4. [Thấp] Bảng 12 cột rộng ≈ 2170px: chỉ cuộn ngang, chấp nhận theo yêu cầu. Chạm kéo cột (`.rz` rộng 7px) và nút lọc `.fbtn` (~20px) dưới ngưỡng 44px khó bấm. Tăng vùng chạm `@media (pointer:coarse) { .rz { width:16px } .fbtn { padding:8px } }`.
5. [Thấp] `.fpop` cao ≈ 420px không có `max-height`; điện thoại nằm ngang (cao 375px) bị cắt đầu. Thêm `max-height: calc(100vh - 16px); overflow: auto`.
6. [Thấp] Thẻ KPI 2 cột ở 375px (mỗi thẻ ≈ 165px) khá chật: nhãn "Đang thực hiện" xuống dòng. Chấp nhận được; nếu muốn thoáng, `@media (max-width:420px){ .overview { grid-template-columns: 1fr } }`.
7. Ổn: đăng nhập / đăng ký, `.dash` (min(100%,460px)), `.hero` một cột ≤ 600px, `.score` và `.wtable` cuộn ngang trong thẻ, drawer `min(560px,100vw)`, toast, dialog (`calc(100vw - 32px)`).

---

## Thứ tự nên làm
1. 1.1 (phân trang `load`), 2.1 (+ ràng buộc DB), 1.2 (dọn khi đăng xuất), mục 3 phía server.
2. 1.7 (phân loại trạng thái), 1.3, 1.5, 1.6, 7.1, 7.2.
3. 5.1/5.2 (debounce + tách render), a11y 4.1-4.4, rồi dọn CSS ở mục 6.

Không kiểm tra / còn giả định: chưa chạy trình duyệt, chưa thấy RLS / Edge Function / dữ liệu thật (các giá trị `tinh_trang`, `max-rows` của project), nên 1.1, 1.7 và mục 3 cần xác nhận phía Supabase.
