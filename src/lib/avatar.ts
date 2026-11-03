import { adminCall } from './adminCall';
import { db } from './supabase';

// Ảnh đại diện: kho "avatars" riêng tư, xem qua link có hạn 1 giờ (contract §5)
const cache = new Map<string, { url: string; at: number }>(); // path -> link; ký lại khi quá 50 phút
const fresh = (p: string) => Date.now() - (cache.get(p)?.at ?? 0) < 50 * 60e3;

export const avatarUrl = (path: string | null | undefined) => (path ? cache.get(path)?.url : undefined);
export const avatarIsFresh = (path: string | null | undefined) => !path || fresh(path);

export async function signAvatars(paths: (string | null | undefined)[]) {
  const need = [...new Set(paths.filter((p): p is string => !!p && !fresh(p)))];
  if (!need.length) return;
  const { data } = await db.storage.from('avatars').createSignedUrls(need, 3600);
  (data || []).forEach((d) => d.signedUrl && d.path && cache.set(d.path, { url: d.signedUrl, at: Date.now() }));
}

// cắt vuông giữa ảnh, thu về size px JPEG trước khi tải lên
export async function resizeImage(file: File, size = 256): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WEBP');
  if (file.size > 10e6) throw new Error('Ảnh quá lớn (tối đa 10 MB)');
  const img = await createImageBitmap(file);
  const s = Math.min(img.width, img.height);
  const c = Object.assign(document.createElement('canvas'), { width: size, height: size });
  c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Không xử lý được ảnh'))), 'image/jpeg', 0.85));
}

export const toDataUrl = (blob: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });

export async function uploadAvatar(uid: string, file: File, oldPath?: string | null) {
  const path = `${uid}/${Date.now()}.jpg`; // tên mới mỗi lần để trình duyệt không giữ ảnh cũ
  const { error } = await db.storage.from('avatars').upload(path, await resizeImage(file), { contentType: 'image/jpeg' });
  if (error) throw new Error('Tải ảnh lỗi: ' + error.message);
  await adminCall({ action: 'update', id: uid, avatar_path: path });
  if (oldPath) await db.storage.from('avatars').remove([oldPath]); // dọn ảnh cũ, lỗi cũng không sao
  return path;
}
