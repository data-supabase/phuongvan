import { cx } from '@/components/ui';

export type NoticeKind = 'ok' | 'info' | 'error';

/** Thông báo trên màn đăng nhập: xanh (thành công), xanh dương nhạt (thông tin), đỏ (lỗi). */
export function AuthNotice({ text, kind, testId }: { text: string; kind: NoticeKind; testId: string }) {
  if (!text) return <p data-testid={testId} className="hidden" />;
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'} data-testid={testId} data-kind={kind}
      className={cx(
        'rounded-lg border px-3 py-2.5 text-sm font-medium',
        kind === 'ok' && 'border-done-fill/40 bg-done-bg text-done-text',
        kind === 'info' && 'border-accent-line bg-accent-soft text-accent-ink',
        kind === 'error' && 'border-late-line bg-late-bg text-late-text',
      )}
    >
      {text}
    </p>
  );
}
