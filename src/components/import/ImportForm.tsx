import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { TASKS_KEY } from '@/hooks/useTasks';
import { Button, Card, Input, cx, useDialog } from '@/components/ui';
import { useImportWeek } from '@/hooks/useImportWeek';
import { useAuth } from '@/auth/AuthProvider';
import { useWeek } from '@/state/week';
import { normWeek } from '@/lib/week';

const ACCEPT = /\.(xlsx|xlsm|xls)$/i;
// điền sẵn số tuần từ tên file "Tuan 44.2026 - ..." (vẫn sửa được)
export const weekFromName = (name: string) => {
  const m = name.match(/Tu[aầ]n\s*(\d{1,2})[.\-_ /](\d{4})/i);
  return m ? `${+m[1]}/${m[2]}` : null;
};

export function ImportForm() {
  const { me } = useAuth();
  const { dbRows, weeks, setWeek, isLoading, error } = useWeek();
  // không chạy planImport khi dbRows chưa tải xong / đang tải lại / lỗi
  const fetching = useIsFetching({ queryKey: TASKS_KEY }) > 0;
  const notReady = isLoading || !!error || fetching;
  const dialog = useDialog();
  const run = useImportWeek();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [weekIn, setWeekIn] = useState('');
  const [fileErr, setFileErr] = useState('');
  const [weekErr, setWeekErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setResult(null);
    if (!ACCEPT.test(f.name)) { setFile(null); setFileErr('Chỉ nhận file .xlsx, .xlsm hoặc .xls.'); return; }
    setFile(f); setFileErr('');
    const w = weekFromName(f.name);
    if (w) { setWeekIn(w); setWeekErr(''); }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (run.isPending || notReady) return;
    setResult(null);
    // quyền thật nằm ở database (RLS + trigger); kiểm tra ở web chỉ để báo sớm
    if (!me || !['admin', 'editor'].includes(me.role)) {
      setResult({ ok: false, message: 'Chỉ Quản trị và Nhập liệu được nạp hoặc xóa dữ liệu.' }); return;
    }
    const tuan = normWeek(weekIn);
    setFileErr(file ? '' : 'Chọn file Excel báo cáo tuần.');
    setWeekErr(tuan ? '' : 'Nhập số tuần dạng 45/2026.');
    if (!file || !tuan) return;
    try {
      const r = await run.mutateAsync({
        file, tuan, dbRows, weeks, onProgress: setProgress,
        confirm: (p) => dialog.confirm({
          title: `Cập nhật tuần ${tuan}?`, ok: 'Cập nhật',
          message: `Tuần ${tuan} đã có dữ liệu. Nạp file này sẽ cập nhật tuần ${tuan}:\n• giữ ghi chú của việc còn trong file\n• xóa ${p.stale.length} việc không còn trong file` +
            (p.staleNotes ? ` (${p.staleNotes} việc có ghi chú)` : '') + '\n\nTiếp tục?',
        }),
      });
      setResult(r);
      if (r.ok) { setWeek(tuan); setFile(null); if (inputRef.current) inputRef.current.value = ''; }
    } catch (err) {
      setResult({ ok: false, message: 'Lỗi: ' + (err as Error).message });
    } finally { setProgress(''); }
  };

  return (
    <Card
      title="Nạp file Excel báo cáo tuần" data-testid="import-form-card"
      description={'Mỗi tuần nạp 1 file. Số tuần tự điền theo tên file "Tuan 45.2026 - …", sửa được. Nạp lại tuần đã có sẽ cập nhật tuần đó.'}
    >
      <form onSubmit={submit} noValidate className="grid gap-4" data-testid="import-form">
        <div>
          <div
            data-testid="import-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            className={cx('grid justify-items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-fast',
              drag ? 'border-accent bg-accent/5' : 'border-line-2 bg-surface-2', fileErr && 'border-late-fill')}
          >
            <p className="text-md font-semibold text-ink">{file ? file.name : 'Kéo thả file Excel vào đây'}</p>
            <p className="text-sm text-muted">hoặc</p>
            <Button onClick={() => inputRef.current?.click()} disabled={run.isPending} data-testid="import-pick">Chọn file…</Button>
            <input
              ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" aria-label="File Excel" className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])} data-testid="import-file"
            />
          </div>
          {fileErr && <p role="alert" className="mt-1.5 text-xs font-medium text-late-text">{fileErr}</p>}
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <Input
            label="Báo cáo của tuần" placeholder="vd 45/2026" value={weekIn} error={weekErr} inputMode="numeric"
            onChange={(e) => { setWeekIn(e.target.value); setWeekErr(''); }}
            wrapperClassName="w-full sm:w-56" data-testid="import-week"
          />
          <Button
            type="submit" variant="primary" loading={run.isPending} disabled={notReady} className="w-full sm:mt-[1.65rem] sm:w-auto" data-testid="import-submit"
          >
            Nạp &amp; phân loại
          </Button>
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-2" data-testid="import-progress">{run.isPending ? progress : notReady ? 'Đang tải dữ liệu tuần…' : ''}</p>
        {result && (
          <p
            role={result.ok ? 'status' : 'alert'} data-testid="import-msg"
            className={cx('rounded-lg px-3 py-2 text-sm font-medium', result.ok ? 'bg-done-bg text-done-text' : 'bg-late-bg text-late-text')}
          >
            {result.message}
          </p>
        )}
      </form>
    </Card>
  );
}
