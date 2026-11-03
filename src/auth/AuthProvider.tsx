import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { signAvatars } from '@/lib/avatar';
import { db } from '@/lib/supabase';
import { loginEmail } from '@/lib/username';
import type { Profile } from '@/types/app';

export type MessageKind = 'ok' | 'info' | 'error';

export interface AuthValue {
  me: Profile | null;
  phase: 'loading' | 'login' | 'ready';
  /** Thông báo hiện trên màn đăng nhập (flash sau đăng xuất, lỗi boot, đăng ký xong…) */
  message: string;
  /** true = thông báo thành công (màu xanh) */
  messageOk: boolean;
  messageKind: MessageKind;
  canRetry: boolean;
  retry: () => void;
  /** Trả về lỗi đã dịch sang tiếng Việt, hoặc null nếu thành công */
  signIn: (identifier: string, pw: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setMessage: (text: string, kind?: boolean | MessageKind) => void;
}

const Ctx = createContext<AuthValue | null>(null);
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return v;
};

// D-008: đăng xuất / hết phiên -> lưu flash rồi tải lại trang để xóa sạch mọi trạng thái
const takeFlash = (): { text: string; kind: MessageKind } => {
  try {
    const raw = sessionStorage.getItem('flash') || '';
    sessionStorage.removeItem('flash');
    if (!raw) return { text: '', kind: 'error' };
    const j = JSON.parse(raw) as { text?: string; kind?: MessageKind };
    return { text: j.text ?? '', kind: j.kind ?? 'error' };
  } catch {
    return { text: '', kind: 'error' };
  }
};
const FLASH = takeFlash(); // đọc đúng một lần lúc nạp module (StrictMode gọi effect/initializer 2 lần)

function endSession(text: string, kind: MessageKind) {
  try { sessionStorage.setItem('flash', JSON.stringify({ text, kind })); } catch { /* bỏ qua */ }
  location.reload();
}

const signInError = (m: string) =>
  /banned/i.test(m) ? 'Tài khoản đã bị khóa. Liên hệ Quản trị.'
  : /invalid login/i.test(m) ? 'Sai tên đăng nhập hoặc mật khẩu.'
  : 'Đăng nhập lỗi: ' + m;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [phase, setPhase] = useState<AuthValue['phase']>('loading');
  const [message, setMsg] = useState(FLASH.text);
  const [messageKind, setMessageKind] = useState<MessageKind>(FLASH.kind);
  const [canRetry, setCanRetry] = useState(false);
  const meRef = useRef<Profile | null>(null);
  const booting = useRef<Promise<void> | null>(null);

  const setMessage = useCallback((text: string, kind: boolean | MessageKind = 'error') => {
    setMsg(text);
    setMessageKind(kind === true ? 'ok' : kind === false ? 'error' : kind);
  }, []);
  const showLogin = useCallback((text = '', retry = false) => {
    meRef.current = null;
    setMe(null);
    setPhase('login');
    setCanRetry(retry);
    if (text) setMessage(text);
  }, [setMessage]);

  const bootNow = useCallback(async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return showLogin();
    const { data, error } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    // giữ phiên, không đăng xuất, để người dùng bấm Thử lại
    if (error) return showLogin('Lỗi tải hồ sơ: ' + error.message + ' Kiểm tra kết nối rồi bấm Thử lại.', true);
    const p = data as Profile | null;
    if (p?.pending) { // tự đăng ký, chưa được duyệt
      await db.auth.signOut();
      return showLogin(`Tài khoản @${p.username} đang chờ Quản trị duyệt. Vui lòng quay lại sau.`);
    }
    if (!p || !p.active) {
      await db.auth.signOut();
      return showLogin(!p ? 'Tài khoản chưa được cấp quyền. Liên hệ Quản trị.' : 'Tài khoản đã bị khóa. Liên hệ Quản trị.');
    }
    await signAvatars([p.avatar_path]);
    meRef.current = p;
    setMe(p);
    setMsg('');
    setCanRetry(false);
    setPhase('ready');
  }, [showLogin]);

  // chặn boot chạy chồng (bấm đăng nhập 2 lần, StrictMode, đổi ảnh của chính mình…)
  const boot = useCallback(() => (booting.current ??= bootNow().finally(() => { booting.current = null; })), [bootNow]);

  useEffect(() => {
    boot().catch((e: Error) => showLogin('Lỗi khởi động: ' + e.message + ' Bấm Thử lại.', true));
    const { data: { subscription } } = db.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT' && meRef.current) endSession('Phiên đăng nhập đã hết, vui lòng đăng nhập lại.', 'info');
    });
    return () => subscription.unsubscribe();
  }, [boot, showLogin]);

  const value = useMemo<AuthValue>(() => ({
    me, phase, message, messageKind, messageOk: messageKind === 'ok', canRetry, setMessage,
    retry: () => { setCanRetry(false); boot().catch((e: Error) => showLogin('Lỗi khởi động: ' + e.message, true)); },
    async signIn(identifier, pw) {
      const { error } = await db.auth.signInWithPassword({ email: loginEmail(identifier), password: pw });
      if (error) return signInError(error.message);
      setMessage('');
      await boot();
      return null;
    },
    async signOut() {
      meRef.current = null;
      await db.auth.signOut();
      endSession('Đã đăng xuất.', 'info');
    },
    async refreshMe() {
      if (!meRef.current) return;
      const { data } = await db.from('profiles').select('*').eq('id', meRef.current.id).maybeSingle();
      if (!data) return;
      await signAvatars([(data as Profile).avatar_path]);
      meRef.current = data as Profile;
      setMe(data as Profile);
    },
  }), [me, phase, message, messageKind, canRetry, setMessage, boot, showLogin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

