import { useMemo } from 'react';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { CreateUserForm } from '@/components/users/CreateUserForm';
import { PendingList } from '@/components/users/PendingList';
import { UserTable } from '@/components/users/UserTable';
import { useProfiles } from '@/hooks/useProfiles';

export function UsersPage() {
  const { data, isPending, error, refetch } = useProfiles();
  const taken = useMemo(() => new Set([...(data?.users ?? []), ...(data?.pendingUsers ?? [])].map((p) => p.username)), [data]);

  return (
    <div data-testid="page-users" className="grid gap-5">
      {isPending ? (
        <Card aria-busy="true" data-testid="users-loading">
          <div className="grid gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3"><Skeleton className="size-10 rounded-full" /><Skeleton className="h-4 w-48" /><Skeleton className="ml-auto h-4 w-24" /></div>
            ))}
          </div>
        </Card>
      ) : error ? (
        <Card><ErrorState message={error.message} onRetry={() => void refetch()} /></Card>
      ) : (
        <>
          <PendingList pending={data.pendingUsers} />
          <CreateUserForm taken={taken} />
          {data.users.length ? <UserTable users={data.users} taken={taken} /> : <Card><EmptyState message="Chưa có người dùng nào." /></Card>}
        </>
      )}
    </div>
  );
}
