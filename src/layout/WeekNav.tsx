import { IconChevronLeft, IconChevronRight, Select } from '@/components/ui';
import { useSetWeekByStep, useWeek, useWeekOptions } from '@/state/week';

/** Năm, Tuần trong năm, nút trước/sau (khóa ở hai đầu). Đổi năm thì mở tuần mới nhất của năm đó (F-WEEK-2). */
export function WeekNav() {
  const { weeks, week, setWeek } = useWeek();
  const { years, year, inYear } = useWeekOptions();
  const step = useSetWeekByStep();
  const i = weeks.indexOf(week);
  const none = !weeks.length;
  const btn =
    'grid size-8 place-items-center rounded-md text-ink-2 transition-colors duration-fast hover:bg-surface-2 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent';
  return (
    <div role="group" aria-label="Chọn tuần" data-testid="week-nav" className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
      <button type="button" aria-label="Tuần trước" data-testid="week-prev" className={btn} disabled={i <= 0} onClick={() => step(-1)}>
        <IconChevronLeft size={16} />
      </button>
      <Select
        variant="bare" aria-label="Chọn năm" data-testid="year-select" disabled={none} value={year}
        onChange={(e) => setWeek(weeks.filter((x) => x.endsWith('/' + e.target.value)).at(-1)!)}
      >
        {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
      </Select>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <Select variant="bare" aria-label="Chọn tuần" data-testid="week-select" disabled={none} value={week} onChange={(e) => setWeek(e.target.value)}>
        {inYear.map((w) => <option key={w} value={w}>Tuần {w.split('/')[0]}</option>)}
      </Select>
      <button type="button" aria-label="Tuần sau" data-testid="week-next" className={btn} disabled={i < 0 || i >= weeks.length - 1} onClick={() => step(1)}>
        <IconChevronRight size={16} />
      </button>
    </div>
  );
}
