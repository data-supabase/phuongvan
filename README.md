# Báo cáo tuần

Web theo dõi tình hình thực hiện kết luận giao ban (Ban KT, CĐS, NCPT, ĐCM, PTGĐ Hải).
React + Vite + Tailwind, dữ liệu trên Supabase, triển khai trên Vercel.

Hướng dẫn sử dụng cho người dùng: [docs/huong-dan/](docs/huong-dan/Huong-dan-su-dung-Bao-cao-tuan.pdf).

## Cấu trúc thư mục

| Thư mục / file | Nội dung |
| --- | --- |
| `src/` | Mã nguồn app (trang, component, bộ phân loại Excel `src/lib/classify`) |
| `supabase/` | SQL phân quyền và Edge Functions (`admin-users`, `register`) |
| `tests/` | Kiểm thử: node test + Playwright E2E (`tests/`), vitest (`tests/react/`), file mẫu `tests/fixtures/` |
| `docs/` | Tài liệu kỹ thuật, hướng dẫn sử dụng (`docs/huong-dan/`) |
| `legacy/` | Bản HTML cũ, chỉ để đối chiếu, không deploy |
| `config/` | Cấu hình giao diện Tailwind (`tailwind.config.ts`, nạp từ `vite.config.ts`) |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `package.json` | Cấu hình build, **phải nằm ở thư mục gốc** |

## Chạy trên máy

```bash
cp .env.example .env.local   # điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (khóa publishable)
npm install
npm run dev                  # http://localhost:5173
```

Không bao giờ đưa khóa `service_role` vào `.env.local` hay lên Vercel.

## Kiểm tra trước khi đẩy

```bash
npm run typecheck && npm run lint && npm test && npm run build
cd tests && npm install && npm test   # E2E cần dist/ đã build
```

## Triển khai Vercel

- Framework: Vite · Build: `npm run build` · Output: `dist`
- Environment Variables (loại Config): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Đổi biến môi trường xong phải **Redeploy** mới có hiệu lực.
