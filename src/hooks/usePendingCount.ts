import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { db } from '@/lib/supabase';

/** Số hồ sơ chờ duyệt (contract P3), chỉ admin; người khác luôn 0. */
export function usePendingCount() {
  const { me } = useAuth();
  const admin = me?.role === 'admin';
  return useQuery({
    queryKey: ['pendingCount'],
    enabled: admin,
    queryFn: async () => {
      const { count, error } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('pending', true);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}
