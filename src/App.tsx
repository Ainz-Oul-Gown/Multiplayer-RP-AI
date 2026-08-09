import { parserSystemPrompt, buildNarratorPrompt } from './lib/prompts';
import './styles/app.css';

const mockMessages = [
  'Мастер: Дождь шуршит по вывеске таверны, а в дальнем углу кто-то слишком внимательно следит за вашей компанией.',
  'Мастер: На столе появляется карта старых катакомб — чернила на ней еще не высохли.',
];

export function App() {
  const narratorPreview = buildNarratorPrompt({
    sessionMode: 'plot',
    currentPlotStage: 'Найти информатора в таверне',
    playerName: 'Влад',
    playerConcept: 'Киборг, Хакер',
    playerWeaknesses: ['панически боится высоты'],
    actionText: 'Я незаметно подкрадываюсь к гоблину-часовому.',
    strictFacts: ['Проверка навыка [DEX]: ПРОВАЛ (Бросок 8, нужно 15).'],
    loreSnippets: ['Местная стража носит медные жетоны и боится городских магистратов.'],
  });

  return (
    <main className="shell">
      <aside className="panel">
        <p className="eyebrow">PWA Dashboard</p>
        <h1>Multiplayer RP AI</h1>
        <button>Новая сессия</button>
        <button>Импорт мира JSON</button>
        <button>Инвайты игроков</button>
      </aside>
      <section className="game">
        <header>
          <button aria-label="Профиль">🙂</button>
          <strong>Слепой чат мастера</strong>
          <button aria-label="Инвентарь">🎒</button>
        </header>
        <div className="chat" aria-live="polite">
          {mockMessages.map((message) => <article key={message}>{message}</article>)}
        </div>
        <form className="input-area">
          <input placeholder="Опишите действие персонажа..." />
          <button type="submit">Отправить</button>
        </form>
        <details>
          <summary>Контракты промптов</summary>
          <pre>{parserSystemPrompt}</pre>
          <pre>{narratorPreview}</pre>
        </details>
      </section>
    </main>
  );
}
