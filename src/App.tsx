import { FormEvent, useMemo, useState } from 'react';
import { downloadJson } from './lib/importExport';
import { parserSystemPrompt, buildNarratorPrompt } from './lib/prompts';
import { type AppSettings, hasRuntimeConfiguration, loadSettings, saveSettings } from './lib/settings';
import './styles/app.css';

const sessions = [
  { id: 'eteria-tavern', title: 'Таверна Медного Жетона', mode: 'Сюжет', players: ['Влад', 'Ира'] },
  { id: 'neon-sandbox', title: 'Неоновые окраины', mode: 'Песочница', players: ['Мэй'] },
];

const mockMessages = [
  'Мастер: Дождь шуршит по вывеске таверны, а в дальнем углу кто-то слишком внимательно следит за вашей компанией.',
  'Мастер: На столе появляется карта старых катакомб — чернила на ней еще не высохли.',
];

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);
  const isConfigured = hasRuntimeConfiguration(settings);
  const narratorPreview = useMemo(() => buildNarratorPrompt({
    sessionMode: 'plot',
    currentPlotStage: 'Найти информатора в таверне',
    playerName: 'Влад',
    playerConcept: 'Киборг, Хакер',
    playerWeaknesses: ['панически боится высоты'],
    actionText: 'Я незаметно подкрадываюсь к гоблину-часовому.',
    strictFacts: ['Проверка навыка [DEX]: ПРОВАЛ (Бросок 8, нужно 15).'],
    loreSnippets: ['Местная стража носит медные жетоны и боится городских магистратов.'],
  }), []);

  function updateSettings(field: keyof AppSettings, value: string) {
    setSettingsSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSettings(settings);
    setSettingsSaved(true);
  }

  function exportDemoWorld() {
    downloadJson('world-of-eteria.json', {
      version: 1,
      world: { name: 'World of Eteria', settings: { races: ['Human', 'Cyborg'], classes: ['Hacker', 'Scout'] } },
      loreFiles: [{ folder: 'Фракции', title: 'Городская стража', content: 'Стража носит медные жетоны.', tags: ['стража', 'таверна'] }],
    });
  }

  return (
    <main className="shell">
      <aside className="panel">
        <p className="eyebrow">PWA Dashboard</p>
        <h1>Multiplayer RP AI</h1>
        <section>
          <h2>Сессии</h2>
          {sessions.map((session) => (
            <article className="session-card" key={session.id}>
              <strong>{session.title}</strong>
              <span>{session.mode} · {session.players.join(', ')}</span>
            </article>
          ))}
        </section>
        <section>
          <h2>Библиотека</h2>
          <button onClick={exportDemoWorld}>Экспорт демо-мира JSON</button>
          <button>Импорт мира JSON</button>
          <button>Инвайты игроков</button>
        </section>
      </aside>

      <section className="game">
        <header>
          <button aria-label="Профиль">🙂</button>
          <strong>Слепой чат мастера</strong>
          <button aria-label="Инвентарь">🎒</button>
        </header>

        <section className="settings-card" aria-labelledby="settings-title">
          <div>
            <p className="eyebrow">Настройки подключения</p>
            <h2 id="settings-title">OpenRouter и Supabase</h2>
            <p>Ключ хранится только в localStorage браузера и передается в Edge Function при ходе.</p>
          </div>
          <form onSubmit={handleSettingsSubmit}>
            <label>
              OpenRouter API key
              <input
                type="password"
                value={settings.openRouterApiKey}
                onChange={(event) => updateSettings('openRouterApiKey', event.target.value)}
                placeholder="sk-or-v1-..."
              />
            </label>
            <label>
              Модель OpenRouter
              <input value={settings.openRouterModel} onChange={(event) => updateSettings('openRouterModel', event.target.value)} />
            </label>
            <label>
              Supabase URL
              <input value={settings.supabaseUrl} onChange={(event) => updateSettings('supabaseUrl', event.target.value)} placeholder="https://project.supabase.co" />
            </label>
            <label>
              Supabase anon key
              <input type="password" value={settings.supabaseAnonKey} onChange={(event) => updateSettings('supabaseAnonKey', event.target.value)} />
            </label>
            <button type="submit">Сохранить настройки</button>
            <p className={isConfigured ? 'status-ok' : 'status-warn'}>{settingsSaved ? 'Настройки сохранены.' : isConfigured ? 'Готово к подключению.' : 'Заполните ключи для реального хода.'}</p>
          </form>
        </section>

        <div className="chat" aria-live="polite">
          {mockMessages.map((message) => <article key={message}>{message}</article>)}
        </div>
        <form className="input-area">
          <input placeholder="Опишите действие персонажа..." disabled={!isConfigured} />
          <button type="submit" disabled={!isConfigured}>Отправить</button>
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
