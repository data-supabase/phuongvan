-- ĐỀ XUẤT (chưa chạy). Đọc docs/audit-backend.md trước. Chạy từng khối, theo thứ tự, sau khi Lead/người dùng duyệt.
-- Không xóa 62 dòng cũ, không đụng deadline_tu / deadline_den.

-- ===== [A1] CAO: bỏ TRUNCATE/REFERENCES/TRIGGER của authenticated trên tasks =====
-- TRUNCATE bỏ qua RLS và trigger. PostgREST không có động từ TRUNCATE nên chưa khai thác được qua Data API,
-- nhưng mọi hàm SECURITY INVOKER/RPC thêm sau này hay kết nối SQL trực tiếp dưới role authenticated đều xóa sạch bảng. Thu hồi vì không dùng.
revoke truncate, references, trigger on public.tasks from authenticated, anon;
-- Giữ nguyên: select, insert, delete (RLS kiểm soát) và update theo cột.

-- ===== [A2] TRUNG BÌNH: handle_new_user "fail-closed" =====
-- Hồ sơ mới luôn là viewer + CHỜ DUYỆT (active=false). Chỉ người đầu tiên của hệ thống (profiles rỗng) là admin.
-- Sau đó admin-users 'create' phải tự đặt active=true, pending=false (xem diff trong audit-backend.md).
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(7002);  -- tránh 2 tài khoản đầu cùng thành admin
  insert into public.profiles (id, email, username, role, active, pending, requested_at)
  select new.id, new.email, lower(split_part(new.email, '@', 1)),
         case when exists (select 1 from public.profiles) then 'viewer' else 'admin' end,
         not exists (select 1 from public.profiles),
         exists (select 1 from public.profiles),
         case when exists (select 1 from public.profiles) then now() end;
  return new;
end $$;
revoke all on function private.handle_new_user() from public;

-- ===== [A3] TRUNG BÌNH: luôn còn ít nhất 1 Quản trị đang hoạt động =====
create or replace function private.keep_one_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role is distinct from 'admin' or new.active is not true) then
    perform pg_advisory_xact_lock(7001);
    if not exists (select 1 from public.profiles where role = 'admin' and active and id <> old.id) then
      raise exception 'Không thể hạ/khóa/xóa Quản trị cuối cùng';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.keep_one_admin() from public;
drop trigger if exists keep_one_admin on public.profiles;
create trigger keep_one_admin before update or delete on public.profiles
  for each row execute function private.keep_one_admin();

-- ===== [A4] TRUNG BÌNH: giới hạn tốc độ đăng ký theo IP (register dùng service_role nên bỏ qua RLS) =====
create table if not exists public.register_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  at timestamptz not null default now()
);
alter table public.register_attempts enable row level security;   -- không policy = không ai ngoài service_role truy cập được
revoke all on public.register_attempts from anon, authenticated;
create index if not exists register_attempts_ip_at on public.register_attempts (ip, at desc);

-- ĐÃ ÁP DỤNG A1–A4 (02/11/2026). A5 đã tạo rồi bị XÓA (web không dùng) — KHÔNG chạy lại khối A5.
-- ===== [A5] TRUNG BÌNH (tùy chọn, cần sửa web): nạp tuần trong 1 transaction, không đè ghi chú =====
-- Thay cho upsert 2 lô + delete rời ở index.html:2929-2937. KHÔNG xóa dòng units rỗng (62 dòng cũ).
create or replace function public.import_week(p_tuan text, p_rows jsonb, p_carry jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n_up int; n_del int;
begin
  if private.my_role() not in ('admin', 'editor') then
    raise exception 'Chỉ Quản trị và Nhập liệu được nạp dữ liệu' using errcode = '42501';
  end if;
  if coalesce(trim(p_tuan), '') = '' or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Dữ liệu nạp không hợp lệ' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('import_week:' || p_tuan));
  insert into public.tasks (tuan, key, sheet, thong_tin_cuoc_hop, noi_dung, ket_luan, tinh_hinh, don_vi_dau_moi,
                            don_vi_phoi_hop, tinh_trang, kho_khan, thoi_han, units, units_phoi_hop, updated_at)
  select p_tuan, r.key, r.sheet, r.thong_tin_cuoc_hop, r.noi_dung, r.ket_luan, r.tinh_hinh, r.don_vi_dau_moi,
         r.don_vi_phoi_hop, r.tinh_trang, r.kho_khan, r.thoi_han, coalesce(r.units, '{}'), coalesce(r.units_phoi_hop, '{}'), now()
  from jsonb_populate_recordset(null::public.tasks, p_rows) r
  where r.key is not null
  on conflict (tuan, key) do update set
    sheet = excluded.sheet, thong_tin_cuoc_hop = excluded.thong_tin_cuoc_hop, noi_dung = excluded.noi_dung,
    ket_luan = excluded.ket_luan, tinh_hinh = excluded.tinh_hinh, don_vi_dau_moi = excluded.don_vi_dau_moi,
    don_vi_phoi_hop = excluded.don_vi_phoi_hop, tinh_trang = excluded.tinh_trang, kho_khan = excluded.kho_khan,
    thoi_han = excluded.thoi_han, units = excluded.units, units_phoi_hop = excluded.units_phoi_hop,
    updated_at = excluded.updated_at;            -- ghi_chu, deadline_tu, deadline_den KHÔNG bị đụng
  get diagnostics n_up = row_count;
  -- mang ghi chú cũ sang chỉ khi dòng chưa có ghi chú (p_carry = {"key": "ghi chú"})
  update public.tasks t set ghi_chu = c.value
  from jsonb_each_text(p_carry) c
  where t.tuan = p_tuan and t.key = c.key and t.ghi_chu is null;
  -- dọn việc không còn trong file, chỉ những dòng đang hiển thị (units không rỗng)
  delete from public.tasks t
  where t.tuan = p_tuan and cardinality(t.units) > 0
    and not exists (select 1 from jsonb_array_elements(p_rows) e where e->>'key' = t.key);
  get diagnostics n_del = row_count;
  return jsonb_build_object('upserted', n_up, 'deleted', n_del);
end $$;
revoke all on function public.import_week(text, jsonb, jsonb) from public, anon;
grant execute on function public.import_week(text, jsonb, jsonb) to authenticated;

-- ===== Truy vấn kiểm tra (chỉ đọc), chạy trong SQL Editor để xác minh trước/sau =====
-- select grantee, privilege_type from information_schema.role_table_grants where table_name='tasks' and table_schema='public';
-- select grantee, column_name, privilege_type from information_schema.column_privileges where table_name='tasks' and grantee in ('authenticated','anon') and privilege_type='UPDATE';
-- select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='storage' and tablename='objects';
-- select count(*) from public.profiles where role='admin' and active;
