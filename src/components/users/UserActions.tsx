import { useState } from 'react';
import { PasswordModal } from '@/components/shared/PasswordModal';
import { Button, useDialog } from '@/components/ui';
import type { useUserActions } from '@/hooks/useUserActions';
import { makeUsername, uniqueUsername } from '@/lib/username';
import type { Profile } from '@/types/app';

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;

interface Props {
  user: Profile;
  isSelf: boolean;
  act: ReturnType<typeof useUserActions>;
  /** tên đăng nhập đang dùng (cả người chờ duyệt) để gợi ý tên không trùng */
  taken: Set<string>;
}

export function UserActions({ user: u, isSelf, act, taken }: Props) {
  const dialog = useDialog();
  const [pwOpen, setPwOpen] = useState(false);
  const busy = act.busyId === u.id;
  const label = u.full_name || u.username;

  async function rename() {
    const v = await dialog.prompt({ title: 'Sửa họ tên', message: `Họ tên của @${u.username}`, input: u.full_name ?? '', ok: 'Lưu' });
    if (v?.trim() && v.trim() !== u.full_name) await act.rename(u.id, v.trim());
  }

  async function renameUsername() {
    const others = new Set(taken);
    others.delete(u.username);
    const hint = uniqueUsername(makeUsername(u.full_name ?? ''), others) || u.username;
    const v = (await dialog.prompt({
      title: 'Đổi tên đăng nhập',
      message: 'Chữ thường, số, dấu . _ - (2 đến 32 ký tự, bắt đầu bằng chữ hoặc số).',
      input: hint, ok: 'Đổi',
    }))?.trim().toLowerCase();
    if (!v || v === u.username) return;
    if (!USERNAME_RE.test(v)) return void dialog.error('Tên đăng nhập không hợp lệ.');
    if (others.has(v)) return void dialog.error('Tên đăng nhập đã có người dùng.');
    await act.renameUsername(u.id, v);
  }

  async function toggleActive() {
    if (u.active && !(await dialog.confirm({
      title: 'Khóa tài khoản', message: `Khóa ${label} (@${u.username})? Người này sẽ không đăng nhập được cho tới khi mở khóa.`, ok: 'Khóa', danger: true,
    }))) return;
    await act.setActive(u.id, !u.active);
  }

  async function remove() {
    const v = await dialog.prompt({
      title: 'Xóa tài khoản', danger: true, ok: 'Xóa vĩnh viễn', needs: u.username,
      message: `Xóa vĩnh viễn ${label}? Không hoàn tác được. Gõ "${u.username}" để xác nhận.`,
    });
    if (v !== null) await act.remove(u.id);
  }

  return (
    <div className="flex flex-wrap gap-1.5" data-testid={`user-actions-${u.username}`}>
      <Button size="sm" disabled={busy} onClick={rename} data-testid="act-rename">Sửa tên</Button>
      <Button size="sm" disabled={busy} onClick={renameUsername} data-testid="act-username">Đổi tên ĐN</Button>
      <Button size="sm" disabled={busy} onClick={() => setPwOpen(true)} data-testid="act-password">Đặt lại mật khẩu</Button>
      {!isSelf && (
        <>
          <Button size="sm" disabled={busy} onClick={toggleActive} data-testid="act-toggle">{u.active ? 'Khóa' : 'Mở khóa'}</Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={remove} data-testid="act-delete">Xóa</Button>
        </>
      )}
      <PasswordModal title={`Đặt lại mật khẩu cho @${u.username}`} open={pwOpen} onClose={() => setPwOpen(false)} onSubmit={(pw) => act.resetPassword(u.id, pw)} />
    </div>
  );
}
