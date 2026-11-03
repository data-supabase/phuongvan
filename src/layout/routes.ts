import type { Role } from '@/types/app';

export interface RouteDef {
  path: string;
  title: string;
  /** undefined = mọi vai trò */
  roles?: Role[];
  /** false = ẩn bộ chọn tuần ở header */
  weekNav: boolean;
}

// D-004: HashRouter. Dashboard '/', còn lại theo legacy.
export const ROUTE_DEFS: RouteDef[] = [
  { path: '/', title: 'Dashboard', weekNav: true },
  { path: '/table', title: 'Bảng công việc', weekNav: true },
  { path: '/import', title: 'Nạp dữ liệu', roles: ['admin', 'editor'], weekNav: false },
  { path: '/users', title: 'Người dùng', roles: ['admin'], weekNav: false },
];

export const routeFor = (pathname: string) => ROUTE_DEFS.find((r) => r.path === pathname) ?? ROUTE_DEFS[0];
export const canOpen = (r: RouteDef, role: Role | undefined) => !r.roles || (!!role && r.roles.includes(role));

/** Hash kiểu cũ (#table, #import…) -> route mới (#/table…). Gọi một lần trước khi render. */
export function migrateLegacyHash() {
  const m = location.hash.match(/^#(dash|table|import|users)$/);
  if (m) location.replace(m[1] === 'dash' ? '#/' : `#/${m[1]}`);
}
