# Kế hoạch: Viết lại giao diện bằng React — "phẫu thuật thẩm mỹ" (02/11/2026)

## Giả định
- Repo không có `CLAUDE.md`. Vì vậy Definition of Done (DoD) lấy theo `.claude/agents/frontend.md`: `npm run lint && npm run typecheck && npm run build` phải pass, đủ 4 trạng thái (đang tải / lỗi / trống / có dữ liệu), dùng được ở khổ 375px, phần tử quan trọng có `data-testid`. Cộng thêm: không lệch so với checklist F-* bên dưới.
- Backend giữ nguyên (D-003). Hợp đồng gọi Supabase nằm ở `docs/api-contract.md`. Không có `src/types/database.ts`, kiểu dữ liệu viết tay ở `src/types/app.ts`.
- `legacy/` là chuẩn hành vi và chỉ để đọc. `tests/` hiện tại vẫn chạy trên legacy và phải giữ cho chúng tiếp tục chạy được.
- Tailwind 3.4 (vì cần `tailwind.config.ts`), React Router 6 với HashRouter (D-004), TanStack Query 5, supabase-js 2, xlsx 0.18.5 (D-006). Không thêm thư viện chart (D-005), store (D-007), zod hay bộ icon: form nhỏ nên validate tay, icon SVG thì chép từ legacy.
- Giao diện: tiếng Việt có dấu. Giữ nhận diện navy và font Be Vietnam Pro. Dashboard trông chỉn chu hơn kiểu "executive", hiệu ứng thống nhất (150/250 ms, tắt khi `prefers-reduced-motion`).
- Không có git. Mỗi task chỉ được sửa những file nó sở hữu (cột "Đầu ra"). Cần sửa file của task khác thì ghi vào báo cáo cho Lead.
- File stub: T-102 tạo sẵn các file stub ghi ở cột Đầu ra của các task trang. Stub chỉ có export đúng tên và props như hợp đồng bên dưới. Từ khi task trang bắt đầu, file đó thuộc task trang.

## Hợp đồng nội bộ giữa các task (chữ ký cố định để làm song song)
- `src/lib/supabase.ts`: `export const db`
- `src/lib/status.ts`: `type Cat = 'done'|'doing'|'late'|'todo'`, `CATS: [Cat, label][]` (thứ tự Hoàn thành, Đang thực hiện, Triển khai chậm, Chưa triển khai), `statusClass(s): Cat`, `countBy(rows): Record<Cat, number>`, `pctOf(a,b)`, `riskLevel(ratio): ['hi'|'mid'|'lo', label]`
- `src/lib/week.ts`: `weekNum`, `normWeek`
- `src/lib/units.ts`: `UNITS`, `UNIT_RX`, `PHONG_KT`, `matchUnits(lead)`, `subUnits(lead)`. File này không import xlsx.
- `src/lib/classifier.ts`: `classifyWorkbook(wb): Promise<{ rows: ClassifiedRow[]; skipped: string[] }>`. Import xlsx tĩnh; trang Nạp tải file này bằng `import()`.
- `src/lib/username.ts`: `makeUsername`, `uniqueUsername`, `loginEmail`, `genPw`, `AUTH_DOMAIN`, `OWNER_ID`, `ROLE_LABEL`
- `src/lib/avatar.ts`: `resizeImage(file, size=256): Promise<Blob>`, `toDataUrl(blob)`, `signAvatars(paths)`, `avatarUrl(path)`, `uploadAvatar(uid, file, oldPath?)`
- `src/lib/adminCall.ts`: `adminCall(body)`. Có lỗi thì throw `Error` với thông báo lấy từ server.
- `src/auth/AuthProvider.tsx`: `useAuth() -> { me: Profile|null, phase: 'loading'|'login'|'ready', message, canRetry, retry(), signIn(identifier, pw): Promise<string|null /*lỗi đã dịch*/>, signOut(), refreshMe(), setMessage(text, ok?) }`
- `src/state/week.tsx`, `src/state/tableState.tsx`: xem D-007.
- `src/hooks/useTasks.ts`: query key `['tasks']`, tải hết bằng range (contract T1).
- `src/hooks/useProfiles.ts`: query key `['profiles']` -> `{ users, pendingUsers }`; ký link ảnh xong mới trả về.
- `src/hooks/usePendingCount.ts`: query key `['pendingCount']`.
- UI (T-101): `Button`, `Input`, `Select`, `Textarea`, `Card`, `Modal`, `useDialog() -> { confirm, prompt, alert, error }` (giống uiDialog: `{title,message,input,ok,cancel,danger,needs}`, có hàng đợi, Esc = hủy), `useToast() -> toast(content, { action?, duration? })`, `Skeleton`, `Avatar({ user, size })`, `EmptyState`, `ErrorState({ message, onRetry })`, `StatusPill({ text })`, `Pill`, `Tooltip` (dùng `data-tip` cho toàn app, hoặc component), `StackBar({ segments: { value, color, tip, onClick }[] })`.
- `src/components/shared/UnitPills.tsx` (T-104): `<UnitPills units lead />` (đã đổi từ `task`, xem D-010; mọi chỗ hiện đơn vị phải truyền `lead={r.don_vi_dau_moi}`), hiện tên đơn vị cấp 1 và nhãn cấp 2 nhạt hơn bên dưới.
- `useWeek().setWeek(w)` (D-010): lưu lựa chọn "dính"; nếu `w` chưa có trong `weeks` thì tạm hiện tuần mới nhất, khi dữ liệu tải lại có `w` thì tự chuyển sang `w`. `setWeek('')` = tuần mới nhất. Trang Nạp dựa vào hành vi này.
- AppShell phải giữ `data-testid="app-shell"` ở phần tử gốc: TaskDrawer đặt `inert` lên phần tử này (D-010).
- `src/components/shared/PasswordModal.tsx` (T-103): `<PasswordModal title open onClose onSubmit(pw) />`, kiểm tra 2 lần nhập phải khớp, lỗi hiện ngay trong modal.
- `src/components/drawer/TaskDrawer.tsx` (T-108): `<TaskDrawer task: Task|null onClose />`

