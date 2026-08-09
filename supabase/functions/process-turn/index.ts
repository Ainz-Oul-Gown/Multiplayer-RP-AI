import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
const model = 'mimo/mimo-v2.5';
const parserPrompt = 'Ты — системный анализатор действий. Верни только строгий JSON с intent_type, target, required_check и items_used.';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const { sessionId, playerId, actionText } = await req.json();
  if (!sessionId || !playerId || !actionText) return Response.json({ error: 'sessionId, playerId and actionText are required' }, { status: 400 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openRouterKey) return Response.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 });

  const parserResponse = await fetch(openRouterUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: parserPrompt }, { role: 'user', content: actionText }] }),
  });

  const parserPayload = await parserResponse.json();
  const parsedAction = JSON.parse(parserPayload.choices?.[0]?.message?.content ?? '{}');

  const { data: player, error: playerError } = await supabase.from('players').select('*, sessions(difficulty,current_plot_stage)').eq('id', playerId).eq('session_id', sessionId).single();
  if (playerError) return Response.json({ error: playerError.message }, { status: 404 });

  const { data: inventory } = await supabase.from('inventory').select('item_name, quantity').eq('player_id', playerId);
  const missingItems = (parsedAction.items_used ?? []).filter((item: string) => !inventory?.some((row) => row.item_name === item && row.quantity > 0));
  const strictFacts = missingItems.length > 0
    ? [`Фантомные предметы: ${missingItems.join(', ')} отсутствуют в инвентаре.`]
    : ['Заявка валидирована кодом. Бросок d20 должен выполняться в SQL RPC на следующей итерации.'];

  const narratorPrompt = [
    player.sessions?.current_plot_stage ? `[Режим сессии: Сюжет. Текущая цель: ${player.sessions.current_plot_stage}]` : '[Режим сессии: Песочница.]',
    `Игрок: ${player.name} (${player.race}, ${player.class}).`,
    `Заявка: ${actionText}`,
    'Системный результат (строгие факты от кода):',
    ...strictFacts.map((fact) => `- ${fact}`),
    'ЗАДАЧА: Опиши результат от лица Мастера. Не меняй строгие факты.',
  ].join('\n');

  const narrativeResponse = await fetch(openRouterUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: narratorPrompt }] }),
  });
  const narrativePayload = await narrativeResponse.json();
  const content = narrativePayload.choices?.[0]?.message?.content ?? 'Мастер молчит. Попробуйте перефразировать действие.';

  await supabase.from('master_messages').insert({ session_id: sessionId, player_id: playerId, content, strict_facts: strictFacts });
  return Response.json({ parsedAction, strictFacts, content });
});
