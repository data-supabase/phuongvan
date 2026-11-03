const { test } = require('node:test'), assert = require('node:assert/strict');
const L = require('./lib');
const S = s => [...L.subUnits(s)];
const U = (s) => L.matchUnits(s).join(',');

test('self-check console.assert của app không lỗi', () => assert.deepEqual(L.selfCheckFails, []));

test('makeUsername', () => {
  const m = L.makeUsername;
  assert.equal(m('Lê Thái Bão'), 'baolt');
  assert.equal(m('Huỳnh Phương Vân'), 'vanhp');
  assert.equal(m('Đặng Đức Anh'), 'anhdd');
  assert.equal(m('đinh'), 'dinh');
  assert.equal(m('Vân'), 'van');
  assert.equal(m('  Lê   Thái  Bão  '), 'baolt');
  assert.equal(m('Nguyễn Văn A2'), 'a2nv');
  assert.equal(m(''), '');
  assert.equal(m('   '), '');
  assert.equal(m('!!! ???'), '');
  assert.equal(m('Lê Thái Bão'.normalize('NFD')), 'baolt'); // dạng tổ hợp
});
test('uniqueUsername', () => {
  const S = s => [...L.subUnits(s)];
const u = L.uniqueUsername;
  assert.equal(u('baolt', new Set()), 'baolt');
  assert.equal(u('baolt', new Set(['baolt'])), 'baolt1');
  assert.equal(u('baolt', new Set(['baolt', 'baolt1', 'baolt2'])), 'baolt3');
  assert.equal(u('', new Set()), '');
});
test('loginEmail', () => {
  assert.equal(L.loginEmail(' BaoLT '), 'baolt@bctuan.local');
  assert.equal(L.loginEmail('A@x.com'), 'a@x.com');
});
test('normWeek / weekNum', () => {
  assert.equal(L.normWeek(' 05 / 2026 '), '5/2026');
  assert.equal(L.normWeek('44/2026'), '44/2026');
  assert.equal(L.normWeek('45'), null);
  assert.equal(L.normWeek('1/26'), null);
  assert.equal(L.normWeek('123/2026'), null);
  assert.equal(L.normWeek(''), null);
  assert.ok(L.weekNum('52/2025') < L.weekNum('1/2026'));
  assert.ok(L.weekNum('9/2026') < L.weekNum('10/2026'));
});
test('statusClass', () => {
  const s = L.statusClass;
  assert.equal(s('Hoàn thành'), 'st-done');
  assert.equal(s('Triển khai chậm'), 'st-late');
  assert.equal(s('Quá hạn'), 'st-late');
  assert.equal(s('Chưa triển khai'), 'st-todo');
  assert.equal(s('Đang thực hiện'), 'st-doing');
  assert.equal(s(null), 'st-doing');
  assert.notEqual(s('Chưa hoàn thành'), 'st-done');
});
test('matchUnits', () => {
  assert.equal(U('Ban KT'), 'KT');
  assert.equal(U('Ban KT-Tổ NCS'), 'KT');
  assert.equal(U('Phòng KT'), 'KT');
  assert.equal(U('CĐS'), 'CĐS');
  assert.equal(U('Ban Chuyển đổi số'), 'CĐS');
  assert.equal(U('Ban NCPT'), 'NCPT');
  assert.equal(U('TTNC'), 'NCPT');
  assert.equal(U('ĐCM'), 'ĐCM');
  assert.equal(U('Nhà máy Đạm Cà Mau'), 'ĐCM');
  assert.equal(U('Ban TCKT'), '');
  assert.equal(U('KTNB'), '');
  assert.equal(U('Ban KT, CĐS'), 'KT,CĐS');
  assert.equal(U('KT; ĐCM; KD'), 'KT,ĐCM');
  assert.equal(U('Phòng KD'), '');
  assert.equal(U(''), '');
  assert.equal(U('ban kt'), 'KT'); // cờ i
});
test('subUnits', () => {
  assert.deepEqual(S('Ban KT-Tổ NCS'), ['KT › Tổ NCS']);
  assert.deepEqual(S('Ban KT'), []);
  assert.deepEqual(S('Phòng KT'), ['KT › ' + L.PHONG_KT]);
  assert.deepEqual(S('Ban KT – Tổ A; CĐS-Nhóm B'), ['KT › Tổ A', 'CĐS › Nhóm B']);
});
test('meetingName', () => {
  assert.equal(L.meetingName('TBKLGB T9', []), 'TBKL Giao ban Cty tháng 9');
  assert.equal(L.meetingName('TBKLGB T10', []), 'TBKL Giao ban Cty tháng 10');
  assert.equal(L.meetingName('Sheet1 ', [['Họp A (Đính kèm x)']]), 'Họp A [Sheet1]');
  assert.equal(L.meetingName(' S ', []), 'S');
});
test('todo: quy tắc chưa rõ (KT-Tổ trong ngoặc, CN TMDV không có Phòng KT)', { todo: true }, () => {});



