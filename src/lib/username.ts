import type { Role } from '@/types/app';

export const ROLE_LABEL: Record<Role, string> = { admin: 'Quản trị', editor: 'Nhập liệu', viewer: 'Xem' };
// phải trùng DOMAIN trong cả 2 Edge Function
export const AUTH_DOMAIN = 'bctuan.local';
// @vanhp, Quản trị cao nhất; server chặn thật ở admin-users
export const OWNER_ID = '065441d4-3465-43d4-9088-3c08e6bfa580';

// có @ = email cũ (vd tài khoản tạo trước)
export const loginEmail = (v: string) => {
  v = v.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${AUTH_DOMAIN}`;
};

// "Lê Thái Bão" -> "baolt": tên chính + chữ cái đầu của họ và tên đệm, bỏ dấu
export function makeUsername(fullName: string) {
  const parts = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  return parts.length ? parts.at(-1)! + parts.slice(0, -1).map((p) => p[0]).join('') : '';
}

// thêm số nếu trùng, bắt đầu từ 1: baolt, baolt1, baolt2… (giống Edge Function register)
export function uniqueUsername(base: string, taken: Set<string>) {
  if (!base) return '';
  let u = base;
  let i = 1;
  while (taken.has(u)) u = base + i++;
  return u;
}

export const genPw = () => {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const v = crypto.getRandomValues(new Uint32Array(12));
  return [...v].map((x) => a[x % a.length]).join('');
};