## Checklist tương đương tính năng (F-*) — phải giữ, tham chiếu `legacy/app.js:dòng`
**Xác thực (T-102, T-105)**
- F-AUTH-1: đăng nhập bằng tên đăng nhập hoặc email (`loginEmail`). Thông báo lỗi dịch sang tiếng Việt (banned / invalid login). Nút bị khóa khi đang gửi. (780-790)
- F-AUTH-2: luồng boot: lỗi hồ sơ -> nút Thử lại và giữ phiên; pending / không có hồ sơ / đã khóa -> signOut kèm thông báo riêng cho từng trường hợp; boot không chạy chồng. (751-778)
- F-AUTH-3: đăng ký: xem trước tên đăng nhập (`makeUsername`, chỉ đọc, "—" khi rỗng); chọn ảnh có xem trước; 2 mật khẩu phải khớp, tối thiểu 8 ký tự; gọi `register`; báo thành công kèm username; điền sẵn ô đăng nhập; báo khi ảnh chưa lưu được. (793-825)
- F-AUTH-4: đăng xuất hoặc hết phiên -> flash message + reload (D-008). Flash hiện trên màn đăng nhập. (734-749, 923)
- F-AUTH-5: đổi mật khẩu của mình từ sidebar, qua PasswordModal. (938-942)

**Khung và tuần (T-102)**
- F-SHELL-1: sidebar navy gồm logo/brand, menu Dashboard, Bảng công việc, Nạp dữ liệu (admin, editor), Người dùng (admin, có badge số chờ duyệt); thẻ "tôi" có avatar, tên, nhãn vai trò, @username; nút Đổi mật khẩu và Đăng xuất; `aria-current` ở mục đang mở. ≤860px thì sidebar thành thanh ngang ở trên.
- F-SHELL-2: chặn route theo vai trò; vào route không đủ quyền thì về Dashboard; hash cũ được chuyển sang route mới (D-004). Tiêu đề trang: Dashboard / Bảng công việc / Nạp dữ liệu / Người dùng.
- F-WEEK-1: tuần = các giá trị `tuan` phân biệt của dòng có units, sắp theo `weekNum`. Mặc định là tuần mới nhất; sau khi nạp hoặc tải lại thì giữ tuần đang xem nếu tuần đó còn. (574-575)
- F-WEEK-2: ô chọn Năm (giảm dần), ô chọn Tuần trong năm đó (giảm dần), nút trước/sau (bị khóa ở hai đầu). Đổi năm thì mở tuần mới nhất của năm đó. Tiêu đề hiện tuần và "· cập nhật HH:mm dd/MM/yyyy" (lấy updated_at lớn nhất). Ẩn bộ chọn tuần ở trang Nạp và Người dùng. (526-557)
- F-WEEK-3: `prevWeek` = tuần liền trước trong danh sách; `prevByKey` = Map key -> dòng của tuần trước. Đổi tuần thì đóng drawer (để ghi chú đang gõ kịp lưu) và đóng popover lọc.
- F-SHELL-3: realtime đăng ký mới, toast 15 giây có nút Xem, thông báo trình duyệt khi tab ẩn, mỗi id chỉ báo một lần, xin quyền ở lần click đầu tiên, gỡ kênh khi đăng xuất. (851-893, contract §8)
- F-SHELL-4: làm mới link ảnh của mình khi tab hiện lại (`visibilitychange`). (703-710)

