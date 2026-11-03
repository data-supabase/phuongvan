-- Đăng nhập + 3 vai trò (Quản trị / Nhập liệu / Xem) cho project phuong-van.
-- Chạy 1 lần trong Supabase Dashboard -> SQL Editor (hoặc để Claude áp dụng khi bạn duyệt).
-- Sau khi chạy: chưa đăng nhập thì không đọc được dữ liệu; tài khoản phuongvan@gmail.com thành Quản trị.

-- ===== Người dùng & vai trò =====
create schema if not exists private; -- không expose qua Data API

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- vai trò của người đang gọi; null nếu chưa đăng nhập / bị khóa / không có hồ sơ
create function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and active
$$;
revoke all on function private.my_role() from public;
grant usage on schema private to authenticated;
grant execute on function private.my_role() to authenticated;

-- tài khoản mới -> tạo hồ sơ; nếu hệ thống chưa có Quản trị thì người đó là Quản trị
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when exists (select 1 from public.profiles where role = 'admin') then 'viewer' else 'admin' end);
  return new;
end $$;
revoke all on function private.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- tài khoản đang có -> Quản trị
insert into public.profiles (id, email, role) select id, email, 'admin' from auth.users on conflict (id) do nothing;

-- đọc: hồ sơ của mình, Quản trị đọc tất cả. Ghi: chỉ qua Edge Function admin-users (service role)
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.my_role()) = 'admin');

-- ===== Bảng công việc: phải đăng nhập, quyền theo vai trò =====
drop policy "read all" on public.tasks;
drop policy "edit deadline" on public.tasks;
drop policy "import" on public.tasks;
drop policy "import delete" on public.tasks;
revoke all on public.tasks from anon;

create policy "tasks read" on public.tasks for select to authenticated
  using ((select private.my_role()) is not null);
create policy "tasks insert" on public.tasks for insert to authenticated
  with check ((select private.my_role()) in ('admin', 'editor'));
create policy "tasks update" on public.tasks for update to authenticated
  using ((select private.my_role()) is not null) with check ((select private.my_role()) is not null);
create policy "tasks delete" on public.tasks for delete to authenticated
  using ((select private.my_role()) in ('admin', 'editor'));
grant update (ghi_chu) on public.tasks to authenticated;

-- vai trò Xem chỉ được sửa ghi chú (chặn cả khi gọi API trực tiếp)
create function private.tasks_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if private.my_role() = 'viewer' and (to_jsonb(new) - 'ghi_chu') is distinct from (to_jsonb(old) - 'ghi_chu') then
    raise exception 'Vai trò Xem chỉ được sửa ghi chú';
  end if;
  return new;
end $$;
create trigger tasks_guard before update on public.tasks
  for each row execute function private.tasks_guard();
