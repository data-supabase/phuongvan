# Audit bộ phân loại (tuần 44/2026)

Phạm vi: chỉ đọc `index.html` (dòng 2298-2383), không sửa. Chạy đúng mã JS gốc bằng node + xlsx 0.18.5 trên `Tuan 44.2026 - Bao cao tuan.xlsx` (50 sheet), rồi quét độc lập mọi ô "Đơn vị đầu mối" / "Đơn vị chủ trì".
Script: `C:\Users\benhhc\AppData\Local\Temp\claude\c--Users-benhhc-Desktop-tao-lao-phuong-van\76480f20-04c9-4a9f-b0c7-29a5df81e823\scratchpad\audit\a.js` (b.js, c.js, d.js là các lần quét phụ).

## Kết luận nhanh

- Bộ phân loại trả về **213 dòng** (KT 106, CĐS 44, NCPT 40, ĐCM 28; một dòng có thể thuộc nhiều đơn vị). Khớp số kỳ vọng.
- Số đúng theo quy tắc nghiệp vụ là **215**: mất 2 dòng do ô "Đơn vị đầu mối" bị gộp ô (Cao). Không có dòng trùng khóa, không có false positive.
- 1 sheet bị bỏ qua: `PL4.Ke hoach muc tieu` (không có cột đầu mối). Đúng, vì là biểu mục tiêu.

## 1. Mọi chuỗi "Đơn vị đầu mối" và cách ánh xạ

Được nhận (khớp cấp 1):
- `KT` (54), `Ban KT` (27), `KT; ĐCM`, `KT; KD`, `KT; KD; TCKT; PCTT`, `Ban KT; Ban QLDA`, `Ban KT/ TMDV`, `Ban KHCL, TCKT, KD, PC&TT, KT và QLDA CN.` => KT
- `CĐS` (40), `CĐS; TCKT`, `TMDV, TCKT, Ban CĐS` => CĐS
- `NCPT` (17), `TTNC` (12), `TT NCPT`, `NCPT; TMDV`, `NCPT, TMDV, SPM`, `SPM; NCPT`, `TMDV, TT NCPT`, `TMDV/TT NCPT` => NCPT
- `ĐCM` (21), `QLDA; KHCL; ĐCM` => ĐCM
- `TTNC; CĐS; TCKT; KD; MKT; QTNL; QLDA; KHCL` => CĐS + NCPT
- `Ban KT-P.CNATMT`, `Ban KT-P.NCƯD`, `Ban KT-Tổ NCS` => KT › P.CNATMT / P.NCƯD / Tổ NCS (đúng)
- `Phòng KT` (8), `CN TMDV (Phòng KT)`, `CN TMDV (Phòng KT, Phòng KD)`, `CNTMDV (Phòng TH, KT,KD)` => KT › Phòng KT (CN TMDV) (đúng)

Bị loại (đúng): `KTNB` (9), `TCKT` (53), `MKT` (16), `Ban MKT`, `Phòng KD`, `Phòng TH`, `CNTMDV (Phòng KD)`, `CNTMDV (Phòng KD, TH)`, `Phòng TH, Phòng KD`, `TMDV`, `CN TMDV`, `Chi nhánh TMDV`, `QLDA`, `KHCL`, `KD`, `QTNL`, `PCTT`, `SPM`, `PPC`, `KVF`, `TM`, `VP`, `VP HĐQT`, `Công đoàn`, `Ban CBDA`, `Ban điều hành`, `Ban lãnh đạo`, `Các Ban/Đơn vị...`, `Các Tổ Chuyên môn`, `Tổ QC`, `Tổ CƯVT&DV`, `ĐTN`, `VPĐD Campuchia`, `-`, các chuỗi tên người (P.TGĐ..., PTGĐ Đinh Như Cường/...) và `Đơn vị tư vấn\r\nBan KHCL, TCKT.`.

Không có chuỗi nào trong file mà mã hóa regex sai theo quy tắc đã chốt. Lưu ý quy tắc, không phải lỗi: `Các Ban/Đơn vị liên quan` và `Ban/Đơn vị` bị loại (không nêu KT cụ thể).

