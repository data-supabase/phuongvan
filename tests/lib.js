// Nạp hàm thuần từ ../app.js lúc chạy test (không copy code).
const fs = require('fs'), path = require('path'), vm = require('vm'), { webcrypto } = require('crypto');
const XLSX = require('xlsx');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'legacy', 'index.html'), 'utf8');
const JS = fs.readFileSync(path.join(__dirname, '..', 'legacy', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const cut = JS.indexOf('const db = supabase.createClient'); // phần trước là bộ phân loại Excel (không cần Supabase)
if (cut < 0) throw new Error('Không tìm thấy điểm tách bộ phân loại trong app.js');
const scripts = [JS.slice(0, cut), JS.slice(cut)];
const pick = (src, re, what) => { const m = src.match(re); if (!m) throw new Error('Không tìm thấy trong app.js: ' + what); return m[0]; };

// phần 1 (bộ phân loại) chạy nguyên khối; console.assert tự kiểm của app được gom vào selfCheckFails
const selfCheckFails = [];
const ctx = vm.createContext({ XLSX, crypto: webcrypto, TextEncoder, console: { assert: (c, m) => { if (!c) selfCheckFails.push(m); } } });
vm.runInContext(scripts[0] + '\n;this.api={matchUnits,subUnits,meetingName,classifyWorkbook,PHONG_KT};', ctx);

// phần 2: chỉ lấy các hàm thuần theo tên
const s2 = scripts[1];
const ctx2 = vm.createContext({});
vm.runInContext([
  pick(s2, /function statusClass[\s\S]*?\n}\n/, 'statusClass'),
  pick(s2, /function makeUsername[\s\S]*?\n}\n/, 'makeUsername'),
  pick(s2, /const uniqueUsername = .*\n/, 'uniqueUsername'),
  pick(s2, /const weekNum = .*\n/, 'weekNum'),
  pick(s2, /const normWeek = .*\n/, 'normWeek'),
  pick(s2, /const loginEmail = .*\n/, 'loginEmail'),
  'this.api={statusClass,makeUsername,uniqueUsername,weekNum,normWeek,loginEmail};',
].join('\n'), ctx2);
vm.runInContext('var AUTH_DOMAIN="bctuan.local";', ctx2);
module.exports = { ...ctx.api, ...ctx2.api, XLSX, selfCheckFails, HTML, JS };
