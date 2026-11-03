# Quyết định

## D-001: Áp dụng migration bảo mật và thứ tự triển khai Edge Function (02/11/2026)
- Bối cảnh: audit-backend.md đề xuất các khối [A1]–[A5] (docs/proposed-migration.sql) và sửa admin-users/register. DB thật: 275 dòng tasks (62 dòng units rỗng), 2 profiles (vanhp là admin đang hoạt động, baolt đang chờ duyệt). Người dùng cấm xóa dòng tasks và cấm drop deadline_tu/deadline_den.
- Lựa chọn đã cân nhắc: A) áp dụng cả A1–A5 / B) áp dụng A1–A4, hoãn A5 / C) chỉ A1.
- Quyết định: B. Thứ tự:
  1. Triển khai admin-users (create đặt active=true, pending=false; chạy được cả với trigger cũ lẫn mới).
  2. Triển khai register (giới hạn tốc độ tự bỏ qua khi chưa có bảng).
  3. Chạy SQL [A1] -> [A4] -> [A2] -> [A3], từng khối một, chạy truy vấn kiểm tra sau mỗi khối.
  4. Hoãn [A5] import_week: web giữ cách upsert 2 lô, còn bước xóa dòng cũ sửa ở web để bỏ qua dòng units rỗng. Chỉ làm lại khi cần nạp dữ liệu trong 1 transaction.
- Hệ quả: không khối nào xóa hoặc sửa dòng tasks, không đụng deadline_*. Từ giờ hồ sơ mới mặc định chờ duyệt (fail-closed). DB không cho hạ/khóa/xóa Quản trị cuối cùng (kể cả xóa từ Dashboard: phải gán admin khác trước). Giới hạn đăng ký 5 lượt/IP/giờ có thể chặn nhầm khi cả cơ quan dùng chung một IP NAT, nên người dùng cần chốt ngưỡng.
- Cập nhật sau review lần 2 (02/11/2026): register đã chuyển sang 10 lượt/IP/giờ, chỉ đếm khi dữ liệu hợp lệ, và fail-closed (503) cho mọi lỗi trừ 42P01/PGRST205. admin-users update giờ ghi hồ sơ trước rồi mới ghi Auth, Auth lỗi thì hoàn lại. Thứ tự triển khai giữ nguyên.

## D-002: Chấp nhận bản sửa index.html, không áp dụng import_week (02/11/2026)
- Bối cảnh: frontend đã sửa 14 mục trong audit-frontend.md. Phải bảo toàn key hash (để mang ghi chú sang tuần sau) và 62 dòng ẩn.
- Lựa chọn đã cân nhắc: A) chấp nhận bản sửa, xử lý tiếp nút "Xóa tuần" / B) chuyển sang RPC import_week.
- Quyết định: A.
  - Key = sha256(sheet|noi_dung|ket_luan|don_vi_dau_moi). Bước điền xuống chỉ ghi vào ô đầu mối đang rỗng, mà những dòng đó trước đây bị bỏ qua. Vì vậy key của mọi dòng cũ giữ nguyên, chỉ có thêm 2 dòng mới (213 -> 215).
  - Bước xóa việc cũ khi nạp lại đã lọc `units?.length`, nên không chạm vào 62 dòng ẩn.
- Hệ quả: nút "Xóa tuần" (index.html:2883) vẫn xóa cả 62 dòng ẩn. Người dùng cần chọn: giữ như hiện tại (đây là thao tác chủ động, có gõ xác nhận), hay chỉ xóa dòng có units.

