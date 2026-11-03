# Báo cáo kiểm thử — 02/11/2026 — Baseline bộ regression

## Tổng quan
| Lớp | Đạt | Lỗi | Bỏ qua / todo |
|---|---|---|---|
| Unit (hàm thuần trích từ index.html) | 9 | 0 | 1 todo |
| Golden bộ phân loại (tuần 44/2026, 213 dòng) | 1 | 0 | 0 |
| Smoke trình duyệt (Playwright, mock Supabase; desktop + 375px + phễu/uiDialog) | 3 | 0 | 0 |
| **Tổng** | **13** | **0** | **1** |

Chạy: `cd tests && npm test` (khoảng 7 giây). Ghi lại golden sau khi chủ ý đổi bộ phân loại: `$env:UPDATE_GOLDEN=1; npm run test:unit`.

## Cách hoạt động
- `tests/lib.js` đọc `index.html` lúc chạy, lấy thẻ `<script>` và nạp hàm trong `vm` (không copy code): `matchUnits`, `subUnits`, `meetingName`, `classifyWorkbook` (script 1, chạy nguyên khối) và `statusClass`, `makeUsername`, `uniqueUsername`, `weekNum`, `normWeek`, `loginEmail` (trích theo tên từ script 2). Nếu đổi tên hay xóa hàm, test báo "Không tìm thấy trong index.html".
- Test cũng thu các `console.assert` tự kiểm trong index.html.
- `tests/fixtures/week44.xlsx` là bản sao file tuần 44; `tests/golden-week44.json` gồm số dòng theo sheet, theo đơn vị cấp 1, cấp 2, theo trạng thái (thô và nhóm). Sheet bị bỏ qua: "PL4.Ke hoach muc tieu". Cấp 1: KT 106, CĐS 44, NCPT 40, ĐCM 28. Nhóm trạng thái: đang 120, xong 57, chậm 30, chưa 6.
- Smoke: server tĩnh cục bộ; mọi request tới `mjuioravfaxpmxscnnkm.supabase.co` bị chặn và trả dữ liệu giả (đăng nhập, hồ sơ admin, 4 task). supabase-js 2.45.4 và xlsx lấy từ node_modules thay CDN. Request ra ngoài khác bị chặn. Không gọi server thật, không tạo tài khoản.

## Lỗi
Chưa phát hiện lỗi nào ở phạm vi đã kiểm (không có BUG mức Cao, Trung bình, Thấp).

## Ghi chú / rủi ro (không phải lỗi đã xác nhận)
- Golden chỉ ghi lại hành vi hiện tại, chưa kiểm đúng/sai với nghiệp vụ. Ví dụ "Đang triển khai chậm tiến độ" (29 dòng) được xếp "chậm"; "Quá hạn" xếp "chậm". Có 3 dòng trạng thái trống xếp vào "đang thực hiện" (`index.html:2402-2408`). Cần người nghiệp vụ xác nhận.
- Todo (quy tắc chưa rõ, không đoán): "KT" nằm trong ngoặc không kèm "Phòng", "CN TMDV" không có Phòng KT, các biến thể ký tự khác.
- Chưa phủ: nạp file/xóa tuần, quản lý người dùng, ảnh đại diện, RLS/Edge Function thật, mất mạng, bấm gửi 2 lần.

---

# Cập nhật Phase 3 — kiểm lại các bản sửa (02/11/2026)

## Tổng quan (sau khi mở rộng)
| Lớp | Đạt | Lỗi | Bỏ qua / todo |
|---|---|---|---|
| Unit | 9 | 0 | 1 todo |
| Golden (215 dòng, đã xác nhận `total` = 215) | 1 | 0 | 0 |
| Smoke | 3 | 0 | 0 |
| Kiểm các bản sửa (`tests/fixes.test.js`, Supabase giả) | 6 | 0 | 0 |
| **Tổng** | **19** | **0** | **1** |

Chạy 2 lần liên tiếp đều đạt (khoảng 20 giây).

## Các ca đã kiểm (fixes.test.js)
1. Phân trang `load()`: mock tôn trọng Range/offset và cắt 1000 dòng; 1500 dòng trả về qua >= 2 lần gọi, `dbRows` = 1500, tuần mới nhất 44/2026 có đủ 1200 dòng. Đạt.
2. Nạp lại tuần: tuần có 5 dòng trong file, 2 dòng cũ có units (1 có ghi chú), 3 dòng units rỗng. Hộp xác nhận ghi "xóa 2 việc" và "1 việc có ghi chú"; request DELETE chỉ chứa id 101,102, không có 201-203. Đạt.
3. XSS: `<img src=x onerror=window.__xss=1>` và `" onmouseover=...` đặt trong tuan, units, full_name, username, ghi_chu, thong_tin_cuoc_hop, nội dung các cột, tình trạng. Duyệt dash, bảng (từng tuần trong danh sách), drawer, người dùng (admin), nạp dữ liệu: `window.__xss` không tồn tại, không có thẻ `img[src=x]`, không có thuộc tính onmouseover/onerror; payload hiển thị dạng chữ trong bảng. Đạt.
4. Đăng xuất: trang tải lại, màn đăng nhập hiện "Đã đăng xuất", không còn nội dung công việc, drawer không còn hiển thị. Lỗi mạng khi lấy hồ sơ: hiện nút Thử lại và thông báo "Lỗi tải hồ sơ", không gọi `/auth/v1/logout`; bấm Thử lại thì vào được app. Đạt.
5. `uiDialog` gọi 2 lần đồng thời: Esc ở hộp 1 trả `false`, OK ở hộp 2 trả `true`, cả hai resolve. Đạt.
6. `statusClass('Chưa hoàn thành')` không trả `st-done`. Đạt.

