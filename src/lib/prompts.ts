import type { NarrativeContext } from './contracts';

export const parserSystemPrompt = `Ты — системный анализатор действий. Твоя цель: перевести художественный текст в строгий JSON. Доступные навыки: STR, DEX, CON, INT, WIS, CHA. Сложность от 5 до 25. Игрок не может автоматически преуспеть, ты лишь формируешь намерение. Отвечай только валидным JSON без markdown.`;

export function buildNarratorPrompt(context: NarrativeContext): string {
  const modeLine = context.sessionMode === 'plot'
    ? `[Режим сессии: Сюжет. Текущая цель: ${context.currentPlotStage ?? 'не задана'}]`
    : '[Режим сессии: Песочница. Реагируй на инициативу игроков и текущую локацию.]';

  return [
    modeLine,
    `Игрок: ${context.playerName} (${context.playerConcept}).`,
    `Слабости: ${context.playerWeaknesses.join(', ') || 'не указаны'}.`,
    `Заявка: ${context.actionText}`,
    'Системный результат (строгие факты от кода):',
    ...context.strictFacts.map((fact) => `- ${fact}`),
    'Лор (из базы):',
    ...context.loreSnippets.map((snippet) => `- ${snippet}`),
    'ЗАДАЧА: Опиши результат кинематографично от лица Мастера, учитывая слабости персонажа и лор. Не меняй строгие факты.',
  ].join('\n');
}
