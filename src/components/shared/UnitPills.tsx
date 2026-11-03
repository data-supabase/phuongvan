import { Pill } from '@/components/ui';
import { subUnits } from '@/lib/units';

/** Đơn vị cấp 1 (đậm) và các bộ phận cấp 2 (nhạt) ngay bên dưới. `lead` = chuỗi gốc don_vi_dau_moi để dò cấp 2. */
export function UnitPills({ units, lead = '' }: { units: string[]; lead?: string }) {
  const subs = lead ? subUnits(lead) : [];
  return (
    <div className="flex flex-wrap items-start gap-1.5" data-testid="unit-pills">
      {units.map((u) => (
        <span key={u} className="inline-flex flex-col items-start gap-1">
          <Pill>{u}</Pill>
          {subs.filter((s) => s.startsWith(u + ' ›')).map((s) => (
            <Pill key={s} variant="sub">{s.slice(u.length + 3)}</Pill>
          ))}
        </span>
      ))}
    </div>
  );
}
