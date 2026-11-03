import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Brand } from '@/layout/Brand';

const POINTS = ['Theo dõi tiến độ công việc theo tuần', 'Cảnh báo việc chậm, chưa triển khai', 'Phân quyền rõ ràng, ghi chú tại chỗ'];

export function LoginPage() {
  const { setMessage } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [id, setId] = useState('');

  return (
    <main className="grid min-h-screen bg-surface md:grid-cols-[minmax(420px,5fr)_6fr]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-navy-900 px-10 py-9 text-white max-md:gap-5 max-md:px-6 max-md:py-6">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 size-[520px] rounded-full bg-navy-700/50 max-md:hidden" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 size-[380px] rounded-full border border-white/10 max-md:hidden" />
        <Brand />
        <div className="relative max-md:hidden">
          <h2 className="max-w-[18ch] text-display font-extrabold text-white">Báo cáo tuần, rõ ràng và đúng hạn.</h2>
          <ul className="mt-8 grid gap-3 text-md text-navy-200">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3"><span className="h-px w-6 bg-accent-light" aria-hidden="true" />{p}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-navy-300 max-md:hidden">KT · CĐS · NCPT · ĐCM</p>
      </aside>
      <section className="grid place-items-center px-6 py-10 max-sm:px-5">
        <div key={mode} className="w-full max-w-[400px] animate-rise-in">
          {mode === 'login' ? (
            <LoginForm id={id} setId={setId} onSwitch={() => { setMessage(''); setMode('register'); }} />
          ) : (
            <RegisterForm
              onSwitch={() => setMode('login')}
              onDone={(username, text) => { setId(username); setMessage(text, true); setMode('login'); }}
            />
          )}
        </div>
      </section>
    </main>
  );
}
