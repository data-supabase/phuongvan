import { describe, expect, it } from 'vitest';
import {
  computeOverview, deltaText, deltaTone, lateMeetings, unitBreakdown, unitRiskRanking, weekSeries,
} from '../../src/components/dashboard/stats';

const t = (tinh_trang: string, units: string[] = ['KT'], extra: object = {}) =>
  ({ tinh_trang, units, tuan: '44/2026', thong_tin_cuoc_hop: 'Họp A', ...extra });

describe('deltaTone / deltaText', () => {
  it('GOOD_UP semantics', () => {
    expect(deltaTone(3, true)).toBe('good');
    expect(deltaTone(-3, true)).toBe('bad');
    expect(deltaTone(3, false)).toBe('bad');
    expect(deltaTone(-1, false)).toBe('good');
    expect(deltaTone(5, null)).toBe('neutral');
    expect(deltaTone(0, true)).toBe('neutral');
  });
  it('text', () => {
    expect(deltaText(3)).toBe('▲3');
    expect(deltaText(-2)).toBe('▼2');
    expect(deltaText(0)).toBe('=');
  });
});

describe('computeOverview', () => {
  const rows = [t('Hoàn thành'), t('Hoàn thành'), t('Triển khai chậm'), t('Chưa triển khai')];
  it('không có tuần trước thì không có delta', () => {
    const o = computeOverview(rows, null);
    expect(o).toMatchObject({ total: 4, donePct: 50, risk: 2, prev: null, donePctDelta: null, riskDelta: null });
  });
  it('delta điểm % và số việc cần chú ý', () => {
    const o = computeOverview(rows, [t('Hoàn thành'), t('Triển khai chậm'), t('Triển khai chậm'), t('Triển khai chậm')]);
    expect(o.donePctDelta).toBe(25); // 50% - 25%
    expect(o.riskDelta).toBe(-1); // 2 - 3
    expect(o.prev?.counts.late).toBe(3);
  });
  it('tuần rỗng không chia cho 0', () => {
    expect(computeOverview([], null).donePct).toBe(0);
  });
});

describe('unitBreakdown / unitRiskRanking', () => {
  const rows = [
    t('Triển khai chậm', ['KT']), t('Hoàn thành', ['KT']), t('Hoàn thành', ['KT']), t('Hoàn thành', ['KT']),
    t('Triển khai chậm', ['CĐS']), t('Hoàn thành', ['CĐS']),
    t('Triển khai chậm', ['NCPT', 'CĐS']),
  ];
  it('trả đủ 5 đơn vị kể cả 0 việc, đúng thứ tự', () => {
    const b = unitBreakdown(rows);
    expect(b.map((x) => x.unit)).toEqual(['KT', 'CĐS', 'NCPT', 'ĐCM', 'PTGĐ Hải']);
    expect(b[3].total).toBe(0);
    expect(b[1].total).toBe(3); // việc đa đơn vị tính vào từng đơn vị
  });
  it('xếp theo tỷ lệ chậm giảm dần, bỏ đơn vị 0 việc', () => {
    const r = unitRiskRanking(unitBreakdown(rows));
    expect(r.map((x) => x.unit)).toEqual(['NCPT', 'CĐS', 'KT']); // 100%, 67%, 25%
  });
  it('hòa tỷ lệ thì số việc chậm nhiều hơn đứng trước', () => {
    const r = unitRiskRanking(unitBreakdown([
      t('Triển khai chậm', ['KT']), t('Hoàn thành', ['KT']),
      t('Triển khai chậm', ['CĐS']), t('Triển khai chậm', ['CĐS']), t('Hoàn thành', ['CĐS']), t('Hoàn thành', ['CĐS']),
    ]));
    expect(r.map((x) => x.unit)).toEqual(['CĐS', 'KT']);
  });
});

describe('weekSeries', () => {
  const weeks = Array.from({ length: 10 }, (_, i) => `${40 + i}/2026`);
  const rows = weeks.flatMap((w, i) => Array.from({ length: i + 1 }, () => t('Hoàn thành', ['KT'], { tuan: w })));
  it('lấy 8 tuần cuối, đúng tổng', () => {
    const s = weekSeries(rows, weeks);
    expect(s).toHaveLength(8);
    expect(s[0].week).toBe('42/2026');
    expect(s.at(-1)).toMatchObject({ week: '49/2026', total: 10 });
  });
  it('ít hơn 8 tuần thì lấy hết', () => {
    expect(weekSeries(rows, weeks.slice(0, 3))).toHaveLength(3);
  });
});

describe('lateMeetings', () => {
  it('chỉ đếm việc chậm, gộp khoảng trắng, top theo số lượng', () => {
    const rows = [
      t('Triển khai chậm', ['KT'], { thong_tin_cuoc_hop: 'Họp  A' }),
      t('Triển khai chậm', ['KT'], { thong_tin_cuoc_hop: 'Họp A ' }),
      t('Triển khai chậm', ['KT'], { thong_tin_cuoc_hop: 'Họp B' }),
      t('Hoàn thành', ['KT'], { thong_tin_cuoc_hop: 'Họp C' }),
    ];
    expect(lateMeetings(rows)).toEqual([{ meet: 'Họp A', count: 2 }, { meet: 'Họp B', count: 1 }]);
  });
  it('giới hạn 8 và rỗng khi không có việc chậm', () => {
    const many = Array.from({ length: 12 }, (_, i) => t('Triển khai chậm', ['KT'], { thong_tin_cuoc_hop: 'H' + i }));
    expect(lateMeetings(many)).toHaveLength(8);
    expect(lateMeetings([t('Hoàn thành')])).toEqual([]);
  });
});
