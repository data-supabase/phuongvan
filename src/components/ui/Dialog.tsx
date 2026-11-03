import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

// Thay alert/confirm/prompt của trình duyệt (F-UI-1). Giống uiDialog của legacy, có hàng đợi.
export interface DialogOptions {
  title?: string;
  message?: string;
  /** Có giá trị (kể cả '') = hộp nhập; giá trị là nội dung điền sẵn */
  input?: string | null;
  ok?: string;
  /** null = ẩn nút Hủy */
  cancel?: string | null;
  danger?: boolean;
  /** Phải gõ đúng chuỗi này (không phân biệt hoa thường) thì nút OK mới bật */
  needs?: string | null;
}

interface Api {
  confirm: (o: DialogOptions) => Promise<boolean>;
  prompt: (o: DialogOptions) => Promise<string | null>;
  alert: (message: string, title?: string) => Promise<void>;
  error: (message: string) => Promise<void>;
}

const Ctx = createContext<Api | null>(null);
export const useDialog = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDialog phải nằm trong <DialogProvider>');
  return v;
};

type Result = boolean | string | null;
interface Current { opts: DialogOptions; resolve: (v: Result) => void; id: number }

export function DialogProvider({ children }: { children: ReactNode }) {
  const [cur, setCur] = useState<Current | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);

  // xếp hàng: một hộp thoại tại một thời điểm, lời gọi sau không ghi đè lời gọi trước
  const ask = useCallback((opts: DialogOptions) => {
    const p = chain.current.then(
      () => new Promise<Result>((resolve) => setCur({ opts, resolve, id: ++seq.current })),
    );
    chain.current = p.catch(() => undefined);
    return p;
  }, []);

  const api = useMemo<Api>(() => ({
    confirm: async (o) => (await ask({ ...o, input: null })) === true,
    prompt: async (o) => (await ask({ ...o, input: o.input ?? '' })) as string | null,
    alert: async (message, title = 'Thông báo') => void (await ask({ title, message, ok: 'Đóng', cancel: null, input: null })),
    error: async (message) => void (await ask({ title: 'Có lỗi', message, ok: 'Đóng', cancel: null, input: null })),
  }), [ask]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {cur && <DialogHost key={cur.id} cur={cur} onDone={(v) => { setCur(null); cur.resolve(v); }} />}
    </Ctx.Provider>
  );
}

function DialogHost({ cur, onDone }: { cur: Current; onDone: (v: Result) => void }) {
  const { title = 'Xác nhận', message = '', input = null, ok = 'Đồng ý', cancel = 'Hủy', danger = false, needs = null } = cur.opts;
  const [value, setValue] = useState(input ?? '');
  const isInput = input !== null;
  const blocked = needs != null && value.trim().toLowerCase() !== needs.toLowerCase();
  // Esc/Hủy: hộp xác nhận -> false (hộp chỉ có nút Đóng thì coi như OK); hộp nhập -> null
  const dismiss = () => onDone(isInput ? null : cancel === null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!blocked) onDone(isInput ? value : true);
  };
  return (
    <Modal
      open onClose={dismiss} title={title} testId="dialog"
      footer={
        <>
          {cancel !== null && <Button onClick={dismiss} data-testid="dialog-cancel">{cancel}</Button>}
          <Button
            type="submit" form="ui-dialog-form" variant={danger ? 'danger' : 'primary'} disabled={blocked}
            data-autofocus={isInput ? undefined : ''} data-testid="dialog-ok"
          >
            {ok}
          </Button>
        </>
      }
    >
      <form id="ui-dialog-form" onSubmit={submit} className="grid gap-3">
        {message && <p className="whitespace-pre-line text-md text-ink-2">{message}</p>}
        {isInput && (
          <Input
            aria-label={message || title} value={value} onChange={(e) => setValue(e.target.value)}
            placeholder={needs ?? ''} autoComplete="off" spellCheck={false} data-autofocus="" data-testid="dialog-input"
          />
        )}
      </form>
    </Modal>
  );
}
