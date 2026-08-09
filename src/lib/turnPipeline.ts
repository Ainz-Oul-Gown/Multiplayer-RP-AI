import type { AppSettings } from './settings';
import type { ParsedAction } from './contracts';
import { getSupabaseClient } from './supabase';

export interface TurnRequest {
  sessionId: string;
  playerId: string;
  actionText: string;
}

export interface TurnResponse {
  parsedAction: ParsedAction;
  strictFacts: string[];
  content: string;
}

export async function processTurn(settings: AppSettings, request: TurnRequest): Promise<TurnResponse> {
  const supabase = getSupabaseClient(settings);
  if (!supabase) throw new Error('Supabase URL и anon key не настроены.');
  if (!settings.openRouterApiKey) throw new Error('OpenRouter API key не указан в настройках.');

  const { data, error } = await supabase.functions.invoke<TurnResponse>('process-turn', {
    body: request,
    headers: {
      'x-openrouter-api-key': settings.openRouterApiKey,
      'x-openrouter-model': settings.openRouterModel,
    },
  });

  if (error) throw error;
  if (!data) throw new Error('Edge Function не вернула данные.');
  return data;
}
