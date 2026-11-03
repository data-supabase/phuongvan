// Kiểu dữ liệu viết tay theo docs/api-contract.md §1 (không có database.ts do backend sinh).

export type Role = 'admin' | 'editor' | 'viewer';

export interface Task {
  id: number;
  tuan: string; // "<tuần>/<năm>", không có số 0 ở đầu
  key: string; // unique (tuan, key)
  sheet: string;
  thong_tin_cuoc_hop: string;
  noi_dung: string;
  ket_luan: string;
  tinh_hinh: string;
  don_vi_dau_moi: string;
  don_vi_phoi_hop: string;
  tinh_trang: string;
  kho_khan: string;
  thoi_han: string;
  ghi_chu: string | null;
  units: string[];
  units_phoi_hop: string[];
  deadline_tu: string | null; // cột cũ, không dùng, không xóa
  deadline_den: string | null;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: Role;
  active: boolean;
  pending: boolean;
  requested_at: string | null;
  avatar_path: string | null;
  created_at: string;
}

/** Khóa 11 cột có lọc của Bảng (trừ cột #), giữ đúng data-col của legacy. */
export type ColKey = 'meet' | 'name' | 'kl' | 'th' | 'unit' | 'ph' | 'dl' | 'st' | 'kk' | 'sh' | 'gc';
