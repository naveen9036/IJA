import { browser } from 'wxt/browser';
import { FallbackChain } from './llm/fallback';
import { GeminiProvider, listGeminiModels } from './llm/gemini';
import { listCompatModels, OpenAICompatProvider } from './llm/openaiCompat';
import type { LlmProvider } from './llm/provider';

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'ollama';

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  apiKey: string;
  model: string;
  /** Same provider, second model; used when the main model is busy or over its limit. */
  backupModel: string;
}

export interface Settings {
  /** Array order is the fallback order. */
  providers: ProviderConfig[];
  /** User accepted that free cloud tiers may use prompts to improve their products. */
  cloudConsent: boolean;
}

export const PROVIDER_META: Record<
  ProviderId,
  { label: string; short: string; baseUrl: string; needsKey: boolean; cloud: boolean; keyUrl: string; note: string }
> = {
  gemini: {
    label: 'Google Gemini (free tier)',
    short: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsKey: true,
    cloud: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Free-tier prompts may be used by Google to improve its products.',
  },
  groq: {
    label: 'Groq (free tier)',
    short: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    cloud: true,
    keyUrl: 'https://console.groq.com/keys',
    note: 'Fast; lower daily token limits.',
  },
  openrouter: {
    label: 'OpenRouter (free models)',
    short: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    cloud: true,
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Pick a model ending in ":free".',
  },
  ollama: {
    label: 'Ollama (local, private)',
    short: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    needsKey: false,
    cloud: false,
    keyUrl: 'https://ollama.com/download',
    note: 'Start Ollama with OLLAMA_ORIGINS=chrome-extension://* so the extension can reach it.',
  },
};

export const defaultSettings = (): Settings => ({
  providers: [
    { id: 'gemini', enabled: true, apiKey: '', model: 'gemini-3.8-flash', backupModel: 'gemini-3.5-flash-lite' },
    { id: 'groq', enabled: false, apiKey: '', model: 'openai/gpt-oss-120b', backupModel: 'qwen/qwen3.8-27b' },
    { id: 'openrouter', enabled: false, apiKey: '', model: '', backupModel: '' },
    { id: 'ollama', enabled: false, apiKey: '', model: '', backupModel: '' },
  ],
  cloudConsent: false,
});

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  const defaults = defaultSettings();
  if (!stored) return defaults;
  const providers = defaults.providers.map((d) => ({ ...d, ...stored.providers?.find((p) => p.id === d.id) }));
  const order = stored.providers?.map((p) => p.id) ?? [];
  providers.sort((a, b) => rank(order, a.id) - rank(order, b.id));
  return { providers, cloudConsent: stored.cloudConsent ?? false };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY]: settings });
}

export function isUsable(p: ProviderConfig, cloudConsent: boolean): boolean {
  const meta = PROVIDER_META[p.id];
  return p.enabled && !!p.model.trim() && (!meta.needsKey || !!p.apiKey.trim()) && (!meta.cloud || cloudConsent);
}

export function createProvider(p: ProviderConfig, model = p.model, name = PROVIDER_META[p.id].short): LlmProvider {
  const meta = PROVIDER_META[p.id];
  return p.id === 'gemini'
    ? new GeminiProvider(p.apiKey.trim(), model.trim(), name)
    : new OpenAICompatProvider(name, meta.baseUrl, p.apiKey.trim(), model.trim());
}

export function buildChain(settings: Settings): FallbackChain {
  return new FallbackChain(
    settings.providers
      .filter((p) => isUsable(p, settings.cloudConsent))
      .flatMap((p) => {
        const backup = p.backupModel?.trim();
        const main = createProvider(p);
        return backup && backup !== p.model.trim()
          ? [main, createProvider(p, backup, `${PROVIDER_META[p.id].short} (${backup})`)]
          : [main];
      }),
  );
}

export function listModels(p: ProviderConfig): Promise<string[]> {
  return p.id === 'gemini'
    ? listGeminiModels(p.apiKey.trim())
    : listCompatModels(PROVIDER_META[p.id].baseUrl, p.apiKey.trim());
}

function rank(order: ProviderId[], id: ProviderId): number {
  const i = order.indexOf(id);
  return i === -1 ? order.length : i;
}
