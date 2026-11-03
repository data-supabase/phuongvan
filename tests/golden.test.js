// Chạy với UPDATE_GOLDEN=1 để ghi lại golden sau khi chủ ý đổi bộ phân loại.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const L = require('./lib');
const GOLD = path.join(__dirname, 'golden-week44.json');

test('classifyWorkbook khớp golden tuần 44/2026', async () => {
  const wb = L.XLSX.read(fs.readFileSync(path.join(__dirname, 'fixtures', 'week44.xlsx')));
  const { rows, skipped } = await L.classifyWorkbook(wb);
  const count = (f) => { const o = {}; rows.forEach(r => [].concat(f(r)).forEach(k => o[k] = (o[k] || 0) + 1)); return Object.fromEntries(Object.entries(o).sort()); };
  const got = {
    total: rows.length,
    skipped: [...skipped].sort(),
    perSheet: count(r => r.sheet),
    perUnit: count(r => [...r.units]),
    perStatusClass: count(r => L.statusClass(r.tinh_trang)),
    perStatusRaw: count(r => r.tinh_trang || '(trống)'),
    perSubUnit: count(r => [...L.subUnits(r.don_vi_dau_moi)]),
  };
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLD, JSON.stringify(got, null, 2));
  assert.ok(rows.length > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(got)), JSON.parse(fs.readFileSync(GOLD, 'utf8')));
});