**Dashboard (T-106, T-107)** — chỉ tính trên `rows` của tuần đang xem, không chịu ảnh hưởng của bộ lọc ở Bảng
- F-DASH-1: 4 thẻ KPI theo CATS: icon, nhãn, số, %, thanh %, chip so với tuần trước (▲n / ▼n / =). Chip màu xanh/đỏ theo GOOD_UP: done tăng là tốt; late/todo tăng là xấu; doing trung tính. Tooltip "So với tuần X: n". Dòng "Tổng: N công việc · tuần X: M". Bấm thẻ -> `drill({ cat })`. (140-174)
- F-DASH-2: Tiến độ tổng thể: % hoàn thành (done/total) với trend tính bằng "điểm %"; "Cần chú ý" = late + todo, có trend theo số việc (tăng là xấu); các con số bấm được (cat done/late/todo); thanh xếp chồng ghi nhãn % khi đoạn ≥ 8%; chú thích có số lượng. Trend chỉ hiện khi có tuần trước. (434-456)
- F-DASH-3: bảng "Đơn vị cần chú ý": các UNITS có ít nhất một việc; sắp theo tỷ lệ chậm giảm dần, hòa thì theo số việc chậm giảm dần; cột Đơn vị, Số việc, Hoàn thành (thanh nhỏ + %), Chậm (n + %), Chưa TK, Rủi ro (riskLevel: ≥20% Cao, ≥10% Trung bình). Bấm dòng -> `drill({ unit, cat: 'late' })`. (458-468)
- F-DASH-4: thanh xếp chồng theo đơn vị (4 UNITS, kể cả đơn vị có 0 việc), chiều rộng tỉ lệ với đơn vị nhiều việc nhất, có số tổng, tooltip "{u} · {nhãn}: n (p%)", bấm -> `drill({ unit, cat })`. (471-477)
- F-DASH-5: xu hướng 8 tuần gần nhất (trên mọi dòng có units): cột xếp chồng, cao tối đa 90%, có tổng trên đầu cột, nhãn tuần, tô đậm tuần đang xem. Bấm -> `drill({ week, cat })`, đổi tuần trước rồi mới lọc. (478-485)
- F-DASH-6: top 8 cuộc họp có nhiều việc chậm nhất; chuỗi rỗng thì "Tuần này không có việc triển khai chậm."; bấm -> `drill({ meet, cat: 'late' })`, meet đã gộp khoảng trắng. (486-493, 505)
- F-DASH-7: tuần không có dữ liệu thì hiện "Chưa có dữ liệu." ở mọi khối. Tooltip đi theo con trỏ và không tràn ra ngoài màn hình. Thêm mới: skeleton khi đang tải.

