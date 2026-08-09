import { FormEvent, useEffect, useMemo, useState } from 'react';
import { downloadJson } from './lib/importExport';
import { parserSystemPrompt, buildNarratorPrompt } from './lib/prompts';
import { fetchMasterMessages, type MasterMessage, subscribeToMasterMessages } from './lib/realtime';
import { type AppSettings, hasRuntimeConfiguration, loadSettings, saveSettings } from './lib/settings';
import { getSupabaseClient } from './lib/supabase';
import { processTurn } from './lib/turnPipeline';
import './styles/app.css';

const sessions = [
  { id: 'eteria-tavern', title: 'Таверна Медного Жетона', mode: 'Сюжет', players: ['Влад', 'Ира'] },
  { id: 'neon-sandbox', title: 'Неоновые окраины', mode: 'Песочница', players: ['Мэй'] },
];

const fallbackMessages: MasterMessage[] = [
  { id: 'demo-1', session_id: 'demo', player_id: null, content: 'Мастер: Дождь шуршит по вывеске таверны, а в дальнем углу кто-то слишком внимательно следит за вашей компанией.', strict_facts: [], created_at: new Date().toISOString() },
  { id: 'demo-2', session_id: 'demo', player_id: null, content: 'Мастер: На столе появляется карта старых катакомб — чернила на ней еще не высохли.', strict_facts: [], created_at: new Date().toISOString() },
];

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [actionText, setActionText] = useState('');
  const [messages, setMessages] = useState<MasterMessage[]>(fallbackMessages);
  const [status, setStatus] = useState('Заполните настройки, чтобы отправлять реальные ходы.');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  useEffect(() => {
    const supabase = getSupabaseClient(settings);
    if (!supabase || !settings.sessionId) return;

    let isMounted = true;
    fetchMasterMessages(supabase, settings.sessionId)
      .then((loadedMessages) => {
        if (isMounted && loadedMessages.length > 0) setMessages(loadedMessages);
      })
      .catch((error: Error) => setStatus(`Не удалось загрузить историю: ${error.message}`));

    const unsubscribe = subscribeToMasterMessages(supabase, settings.sessionId, (message) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [settings]);

  function updateSettings(field: keyof AppSettings, value: string) {
    setSettingsSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSettings(settings);
    setSettingsSaved(true);
    setStatus(hasRuntimeConfiguration(settings) ? 'Настройки сохранены. Можно отправлять ход.' : 'Не все обязательные поля заполнены.');
  }

  async function handleTurnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionText.trim() || !isConfigured) return;

    setIsSubmitting(true);
    setStatus('Ход отправлен: парсер → математика → нарратив...');
    try {
      const result = await processTurn(settings, { sessionId: settings.sessionId, playerId: settings.playerId, actionText });
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        session_id: settings.sessionId,
        player_id: settings.playerId,
        content: result.content,
        strict_facts: result.strictFacts,
        created_at: new Date().toISOString(),
      }]);
      setActionText('');
      setStatus('Мастер ответил. Игроки получили новый фрагмент истории.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Неизвестная ошибка хода.');
    } finally {
      setIsSubmitting(false);
    }
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
            <label>OpenRouter API key<input type="password" value={settings.openRouterApiKey} onChange={(event) => updateSettings('openRouterApiKey', event.target.value)} placeholder="sk-or-v1-..." /></label>
            <label>Модель OpenRouter<input value={settings.openRouterModel} onChange={(event) => updateSettings('openRouterModel', event.target.value)} /></label>
            <label>Supabase URL<input value={settings.supabaseUrl} onChange={(event) => updateSettings('supabaseUrl', event.target.value)} placeholder="https://project.supabase.co" /></label>
            <label>Supabase anon key<input type="password" value={settings.supabaseAnonKey} onChange={(event) => updateSettings('supabaseAnonKey', event.target.value)} /></label>
            <label>Session ID<input value={settings.sessionId} onChange={(event) => updateSettings('sessionId', event.target.value)} placeholder="uuid игровой комнаты" /></label>
            <label>Player ID<input value={settings.playerId} onChange={(event) => updateSettings('playerId', event.target.value)} placeholder="uuid персонажа" /></label>
            <button type="submit">Сохранить настройки</button>
            <p className={isConfigured ? 'status-ok' : 'status-warn'}>{settingsSaved ? 'Настройки сохранены.' : status}</p>
          </form>
        </section>

        <div className="chat" aria-live="polite">
          {messages.map((message) => <article key={message.id}><p>{message.content}</p>{message.strict_facts.length > 0 && <small>{message.strict_facts.join(' · ')}</small>}</article>)}
        </div>
        <form className="input-area" onSubmit={handleTurnSubmit}>
          <input value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder="Опишите действие персонажа..." disabled={!isConfigured || isSubmitting} />
          <button type="submit" disabled={!isConfigured || isSubmitting || !actionText.trim()}>{isSubmitting ? 'Ход...' : 'Отправить'}</button>
        </form>
        <p className="turn-status">{status}</p>
        <details>
          <summary>Контракты промптов</summary>
          <pre>{parserSystemPrompt}</pre>
          <pre>{narratorPreview}</pre>
        </details>
      </section>
    </main>
  );
}
