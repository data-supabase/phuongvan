import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { avatarIsFresh, signAvatars } from '@/lib/avatar';

/** F-SHELL-4: tab hiện lại mà link ảnh của mình đã cũ thì ký lại rồi vẽ lại (contract S1). */
export function useAvatarRefresh() {
  const { me, refreshMe } = useAuth();
  const path = me?.avatar_path;
  useEffect(() => {
    if (!path) return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || avatarIsFresh(path)) return;
      await signAvatars([path]);
      await refreshMe(); // đặt lại `me` để Avatar đọc link mới
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [path, refreshMe]);
}
