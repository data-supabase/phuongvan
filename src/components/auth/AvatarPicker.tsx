import { useId, useRef } from 'react';
import { Avatar, Button } from '@/components/ui';

/** Chọn ảnh đại diện có xem trước. Chữ cái đầu của tên hiện khi chưa có ảnh. */
export function AvatarPicker({ file, previewUrl, name, onPick, error }: {
  file: File | null; previewUrl: string; name: string; onPick: (f: File | null) => void; error?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-4">
      <Avatar user={{ full_name: name }} size="xl" src={previewUrl || undefined} />
      <div className="grid min-w-0 gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold text-ink-2">Ảnh đại diện <span className="font-normal text-muted">(không bắt buộc)</span></label>
        <input
          ref={ref} id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="reg-avatar"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => ref.current?.click()} data-testid="reg-avatar-pick">{file ? 'Đổi ảnh' : 'Chọn ảnh'}</Button>
          {file && (
            <Button size="sm" variant="ghost" onClick={() => { if (ref.current) ref.current.value = ''; onPick(null); }}>Bỏ ảnh</Button>
          )}
        </div>
        {error ? <p role="alert" className="text-xs font-medium text-late-text">{error}</p> : <p className="text-xs text-muted">JPG, PNG hoặc WEBP, tối đa 10 MB.</p>}
      </div>
    </div>
  );
}
