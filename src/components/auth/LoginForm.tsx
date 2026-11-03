import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Input } from '@/components/ui';
import { AuthNotice, type NoticeKind } from './AuthNotice';

export function LoginForm({ id, setId, onSwitch }: { id: string; setId: (v: string) => void; onSwitch: () => void }) {
  const { signIn, message, messageKind, canRetry, retry } = useAuth();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const err = await signIn(id, pw);
      if (err) setError(err);
    } catch (x) {
      setError('Đăng nhập lỗi: ' + (x as Error).message); // boot() sau khi đăng nhập có thể bị từ chối
    } finally {
      setBusy(false);
    }
  }

  // "Đã đăng xuất." là thông tin bình thường, không phải lỗi
  const kind: NoticeKind = error ? 'error' : messageKind;
  return (
    <form onSubmit={submit} data-testid="login-form" autoComplete="on" className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Đăng nhập</h1>
        <p className="mt-1 text-sm text-muted">Dùng tài khoản do Quản trị cấp hoặc tài khoản đã được duyệt.</p>
      </div>
      <AuthNotice text={error || message} kind={kind} testId="login-message" />
      {canRetry && <Button onClick={retry} data-testid="login-retry">Thử lại</Button>}
      <Input
        label="Tên đăng nhập" value={id} onChange={(e) => setId(e.target.value)} placeholder="Ví dụ: vanhp"
        autoComplete="username" autoCapitalize="none" spellCheck={false} required data-testid="login-id"
      />
      <Input
        label="Mật khẩu" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
        autoComplete="current-password" required data-testid="login-password"
      />
      <Button type="submit" variant="primary" loading={busy} data-testid="login-submit" className="w-full">Đăng nhập</Button>
      <p className="text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <button type="button" onClick={onSwitch} data-testid="to-register" className="font-semibold text-accent-ink hover:underline">Đăng ký</button>
      </p>
    </form>
  );
}
