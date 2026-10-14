import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { deleteAllData } from '@/lib/db';
import {
  createProvider,
  defaultSettings,
  listModels,
  loadSettings,
  PROVIDER_META,
  saveSettings,
  type ProviderConfig,
  type Settings,
} from '@/lib/settings';

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!settings) return <p className="text-sm text-gray-500">Loading…</p>;

  const update = (next: Settings) => {
    setSettings(next);
    setSaved(false);
  };
  const updateProvider = (id: string, patch: Partial<ProviderConfig>) =>
    update({ ...settings, providers: settings.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const move = (index: number, delta: number) => {
    const providers = [...settings.providers];
    const [item] = providers.splice(index, 1);
    if (!item) return;
    providers.splice(index + delta, 0, item);
    update({ ...settings, providers });
  };

  const loadModelList = async (p: ProviderConfig) => {
    setStatus((s) => ({ ...s, [p.id]: 'Loading models…' }));
    try {
      const list = await listModels(p);
      setModels((m) => ({ ...m, [p.id]: list }));
      setStatus((s) => ({ ...s, [p.id]: `${list.length} models found` }));
    } catch (e) {
      setStatus((s) => ({ ...s, [p.id]: (e as Error).message }));
    }
  };

  const test = async (p: ProviderConfig) => {
    setStatus((s) => ({ ...s, [p.id]: 'Testing…' }));
    try {
      const reply = await createProvider(p).complete({ system: 'You are a test.', user: 'Reply with the word OK.' });
      setStatus((s) => ({ ...s, [p.id]: `Works: "${reply.trim().slice(0, 40)}"` }));
    } catch (e) {
      setStatus((s) => ({ ...s, [p.id]: (e as Error).message }));
    }
  };

  const save = async () => {
    await saveSettings(settings);
    setSaved(true);
  };

  const wipe = async () => {
    if (!confirm('Delete your profile, settings, and all saved data?')) return;
    await deleteAllData();
    await browser.storage.local.clear();
    setSettings(defaultSettings());
    setModels({});
    setStatus({});
  };

  return (
    <div className="space-y-3">
      <div className="card space-y-2 border-amber-300 bg-amber-50">
        <p className="text-sm">
          Free cloud tiers (Gemini, Groq, OpenRouter) may use what you send, including resume text, to improve their
          products. Ollama runs on your machine and sends nothing out.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={settings.cloudConsent}
            onChange={(e) => update({ ...settings, cloudConsent: e.target.checked })}
          />
          I understand; allow free cloud providers
        </label>
      </div>

      <p className="text-xs text-gray-500">Providers are tried top to bottom. If one hits its limit, the next one is used.</p>

      {settings.providers.map((p, i) => {
        const meta = PROVIDER_META[p.id];
        return (
          <div key={p.id} className="card space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) => updateProvider(p.id, { enabled: e.target.checked })}
              />
              <span className="flex-1 text-sm font-medium">{meta.label}</span>
              <button className="btn-secondary px-2 py-0.5" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                ↑
              </button>
              <button
                className="btn-secondary px-2 py-0.5"
                disabled={i === settings.providers.length - 1}
                onClick={() => move(i, 1)}
                title="Move down"
              >
                ↓
              </button>
            </div>

            {p.enabled && (
              <>
                {meta.needsKey && (
                  <input
                    className="input"
                    type="password"
                    autoComplete="off"
                    placeholder="API key"
                    value={p.apiKey}
                    onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                  />
                )}
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Model"
                    list={`models-${p.id}`}
                    value={p.model}
                    onChange={(e) => updateProvider(p.id, { model: e.target.value })}
                  />
                  <datalist id={`models-${p.id}`}>
                    {(models[p.id] ?? []).map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  <button className="btn-secondary whitespace-nowrap" onClick={() => loadModelList(p)}>
                    Load models
                  </button>
                  <button className="btn-secondary" disabled={!p.model} onClick={() => test(p)}>
                    Test
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {meta.note}{' '}
                  <a className="text-blue-600 underline" href={meta.keyUrl} target="_blank" rel="noreferrer">
                    {meta.needsKey ? 'Get a free key' : 'Download'}
                  </a>
                </p>
                {status[p.id] && <p className="text-xs break-words text-gray-700">{status[p.id]}</p>}
              </>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={save}>
          Save settings
        </button>
        {saved && <span className="text-sm text-green-700">Saved</span>}
        <span className="flex-1" />
        <button className="btn-danger" onClick={wipe}>
          Delete all data
        </button>
      </div>
    </div>
  );
}
