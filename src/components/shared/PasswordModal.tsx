import { useState, type FormEvent } from 'react';
import { Button, Input, Modal } from '@/components/ui';

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  /** Throw Error để hiện lỗi ngay trong modal; thành công thì modal tự đóng */
  onSubmit: (pw: string) => Promise<void>;
}

export function PasswordModal({ open, ...rest }: Props) {
  // Phần ruột chỉ mount khi mở nên mỗi lần mở là form trống
  return open ? <Inner {...rest} /> : null;
}

function Inner({ title, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw1.length < 8) return setErr('Mật khẩu tối thiểu 8 ký tự.');
    if (pw1 !== pw2) return setErr('Hai lần nhập không khớp.');
    setBusy(true);
    setErr('');
    try {
      await onSubmit(pw1);
      onClose();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open onClose={onClose} title={title} testId="password-modal"
      footer={
        <>
          <Button onClick={onClose} data-testid="password-cancel">Hủy</Button>
          <Button type="submit" form="password-form" variant="primary" loading={busy} data-testid="password-submit">Lưu</Button>
        </>
      }
    >
      <form id="password-form" onSubmit={submit} className="grid gap-3" noValidate>
        <Input
          label="Mật khẩu mới" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)}
          autoComplete="new-password" data-autofocus="" data-testid="password-new"
        />
        <Input
          label="Nhập lại" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
          autoComplete="new-password" data-testid="password-confirm"
        />
        <p role="alert" data-testid="password-error" className="min-h-5 text-sm font-medium text-late-text">{err}</p>
      </form>
    </Modal>
  );
}
