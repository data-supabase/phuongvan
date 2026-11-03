import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, Skeleton, useDialog } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { useDeleteWeek } from '@/hooks/useDeleteWeek';
import { formatDateTime, formatNumber } from '@/lib/format';
import { normWeek } from '@/lib/week';
import { useWeek } from '@/state/week';

export function WeekList() {
  const { dbRows, weeks, week, setWeek, isLoading, error, refetch } = useWeek();
  const { me } = useAuth();
  const dialog = useDialog();
  const nav = useNavigate();
  const del = useDeleteWeek();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const list = useMemo(() => [...weeks].reverse().map((w) => {
    const l = dbRows.filter((r) => r.tuan === w && r.units?.length);
    return { w, n: l.length, notes: l.filter((r) => r.ghi_chu).length, at: l.reduce((a, r) => (r.updated_at > a ? r.updated_at : a), '') };
  }), [dbRows, weeks]);

  const remove = async (w: string) => {
    setMsg(null);
    if (!me || !['admin', 'editor'].includes(me.role)) {
      setMsg({ ok: false, text: 'Chỉ Quản trị và Nhập liệu được nạp hoặc xóa dữ liệu.' }); return;
    }
    const n = dbRows.filter((r) => r.tuan === w).length; // gồm cả dòng ẩn
    const typed = await dialog.prompt({
      title: `Xóa dữ liệu tuần ${w}`, danger: true, ok: 'Xóa tuần', needs: w,
      message: `Xóa toàn bộ ${n} việc của tuần ${w}, kể cả ghi chú. Thao tác này không hoàn tác được.\n\nGõ ${w} để xác nhận:`,
    });
    if (typed === null) return;
    if (normWeek(typed) !== w) { setMsg({ ok: false, text: 'Số tuần gõ lại không khớp, chưa xóa gì.' }); return; }
    try {
      await del.mutateAsync(w);
      setMsg({ ok: true, text: `✓ Đã xóa dữ liệu tuần ${w}.` });
      if (w === week) setWeek(''); // về tuần mới nhất
    } catch (e) {
      setMsg({ ok: false, text: 'Xóa lỗi: ' + (e as Error).message });
    }
  };

  const summary = weeks.length ? `${weeks.length} tuần dữ liệu · mới nhất ${weeks.at(-1)}` : 'Chưa có dữ liệu';
  return (
    <Card title="Các tuần đã nạp" description={isLoading || error ? undefined : summary} data-testid="week-list-card">
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} data-testid="week-msg"
          className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-done-bg text-done-text' : 'bg-late-bg text-late-text'}`}>
          {msg.text}
        </p>
      )}
      {isLoading ? (
        <div className="grid gap-3" data-testid="week-list-loading"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : !list.length ? (
        <EmptyState message="Chưa nạp tuần nào." />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm" data-testid="week-table">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-3 font-semibold">Tuần</th>
                <th className="py-2 pr-3 text-right font-semibold">Số việc</th>
                <th className="py-2 pr-3 text-right font-semibold">Có ghi chú</th>
                <th className="py-2 pr-3 font-semibold">Nạp lúc</th>
                <th className="py-2"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ w, n, notes, at }) => (
                <tr key={w} className="border-b border-line last:border-0" data-testid={`week-row-${w.replace('/', '-')}`}>
                  <td className="py-2 pr-3 font-bold">{w}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(n)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(notes)}</td>
                  <td className="py-2 pr-3">{at ? formatDateTime(at) : '—'}</td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <Button size="sm" onClick={() => { setWeek(w); nav('/'); }} aria-label={`Xem tuần ${w}`} data-testid="week-open">Xem</Button>{' '}
                    <Button size="sm" variant="danger" loading={del.isPending && del.variables === w} onClick={() => void remove(w)}
                      aria-label={`Xóa tuần ${w}`} data-testid="week-delete">Xóa</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
