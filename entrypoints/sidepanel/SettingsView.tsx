import { ArrowDown, ArrowUp, Cpu, ExternalLink, FlaskConical, ListRestart, Save, Settings as SettingsIcon, Trash2 } from 'lucide-react';
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
import { Field } from './components/fields';
import { Notice, Select, Spinner, TabIntro, Tooltip } from './components/ui';

const CUSTOM = '__custom__';

function ModelPicker({
  label,
  value,
  models,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  models: string[] | undefined;
  optional?: boolean;
  onChange: (v: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  if (!models?.length || custom) {
    return (
      <Field label={label}>
        <input
          className="input"
          placeholder={optional ? 'Optional, e.g. gemini-3.5-flash-lite' : 'Model name'}
          title={value}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    );
  }
  const options = [
    ...(optional ? [{ value: '', label: 'None' }] : []),
    ...[...new Set([value, ...models].filter(Boolean))].map((m) => ({ value: m, label: m })),
    { value: CUSTOM, label: 'Other (type a name)…' },
  ];
  return (
    <Field label={label}>
      <Select
        value={value}
        title={value}
        options={options}
        onChange={(e) => (e.target.value === CUSTOM ? setCustom(true) : onChange(e.target.value))}
      />
    </Field>
  );
}

type Status = { tone: 'error' | 'success' | 'info'; text: string; busy?: boolean };

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!settings) return null;

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
  const setProviderStatus = (id: string, s: Status) => setStatus((all) => ({ ...all, [id]: s }));

  const loadModelList = async (p: ProviderConfig) => {
    setProviderStatus(p.id, { tone: 'info', text: 'Loading models…', busy: true });
    try {
      const list = await listModels(p);
      setModels((m) => ({ ...m, [p.id]: list }));
      setProviderStatus(p.id, { tone: 'success', text: `${list.length} models found. Pick one from the list.` });
    } catch (e) {
      setProviderStatus(p.id, { tone: 'error', text: (e as Error).message });
    }
  };

  const test = async (p: ProviderConfig) => {
    setProviderStatus(p.id, { tone: 'info', text: 'Testing…', busy: true });
    const results: string[] = [];
    let failed = false;
    for (const model of [p.model, p.backupModel].map((m) => m.trim()).filter(Boolean)) {
      try {
        const reply = await createProvider(p, model).complete({ system: 'You are a test.', user: 'Reply with the word OK.' });
        results.push(`${model}: works ("${reply.trim().slice(0, 30)}")`);
      } catch (e) {
        failed = true;
        results.push(`${model}: ${(e as Error).message}`);
      }
    }
    setProviderStatus(p.id, { tone: failed ? 'error' : 'success', text: results.join('\n') });
  };

  const save = async () => {
    await saveSettings(settings);
    setSaved(true);
  };

  const wipe = async () => {
    if (!confirm('Delete your profile, jobs, documents, saved answers, and settings from this browser?')) return;
    await deleteAllData();
    await browser.storage.local.clear();
    localStorage.clear();
    setSettings(defaultSettings());
    setModels({});
    setStatus({});
  };

  return (
    <div className="space-y-3">
      <TabIntro
        id="settings"
        icon={SettingsIcon}
        title="AI settings"
        summary="Choose which free AI services IJA uses for reading resumes and jobs and for writing."
        steps={[
          <>
            Next to Google Gemini, open <b>Get a free key</b>, sign in with a Google account and create an API key.
          </>,
          'Paste the key below. Keep the model gemini-3.8-flash and the backup gemini-3.5-flash-lite.',
          'Tick the consent box to allow free cloud providers, then click Test \u2013 each model should report \u201cworks\u201d.',
          'Recommended: also turn on Groq or OpenRouter (free keys) as a backup for when Gemini is busy or over its daily limit.',
          <>
            Click <b>Save settings</b>.
          </>,
        ]}
        tips={[
          'Providers are tried from top to bottom; use the arrows to change the order. Within a provider, the backup model is tried after the main one.',
          'Busy errors (HTTP 503) are retried after a few seconds before IJA moves on to the next provider.',
          'Ollama runs AI on your own computer: private and unlimited, but it needs a capable machine.',
          'Delete all data removes your profile, jobs, documents, saved answers and keys from this browser.',
        ]}
      />

      <Notice tone="warning">
        <div className="space-y-2">
          <p>
            Free cloud tiers (Gemini, Groq, OpenRouter) may use what you send, including resume text, to improve their
            products. Ollama runs on your machine and sends nothing out.
          </p>
          <label className="flex cursor-pointer items-center gap-2 font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={settings.cloudConsent}
              onChange={(e) => update({ ...settings, cloudConsent: e.target.checked })}
            />
            I understand; allow free cloud providers
          </label>
        </div>
      </Notice>

      {settings.providers.map((p, i) => {
        const meta = PROVIDER_META[p.id];
        const st = status[p.id];
        return (
          <div key={p.id} className={`card space-y-3 transition ${p.enabled ? 'ring-1 ring-indigo-100' : 'opacity-80'}`}>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={p.enabled}
                  onChange={(e) => updateProvider(p.id, { enabled: e.target.checked })}
                />
                <Cpu className={`h-4 w-4 ${p.enabled ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
                <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
              </label>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">#{i + 1}</span>
              <Tooltip label="Move up">
                <button
                  className="btn-secondary h-8 w-8 p-0"
                  aria-label={`Move ${meta.short} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
              <Tooltip label="Move down">
                <button
                  className="btn-secondary h-8 w-8 p-0"
                  aria-label={`Move ${meta.short} down`}
                  disabled={i === settings.providers.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            </div>

            {p.enabled && (
              <div className="animate-fade-in space-y-3 motion-reduce:animate-none">
                {meta.needsKey && (
                  <Field label="API key">
                    <input
                      className="input"
                      type="password"
                      autoComplete="off"
                      placeholder="Paste your key"
                      value={p.apiKey}
                      onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                    />
                  </Field>
                )}
                <ModelPicker
                  label="Model"
                  value={p.model}
                  models={models[p.id]}
                  onChange={(model) => updateProvider(p.id, { model })}
                />
                <ModelPicker
                  label="Backup model (used when the main one is busy)"
                  value={p.backupModel}
                  models={models[p.id]}
                  optional
                  onChange={(backupModel) => updateProvider(p.id, { backupModel })}
                />
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => loadModelList(p)}>
                    <ListRestart className="h-4 w-4" aria-hidden />
                    Load models
                  </button>
                  <button className="btn-secondary flex-1" disabled={!p.model} onClick={() => test(p)}>
                    <FlaskConical className="h-4 w-4" aria-hidden />
                    Test
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {meta.note}{' '}
                  <a
                    className="inline-flex items-center gap-0.5 font-medium text-indigo-700 underline"
                    href={meta.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {meta.needsKey ? 'Get a free key' : 'Download'}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </p>
                {st &&
                  (st.busy ? (
                    <div className="flex items-center gap-2 text-sm text-indigo-700">
                      <Spinner /> {st.text}
                    </div>
                  ) : (
                    <Notice tone={st.tone}>{st.text}</Notice>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="sticky bottom-0 -mx-3 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
        <button className="btn-primary" onClick={save}>
          <Save className="h-4 w-4" aria-hidden />
          Save settings
        </button>
        {saved && <span className="animate-fade-in text-sm font-medium text-emerald-700">Saved</span>}
        <span className="flex-1" />
        <button className="btn-danger" onClick={wipe}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete all data
        </button>
      </div>
    </div>
  );
}
