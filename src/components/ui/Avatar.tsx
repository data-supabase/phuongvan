import { avatarUrl } from '@/lib/avatar';
import type { Profile } from '@/types/app';
import { cx } from './cx';

type AvatarUser = Partial<Pick<Profile, 'avatar_path' | 'full_name' | 'username' | 'email'>>;
const SIZE = { sm: 'size-8 text-sm', md: 'size-10 text-base', xl: 'size-[84px] text-3xl' } as const;

// chữ cái đầu của từ cuối trong full_name || username || email
export const initialOf = (u: AvatarUser) =>
  ((u.full_name || u.username || u.email || '?').trim().split(/\s+/).at(-1)?.[0] || '?').toUpperCase();

export function Avatar({ user, size = 'sm', src, className }: {
  user: AvatarUser; size?: keyof typeof SIZE; /** ghi đè link ảnh (xem trước khi chọn file) */ src?: string; className?: string;
}) {
  const url = src ?? avatarUrl(user.avatar_path);
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid flex-none select-none place-items-center overflow-hidden rounded-full bg-accent-soft font-bold text-accent-ink',
        SIZE[size], className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initialOf(user)}
    </span>
  );
}
