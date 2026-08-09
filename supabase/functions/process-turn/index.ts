import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
const defaultModel = 'mimo/mimo-v2.5';
const parserPrompt = 'Ты — системный анализатор действий. Верни только строгий JSON с intent_type, target, required_check и items_used. Если JSON невозможен, все равно верни {"intent_type":"other","target":"unknown","items_used":[]}.';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-openrouter-api-key, x-openrouter-model' };

interface ParsedAction {
  intent_type: string;
  target: string;
  required_check?: { skill: string; difficulty: number };
  items_used?: string[];
  parse_error?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  const { sessionId, playerId, actionText } = await req.json();
  if (!sessionId || !playerId || !actionText) return Response.json({ error: 'sessionId, playerId and actionText are required' }, { status: 400, headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const openRouterKey = req.headers.get('x-openrouter-api-key') ?? Deno.env.get('OPENROUTER_API_KEY');
  const model = req.headers.get('x-openrouter-model') ?? Deno.env.get('OPENROUTER_MODEL') ?? defaultModel;
  if (!openRouterKey) return Response.json({ error: 'OpenRouter API key is not configured' }, { status: 500, headers: corsHeaders });

  const parserResponse = await fetch(openRouterUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: parserPrompt }, { role: 'user', content: actionText }] }),
  });

  const parserPayload = await parserResponse.json();
  const parsedAction = await parseActionWithRetries(openRouterKey, model, actionText, parserPayload.choices?.[0]?.message?.content);

  const { data: player, error: playerError } = await supabase.from('players').select('*, sessions(difficulty,current_plot_stage,world_id)').eq('id', playerId).eq('session_id', sessionId).single();
  if (playerError) return Response.json({ error: playerError.message }, { status: 404, headers: corsHeaders });

  const { data: inventory } = await supabase.from('inventory').select('item_name, quantity').eq('player_id', playerId);
  const missingItems = (parsedAction.items_used ?? []).filter((item: string) => !inventory?.some((row) => row.item_name === item && row.quantity > 0));
  let strictFacts = missingItems.length > 0
    ? [`Фантомные предметы: ${missingItems.join(', ')} отсутствуют в инвентаре.`]
    : ['Заявка валидирована кодом.'];

  if (missingItems.length === 0 && parsedAction.required_check) {
    const { data: rollData, error: rollError } = await supabase.rpc('resolve_skill_check', {
      input_session_id: sessionId,
      input_player_id: playerId,
      ability: parsedAction.required_check.skill,
      difficulty_class: parsedAction.required_check.difficulty,
      action_text: actionText,
      parsed_action: parsedAction,
    }).single();

    if (rollError) return Response.json({ error: rollError.message }, { status: 500, headers: corsHeaders });
    strictFacts = rollData.strict_facts;
  }

  const loreTags = [parsedAction.target, ...(parsedAction.items_used ?? [])].filter(Boolean).flatMap((value: string) => value.toLowerCase().split(/\s+/)).slice(0, 8);
  const { data: loreFiles } = loreTags.length > 0
    ? await supabase.from('lore_files').select('folder,title,content,tags').eq('world_id', player.sessions?.world_id).overlaps('tags', loreTags).limit(3)
    : { data: [] };
  const loreSnippets = (loreFiles ?? []).map((file) => `${file.folder}/${file.title}: ${file.content.slice(0, 700)}`);

  const narratorPrompt = [
    player.sessions?.current_plot_stage ? `[Режим сессии: Сюжет. Текущая цель: ${player.sessions.current_plot_stage}]` : '[Режим сессии: Песочница.]',
    `Игрок: ${player.name} (${player.race}, ${player.class}).`,
    `Заявка: ${actionText}`,
    'Системный результат (строгие факты от кода):',
    ...strictFacts.map((fact) => `- ${fact}`),
    'Лор (из базы):',
    ...(loreSnippets.length > 0 ? loreSnippets.map((snippet) => `- ${snippet}`) : ['- Подходящих файлов лора не найдено. Импровизируй без противоречий.']),
    'ЗАДАЧА: Опиши результат от лица Мастера. Не меняй строгие факты. Игроки должны видеть только готовую литературную историю.',
  ].join('\n');

  const narrativeResponse = await fetch(openRouterUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: narratorPrompt }] }),
  });
  const narrativePayload = await narrativeResponse.json();
  const content = narrativePayload.choices?.[0]?.message?.content ?? 'Мастер молчит. Попробуйте перефразировать действие.';

  await supabase.from('master_messages').insert({ session_id: sessionId, player_id: playerId, content, strict_facts: strictFacts });
  return Response.json({ parsedAction, strictFacts, content }, { headers: corsHeaders });
});

async function parseActionWithRetries(openRouterKey: string, model: string, actionText: string, firstContent?: string): Promise<ParsedAction> {
  const attempts = [firstContent];

  for (let attempt = attempts.length; attempt < 3; attempt += 1) {
    const response = await fetch(openRouterUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: parserPrompt }, { role: 'user', content: actionText }] }),
    });
    const payload = await response.json();
    attempts.push(payload.choices?.[0]?.message?.content);
  }

  for (const content of attempts) {
    if (!content) continue;
    try {
      return JSON.parse(content);
    } catch {
      continue;
    }
  }

  return { intent_type: 'other', target: 'unknown', items_used: [], parse_error: true };
}
