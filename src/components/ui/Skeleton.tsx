import { cx } from './cx';

/** Khung xám nhấp nháy khi đang tải. Đặt kích thước bằng className (vd "h-24 w-full"). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'block h-3 animate-shimmer rounded-md bg-[linear-gradient(90deg,#eef1f5_25%,#f7f9fb_50%,#eef1f5_75%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}