## D-003: Viết lại giao diện bằng React, giữ nguyên backend (02/11/2026)
- Bối cảnh: người dùng muốn "phẫu thuật thẩm mỹ" giao diện. Bản vanilla đang chạy được chuyển vào `legacy/`. Stack lấy theo `.claude/agents/frontend.md`.
- Lựa chọn đã cân nhắc: A) chỉ chỉnh CSS của legacy / B) viết lại bằng React 18 + Vite + TS + Tailwind + Router + TanStack Query, đặt ở thư mục gốc / C) viết lại và đổi luôn backend.
- Quyết định: B. Giữ nhận diện cũ: sidebar navy (gradient #0f2a4a -> #15365f), header bảng #1e3a5f, nội dung nền sáng (#f4f6f9 / trắng), font Be Vietnam Pro, các màu trạng thái lấy từ `legacy/style.css:18-31`. `legacy/` giữ lại làm tham chiếu, không xóa.
- Hệ quả: hành vi phải giống legacy (checklist F-* trong plan.md). Mọi lời gọi Supabase theo docs/api-contract.md. Không có `src/types/database.ts` do backend sinh, nên T-101 tự viết kiểu trong `src/types/app.ts`.

## D-004: Routing dùng HashRouter (02/11/2026)
- Bối cảnh: chưa biết web được host ở đâu (file tĩnh). Legacy dùng `#dash`, `#table`, `#import`, `#users`.
- Lựa chọn đã cân nhắc: A) BrowserRouter (cần server rewrite về index.html) / B) HashRouter.
- Quyết định: B. Route: `#/` (Dashboard), `#/table`, `#/import` (admin, editor), `#/users` (admin). Login không có route riêng: chưa đăng nhập thì AuthGate hiện màn đăng nhập ở mọi URL. Hash kiểu cũ (`#table`, …) được chuyển sang route mới. Vào route không đủ quyền thì về `#/`.
- Hệ quả: chạy được trên mọi host tĩnh mà không cần cấu hình gì thêm. URL có dấu `#/`.

## D-005: Biểu đồ tự vẽ, không thêm thư viện chart (02/11/2026)
- Bối cảnh: chỉ có 4 loại hình: thanh tiến độ xếp chồng, thanh ngang xếp chồng theo đơn vị, cột xếp chồng 8 tuần, thanh ngang top cuộc họp. Đoạn nào cũng phải có tooltip và bấm được để mở Bảng đã lọc.
- Lựa chọn đã cân nhắc: A) Recharts (~100 KB gzip) / B) ECharts (lớn hơn nữa) / C) tự vẽ bằng div flex + Tailwind (legacy đang làm vậy).
- Quyết định: C. Dùng một component `<StackBar>` và một `<Tooltip>` dùng chung. Hiệu ứng: thanh tăng từ 0 lên bằng CSS transition, tắt khi `prefers-reduced-motion`.
- Hệ quả: bundle nhẹ, kiểm soát hoàn toàn được việc bấm-để-lọc. Sau này cần biểu đồ đường hoặc trục số phức tạp thì xem lại quyết định này.

## D-006: Giữ SheetJS 0.18.5, nạp động ở trang Nạp dữ liệu (02/11/2026)
- Bối cảnh: golden test (215 dòng, key SHA-256) được tạo bằng 0.18.5. Bản 0.18.5 trên npm có CVE-2023-30533 (prototype pollution khi đọc file độc) và CVE-2024-22363 (ReDoS). Bản đã sửa (0.20.x) chỉ phát hành qua cdn.sheetjs.com, không có trên npm.
- Lựa chọn đã cân nhắc: A) giữ 0.18.5 từ npm / B) lên 0.20.3 bằng tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` và chạy lại golden.
- Quyết định: A cho lần viết lại này, để chỉ thay một thứ mỗi lần. Chỉ tải bằng `import('xlsx')` trong trang Nạp, không đưa vào bundle chính. Người dùng file là admin/editor nội bộ.
- Hệ quả: rủi ro CVE vẫn còn (thấp vì chỉ người nội bộ đưa file vào). Sau khi bản React đạt golden, nên làm task riêng nâng lên B. Golden phải khớp từng byte thì mới nhận.

## D-007: Trạng thái dùng chung giữa các trang (02/11/2026)
- Bối cảnh: tuần đang xem dùng chung cho Dashboard và Bảng. Bấm vào biểu đồ phải mở Bảng với bộ lọc tương ứng. Legacy giữ bộ lọc của Bảng khi chuyển qua lại giữa các trang.
- Lựa chọn đã cân nhắc: A) đưa hết lên URL search params / B) hai context nhỏ do T-102 sở hữu / C) thêm thư viện store (zustand).
- Quyết định: B.
  - `WeekProvider` (src/state/week.tsx) cung cấp: `useWeek() -> { dbRows, weeks, week, setWeek, rows, prevWeek, prevByKey, updatedAt, isLoading, error, refetch }`. Dữ liệu lấy từ query `['tasks']` (tải hết bằng range).
  - `TableStateProvider` (src/state/tableState.tsx) cung cấp: `useTableState() -> { colFilters: Record<ColKey, Set<string>>, setColFilters, cat, setCat, q, setQ, sortBy, setSortBy, drill(go) }`. Trong đó `drill({week?, unit?, meet?, cat?})` xóa colFilters và q, đặt unit/meet/cat, KHÔNG xóa sortBy (giống legacy), đổi tuần nếu cần, rồi điều hướng tới `#/table`.
