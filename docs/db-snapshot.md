# Hiện trạng Supabase (project mjuioravfaxpmxscnnkm) — chụp 02/11/2026

Agent không có quyền truy cập DB trực tiếp; đây là dữ liệu thật lấy từ DB.

## Bảng
- **tasks**: id bigint, tuan text NOT NULL, key text NOT NULL, sheet, thong_tin_cuoc_hop, noi_dung, ket_luan, tinh_hinh, don_vi_dau_moi, don_vi_phoi_hop, tinh_trang, kho_khan, thoi_han text, ghi_chu text, units text[] NOT NULL '{}', units_phoi_hop text[] NOT NULL '{}', deadline_tu date, deadline_den date (cột cũ, không dùng — người dùng KHÔNG cho xóa), updated_at timestamptz now()
  - unique (tuan, key); pk id. 275 dòng (tuần 44/2026), trong đó 62 dòng cũ có units rỗng (web ẩn; người dùng KHÔNG cho xóa).
- **profiles**: id uuid pk (FK auth.users on delete cascade), email NOT NULL, username NOT NULL (unique lower(username)), full_name, role text default 'viewer', active bool default true, pending bool default false, requested_at, avatar_path, created_at. 2 dòng.

## Grant (information_schema.role_table_grants, chưa gồm grant theo cột)
- profiles → authenticated: SELECT
- tasks → authenticated: INSERT, SELECT, DELETE, **TRUNCATE**, REFERENCES, TRIGGER  (không có UPDATE ở mức bảng — có thể có grant theo cột)

## RLS policies
- tasks read SELECT authenticated using my_role() is not null
- tasks insert INSERT authenticated check my_role() in (admin, editor)
- tasks update UPDATE authenticated using/check my_role() is not null  (+ trigger tasks_guard: viewer chỉ sửa ghi_chu)
- tasks delete DELETE authenticated using my_role() in (admin, editor)
- profiles read SELECT authenticated using id = auth.uid() or my_role() = 'admin'
- storage.objects avatars: read (my_role() is not null), insert/update/delete chỉ admin

## Hàm / trigger
- private.my_role() SECURITY DEFINER, search_path '': `select role from public.profiles where id = auth.uid() and active`
- private.tasks_guard() BEFORE UPDATE on tasks: nếu viewer và (to_jsonb(new)-'ghi_chu') khác (to_jsonb(old)-'ghi_chu') → raise
- private.handle_new_user() SECURITY DEFINER AFTER INSERT on auth.users: insert profile (id, email, lower(split_part(email,'@',1)), role = admin nếu chưa có admin nào, ngược lại viewer)

## Storage
- bucket avatars: private, 1 MB, image/jpeg,png,webp

## Realtime
- publication supabase_realtime gồm public.profiles

## Edge Functions (verify_jwt = true)
- admin-users v3 → supabase/functions/admin-users/index.ts
- register v4 → supabase/functions/register/index.ts

## Advisors
- Security: Leaked Password Protection đang tắt (WARN). Performance: không có.