## 2. False positive / false negative

False positive: **không có** (đã soát 213 dòng; mọi dòng đều có token KT/CĐS/NCPT/TTNC/ĐCM hoặc "Phòng KT" trong ô đầu mối).

False negative:
- **Cao** `PL3.34 1645 KH CN TMDV` dòng 13 và 14: ô đầu mối `Ban KT/ TMDV` là ô gộp F12:F14, `sheet_to_json` chỉ giữ giá trị ở dòng 12, hai dòng sau rỗng nên bị `continue`. Nội dung: "Gia tăng giá trị và mở rộng hoạt động kinh doanh CO₂ thực phẩm..." và "Nghiên cứu phương án khai thác 40.000 tấn nitơ lỏng...". Đây là nguyên nhân 213 thay vì 215.
- Thấp (không sửa được bằng code, cần người xác nhận): dòng có đầu mối rỗng thật nhưng có nội dung: `PL3.36 1752` dòng 5 (kết luận P.TGĐ Nguyễn Duy Hải và Trần Thế Cường, dòng trên là Ban KT), `PL3.29 1487` dòng 16 (phối hợp PPC), `PL3.39 1892` dòng 6, `PL3.18A 1141` dòng 8 ("Dịch vụ hồ sơ cấp độ An toàn thông tin", ô chủ trì rỗng). Không có bằng chứng thuộc KT/CĐS/NCPT/ĐCM nên để nguyên, nhưng nên báo người dùng.
- Các dòng "đầu mối rỗng" còn lại trong PL1, PL2, PL3.1, PL3.4, PL3.6... là dòng tiêu đề nhóm ("Khối Nhà máy, KT, TTNCPT, CĐS", "Chỉ đạo chung", "Ban KD"...). Bỏ qua là đúng.

## 3. Phát hiện tiêu đề

- 49/50 sheet tìm đúng dòng tiêu đề (chỉ số 2 hoặc 3, trong giới hạn 15 dòng). Cột đầu mối đúng ở mọi sheet.
- `PL3.19. 04 BDTT` có cả "Chủ trì" (tên người) và "Đơn vị đầu mối": mã chọn đúng "đầu mối".
- `PL3.18A 1141 tu van` chỉ có "Đơn vị chủ trì" (fallback đúng) và **không có cột Thời hạn** (thoi_han rỗng cả sheet).
- Cột kết luận có tên khác nhau theo sheet (Kết luận của TGĐ..., của Chủ tịch HĐQT, của PTGĐ...): `startsWith('kết luận')` bắt đúng ở tất cả.
- `PL3.22 1254 TTNC` dùng "Thời hạn" thay vì "Thời hạn hoàn thành": `startsWith('thời hạn')` vẫn đúng.
- **Trung bình** `PL3.18A`, dòng 9 (đầu mối CĐS, Chưa có Tình trạng): giá trị "HỦY" nằm nhầm ở cột "Khó khăn vướng mắc", nên Tình trạng rỗng và UI hiển thị "Đang thực hiện" cho một việc đã hủy.

## 4. Dòng mất / gộp

- Mất 2 dòng do ô gộp đầu mối (mục 2).
- Ô gộp ở cột Nội dung (31 dòng thuộc KT/CĐS/NCPT/ĐCM, vd PL3.22, PL3.21, PL3.38, PL1.TBKLGBT9, PL3.TBKL Ban dieu hanh): dòng tiếp theo có `noi_dung` rỗng, chỉ có kết luận. Dòng không bị mất (còn `ket_luan`) nhưng UI hiện "(không ghi)". **Trung bình**.
- **Trùng khóa: 0** (213 khóa SHA-256 khác nhau). Không có dòng trống có nội dung bị bỏ nhầm ngoài các trường hợp ở mục 2.
- **Trung bình, rủi ro tiềm ẩn**: workbook có 2 sheet tên chỉ khác dấu cách cuối: `"PL2 NQ HDQT 2070"` và `"PL2 NQ HDQT 2070 "`. `row.sheet = name.trim()` nên khóa băm của hai sheet trùng namespace. Tuần này chưa va chạm; nếu hai sheet có dòng giống hệt (nội dung, kết luận, đầu mối) thì một dòng bị nuốt. Ngoài ra `meetingName` cho hai sheet này cũng sẽ giống nhau.
- Dòng thiếu thời hạn (kể cả hiển thị): 9 dòng KT/CĐS/NCPT/ĐCM rỗng thời hạn (PL1 T10 d19, PL1.T8 d14, PL2 NQ HDQT 2070 d5, PL1.T9 d13, PL3.TBKL Ban dieu hanh d5-7 và PL3.18A cả sheet). Thấp.