- Hệ quả: các task trang chạy song song được vì chỉ cần dùng hook với chữ ký đã cố định. Không thêm thư viện. Tải toàn bộ tasks vẫn là shortcut (legacy cũng làm vậy, khoảng 300 dòng/tuần). Chuyển sang tải theo tuần khi dữ liệu lên tới vài chục nghìn dòng. Đây là ngoại lệ có chủ đích với quy tắc "phân trang từ server" trong frontend.md.

## D-008: Đăng xuất thì tải lại trang (02/11/2026)
- Bối cảnh: đăng xuất phải xóa sạch dữ liệu: cache query, ghi chú đang gõ, mật khẩu tạm đang hiện, kênh realtime.
- Lựa chọn đã cân nhắc: A) `queryClient.clear()` + reset từng context / B) giữ cách của legacy: signOut, lưu flash vào sessionStorage, `location.reload()`.
- Quyết định: B. Cách này ít code nhất và chắc chắn không còn sót trạng thái.
- Hệ quả: sau khi đăng xuất, trang tải lại một lần.

## D-009: Tách bundle: chỉ lazy hai trang theo vai trò (02/11/2026)
- Bối cảnh: build cảnh báo chunk chính 537 kB (157 kB gzip). Phần lớn là react-dom, supabase-js, react-router, TanStack Query; các trang tự viết khá nhỏ. xlsx đã tách riêng (D-006).
- Lựa chọn đã cân nhắc: A) `React.lazy` mọi trang / B) chỉ lazy ImportPage và UsersPage / C) `manualChunks` tách vendor / D) giữ nguyên, chỉ nâng `chunkSizeWarningLimit`.
- Quyết định: B. Viewer (đa số người dùng) không tải mã của hai trang chỉ dành cho admin/editor. Dashboard và Bảng là trang vào đầu tiên nên để trong chunk chính, tránh thêm một lần chờ tải.
- Hệ quả: chunk chính giảm ít (thư viện vẫn nằm đó); cảnh báo 500 kB có thể vẫn còn. Không thêm manualChunks cho tới khi có nơi host và đo được thời gian tải thật.

## D-010: Ghi nhận các lệch so với legacy/hợp đồng sau review T-113 (02/11/2026)
- Bối cảnh: các agent làm song song đã đổi một số chữ ký/hành vi. Cần chốt cái nào giữ, cái nào phải sửa.
- Lựa chọn đã cân nhắc: A) ép mọi thứ về đúng legacy / B) giữ lệch có lợi và không ảnh hưởng dữ liệu, sửa lệch làm mất dữ liệu người dùng.
- Quyết định: B.
  - Giữ: `<UnitPills units lead />` thay cho `<UnitPills task />` (mọi chỗ phải truyền `lead`). `setWeek` lưu lựa chọn "dính" (xem hợp đồng nội bộ trong plan.md). Popover lọc khóa OK khi không tick gì (Excel cũng vậy; trong TableState tập rỗng nghĩa là không lọc). TaskDrawer đặt `inert` qua `[data-testid="app-shell"]`, nên AppShell phải giữ test id này. Thanh menu ngang dùng breakpoint `md` (768px).
  - Phải sửa (T-114b): độ rộng cột quay về `localStorage['colWidths.v5']`, mảng 12 chuỗi `"Npx"`, để người dùng không mất độ rộng đã chỉnh.
- Hệ quả: hợp đồng nội bộ trong plan.md đã cập nhật theo. Nếu sau này đổi `data-testid="app-shell"` thì TaskDrawer sẽ mất bẫy focus mà không báo lỗi.