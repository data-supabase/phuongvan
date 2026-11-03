import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input } from '@/components/ui';
import { resizeImage, toDataUrl } from '@/lib/avatar';
import { invokeFn } from '@/lib/adminCall';
import { makeUsername } from '@/lib/username';
import { AuthNotice } from './AuthNotice';
import { AvatarPicker } from './AvatarPicker';

interface Errors { name?: string; pw?: string; pw2?: string; avatar?: string }

export function RegisterForm({ onSwitch, onDone }: {
  onSwitch: () => void; onDone: (username: string, text: string) => void;
}) {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return setPreview('');
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Errors = {};
    if (!name.trim()) er.name = 'Nhập họ và tên.';
    if (pw.length < 8) er.pw = 'Mật khẩu tối thiểu 8 ký tự.';
    if (pw !== pw2) er.pw2 = 'Hai lần nhập mật khẩu không khớp.';
    setFormError('');
    let avatar: string | undefined;
    if (file) {
      try { avatar = await toDataUrl(await resizeImage(file)); } catch (x) { er.avatar = (x as Error).message; }
    }
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const d = await invokeFn<{ username: string; avatarSaved?: boolean }>('register', { full_name: name.trim(), password: pw, avatar });
      onDone(d.username, `✓ Đã gửi đăng ký. Tên đăng nhập của bạn: ${d.username} (hãy ghi nhớ). Bạn đăng nhập được sau khi Quản trị duyệt.`
        + (avatar && !d.avatarSaved ? ' Ảnh đại diện chưa lưu được, Quản trị có thể thêm sau.' : ''));
    } catch (x) {
      setFormError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const username = makeUsername(name);
  return (
    <form onSubmit={submit} noValidate data-testid="register-form" autoComplete="off" className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Đăng ký tài khoản</h1>
        <p className="mt-1 text-sm text-muted">Quản trị sẽ duyệt trước khi bạn đăng nhập được.</p>
      </div>
      <AuthNotice text={busy ? 'Đang gửi…' : formError} kind={busy ? 'info' : 'error'} testId="register-message" />
      <Input
        label="Họ và tên" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Lê Thái Bão"
        autoComplete="name" error={errors.name} data-testid="reg-name"
      />
      <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5" data-testid="reg-username-box">
        <span className="text-xs font-semibold text-muted">Tên đăng nhập (dự kiến)</span>
        <output data-testid="reg-username" className="mt-0.5 block font-mono text-md font-semibold text-ink">{username || '—'}</output>
        <span className="text-xs text-muted">Hệ thống quyết định tên chính thức, có thể thêm số nếu trùng.</span>
      </div>
      <AvatarPicker file={file} previewUrl={preview} name={name} onPick={setFile} error={errors.avatar} />
      <Input
        label="Mật khẩu" type="password" value={pw} onChange={(e) => setPw(e.target.value)} hint="Tối thiểu 8 ký tự."
        autoComplete="new-password" error={errors.pw} data-testid="reg-pw"
      />
      <Input
        label="Nhập lại mật khẩu" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
        autoComplete="new-password" error={errors.pw2} data-testid="reg-pw2"
      />
      <Button type="submit" variant="primary" loading={busy} data-testid="reg-submit" className="w-full">Gửi đăng ký</Button>
      <p className="text-center text-sm text-muted">
        Đã có tài khoản?{' '}
        <button type="button" onClick={onSwitch} data-testid="to-login" className="font-semibold text-accent-ink hover:underline">Đăng nhập</button>
      </p>
    </form>
  );
}
