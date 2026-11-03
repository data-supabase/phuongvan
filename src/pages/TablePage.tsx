import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TaskDrawer } from '@/components/drawer/TaskDrawer';
import { filterRows, hasFilter, type FilterState } from '@/components/table/filtering';
import { TaskTable } from '@/components/table/TaskTable';
import { Button, EmptyState, ErrorState, IconDownload, IconSearch, Skeleton, useToast } from '@/components/ui';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import { formatNumber } from '@/lib/format';
import { CAT_LABEL } from '@/lib/status';
import { emptyColFilters, useTableState } from '@/state/tableState';
import { useWeek } from '@/state/week';

export function TablePage() {
  const { rows, week, prevWeek, prevByKey, isLoading, error, refetch } = useWeek();
  const ts = useTableState();
  const { colFilters, cat, q, sortBy } = ts;
  const { widths, setWidth, persist, total } = useColumnWidths();
  const [openId, setOpenId] = useState<number | null>(null);
  const [qInput, setQInput] = useState(q);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  // tìm kiếm debounce 150 ms (F-TBL-3); q đổi từ ngoài (drill, xóa lọc) thì ô nhập theo
  useEffect(() => setQInput(q), [q]);
  useEffect(() => {
    if (qInput === q) return;
    const t = setTimeout(() => ts.setQ(qInput), 150);
    return () => clearTimeout(t);
  }, [qInput, q, ts]);

  // đổi tuần thì đóng drawer (drawer tự lưu ghi chú đang gõ khi gỡ)
  useEffect(() => setOpenId(null), [week]);
  // đến từ Dashboard với { open: id }: mở thẳng việc đó (chạy SAU effect trên khi mới vào trang)
  const location = useLocation();
  const openFromNav = (location.state as { open?: number } | null)?.open;
  useEffect(() => { if (openFromNav != null) setOpenId(openFromNav); }, [openFromNav, location.key]);
  useEffect(() => {
    if (openId != null && !isLoading) document.getElementById(`row-${openId}`)?.scrollIntoView({ block: 'center' });
  }, [openId, isLoading]);

  const state = useMemo<FilterState>(() => ({ filters: colFilters, q, cat }), [colFilters, q, cat]);
  const shown = useMemo(() => filterRows(rows, state, sortBy), [rows, state, sortBy]);
  const task = openId == null ? null : rows.find((r) => r.id === openId) ?? null;

  if (isLoading) return <TableSkeleton />;
  if (error) return <div data-testid="page-table"><ErrorState message={`Không tải được danh sách công việc: ${error.message}`} onRetry={refetch} /></div>;
  if (!rows.length) return <div data-testid="page-table"><EmptyState title="Chưa có dữ liệu" message="Tuần này chưa có công việc nào." /></div>;

  const doExport = async () => {
    setExporting(true);
    try {
      await (await import('@/lib/exportXlsx')).exportTasks(shown, week);
    } catch {
      toast('Không xuất được file Excel. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };
  const clearAll =() => { ts.setColFilters(emptyColFilters()); ts.setSortBy(null); ts.setCat(''); ts.setQ(''); setQInput(''); };

  return (
    <div data-testid="page-table" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="relative min-w-0 flex-1 basis-64 sm:max-w-md">
          <span className="sr-only">Tìm kiếm công việc</span>
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} data-testid="table-search"
            placeholder="Tìm trong nội dung, kết luận, tình hình, khó khăn…"
            className="h-10 w-full rounded-md border border-line-2 bg-surface pl-9 pr-3 text-base shadow-card transition-shadow duration-fast focus:border-accent focus:shadow-focus focus:outline-none"
          />
        </label>
        {cat && (
          <button
            type="button" onClick={() => ts.setCat('')} data-testid="cat-chip" aria-label={`Bỏ lọc trạng thái ${CAT_LABEL[cat]}`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 text-sm font-semibold text-accent-ink transition-colors duration-fast hover:bg-accent-line/40"
          >
            Trạng thái: {CAT_LABEL[cat]} <span aria-hidden="true">✕</span>
          </button>
        )}
        {hasFilter(state, sortBy) && <Button size="sm" onClick={clearAll} data-testid="clear-all">Xóa tất cả bộ lọc</Button>}
        <span className="tabular ml-auto whitespace-nowrap text-sm text-muted" data-testid="table-count" role="status">
          <b className="font-semibold text-ink-2">{formatNumber(shown.length)}</b> / {formatNumber(rows.length)} công việc
        </span>
        <Button size="sm" onClick={doExport} disabled={!shown.length || exporting} data-testid="export-xlsx">
          <IconDownload size={16} /> {exporting ? 'Đang xuất…' : 'Xuất Excel'}
        </Button>
      </div>

      <TaskTable
        shown={shown} allRows={rows} state={state} sort={sortBy} onSort={ts.setSortBy}
        onApplyFilter={(col, set) => ts.setColFilters((f) => ({ ...f, [col]: set ?? new Set<string>() }))}
        prevWeek={prevWeek} prevByKey={prevByKey} openId={openId} onOpen={setOpenId}
        widths={widths} total={total} onResize={setWidth}
        onResizeEnd={persist}
      />
      <TaskDrawer task={task} onClose={() => setOpenId(null)} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div data-testid="page-table" className="grid gap-3" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    </div>
  );
}