**Bảng (T-107)**
- F-TBL-1: cột theo thứ tự: # · Thông tin cuộc họp · Tên công việc · Nội dung kết luận · Tình hình thực hiện · Đơn vị phụ trách · Đơn vị phối hợp · Deadline · Trạng thái · Khó khăn, kiến nghị · Từ sheet · Ghi chú. Độ rộng mặc định 52/160/210/300/300/130/130/130/180/220/160/200 px. (index.html:182-208)
- F-TBL-2: hiện đầy đủ nội dung ô (`white-space: pre-line`, không cắt bớt); header navy dính trên cùng trong vùng cuộn; Khó khăn tô màu cảnh báo; Tên công việc rỗng hiện "(không ghi)"; nhãn "Mới" khi có prevWeek mà key không có ở tuần trước; Ghi chú rỗng hiện "—"; Trạng thái là StatusPill; Đơn vị dùng UnitPills, tooltip = don_vi_dau_moi.
- F-TBL-3: tìm kiếm trong noi_dung, ket_luan, tinh_hinh, kho_khan (chữ thường, includes), debounce 150 ms. Đếm "x / y công việc". Không có dòng nào thì "Không có công việc phù hợp với bộ lọc."
- F-TBL-4: lọc cột kiểu Excel cho 11 cột (trừ #): giá trị đã gộp khoảng trắng, rỗng thì là "(Trống)"; danh sách chỉ lấy từ các dòng đang qua mọi bộ lọc khác + cat; giá trị đang chọn vẫn hiện dù đếm được 0; sắp `localeCompare('vi')` với (Trống) ở cuối; mỗi giá trị có số đếm; cột Đơn vị hiện dạng cây (UNITS rồi đến "└ cấp 2"; chọn KT là khớp cả việc cấp 2); ô tìm trong popover; (Chọn tất cả) chỉ áp cho các giá trị đang hiện; nút Sắp xếp A→Z / Z→A; chỉ có **Hủy** và **OK**. Bấm OK khi đang gõ tìm thì chỉ giữ những giá trị đang hiện và được tick; giữ hết thì bỏ bộ lọc. Bấm ra ngoài hoặc Esc thì đóng. Popover không tràn màn hình. Nút phễu sáng lên khi đang lọc hoặc sắp theo cột đó, kèm ↑/↓. (178-297)
- F-TBL-5: một dòng qua bộ lọc khi BẤT KỲ giá trị nào của nó nằm trong tập đã chọn. Sắp theo giá trị đầu tiên, `localeCompare('vi')`.
- F-TBL-6: chip "Trạng thái: {nhãn} ✕" (bấm để bỏ cat). Nút "Xóa lọc" bỏ hết filter, sort, cat, q; chỉ hiện khi đang có ít nhất một trong số đó.
- F-TBL-7: kéo đổi độ rộng cột (tối thiểu 60 px; độ rộng bảng = tổng các cột, table-layout fixed); lưu `localStorage['colWidths.v5']` là mảng 12 chuỗi "Npx". Giữ đúng key và định dạng để người dùng không mất độ rộng đã chỉnh. (209-237)
- F-TBL-8: bấm dòng (khi không đang bôi đen chữ) hoặc nhấn Enter/Space -> mở drawer; dòng đang mở được tô sáng; đóng drawer thì focus trở lại dòng đó.
- F-TBL-9: ở 375px bảng cuộn ngang trong khung, trang không bị cuộn ngang.

**Drawer (T-108)**
- F-DRW-1: trượt vào từ bên phải, có nền mờ; tiêu đề gồm cuộc họp và tên việc ("(Không ghi tên công việc)" khi rỗng); khối meta: Trạng thái, Deadline, Đơn vị phụ trách (pills + chuỗi gốc), Đơn vị phối hợp; các mục Nội dung kết luận / Tình hình thực hiện / Khó khăn (kiểu cảnh báo), chỉ hiện khi có nội dung; chân: "Từ sheet: … · Tuần …". (337-363)
- F-DRW-2: Ghi chú sửa được với MỌI vai trò, kể cả viewer. Tự lưu khi ô mất focus/change (T2). Trạng thái "Đang lưu…" rồi "✓ Đã lưu". Lỗi thì hiện modal lỗi và trả lại giá trị cũ. Đóng drawer hoặc đổi tuần thì lưu phần đang gõ trước. Cập nhật cache để ô Ghi chú trong bảng đổi ngay. (379-391)
- F-DRW-3: bẫy focus (phần nền phía sau `inert`), Esc đóng (trừ khi đang mở modal), nút đóng nhận focus khi mở.

**Nạp dữ liệu (T-109)** — chỉ admin, editor
- F-IMP-1: bộ phân loại port NGUYÊN VĂN logic `legacy/app.js:1-95` sang `src/lib/units.ts` + `src/lib/classifier.ts` (T-104): SKIP_SHEETS, NB/NA (ranh giới từ Unicode, có lookbehind), UNIT_RX (cờ `iu`), FIELDS (tìm cột đầu tiên khớp, không ghi đè), LEAD_FALLBACK (chỉ dùng khi không có cột "đầu mối"), `norm` (NFC, NBSP -> dấu cách, gộp space/tab, trim; giữ đúng ký tự NBSP ở dòng 22), `hdr`, PHONG_KT/isPhongKT, cleanLead, matchUnits, SUB_RX (cờ `giu`, ký tự `›` U+203A), subUnits, meetingName, tìm dòng header trong 15 dòng đầu, `sheet_to_json({header:1, defval:null, raw:false, blankrows:true})`, điền xuống ô gộp dọc chỉ cho cột đầu mối và chỉ vào ô null nằm dưới header, bỏ dòng không có đầu mối hoặc không có (nội dung hoặc kết luận), chỉ lấy dòng có units, `key = sha256hex([sheet.trim(), noi_dung, ket_luan, don_vi_dau_moi].join('|'))`, gộp dòng trùng bằng Map theo key (dòng sau thắng). Key phải giống legacy từng byte, nếu không sẽ mất ghi chú mang sang tuần sau. Mọi console.assert ở dòng 98-104 chuyển thành unit test (tester).
- F-IMP-2: chọn file `.xlsx,.xlsm,.xls`; tên file khớp `/Tu[aầ]n\s*(\d{1,2})[.\-_ /](\d{4})/i` thì điền sẵn tuần (vẫn sửa được); tuần không hợp lệ thì báo "Nhập số tuần dạng 45/2026."; trạng thái "Đang đọc và phân loại…"; không có dòng nào thì báo không tìm thấy việc của KT/CĐS/NCPT/ĐCM; nút bị khóa khi đang chạy.
- F-IMP-3: quy tắc nạp (contract §3.1): modal xác nhận khi tuần đã có dữ liệu, 2 lô upsert, xóa stale chỉ với dòng có units, báo kết quả kèm số ghi chú mang sang, danh sách sheet bỏ qua. Xong thì chuyển sang xem tuần vừa nạp.
- F-IMP-4: danh sách tuần đã nạp (mới nhất ở trên): Tuần, Số việc, Có ghi chú, Nạp lúc, nút **Xem** (đặt tuần và mở Dashboard) và **Xóa** (modal nguy hiểm phải gõ đúng số tuần, kiểm lại bằng `normWeek`, sau đó T5 rồi tải lại; xóa đúng tuần đang xem thì về tuần mới nhất). Có dòng tóm tắt "N tuần dữ liệu · mới nhất X".
- F-IMP-5: kiểm tra quyền ở web ("Chỉ Quản trị và Nhập liệu được nạp hoặc xóa dữ liệu.").

**Người dùng (T-110, T-111)** — chỉ admin
- F-USR-1: tạo tài khoản: chọn ảnh có xem trước; Họ tên tự sinh tên đăng nhập (uniqueUsername so với danh sách hiện có) cho tới khi admin tự sửa ô tên; tên luôn viết thường; mật khẩu tạm có nút sinh ngẫu nhiên (genPw); chọn vai trò. Kiểm tra ảnh trước khi tạo, `create`, rồi upload ảnh (ảnh lỗi thì vẫn coi là tạo thành công, kèm ghi chú). Kết quả hiện cố định (KHÔNG tự tắt): "✓ Đã tạo {u} ({vai trò}). Tên đăng nhập · Mật khẩu tạm: … — gửi riêng cho người dùng." Reset form. (985-1012)
- F-USR-2: danh sách (không gồm người chờ duyệt): avatar (bấm để đổi ảnh, trừ chủ tài khoản khi mình không phải chủ), tên + nhãn "Bạn" / "Quản trị cao nhất", @username, chọn vai trò (bị khóa với chính mình hoặc chủ tài khoản; lỗi thì trả lại giá trị cũ), trạng thái Hoạt động / Đã khóa (dòng mờ đi), ngày tạo dd/MM/yyyy. (966-983)
- F-USR-3: thao tác: Sửa tên (prompt), Đổi tên ĐN (prompt điền sẵn tên gợi ý; nếu đổi của chính mình thì báo tên đăng nhập mới), Đặt lại mật khẩu (PasswordModal), Khóa (có xác nhận) / Mở khóa, Xóa (modal nguy hiểm phải gõ đúng username). Không hiện các nút sửa với chủ tài khoản khi mình không phải chủ; không hiện Khóa/Xóa với chính mình. Đổi ảnh của chính mình thì cập nhật avatar ở sidebar (`refreshMe`). (1031-1056)
- F-USR-4: thẻ chờ duyệt (ẩn khi không có ai): avatar, tên, @username, thời điểm đăng ký (requested_at hoặc created_at), chọn vai trò (mặc định Xem), Duyệt (`approve`), Từ chối (xác nhận rồi `delete`). Badge và danh sách cập nhật theo realtime. (886-922)

**Chung (mọi task)**
- F-UI-1: không dùng alert/confirm/prompt của trình duyệt, chỉ dùng `useDialog`.
- F-UI-2: không đưa HTML thô từ dữ liệu vào trang (React tự escape; cấm `dangerouslySetInnerHTML`).
- F-UI-3: ngày giờ theo `vi-VN`, múi giờ Asia/Ho_Chi_Minh; số theo `Intl.NumberFormat('vi-VN')`.
- F-UI-4: label gắn với input; nút chỉ có icon thì phải có `aria-label`; focus-visible rõ; tương phản đủ.

## Task
| ID | Agent | Mô tả | Đầu vào | Đầu ra (file sở hữu) | Phụ thuộc | Trạng thái |
|----|-------|-------|---------|----------------------|-----------|------------|
| T-101 | frontend | Dựng khung dự án + design tokens + bộ UI. Script `dev/build/preview/lint/typecheck/test` (vitest, include `tests/react/**/*.test.ts`). Token trong tailwind.config: navy 900/800/700 (#0f2a4a/#15365f/#1e3a5f), bg/surface/line/text/muted, accent, status bg/text/fill (style.css:3-31), radius, shadow, font Be Vietnam Pro (400–800), thời lượng hiệu ứng. `.env` + `.env.example` theo contract §0. Lib status/format. Kiểu dữ liệu. Toàn bộ `components/ui` (theo hợp đồng nội bộ) + trang `/__ui` chỉ có khi dev để xem thử | legacy/style.css, api-contract §0-1 | package.json, package-lock.json, vite.config.ts, tsconfig*.json, tailwind.config.ts, postcss.config.js, eslint.config.js, index.html (gốc), .env, .env.example, src/main.tsx, src/index.css, src/vite-env.d.ts, src/lib/supabase.ts, src/lib/format.ts, src/lib/status.ts, src/types/app.ts, src/components/ui/** | — | Xong |
| T-102 | frontend | Khung app: QueryClient, HashRouter + chặn theo vai trò + chuyển hash cũ, AuthProvider (boot đúng contract §2, flash, khóa chạy chồng, onAuthStateChange), AuthGate, AppShell/Sidebar/Header/WeekNav (responsive), WeekProvider, TableStateProvider (drill), useTasks, lib/week. Tạo stub cho mọi file trang (ghi ở cột Đầu ra của T-105..T-111) | T-101, D-004, D-007 | src/App.tsx, src/router.tsx, src/auth/**, src/layout/**, src/state/**, src/hooks/useTasks.ts, src/lib/week.ts (+ các stub, giao lại cho task trang) | T-101 | Xong |
| T-103 | frontend | Phần dùng chung cho người dùng: lib username/avatar/adminCall, useProfiles, usePendingCount, useRegistrationWatcher (contract §8; gắn vào AppShell qua một dòng `<RegistrationWatcher/>` mà T-102 đã chừa sẵn), PasswordModal + nút Đổi mật khẩu (F-AUTH-5), avatar ở sidebar + làm mới khi tab hiện lại | T-102, contract §4-8 | src/lib/username.ts, src/lib/avatar.ts, src/lib/adminCall.ts, src/hooks/useProfiles.ts, src/hooks/usePendingCount.ts, src/realtime/**, src/components/shared/PasswordModal.tsx | T-102 | Xong |
| T-104 | frontend | Port bộ phân loại NGUYÊN VĂN (F-IMP-1), chỉ thêm kiểu TS: chép dòng 1-95 rồi tách thành units.ts / classifier.ts; không "dọn dẹp" regex; kiểm hex ký tự NBSP và `›`. Viết UnitPills | legacy/app.js:1-127 | src/lib/units.ts, src/lib/classifier.ts, src/components/shared/UnitPills.tsx | T-101 (chạy song song với T-102) | Xong |
| T-105 | frontend | Màn đăng nhập/đăng ký (F-AUTH-1..4): hai form chuyển qua lại, nút Thử lại, thông báo ok/lỗi, avatar picker, xem trước username; bố cục 2 cột kiểu thương hiệu navy, ở mobile còn 1 cột | T-102, T-103 | src/pages/LoginPage.tsx, src/components/auth/** | T-103 | Xong |
| T-106 | frontend | Dashboard phần 1: bố cục trang, thẻ KPI (F-DASH-1), Tiến độ tổng thể (F-DASH-2), Đơn vị cần chú ý (F-DASH-3), skeleton/trống/lỗi; ghép 3 chart của T-107 vào trang | T-102 | src/pages/DashboardPage.tsx, src/components/dashboard/*.tsx, src/components/dashboard/stats.ts | T-102 | Xong |
| T-107a | frontend | Dashboard phần 2: UnitBars (F-DASH-4), WeekTrend (F-DASH-5), LateMeetings (F-DASH-6); dùng StackBar/Tooltip, có hiệu ứng tăng dần | T-102 | src/components/dashboard/charts/** | T-102 | Xong |
| T-107 | frontend | Trang Bảng (F-TBL-1..9): cột, lọc/sắp kiểu Excel, tìm kiếm, chip, xóa lọc, kéo đổi độ rộng, mở drawer. Logic lọc thuần đặt ở `filtering.ts` | T-102, T-104 | src/pages/TablePage.tsx, src/components/table/**, src/hooks/useColumnWidths.ts | T-102, T-104 | Xong |
| T-108 | frontend | TaskDrawer (F-DRW-1..3) + useUpdateNote (T2, cập nhật cache `['tasks']`) | T-102, T-104 | src/components/drawer/**, src/hooks/useUpdateNote.ts | T-102, T-104 | Xong |
| T-109 | frontend | Trang Nạp dữ liệu (F-IMP-2..5). Viết `importPlan.ts` thuần: `planImport(data, tuan, dbRows, weeks) -> { stale, carry, rest, before, needsConfirm }` để tester test được; mutation T3/T4/T5; `import()` động classifier | T-102, T-104, contract §3.1 | src/pages/ImportPage.tsx, src/components/import/**, src/lib/importPlan.ts, src/hooks/useImportWeek.ts, src/hooks/useDeleteWeek.ts | T-102, T-104 | Xong |
| T-110 | frontend | Trang Người dùng phần 1: bố cục trang, bảng người dùng + thao tác (F-USR-2, F-USR-3), bảo vệ chủ tài khoản ở web; ghép CreateUserForm và PendingList vào trang | T-103 | src/pages/UsersPage.tsx, src/components/users/UserTable.tsx, src/components/users/UserActions.tsx, src/hooks/useUserActions.ts | T-103 | Xong |
| T-111 | frontend | Trang Người dùng phần 2: CreateUserForm (F-USR-1), PendingList (F-USR-4) | T-103 | src/components/users/CreateUserForm.tsx, src/components/users/PendingList.tsx | T-103 | Xong |
| T-112 | tester | (1) vitest `tests/react/`: chuyển hết console.assert của legacy và unit.test.js/fixes.test.js sang test cho TS (statusClass, riskLevel, makeUsername, uniqueUsername, loginEmail, normWeek, weekNum, genPw, matchUnits, subUnits); golden: `classifyWorkbook(week44.xlsx)` phải đúng 215 dòng, khớp `tests/golden-week44.json` từng trường và từng key; test `planImport` (dòng ẩn không bao giờ vào stale, quy tắc carry, lô 1 không có trường ghi_chu). (2) `tests/react-smoke.test.js` (node:test + playwright có sẵn trong tests/): serve `dist/` (sau `npm run build`), giả Supabase giống smoke.test.js; chạy ở 1280 và 375px: đăng nhập -> dashboard -> bảng, phễu lọc Hủy/OK, mở drawer + lưu ghi chú với vai trò viewer, chặn route theo vai trò, không lỗi console, không có request ra ngoài. (3) chạy cả test của legacy. Cập nhật test-report | T-101..T-111 | tests/react/**, tests/react-smoke.test.js, tests/package.json, docs/test-report.md | T-101..T-111 | Đang làm (vitest 3 file pass; golden TS ở tests/classify-ts.test.js pass; E2E tests/e2e-react đang viết) |
| T-113 | lead | Review: so với api-contract + checklist F-*, chạy lint/typecheck/build/test, kiểm 375px, lập danh sách lỗi Cao/TB/Thấp | toàn bộ | docs/plan.md, docs/decisions.md | T-112 | Xong |
| T-114a | frontend | Sửa review nhóm Nạp: R-1, R-2, R-9 (xem "Kết quả review T-113") | R-* | src/components/import/ImportForm.tsx, src/components/import/WeekList.tsx | T-113 | Chờ |
| T-114b | frontend | Sửa review nhóm Bảng/Dashboard: R-4, R-7, R-8, R-12 | R-* | src/hooks/useColumnWidths.ts, src/pages/TablePage.tsx, src/state/tableState.tsx, src/components/dashboard/charts/WeekTrend.tsx | T-113 | Chờ |
| T-114c | frontend | Sửa review nhóm Khung/Đăng nhập: R-3, R-5, R-6, R-10, R-11 | R-* | src/layout/Sidebar.tsx, src/auth/AuthProvider.tsx, src/components/auth/LoginForm.tsx, src/components/auth/RegisterForm.tsx, src/lib/adminCall.ts, src/router.tsx | T-113 | Chờ |

T-114a/b/c sửa các file không giao nhau nên chạy song song được. Xong thì tester chạy lại E2E (375px + desktop).

## Kết quả review T-113 (02/11/2026)
Đã chạy: `npm run typecheck` pass · `npm run lint` pass · `npm run build` pass (cảnh báo chunk chính 537 kB / 157 kB gzip; xlsx tách riêng 429 kB, chỉ tải ở trang Nạp) · `npx vitest run` 22/22 pass · `tests/` legacy + `classify-ts.test.js` 24 pass, 1 todo (golden TS khớp 215 dòng/key). Đo 375px bằng Playwright (Supabase giả) trên dist.
Đã đạt: lô upsert 2 lần (lô 1 không có `ghi_chu`), carry, stale chỉ dòng có units, xóa tuần T5 + gõ xác nhận + `normWeek`; viewer lưu được ghi chú, cập nhật cache, flush khi đóng/đổi tuần, không ghi gì khi render/mount; không có service_role, `dangerouslySetInnerHTML`, `innerHTML`, alert/confirm/prompt; mọi text dữ liệu render dạng text; chặn route + bảo vệ chủ tài khoản ở web; đăng xuất = reload; query key realtime khớp `['profiles']`/`['pendingCount']`; UnitPills có `lead` ở cả Bảng và Drawer.

| ID | Mức | File:dòng | Vấn đề | Cách sửa | Task |
|----|-----|-----------|--------|----------|------|
| R-1 | Trung bình | src/components/import/ImportForm.tsx:41-61 | Nút Nạp bấm được khi `['tasks']` đang tải lần đầu, đang tải lại sau lần nạp trước, hoặc lỗi. Khi đó `dbRows` rỗng/cũ: bỏ qua modal xác nhận ghi đè tuần, không xóa stale, carry tính sai (lần nạp thứ 2 liền nhau có thể ghi đè `ghi_chu` của dòng vừa nạp bằng ghi chú tuần trước). Legacy chờ `load()` xong mới mở lại nút. | Khóa submit khi `isLoading \|\| error \|\| useIsFetching({ queryKey: TASKS_KEY }) > 0`; bỏ `refetch()` thừa ở dòng 61 (onSettled đã invalidate) | T-114a |
| R-2 | Trung bình | src/components/import/WeekList.tsx:55 | Trang Nạp ở 375px bị cuộn ngang (scrollWidth 397): `<span class="sr-only">` (absolute) trong `<th>` thoát khỏi khung `overflow-x-auto` vì không có tổ tiên `relative` | Thêm `relative` vào div `overflow-x-auto` | T-114a |
| R-3 | Trung bình | src/layout/Sidebar.tsx:14-37, 81 | 375px: thanh menu ngang rộng 563px trong khung 267px; "Nạp dữ liệu", "Người dùng" và badge chờ duyệt bị đẩy khỏi màn hình, không có dấu hiệu cuộn; viewer cũng bị cắt "Bảng công việc" (296/267) | Dưới `sm` chỉ hiện icon (chữ thành `sr-only`, giữ `aria-label`, badge chồng lên icon); 4 icon ≈ 170px là vừa | T-114c |
| R-4 | Trung bình | src/hooks/useColumnWidths.ts:3-25, src/pages/TablePage.tsx:72 | Đổi key sang `colWidths.v6` + mảng số, trái F-TBL-7: người dùng mất độ rộng đã chỉnh | Dùng lại `colWidths.v5`, đọc/ghi mảng 12 chuỗi `"Npx"` (parseInt khi đọc, bỏ phần tử không hợp lệ); đưa phép clamp vào hook (`persist(i, w)`) thay vì lặp ở TablePage | T-114b |
| R-5 | Thấp | src/auth/AuthProvider.tsx:40,55; src/components/auth/LoginForm.tsx:25 | Flash luôn mang `messageOk=false`; LoginForm so khớp chuỗi `'Đã đăng xuất.'` để đổi màu. "Phiên đăng nhập đã hết" hiện như lỗi | Lưu flash dạng `{text, kind}` (hoặc tiền tố) trong sessionStorage, AuthProvider trả `messageKind`; bỏ so chuỗi ở LoginForm | T-114c |
| R-6 | Thấp | src/components/auth/LoginForm.tsx:16-21 | `signIn` -> `boot()` reject (lỗi mạng ở getSession/signAvatars) thì không có catch: unhandled rejection, không có thông báo | Thêm `catch (e) { setError('Đăng nhập lỗi: ' + e.message) }` | T-114c |
| R-7 | Thấp | src/state/tableState.tsx:52 | Bấm cuộc họp tên rỗng ở "Cuộc họp nhiều việc chậm" (`meet: ''`) thì không lọc theo cuộc họp (legacy cũng vậy) | `if (go.meet !== undefined) f.meet = new Set([norm(go.meet) \|\| BLANK])` | T-114b |
| R-8 | Thấp | src/components/dashboard/charts/WeekTrend.tsx:8,20 | Cột cao nhất 85%, F-DASH-5 ghi 90% | Đổi 85 -> 90 (sửa cả comment) | T-114b |
| R-9 | Thấp | src/components/import/WeekList.tsx:21-37 | Xóa tuần không kiểm vai trò ở web (F-IMP-5); route đã chặn nên chỉ để báo sớm cho đồng bộ với legacy | Kiểm `me.role` trước `dialog.prompt`, báo "Chỉ Quản trị và Nhập liệu được nạp hoặc xóa dữ liệu." | T-114a |
| R-10 | Thấp | src/components/auth/RegisterForm.tsx:46-51 vs src/lib/adminCall.ts:5-14 | Lặp logic đọc lỗi Edge Function (`error.context.json()`) | Tách `invokeFn(name, body)` trong adminCall.ts, `adminCall` và RegisterForm cùng dùng | T-114c |
| R-11 | Thấp | src/router.tsx:5-8 | Bundle chính 537 kB. Trang Import/Users chỉ admin/editor dùng | `React.lazy` cho ImportPage và UsersPage (D-009); không tách Dashboard/Table | T-114c |
| R-12 | Thấp | src/pages/TablePage.tsx:72 | Hằng 60 lặp lại `MIN_WIDTH` | Gộp vào R-4 | T-114b |

Ghi nhận, không sửa (xem D-010): OK bị khóa khi không tick giá trị nào (legacy cho tập rỗng = 0 dòng); breakpoint thanh ngang là `md` (768px) thay vì 860px; `db.auth.signOut()` lỗi mạng thì supabase-js giữ phiên, sau reload vẫn đăng nhập (legacy cũng vậy).

Thứ tự chạy: T-101 -> (T-102 ‖ T-104) -> T-103 ‖ T-106 ‖ T-107a ‖ T-107 ‖ T-108 ‖ T-109 -> (T-105 ‖ T-110 ‖ T-111 sau T-103) -> T-112 -> T-113 -> T-114.
Mỗi task frontend tự kiểm tra trước khi bàn giao: `npm run lint && npm run typecheck && npm run build`.

## Rủi ro
- Key SHA-256 lệch dù chỉ 1 byte (NBSP, `›`, thứ tự join, `.trim()` của sheet) thì mất ghi chú mang sang tuần sau, và việc xóa stale sẽ xóa nhầm. Golden test của T-112 là điều kiện bắt buộc. T-109 chỉ được nạp vào DB thật sau khi golden pass.
- Chạy song song: build có thể hỏng khi stub bị đổi chữ ký. Hợp đồng nội bộ ở trên là ràng buộc cứng; muốn đổi thì phải qua Lead.
- Nút xóa tuần (T5) vẫn xóa cả dòng ẩn (D-002, chưa có quyết định của người dùng). Bản React giữ nguyên hành vi này.
- SheetJS 0.18.5 còn CVE (D-006).
- Tải toàn bộ tasks vào trình duyệt (D-007) sẽ chậm khi dữ liệu nhiều năm.
- Bản React chưa có nơi host / quy trình deploy. Cần người dùng chỉ định trước khi thay legacy.

## Lưu trữ — Kế hoạch trước: Phẫu thuật bảo mật & sửa lỗi (02/11/2026)
| ID | Agent | Mô tả | Trạng thái |
|----|-------|-------|------------|
| T-001..T-006 | backend/frontend/lead | Audit, sửa admin-users/register/index.html, review | Xong |
| T-007 | tester | Test bộ phân loại, XFF, đăng ký lần thứ 11 bị 429 | Đang làm (chưa xác minh) |
| T-008..T-010 | backend/người dùng | Sửa A3 an toàn với NULL, triển khai function, chạy SQL A1->A4->A2->A3 | Xong theo lời người gọi: A2/A3 đã áp dụng, TRUNCATE đã thu hồi (Lead chưa tự kiểm) |
| T-011 | frontend | "Xóa tuần" chỉ xóa dòng có units | Chờ quyết định của người dùng (nay áp vào T-109) |
| T-012 | — | RPC import_week | Hủy (đã drop) |
