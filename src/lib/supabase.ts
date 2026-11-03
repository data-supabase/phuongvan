import { createClient } from '@supabase/supabase-js';

// Client duy nhất. Chỉ dùng khóa publishable; quyền thật nằm ở RLS + trigger + Edge Function.
export const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
