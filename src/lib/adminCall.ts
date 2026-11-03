import { db } from './supabase';

/** Gọi Edge Function; lỗi thì lấy thông báo từ JSON của server (contract §6, §7) rồi throw. */
export async function invokeFn<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke(name, { body });
  if (error) {
    let m = error.message;
    try {
      m = (await (error as { context: Response }).context.json()).error || m;
    } catch {
      /* giữ error.message */
    }
    throw new Error(m);
  }
  return data as T;
}

// Edge Function admin-users (contract §6)
export const adminCall = (body: Record<string, unknown>) => invokeFn('admin-users', body);
