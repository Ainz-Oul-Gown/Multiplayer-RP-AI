export interface AppSettings {
  openRouterApiKey: string;
  openRouterModel: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  sessionId: string;
  playerId: string;
}

export const defaultSettings: AppSettings = {
  openRouterApiKey: '',
  openRouterModel: 'mimo/mimo-v2.5',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  sessionId: '',
  playerId: '',
};

const storageKey = 'multiplayer-rp-ai:settings';

export function loadSettings(): AppSettings {
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) return defaultSettings;

  try {
    return { ...defaultSettings, ...JSON.parse(rawValue) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}

export function hasRuntimeConfiguration(settings: AppSettings): boolean {
  return Boolean(settings.openRouterApiKey && settings.supabaseUrl && settings.supabaseAnonKey && settings.sessionId && settings.playerId);
}
