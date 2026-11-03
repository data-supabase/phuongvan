import { useRef } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, Card, IconCamera, Pill, Select, cx } from '@/components/ui';
import { useUserActions } from '@/hooks/useUserActions';
import { formatDate } from '@/lib/format';
import { OWNER_ID, ROLE_LABEL } from '@/lib/username';
import type { Profile, Role } from '@/types/app';
import { UserActions } from './UserActions';

export const RoleOptions = () => (
  <>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</>
);

// Cột: người dùng | vai trò | trạng thái | ngày tạo (hàng thao tác nằm dưới, trải suốt chiều ngang)
const COLS = 'md:grid-cols-[minmax(0,1fr)_150px_120px_110px]';

export function UserTable({ users, taken }: { users: Profile[]; taken: Set<string> }) {
  const { me } = useAuth();
  const act = useUserActions();
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<Profile | null>(null);
  const iAmOwner = me?.id === OWNER_ID;

  return (
    <Card padded={false} title={<span className="block px-5 pt-5 max-sm:px-4 max-sm:pt-4">Người dùng ({users.length})</span>} data-testid="user-list">
      <input
        ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid="avatar-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f && target.current) void act.changeAvatar(target.current.id, f, target.current.avatar_path);
        }}
      />
      <div className={cx('hidden gap-4 border-b border-line bg-surface-2 px-5 py-2 text-2xs font-semibold uppercase text-muted md:grid', COLS)} aria-hidden="true">
        <span>Người dùng</span><span>Vai trò</span><span>Trạng thái</span><span>Ngày tạo</span>
      </div>
      <ul className="divide-y divide-line">
        {users.map((u) => {
          const isSelf = u.id === me?.id;
          const isOwner = u.id === OWNER_ID;
          const locked = isOwner && !iAmOwner; // chủ tài khoản: chỉ chính chủ được sửa
          return (
            <li key={u.id} data-testid={`user-row-${u.username}`} className={cx('grid gap-x-4 gap-y-3 px-5 py-4 max-sm:px-4', COLS, !u.active && 'bg-surface-2/60')}>
              <div className={cx('flex min-w-0 items-center gap-3', !u.active && 'opacity-60')}>
                <button
                  type="button" disabled={locked || act.busyId === u.id} aria-label={`Đổi ảnh đại diện của ${u.full_name || u.username}`}
                  title="Bấm để đổi ảnh" data-testid="avatar-btn"
                  onClick={() => { target.current = u; fileRef.current?.click(); }}
                  className="group relative flex-none rounded-full focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-default"
                >
                  <Avatar user={u} size="md" />
                  {!locked && (
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-navy-900/55 text-white opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100">
                      <IconCamera size={16} />
                    </span>
                  )}
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <b className="truncate font-semibold text-ink">{u.full_name || u.username}</b>
                    {isSelf && <Pill variant="sub">Bạn</Pill>}
                    {isOwner && <Pill>Quản trị cao nhất</Pill>}
                  </div>
                  <div className="truncate text-sm text-muted">@{u.username}</div>
                </div>
              </div>
              <Select
                aria-label={`Vai trò của ${u.full_name || u.username}`} value={u.role} data-testid="role-select"
                disabled={isSelf || locked || act.busyId === u.id}
                onChange={(e) => void act.setRole(u.id, e.target.value as Role)}
                className="py-1.5" wrapperClassName="self-center"
              >
                <RoleOptions />
              </Select>
              <div className="flex items-center gap-2 md:self-center">
                <span
                  data-testid="user-status"
                  className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', u.active ? 'bg-done-bg text-done-text' : 'bg-late-bg text-late-text')}
                >
                  <span className="size-[7px] rounded-full bg-current" aria-hidden="true" />
                  {u.active ? 'Hoạt động' : 'Đã khóa'}
                </span>
                <span className="text-sm text-muted md:hidden">· Tạo {formatDate(u.created_at)}</span>
              </div>
              <span className="hidden text-sm text-ink-2 md:self-center md:block">{formatDate(u.created_at)}</span>
              {!locked && (
                <div className="md:col-span-4">
                  <UserActions user={u} isSelf={isSelf} act={act} taken={taken} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
