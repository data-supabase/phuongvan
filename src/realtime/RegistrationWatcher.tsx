import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useToast } from '@/components/ui';
import { useAvatarRefresh } from '@/hooks/useAvatarRefresh';
import { db } from '@/lib/supabase';

interface RegRow { id: string; pending?: boolean; full_name?: string | null; username?: string }

// Contract §8 / F-SHELL-3: admin nghe đăng ký mới. Component này không vẽ gì.
export function RegistrationWatcher() {
  useAvatarRefresh();
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const admin = me?.role === 'admin';
  const notified = useRef(new Set<string>()); // mỗi id chỉ báo một lần
  // giữ tham chiếu mới nhất để kênh không bị tạo lại mỗi lần render
  const fn = useRef({ toast, navigate, qc });
  fn.current = { toast, navigate, qc };

  useEffect(() => {
    if (!admin) return;
    // trình duyệt chỉ cho hỏi quyền sau một thao tác của người dùng
    const ask = () => { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission(); };
    document.addEventListener('click', ask, { once: true });

    const ch = db.channel('dang-ky-moi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, ({ new: n }: { new: Partial<RegRow> }) => {
        const { toast: t, navigate: go, qc: q } = fn.current;
        void q.invalidateQueries({ queryKey: ['pendingCount'] });
        void q.invalidateQueries({ queryKey: ['profiles'] });
        // hàm register tạo hồ sơ rồi mới đặt pending = true, nên báo ở sự kiện có pending
        if (!n?.pending || !n.id || notified.current.has(n.id)) return;
        notified.current.add(n.id);
        const who = `${n.full_name || n.username} (@${n.username})`;
        const open = () => go('/users');
        t(<>🔔 Có đăng ký mới: <b>{who}</b> đang chờ duyệt.</>, { action: { label: 'Xem', onClick: open }, duration: 15000 });
        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          const nt = new Notification('Báo cáo tuần — đăng ký mới', { body: `${who} đang chờ duyệt`, tag: 'reg-' + n.id });
          nt.onclick = () => { window.focus(); open(); nt.close(); };
        }
      })
      .subscribe();

    return () => {
      document.removeEventListener('click', ask);
      void db.removeChannel(ch);
    };
  }, [admin]);

  return null;
}