## 5. Chuẩn hóa Tình trạng

Giá trị trong 213 dòng: `Đang triển khai` 116, `Hoàn thành` 57, `Đang triển khai chậm tiến độ` 29, `Chưa triển khai` 6, `Quá hạn` 1, `Đang thực hiện` 1, rỗng 3 (PL3.TBKL Ban dieu hanh d5, d9; PL3.18A d9).

`statusClass` (dòng 2402) ánh xạ đúng cả 4 nhóm: "Đang triển khai" và rỗng rơi vào `st-doing` (mặc định), "chậm tiến độ" và "Quá hạn" vào `st-late`. Chuỗi thô không bị đổi (chỉ lớp CSS), nên cột Tình trạng hiển thị vẫn là 7 giá trị thô.
- **Thấp** chuỗi "Chưa hoàn thành" sẽ bị xếp `st-done` vì kiểm tra "hoàn thành" trước "chưa". Chưa xuất hiện trong dữ liệu.
- **Thấp** "HỦY"/"Hủy" không có nhóm riêng (xem mục 3).

## 6. Đề xuất sửa (chưa áp dụng)

1. **Cao**, điền xuống ô gộp. Ngay sau dòng 2359 trong `classifyWorkbook`:
```js
for (const m of wb.Sheets[name]['!merges'] || [])
  if (m.s.r > 0 && m.e.r > m.s.r) for (let r = m.s.r + 1; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++)
    if (rows[r] && rows[r][c] == null) rows[r][c] = rows[m.s.r][m.s.c];
```
   Cẩn thận: điền xuống mọi cột làm `noi_dung` được lặp ở dòng tiếp theo (giải quyết luôn "(không ghi)") nhưng các ô gộp ngang như `C5:H5` (tiêu đề nhóm) sẽ trải sang `ket_luan` và tạo dòng giả. Nên chỉ điền xuống khi `m.s.c === m.e.c` (gộp dọc), và đặt điều kiện `r > hi` sau khi biết `hi`. Điền xuống `noi_dung` sẽ thay đổi `row.key` (băm gồm `noi_dung`) nên sẽ lệch khóa so với dữ liệu các tuần đã nạp: nếu cần giữ khóa, chỉ điền xuống cho cột `don_vi_dau_moi` (và tùy chọn `noi_dung` chỉ để hiển thị, tách khỏi đầu vào băm).
2. **Trung bình**, tránh va chạm khóa giữa hai sheet cùng tên sau `trim`: dùng tên gốc trong khóa băm, `sha256([name, rec.noi_dung, rec.ket_luan, rec.don_vi_dau_moi].join('|'))` (dòng 2378). Đổi khóa chung của mọi dòng một lần, cần báo trước vì phá so sánh "so với tuần trước".
3. **Thấp**, `statusClass`: kiểm tra "chưa" trước "hoàn thành": đổi thứ tự sang `if (s.includes('chưa')) return 'st-todo'` trước dòng `hoàn thành`, và thêm `if (s.includes('hủy')) return 'st-todo'` nếu người dùng muốn gom việc đã hủy.

## Chưa kiểm tra

Không mở Excel gốc bằng Excel (chỉ SheetJS, cùng bản 0.18.5 như trình duyệt), không kiểm tra giao diện hay Supabase.
