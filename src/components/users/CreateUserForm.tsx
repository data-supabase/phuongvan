import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar, Button, Card, IconClose, Input, Select } from '@/components/ui';
import { useUserActions } from '@/hooks/useUserActions';
import { resizeImage } from '@/lib/avatar';
import { genPw, makeUsername, ROLE_LABEL, uniqueUsername } from '@/lib/username';
import type { Role } from '@/types/app';
import { USERNAME_RE } from './UserActions';
import { RoleOptions } from './UserTable';

interface Done { username: string; password: string; role: Role; avatarFailed: boolean }

/** Tạo tài khoản (F-USR-1). Mật khẩu tạm chỉ hiện ở kết quả cố định, không tự tắt. */
export function CreateUserForm({ taken }: { taken: Set<string> }) {
  const act = useUserActions();
  const [name, setName] = useState('');
  const [userEdit, setUserEdit] = useState<string | null>(null); // null = còn tự sinh theo họ tên
  const [pw, setPw] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const username = userEdit ?? uniqueUsername(makeUsername(name), taken);

  useEffect(() => {
    if (!file) return setPreview(undefined);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pick(f?: File) {
    if (!f) return;
    try {
      await resizeImage(f); // kiểm tra định dạng/dung lượng ngay khi chọn
      setFile(f);
      setErrs((x) => ({ ...x, avatar: '' }));
    } catch (e) {
      setFile(null);
      setErrs((x) => ({ ...x, avatar: (e as Error).message }));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    const v: Record<string, string> = {};
    if (!name.trim()) v.name = 'Nhập họ tên.';
    if (!USERNAME_RE.test(u)) v.username = 'Chữ thường, số, . _ - (2 đến 32 ký tự, bắt đầu bằng chữ hoặc số).';
    else if (taken.has(u)) v.username = 'Tên đăng nhập đã có người dùng.';
    if (pw.length < 8) v.pw = 'Mật khẩu tối thiểu 8 ký tự.';
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const r = await act.create({ username: u, password: pw, full_name: name.trim(), role, avatar: file });
      setDone({ username: u, password: pw, role, avatarFailed: !r.avatarSaved });
      setName(''); setUserEdit(null); setPw(''); setRole('viewer'); setFile(null);
    } catch (x) {
      setErrs({ form: (x as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Tạo tài khoản mới" description="Họ tên sinh sẵn tên đăng nhập; bạn có thể sửa lại." data-testid="create-user">
      <form onSubmit={submit} noValidate className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:gap-6">
        <div className="flex items-center gap-3 md:flex-col md:items-start">
          <Avatar user={{ full_name: name, username }} size="xl" src={preview} />
          <div className="grid gap-1">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid="create-avatar-file" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="create-avatar-pick">{file ? 'Đổi ảnh' : 'Chọn ảnh'}</Button>
            {file && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setFile(null)}>Bỏ ảnh</Button>}
            {errs.avatar && <p role="alert" className="max-w-[160px] text-xs font-medium text-late-text">{errs.avatar}</p>}
          </div>
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Input label="Họ tên" value={name} onChange={(e) => setName(e.target.value)} error={errs.name} placeholder="Lê Thái Bão" autoComplete="off" disabled={busy} data-testid="create-name" />
          <Input
            label="Tên đăng nhập" value={username} error={errs.username} autoComplete="off" spellCheck={false} disabled={busy} placeholder="baolt"
            onChange={(e) => setUserEdit(e.target.value.toLowerCase())} data-testid="create-username"
          />
          <div className="grid gap-1.5">
            <Input
              label="Mật khẩu tạm" type="text" value={pw} error={errs.pw} autoComplete="off" spellCheck={false} disabled={busy}
              placeholder="Tối thiểu 8 ký tự" onChange={(e) => setPw(e.target.value)} data-testid="create-password"
            />
            <Button size="sm" disabled={busy} onClick={() => setPw(genPw())} data-testid="create-genpw">Tạo mật khẩu ngẫu nhiên</Button>
          </div>
          <Select label="Vai trò" value={role} disabled={busy} onChange={(e) => setRole(e.target.value as Role)} data-testid="create-role"><RoleOptions /></Select>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-4">
            <Button type="submit" variant="primary" loading={busy} data-testid="create-submit">Tạo tài khoản</Button>
            {errs.form && <p role="alert" data-testid="create-error" className="text-sm font-medium text-late-text">{errs.form}</p>}
          </div>
        </div>
      </form>
      {done && (
        <div role="status" data-testid="create-result" className="mt-4 flex items-start gap-3 rounded-lg border border-done-fill/40 bg-done-bg p-4 text-sm text-done-text">
          <p className="min-w-0 flex-1">
            <b>✓ Đã tạo {done.username} ({ROLE_LABEL[done.role]}).</b> Tên đăng nhập: <b className="select-all">{done.username}</b> · Mật khẩu tạm: <b className="select-all font-mono">{done.password}</b> — gửi riêng cho người dùng.
            {done.avatarFailed && ' Ảnh đại diện chưa lưu được, bấm vào ảnh trong danh sách để thêm sau.'}
          </p>
          <button type="button" aria-label="Đóng kết quả" onClick={() => setDone(null)} className="flex-none rounded-md p-1 hover:bg-white/60"><IconClose size={14} /></button>
        </div>
      )}
    </Card>
  );
}
