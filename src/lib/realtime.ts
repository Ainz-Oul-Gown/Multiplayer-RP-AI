import type { SupabaseClient } from '@supabase/supabase-js';

export interface MasterMessage {
  id: string;
  session_id: string;
  player_id: string | null;
  content: string;
  strict_facts: string[];
  created_at: string;
}

export async function fetchMasterMessages(supabase: SupabaseClient, sessionId: string): Promise<MasterMessage[]> {
  const { data, error } = await supabase
    .from('master_messages')
    .select('id, session_id, player_id, content, strict_facts, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export function subscribeToMasterMessages(
  supabase: SupabaseClient,
  sessionId: string,
  onMessage: (message: MasterMessage) => void,
): () => void {
  const channel = supabase
    .channel(`master_messages:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'master_messages', filter: `session_id=eq.${sessionId}` },
      (payload) => onMessage(payload.new as MasterMessage),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
