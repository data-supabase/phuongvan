import type { Task } from '@/types/app';

// Cùng thứ tự và tiêu đề với COLUMNS trong TaskTable (cộng cột #)
const HEADERS = [
  '#', 'Thông tin cuộc họp', 'Tên công việc', 'Nội dung kết luận', 'Tình hình thực hiện', 'Đơn vị phụ trách',
  'Đơn vị phối hợp', 'Deadline', 'Trạng thái', 'Khó khăn, kiến nghị', 'Từ sheet', 'Ghi chú',
];
const WIDTHS = [5, 28, 40, 48, 48, 20, 20, 14, 18, 36, 14, 28];

export function toSheetRows(rows: Task[]): (string | number)[][] {
  return [
    HEADERS,
    ...rows.map((r, i) => [
      i + 1, r.thong_tin_cuoc_hop, r.noi_dung, r.ket_luan, r.tinh_hinh, r.don_vi_dau_moi,
      r.don_vi_phoi_hop, r.thoi_han, r.tinh_trang, r.kho_khan, r.sheet, r.ghi_chu ?? '',
    ]),
  ];
}

export async function exportTasks(rows: Task[], week: string): Promise<void> {
  const XLSX = await import('xlsx'); // tải lười: không làm nặng bundle chính
  const ws = XLSX.utils.aoa_to_sheet(toSheetRows(rows));
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Công việc');
  // 0.18.5 bản cộng đồng không ghi style (wrap/freeze) nên bỏ qua
  XLSX.writeFile(wb, `Bao-cao-tuan-${week.replace(/\//g, '-')}-${rows.length}-viec.xlsx`);
}
