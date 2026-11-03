import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UnitPills } from '@/components/shared/UnitPills';
import { IconClose, StatusPill, Textarea, useDialog } from '@/components/ui';
import { useUpdateNote } from '@/hooks/useUpdateNote';
import { useWeek } from '@/state/week';
import type { Task } from '@/types/app';

const TITLE = 'text-sm font-bold uppercase tracking-wide text-navy-900';
const FOCUSABLE = 'button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

export function TaskDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  // key theo id: đổi dòng = dựng lại, phần dọn dẹp cũ kịp lưu ghi chú đang gõ
  return task ? createPortal(<DrawerBody key={task.id} task={task} onClose={onClose} />, document.body) : null;
}

function DrawerBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { error: showError } = useDialog();
  const update = useUpdateNote();
  const { prevWeek, prevByKey } = useWeek();
  const prev = prevByKey.get(task.key);
  const [note, setNote] = useState(task.ghi_chu ?? '');
  const [status, setStatus] = useState<'' | 'saving' | 'saved'>('');
  const noteRef = useRef(note);
  const savedRef = useRef(task.ghi_chu ?? '');

  const save = useCallback(async () => {
    const value = noteRef.current;
    if (value === savedRef.current) return; // savedRef = giá trị đã gửi/đã lưu gần nhất, tránh gửi trùng khi blur + đóng
    const prev = savedRef.current;
    savedRef.current = value;
    setStatus('saving');
    try {
      await update.mutateAsync({ id: task.id, value });
      setStatus('saved');
    } catch (e) {
      setStatus('');
      savedRef.current = prev;
      noteRef.current = prev;
      setNote(prev);
      void showError('Lưu lỗi: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [task.id, update, showError]);
  const saveRef = useRef(save);
  saveRef.current = save;

  const close = useCallback(() => { void saveRef.current(); onClose(); }, [onClose]);

  // F-DRW-3: nền phía sau inert, nút đóng nhận focus, trả focus về dòng khi đóng; flush ghi chú khi gỡ
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('[data-testid="app-shell"]');
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (shell) shell.inert = true;
    closeBtn.current?.focus();
    return () => {
      if (shell) shell.inert = false;
      void saveRef.current();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!document.querySelector('dialog[open]')) { e.preventDefault(); close(); }
      } else if (e.key === 'Tab' && panel.current && !document.querySelector('dialog[open]')) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = items[0], last = items.at(-1);
        if (!first || !last) return;
        const a = document.activeElement;
        if (e.shiftKey && (a === first || !panel.current.contains(a))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (a === last || !panel.current.contains(a))) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="fixed inset-0 z-50" data-testid="task-drawer-root">
      <div className="absolute inset-0 bg-ink/40 animate-fade-in" onClick={close} data-testid="drawer-backdrop" aria-hidden="true" />
      <aside
        ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="task-drawer"
        className="absolute inset-y-0 right-0 flex w-[560px] max-w-full flex-col bg-surface shadow-pop animate-slide-in"
      >
        <header className="flex items-start gap-3 bg-navy-900 px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase text-navy-200" data-testid="drawer-meet">{task.thong_tin_cuoc_hop || '—'}</p>
            <h2 id={titleId} className="mt-1 whitespace-pre-line break-words text-lg font-bold" data-testid="drawer-title">
              {task.noi_dung || '(Không ghi tên công việc)'}
            </h2>
          </div>
          <button
            ref={closeBtn} type="button" onClick={close} aria-label="Đóng chi tiết" data-testid="drawer-close"
            className="grid size-9 flex-none place-items-center rounded-md text-navy-200 transition-colors duration-fast hover:bg-white/10 hover:text-white"
          >
            <IconClose />
          </button>
        </header>

        <div className="grid flex-1 content-start gap-5 overflow-y-auto overscroll-contain px-5 py-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg border border-line bg-surface-2 p-4 max-sm:grid-cols-1">
            <Meta label="Trạng thái"><StatusPill text={task.tinh_trang} /></Meta>
            <Meta label="Deadline">{task.thoi_han || '—'}</Meta>
            <Meta label="Đơn vị phụ trách">
              <UnitPills units={task.units} lead={task.don_vi_dau_moi} />
              <div className="mt-1.5 break-words text-xs text-muted">{task.don_vi_dau_moi}</div>
            </Meta>
            <Meta label="Đơn vị phối hợp">{task.don_vi_phoi_hop || '—'}</Meta>
          </dl>

          <div className="text-sm text-ink-2" data-testid="drawer-vs-prev">
            {prevWeek ? (
              prev ? (
                <>
                  <span className="font-semibold">So với tuần {prevWeek}:</span> <StatusPill text={prev.tinh_trang} />
                  {prev.tinh_hinh && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold text-navy-900">Xem tình hình tuần trước</summary>
                      <p className="mt-2 whitespace-pre-line break-words">{prev.tinh_hinh}</p>
                    </details>
                  )}
                </>
              ) : <span className="font-semibold">Việc mới tuần này</span>
            ) : null}
          </div>

          <Section title="Nội dung kết luận" text={task.ket_luan} />
          <Section title="Tình hình thực hiện" text={task.tinh_hinh} />
          <Section title="Khó khăn vướng mắc, kiến nghị" text={task.kho_khan} warn />

          <div>
            <Textarea
              label={<span className={`${TITLE} border-l-4 border-navy-900 pl-2`}>Ghi chú</span>} value={note} data-testid="drawer-note" rows={5}
              placeholder="Nhập ghi chú… (tự lưu khi bấm ra ngoài)"
              onChange={(e) => { noteRef.current = e.target.value; setNote(e.target.value); setStatus(''); }}
              onBlur={() => void save()}
            />
            <p role="status" data-testid="drawer-saved" className="mt-1 h-4 text-xs font-semibold text-done-text">
              {status === 'saving' ? <span className="text-muted">Đang lưu…</span> : status === 'saved' ? '✓ Đã lưu' : ''}
            </p>
          </div>

          <p className="text-xs text-muted">Từ sheet: {task.sheet} · Tuần {task.tuan}</p>
        </div>
      </aside>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={TITLE}>{label}</dt>
      <dd className="mt-1 break-words text-base text-ink">{children}</dd>
    </div>
  );
}

function Section({ title, text, warn }: { title: string; text: string; warn?: boolean }) {
  if (!text) return null;
  return (
    <section className={warn ? 'rounded-lg border border-warn-line bg-warn-bg p-4' : ''}>
      <h3 className={`${TITLE} border-l-4 pl-2 ${warn ? 'border-warn-text text-warn-text' : 'border-navy-900'}`}>{title}</h3>
      <p className={`mt-2 whitespace-pre-line break-words text-base ${warn ? 'text-warn-text' : 'text-ink-2'}`}>{text}</p>
    </section>
  );
}

