import { cx } from '@/components/ui';

/** Logo + tên hệ thống. tone 'light' = chữ trắng (trên nền navy), 'dark' = chữ tối. */
export function Brand({ tone = 'light', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cx(
          'grid size-9 flex-none place-items-center rounded-[10px] text-sm font-extrabold tracking-wide',
          tone === 'light' ? 'bg-white text-navy-900 shadow-[0_2px_8px_rgba(0,0,0,.25)]' : 'bg-navy-900 text-white',
        )}
      >
        BC
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <b className={cx('block text-md font-bold', tone === 'light' ? 'text-white' : 'text-ink')}>Báo cáo tuần</b>
          <small className={cx('block text-xs', tone === 'light' ? 'text-navy-300' : 'text-muted')}>KT · CĐS · NCPT · ĐCM</small>
        </span>
      )}
    </div>
  );
}
