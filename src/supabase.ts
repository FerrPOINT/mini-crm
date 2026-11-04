import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient<Database>(new URL(url, window.location.origin).href, key)
  : null;

export function db() {
  if (!supabase) throw new Error('Не настроено подключение к базе');
  return supabase;
}
