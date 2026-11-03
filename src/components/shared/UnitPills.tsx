import { Pill } from '@/components/ui';
import { PTGD_HAI, PTGD_HAI_RX, subUnits } from '@/lib/units';

/** Đơn vị cấp 1 (đậm) và các bộ phận cấp 2 (nhạt) ngay bên dưới. `lead` = chuỗi gốc don_vi_dau_moi để dò cấp 2. */
export function UnitPills({ units, lead = '' }: { units: string[]; lead?: string }) {
  const subs = lead ? subUnits(lead) : [];
  // PTGĐ Hải: đầu mối gốc (TMDV, KVF...) hiện ở cấp 2 (chỉ để xem, không có trong bộ lọc); đầu mối chính là ông Hải thì thôi
  if (lead.trim() && units.includes(PTGD_HAI) && !PTGD_HAI_RX.test(lead)) subs.push(`${PTGD_HAI} › ${lead.trim()}`);
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
