import type { SupabaseClient } from '@supabase/supabase-js';
import type { Difficulty } from './contracts';

export interface PlayerProfile {
  id: string;
  name: string;
  race: string;
  class: string;
  appearance: string;
  personality: Record<string, unknown>;
  bio: string;
  stats: Record<string, number>;
  hp: number;
  max_hp: number;
  money: number;
}

export interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  type: 'weapon' | 'armor' | 'consumable' | 'misc';
  attributes: Record<string, unknown>;
}

export interface SessionSettings {
  id: string;
  difficulty: Difficulty;
  is_pvp_enabled: boolean;
  current_plot_stage: string | null;
}

export async function fetchPlayerProfile(supabase: SupabaseClient, playerId: string): Promise<PlayerProfile | null> {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, race, class, appearance, personality, bio, stats, hp, max_hp, money')
    .eq('id', playerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchInventory(supabase: SupabaseClient, playerId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('id, item_name, quantity, type, attributes')
    .eq('player_id', playerId)
    .order('item_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchSessionSettings(supabase: SupabaseClient, sessionId: string): Promise<SessionSettings | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, difficulty, is_pvp_enabled, current_plot_stage')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateSessionSettings(supabase: SupabaseClient, settings: SessionSettings): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({
      difficulty: settings.difficulty,
      is_pvp_enabled: settings.is_pvp_enabled,
      current_plot_stage: settings.current_plot_stage || null,
    })
    .eq('id', settings.id);

  if (error) throw error;
}
