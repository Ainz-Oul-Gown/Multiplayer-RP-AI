import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppSettings } from './settings';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function getSupabaseClient(settings: AppSettings): SupabaseClient | null {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) return null;
  if (cachedClient && cachedUrl === settings.supabaseUrl && cachedKey === settings.supabaseAnonKey) return cachedClient;

  cachedUrl = settings.supabaseUrl;
  cachedKey = settings.supabaseAnonKey;
  cachedClient = createClient(settings.supabaseUrl, settings.supabaseAnonKey);
  return cachedClient;
}
