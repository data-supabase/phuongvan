import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useDialog, useToast } from '@/components/ui';
import { adminCall } from '@/lib/adminCall';
import { uploadAvatar } from '@/lib/avatar';
import type { Role } from '@/types/app';

export interface CreateInput { username: string; password: string; full_name: string; role: Role; avatar: File | null }

/** Mọi thao tác ghi người dùng đi qua Edge Function admin-users (contract §6); xong thì làm mới danh sách + badge. */
export function useUserActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const dialog = useDialog();
  const { me, refreshMe } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['profiles'] }), qc.invalidateQueries({ queryKey: ['pendingCount'] })]);

  /** Chạy một thao tác: khóa dòng đang xử lý, báo lỗi bằng hộp thoại, trả về true nếu thành công. */
  async function run(id: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusyId(id);
    try {
      await fn();
      await refresh();
      if (okMsg) toast(okMsg);
      return true;
    } catch (e) {
      void dialog.error((e as Error).message);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const update = (id: string, patch: Record<string, unknown>, okMsg?: string) =>
    run(id, () => adminCall({ action: 'update', id, ...patch }), okMsg);

  return {
    busyId,
    update,
    setRole: (id: string, role: Role) => update(id, { role }, 'Đã đổi vai trò.'),
    setActive: (id: string, active: boolean) => update(id, { active }, active ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.'),
    rename: (id: string, full_name: string) => update(id, { full_name }, 'Đã đổi tên.'),
    renameUsername: (id: string, username: string) =>
      update(id, { username }, id === me?.id ? `Tên đăng nhập mới của bạn: ${username}. Dùng tên này cho lần đăng nhập sau.` : 'Đã đổi tên đăng nhập.'),
    remove: (id: string, okMsg = 'Đã xóa tài khoản.') => run(id, () => adminCall({ action: 'delete', id }), okMsg),
    approve: (id: string, role: Role) => run(id, () => adminCall({ action: 'approve', id, role }), 'Đã duyệt tài khoản.'),
    /** Throw để PasswordModal hiện lỗi ngay trong modal */
    async resetPassword(id: string, password: string) {
      await adminCall({ action: 'reset_password', id, password });
      toast('Đã đặt lại mật khẩu.');
    },
    changeAvatar: (id: string, file: File, oldPath: string | null) =>
      run(id, async () => {
        await uploadAvatar(id, file, oldPath);
        if (id === me?.id) await refreshMe();
      }, 'Đã cập nhật ảnh đại diện.'),
    /** Throw nếu tạo lỗi. Ảnh lỗi vẫn tính là tạo thành công (avatarSaved=false). */
    async create(input: CreateInput) {
      const { avatar, ...body } = input;
      const r = (await adminCall({ action: 'create', ...body })) as { id: string };
      let avatarSaved = !avatar;
      if (avatar) {
        try { await uploadAvatar(r.id, avatar); avatarSaved = true; } catch { /* báo ở kết quả */ }
      }
      await refresh();
      return { avatarSaved };
    },
  };
}