## Lỗi
Không có lỗi thật mới. Ghi chú nhỏ, không phải BUG: khi drawer đang mở, lớp nền `#drawerBg` che nút Đăng xuất (người dùng phải đóng drawer trước); test gọi `click()` bằng JS để kiểm trường hợp đăng xuất lúc drawer còn mở.

## Hạn chế
- Mock không kiểm tra RLS/Edge Function thật; payload XSS chỉ thử ở các trường nêu trên, chưa thử toast đăng ký mới (realtime) và tên file ảnh đại diện.


---

# React rebuild — E2E (T-112) — 03/11/2026

Chạy: `npm run build` (gốc) rồi `cd tests && npm run test:e2e-react` (hoặc `npm test`, đã gồm). Build kiểm: sau đợt sửa T-114a/b/c. Toàn bộ Supabase (auth, REST, functions, storage, realtime WebSocket) được mock bằng route; request nào ra `*.supabase.co`/mạng ngoài chưa mock, hoặc lỗi console, đều làm test fail (`assertClean`).

## Tổng quan
| Lớp | Đạt | Lỗi | Bỏ qua |
|---|---|---|---|
| Legacy node --test (unit/golden/smoke/fixes/classify-ts) | 27 | 0 | 0 |
| Vitest `tests/react` | 23 | 0 | 0 |
| E2E React (Playwright, 5 file, 42 test) | 41 | 1 | 0 |

Phủ: đăng nhập (username -> `x@bctuan.local`, trim/lowercase, email cũ có @, sai mật khẩu, bấm 2 lần, chờ duyệt, khóa/ban, chưa có hồ sơ, lỗi tải hồ sơ + Thử lại, đăng xuất reload/xóa phiên/flash info); dashboard KPI/hero + drill (thẻ, dòng rủi ro, biểu đồ xu hướng sang tuần khác); bảng (lọc Excel OK/Hủy, tìm kiếm, ký tự đặc biệt, resize + lưu `colWidths.v5` dạng "Npx", áp dụng giá trị có sẵn, localStorage hỏng, drawer + PATCH ghi chú khi Esc với VIEWER, mất mạng khi lưu); nạp file week44.xlsx (215 dòng, 2 lô, lô 1 không có ghi_chu, chỉ xóa việc cũ có units, không xóa dòng ẩn, Hủy, tuần mới, bấm 2 lần, đầu vào sai, nút Nạp khóa khi tasks đang tải); xóa tuần phải gõ lại số tuần; trang người dùng (chủ không có thao tác, bản thân không Khóa/Xóa, xóa phải gõ username, khóa/duyệt/vai trò, lỗi server, tạo tài khoản); đăng ký (`{full_name,password,avatar?}`, username do server cấp); XSS ở mọi trang/drawer/hộp thoại/bộ lọc; 375px mọi trang + drawer + thanh điều hướng + menu tài khoản.

## Lỗi
### BUG-R01 [Thấp] Tên cuộc họp dài liền không dấu cách làm Dashboard cuộn ngang toàn trang ở 375px
- Agent cần sửa: frontend
- Vị trí: `src/components/dashboard/charts/LateMeetings.tsx:12-15` (`<ul className="grid">` / `<p className="line-clamp-2">`)
- Cách tái hiện: 1. Dữ liệu có `thong_tin_cuoc_hop` là chuỗi 600 ký tự không dấu cách, việc ở nhóm chậm. 2. Mở Dashboard ở 375px.
- Kết quả mong đợi: không cuộn ngang trang (chữ ngắt dòng/cắt).
- Kết quả thực tế: scrollWidth = 4281px; phần tử `late-meet-0` tràn. Thiếu `min-w-0` / `break-words` (`[overflow-wrap:anywhere]`).
- Test liên quan: `tests/e2e-react/xss-mobile.test.js` ("375px (chuỗi rất dài 600 ký tự)")
- Trạng thái: Mở

## Lỗi đã phát hiện trong lúc viết test và đã được sửa ở T-114 (đã kiểm lại, test đạt)
- [Trung bình] Độ rộng cột không được khôi phục sau reload (cột "#" 52px < MIN 60 nên mảng bị loại) -> nay dùng `colWidths.v5` "Npx": **Đã kiểm lại**.
- [Trung bình] Thanh điều hướng 375px (admin) che mất "Nạp dữ liệu"/"Người dùng" (nav 563px trong khung 267px) -> **Đã kiểm lại**.
- [Thấp] `/import` 375px cuộn ngang 23px do `sr-only` trong bảng tuần -> **Đã kiểm lại**.

## Ghi chú
- Mock không dùng được: tìm thấy cả Realtime (`routeWebSocket`) nên admin không chạm server thật.
- Chưa phủ: đổi mật khẩu bản thân (PUT /auth/v1/user), upload ảnh đại diện trong trang người dùng, toast realtime đăng ký mới, Firefox/WebKit.
- Task T-112: Definition of Done đạt về phạm vi E2E; còn BUG-R01 mức Thấp.
