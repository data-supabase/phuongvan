import { useState } from 'react';
import { Avatar, Button, Card, Select, useDialog } from '@/components/ui';
import { useUserActions } from '@/hooks/useUserActions';
import { formatDateTime } from '@/lib/format';
import type { Profile, Role } from '@/types/app';
import { RoleOptions } from './UserTable';

/** Thẻ đăng ký chờ duyệt (F-USR-4). Ẩn khi không có ai. Từ chối = action delete. */
export function PendingList({ pending }: { pending: Profile[] }) {
  const act = useUserActions();
  const dialog = useDialog();
  const [roles, setRoles] = useState<Record<string, Role>>({});
  if (!pending.length) return null;

  async function reject(p: Profile) {
    const ok = await dialog.confirm({
      title: 'Từ chối đăng ký', danger: true, ok: 'Từ chối',
      message: `Từ chối và xóa đăng ký của ${p.full_name || p.username} (@${p.username})?`,
    });
    if (ok) await act.remove(p.id, 'Đã từ chối đăng ký.');
  }

  return (
    <Card
      data-testid="pending-list" className="border-warn-line bg-warn-bg/40"
      title={`Đăng ký chờ duyệt (${pending.length})`} description="Chọn vai trò rồi bấm Duyệt để cho phép đăng nhập."
    >
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {pending.map((p) => {
          const busy = act.busyId === p.id;
          return (
            <li key={p.id} data-testid={`pending-${p.username}`} className="grid gap-3 rounded-lg border border-line bg-surface p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar user={p} size="md" />
                <div className="min-w-0">
                  <b className="block truncate font-semibold text-ink">{p.full_name || p.username}</b>
                  <span className="block truncate text-sm text-muted">@{p.username}</span>
                  <span className="block text-xs text-muted">Đăng ký {formatDateTime(p.requested_at ?? p.created_at)}</span>
                </div>
              </div>
              <Select
                aria-label={`Vai trò cho ${p.full_name || p.username}`} value={roles[p.id] ?? 'viewer'} disabled={busy}
                onChange={(e) => setRoles({ ...roles, [p.id]: e.target.value as Role })} className="py-1.5" data-testid="pending-role"
              >
                <RoleOptions />
              </Select>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" className="flex-1" loading={busy} onClick={() => void act.approve(p.id, roles[p.id] ?? 'viewer')} data-testid="pending-approve">Duyệt</Button>
                <Button variant="danger" size="sm" className="flex-1" disabled={busy} onClick={() => void reject(p)} data-testid="pending-reject">Từ chối</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
