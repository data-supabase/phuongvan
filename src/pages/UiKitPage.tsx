import { useState } from 'react';
import {
  Avatar, Button, Card, EmptyState, ErrorState, Input, Modal, Pill, Select, Skeleton, StackBar, StatusPill, Textarea,
  useDialog, useToast,
} from '@/components/ui';
import { CATS, CAT_FILL, type Cat } from '@/lib/status';

// Trang xem thử bộ UI: chỉ có khi chạy `npm run dev` (route /__ui), không vào bản build.
export default function UiKitPage() {
  const dialog = useDialog();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const segs = CATS.map(([k, label], i) => ({
    value: [18, 7, 4, 3][i], color: CAT_FILL[k as Cat], tip: `${label}: ${[18, 7, 4, 3][i]}`, label: `${[56, 22, 13, 9][i]}%`, onClick: () => toast(label),
  }));
  return (
    <div className="grid gap-5" data-testid="ui-kit">
      <Card title="Thang chữ" description="Be Vietnam Pro 400–800">
        <p className="text-display font-extrabold">92%</p>
        <p className="text-3xl font-bold">Dashboard 30</p>
        <p className="text-2xl font-bold">Tiêu đề trang 24</p>
        <p className="text-xl font-bold">Tiêu đề lớn 20</p>
        <p className="text-md font-bold">Tiêu đề thẻ 15</p>
        <p className="text-base">Nội dung 14: Phương Văn — Hoàn thành công việc đúng hạn.</p>
        <p className="text-sm text-muted">Phụ đề 13 · số liệu 1.234.567,89</p>
        <p className="eyebrow mt-2">Nhãn nhỏ viết hoa</p>
      </Card>
      <Card title="Nút" className="flex flex-wrap gap-2">
        <Button variant="primary">Chính</Button>
        <Button>Phụ</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Xóa</Button>
        <Button variant="link">Liên kết</Button>
        <Button variant="primary" loading>Đang gửi</Button>
        <Button disabled>Vô hiệu</Button>
        <Button size="sm">Nhỏ</Button>
      </Card>
      <Card title="Ô nhập">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Họ và tên" placeholder="vd: Huỳnh Phương Vân" />
          <Input label="Có lỗi" defaultValue="abc" error="Tối thiểu 8 ký tự." />
          <Select label="Vai trò"><option>Xem</option><option>Nhập liệu</option></Select>
          <Textarea label="Ghi chú" hint="Tự lưu khi rời ô." />
        </div>
      </Card>
      <Card title="Nhãn, trạng thái, avatar" className="flex flex-wrap items-center gap-3">
        <StatusPill text="Hoàn thành" /><StatusPill text="Đang thực hiện" /><StatusPill text="Triển khai chậm" /><StatusPill text="Chưa triển khai" />
        <Pill>KT</Pill><Pill variant="sub">Tổ NCS</Pill><Pill variant="role">Quản trị</Pill>
        <Avatar user={{ full_name: 'Huỳnh Phương Vân' }} /><Avatar user={{ username: 'baolt' }} size="md" /><Avatar user={{ email: 'a@b.c' }} size="xl" />
      </Card>
      <Card title="StackBar" description="Rê chuột để xem tooltip, bấm để hiện toast">
        <StackBar segments={segs} size="lg" />
        <div className="mt-4"><StackBar segments={segs} /></div>
        <div className="mt-4 h-32 w-16"><StackBar direction="col" segments={segs} /></div>
      </Card>
      <Card title="Tải / Trống / Lỗi">
        <div className="grid gap-2"><Skeleton className="h-16" /><Skeleton /><Skeleton className="w-2/3" /></div>
        <EmptyState message="Không có công việc phù hợp với bộ lọc." />
        <ErrorState message="Failed to fetch" onRetry={() => toast('Thử lại')} />
      </Card>
      <Card title="Hộp thoại và thông báo" className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)}>Modal</Button>
        <Button onClick={() => void dialog.confirm({ title: 'Khóa @baolt?', message: 'Người này sẽ không đăng nhập được.', danger: true, ok: 'Khóa' })}>Confirm</Button>
        <Button onClick={() => void dialog.prompt({ title: 'Xóa tuần', message: 'Gõ 44/2026 để xác nhận.', danger: true, needs: '44/2026', ok: 'Xóa tuần' })}>Prompt (needs)</Button>
        <Button onClick={() => void dialog.error('Mất kết nối máy chủ.')}>Error</Button>
        <Button onClick={() => toast(<><b>Có đăng ký mới</b> đang chờ duyệt.</>, { action: { label: 'Xem', onClick: () => undefined }, duration: 15000 })}>Toast</Button>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Ví dụ modal" footer={<Button variant="primary" onClick={() => setOpen(false)} data-autofocus="">Đóng</Button>}>
        <p className="text-ink-2">Esc để đóng. Nền phía sau bị khóa focus.</p>
      </Modal>
    </div>
  );
}
