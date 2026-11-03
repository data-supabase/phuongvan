import { Button } from './Button';
import { IconAlert } from './icons';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" data-testid="error-state" className="flex flex-col items-center gap-3 px-4 py-10 text-center animate-fade-in">
      <span className="grid size-11 place-items-center rounded-full bg-late-bg text-late-text"><IconAlert size={22} /></span>
      <p className="font-semibold text-ink">Không tải được dữ liệu</p>
      <p className="max-w-md break-words text-sm text-muted">{message}</p>
      {onRetry && <Button onClick={onRetry} data-testid="retry-btn">Thử lại</Button>}
    </div>
  );
}
