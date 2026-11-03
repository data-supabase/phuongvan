import { useMemo } from 'react';
import { KpiCards, ProgressHero } from '@/components/dashboard/Overview';
import { RiskTable } from '@/components/dashboard/RiskTable';
import { LateMeetings } from '@/components/dashboard/charts/LateMeetings';
import { UnitBars } from '@/components/dashboard/charts/UnitBars';
import { WeekTrend } from '@/components/dashboard/charts/WeekTrend';
import { DueSoonCard } from '@/components/dashboard/DueSoonCard';
import { WeekChangesCard } from '@/components/dashboard/WeekChangesCard';
import { stagger } from '@/components/dashboard/parts';
import {
  computeOverview, lateMeetings, unitBreakdown, unitRiskRanking, weekSeries,
} from '@/components/dashboard/stats';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { useTableState } from '@/state/tableState';
import { useWeek } from '@/state/week';

function DashboardSkeleton() {
  return (
    <div className="grid gap-4" data-testid="dashboard-skeleton" aria-busy="true" aria-label="Đang tải dữ liệu">
      <Skeleton className="h-52 rounded-xl" />
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { isLoading, error, refetch, rows, week, weeks, dbRows, prevWeek, prevByKey } = useWeek();
  const { drill } = useTableState();

  const d = useMemo(() => {
    const prevRows = prevWeek ? [...prevByKey.values()] : null;
    const units = unitBreakdown(rows);
    return {
      prevRows,
      overview: computeOverview(rows, prevRows),
      units,
      ranking: unitRiskRanking(units),
      series: weekSeries(dbRows.filter((r) => r.units?.length), weeks),
      meetings: lateMeetings(rows),
    };
  }, [rows, dbRows, weeks, prevWeek, prevByKey]);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <Card data-testid="page-dashboard"><ErrorState message={error.message} onRetry={refetch} /></Card>;
  if (!rows.length) return <Card data-testid="page-dashboard"><EmptyState message="Chưa có dữ liệu." /></Card>;

  const { overview: o } = d;
  const cat = (c: 'done' | 'doing' | 'late' | 'todo') => drill({ cat: c });
  return (
    <div className="grid gap-4" data-testid="page-dashboard">
      <ProgressHero o={o} prevWeek={prevWeek} onDrill={cat} />
      <KpiCards o={o} prevWeek={prevWeek} onDrill={cat} />
      <p className="-mt-1 text-sm text-muted" data-testid="dash-total">
        Tổng: <b className="text-ink">{formatNumber(o.total)}</b> công việc
        {o.prev && <> · tuần {prevWeek}: {formatNumber(o.prev.total)}</>}
      </p>

      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <Card title="Đơn vị cần chú ý" description="Xếp theo tỷ lệ việc triển khai chậm" className="animate-rise-in lg:col-span-2" style={stagger(5)} data-testid="card-risk">
          {d.ranking.length ? <RiskTable stats={d.ranking} onDrill={drill} /> : <EmptyState message="Chưa có dữ liệu." />}
        </Card>
        <DueSoonCard rows={rows} />
        <WeekChangesCard rows={rows} prevWeek={prevWeek} prevByKey={prevByKey} prevRows={d.prevRows ?? []} />
        <Card title="Trạng thái theo đơn vị" description="Độ dài thanh tỉ lệ với số việc" className="animate-rise-in" style={stagger(6)} data-testid="card-units">
          <UnitBars stats={d.units} onDrill={drill} />
        </Card>
        <Card title="Cuộc họp có nhiều việc chậm nhất" description="Tuần đang xem, tối đa 8 cuộc họp" className="animate-rise-in" style={stagger(7)} data-testid="card-late">
          <LateMeetings items={d.meetings} onDrill={drill} />
        </Card>
        <Card title="Xu hướng 8 tuần gần nhất" description="Số công việc theo trạng thái; tuần đang xem được tô nền" className="animate-rise-in lg:col-span-2" style={stagger(8)} data-testid="card-trend">
          <WeekTrend series={d.series} current={week} onDrill={drill} />
        </Card>
      </div>
    </div>
  );
}
