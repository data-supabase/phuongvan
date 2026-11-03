import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { signAvatars } from '@/lib/avatar';
import { db } from '@/lib/supabase';
import type { Profile } from '@/types/app';

/** Query key ['profiles'] (contract P2), chỉ admin. Ký link ảnh xong mới trả về để Avatar hiện ngay. */
export function useProfiles() {
  const { me } = useAuth();
  return useQuery({
    queryKey: ['profiles'],
    enabled: me?.role === 'admin',
    queryFn: async () => {
      const { data, error } = await db.from('profiles').select('*').order('created_at');
      if (error) throw new Error(error.message);
      const all = data as Profile[];
      await signAvatars(all.map((p) => p.avatar_path));
      return { users: all.filter((p) => !p.pending), pendingUsers: all.filter((p) => p.pending) };
    },
  });
}
