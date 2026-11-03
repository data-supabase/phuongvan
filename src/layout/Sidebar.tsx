import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { PasswordModal } from '@/components/shared/PasswordModal';
import {
  Avatar, IconChevronLeft, IconClock, IconChevronRight, IconDashboard, IconKey, IconLogout, IconTable, IconUpload, IconUsers, cx, useDialog,
} from '@/components/ui';
import { usePendingCount } from '@/hooks/usePendingCount';
import { db } from '@/lib/supabase';
import { ROLE_LABEL } from '@/lib/username';
import { useWeek } from '@/state/week';
import { Brand } from './Brand';

const KEY = 'sidebar.collapsed';
const readCollapsed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

function NavItem({ to, icon, children, badge, testId, collapsed }: { to: string; icon: ReactNode; children: string; badge?: number; testId: string; collapsed: boolean }) {
  // dưới 600px chỉ còn icon: nhãn thành sr-only, tooltip + aria-label giữ tên mục
  const tip = children;
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 599px)').matches);
  useEffect(() => {
    const mq = matchMedia('(max-width: 599px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const iconOnly = narrow || collapsed;
  return (
    <NavLink
      to={to} end={to === '/'} data-testid={testId} data-tip={iconOnly ? tip : undefined} aria-label={iconOnly ? tip : undefined}
      className={cx(
        'relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 max-sm:px-2.5 text-base font-medium text-navy-100',
        'transition-colors duration-fast ease-out hover:bg-white/10 hover:text-white',
        'aria-[current=page]:bg-white/15 aria-[current=page]:font-semibold aria-[current=page]:text-white',
        'md:aria-[current=page]:before:absolute md:aria-[current=page]:before:-left-3 md:aria-[current=page]:before:inset-y-2',
        'md:aria-[current=page]:before:w-[3px] md:aria-[current=page]:before:rounded-r md:aria-[current=page]:before:bg-accent-light',
        'focus-visible:outline-accent-line',
        collapsed && 'md:justify-center md:px-0',
      )}
    >
      {icon}
      <span className={cx('max-sm:sr-only', collapsed && 'md:sr-only')}>{children}</span>
      {!!badge && (
        <span
          data-testid="nav-pending-badge" title="Yêu cầu đăng ký chờ duyệt" aria-label={`${badge} yêu cầu chờ duyệt`}
          className={cx(
            'ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#f87171] px-1.5 text-2xs font-bold text-white max-md:ml-1 max-sm:absolute max-sm:-right-0.5 max-sm:-top-0.5 max-sm:ml-0 max-sm:h-4 max-sm:min-w-4 max-sm:px-1',
            collapsed && 'md:absolute md:right-0 md:top-0 md:ml-0 md:h-4 md:min-w-4 md:px-1',
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}

const linkBtn =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-fast focus-visible:outline-accent-line';

export function Sidebar() {
  const { me, signOut } = useAuth();
  const { weeks } = useWeek();
  const { data: pending = 0 } = usePendingCount();
  const dialog = useDialog();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const role = me?.role;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => setCollapsed((v) => { try { localStorage.setItem(KEY, v ? '0' : '1'); } catch { /* bỏ qua */ } return !v; });

  // điện thoại: menu tài khoản đóng khi chọn trang, bấm ra ngoài hoặc Esc
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [menu]);
  // Ctrl+B thu gọn / mở rộng (bỏ qua khi đang gõ trong ô nhập)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b' || t?.closest('input,textarea,select,[contenteditable=true]')) return;
      e.preventDefault();
      setCollapsed((v) => { try { localStorage.setItem(KEY, v ? '0' : '1'); } catch { /* bỏ qua */ } return !v; });
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  if (!me) return null;
  const label = 'hidden px-3 pb-1 pt-4 text-2xs font-bold uppercase tracking-[0.08em] text-navy-300 md:block';

  return (
    <aside
      data-testid="sidebar"
      className={cx(
        'z-30 flex items-center gap-2 bg-gradient-to-b from-navy-900 to-navy-800 px-3 py-2 text-navy-100',
        'max-md:sticky max-md:top-0 max-md:shadow-card',
        'md:sticky md:top-0 md:h-screen md:flex-none md:flex-col md:items-stretch md:gap-0 md:px-3 md:py-5',
        'md:transition-[width] md:duration-200 md:ease-out motion-reduce:transition-none',
        collapsed ? 'md:w-[4.5rem]' : 'md:w-60',
      )}
    >
      <div className={cx('max-md:hidden md:pb-4', collapsed ? 'md:flex md:justify-center' : 'md:px-2')}><Brand compact={collapsed} /></div>
      <div className="md:hidden"><Brand compact /></div>

      <nav aria-label="Menu" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto max-md:pl-1 md:flex-none md:flex-col md:items-stretch md:overflow-visible">
        {!collapsed && <div className={label}>Tổng quan</div>}
        <NavItem to="/" testId="nav-dashboard" icon={<IconDashboard />} collapsed={collapsed}>Dashboard</NavItem>
        <NavItem to="/table" testId="nav-table" icon={<IconTable />} collapsed={collapsed}>Bảng công việc</NavItem>
        {(role === 'admin' || role === 'editor') && (collapsed ? <div aria-hidden="true" className="mx-2 my-2 hidden h-px bg-white/10 md:block" /> : <div className={label}>Dữ liệu</div>)}
        {(role === 'admin' || role === 'editor') && <NavItem to="/import" testId="nav-import" icon={<IconUpload />} collapsed={collapsed}>Nạp dữ liệu</NavItem>}
        {role === 'admin' && <NavItem to="/users" testId="nav-users" icon={<IconUsers />} collapsed={collapsed} badge={pending}>Người dùng</NavItem>}
      </nav>

      <div className="flex-none md:mt-auto">
        <button
          type="button" onClick={toggle} data-testid="sidebar-toggle" aria-expanded={!collapsed}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} data-tip={collapsed ? 'Mở rộng menu (Ctrl+B)' : undefined}
          className={cx(
            'mb-3 hidden items-center gap-2.5 rounded-lg py-2 text-sm font-medium text-navy-300 transition-colors duration-fast hover:bg-white/10 hover:text-white focus-visible:outline-accent-line md:flex',
            collapsed ? 'w-full justify-center' : 'w-full px-3',
          )}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          {!collapsed && <span>Thu gọn</span>}
        </button>
      <div ref={box} className="relative">
        <button
          type="button" aria-label="Tài khoản" aria-expanded={menu} data-testid="account-toggle"
          onClick={() => setMenu((v) => !v)} className={cx('rounded-full', collapsed ? 'md:mx-auto md:block' : 'md:hidden')}
        >
          <Avatar user={me} size="sm" className="bg-white/15 text-white" />
        </button>
        <div
          data-testid="account-panel"
          className={cx(
            'grid gap-3 text-sm',
            collapsed ? (menu ? 'md:absolute md:bottom-0 md:left-full md:ml-6 md:w-64 md:rounded-xl md:bg-navy-800 md:p-4 md:shadow-pop md:animate-pop-in' : 'md:hidden') : 'md:border-t md:border-white/10 md:pt-4',
            menu
              ? 'max-md:absolute max-md:right-0 max-md:top-full max-md:mt-3 max-md:w-64 max-md:rounded-xl max-md:bg-navy-800 max-md:p-4 max-md:shadow-pop max-md:animate-pop-in'
              : 'max-md:hidden',
          )}
        >
          <p data-testid="data-info" className={cx('flex items-center gap-2 px-1 text-xs text-navy-100 max-md:hidden', collapsed && 'md:hidden')}>
            <IconClock size={14} className="flex-none text-navy-300" />
            {weeks.length ? `Dữ liệu: ${weeks.length} tuần · mới nhất ${weeks.at(-1)}` : 'Chưa có dữ liệu'}
          </p>
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3" data-testid="me-card">
              <Avatar user={me} size="md" className="bg-white/20 text-white" />
              <div className="min-w-0">
                <b data-testid="me-name" className="block truncate text-base font-bold text-white">{me.full_name || me.username}</b>
                <span className="block truncate text-sm text-navy-100">
                  {ROLE_LABEL[me.role]} · <span data-testid="me-username">@{me.username}</span>
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-0.5 border-t border-white/15 pt-2">
              <button type="button" className={cx(linkBtn, 'text-white hover:bg-white/10')} data-testid="change-password" onClick={() => { setMenu(false); setPwOpen(true); }}>
                <IconKey size={16} /> Đổi mật khẩu
              </button>
              <button type="button" className={cx(linkBtn, 'text-[#fecaca] hover:bg-[#f87171]/20')} data-testid="logout" onClick={() => void signOut()}>
                <IconLogout size={16} /> Đăng xuất
              </button>
            </div>
          </div>        </div>
      </div>
      </div>

      <PasswordModal
        title="Đổi mật khẩu của bạn" open={pwOpen} onClose={() => setPwOpen(false)}
        onSubmit={async (password) => {
          const { error } = await db.auth.updateUser({ password });
          if (error) throw new Error(/should be different/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu cũ.' : error.message);
          void dialog.alert('Đã đổi mật khẩu.');
        }}
      />
    </aside>
  );
}
