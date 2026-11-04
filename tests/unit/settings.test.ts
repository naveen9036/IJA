import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { buildChain, defaultSettings, isUsable, loadSettings, saveSettings, type ProviderConfig } from '@/lib/settings';

const cfg = (p: Omit<ProviderConfig, 'backupModel'> & { backupModel?: string }): ProviderConfig => ({ backupModel: '', ...p });

describe('settings', () => {
  beforeEach(() => fakeBrowser.reset());

  it('returns defaults with Gemini first', async () => {
    const s = await loadSettings();
    expect(s.providers.map((p) => p.id)).toEqual(['gemini', 'groq', 'openrouter', 'ollama']);
    expect(s.cloudConsent).toBe(false);
  });

  it('keeps the saved fallback order', async () => {
    const s = defaultSettings();
    s.providers.reverse();
    await saveSettings(s);
    expect((await loadSettings()).providers.map((p) => p.id)).toEqual(['ollama', 'openrouter', 'groq', 'gemini']);
  });

  it('skips cloud providers until the user consents', () => {
    const gemini = cfg({ id: 'gemini', enabled: true, apiKey: 'k', model: 'm' });
    expect(isUsable(gemini, false)).toBe(false);
    expect(isUsable(gemini, true)).toBe(true);
  });

  it('allows Ollama without a key or consent', () => {
    expect(isUsable(cfg({ id: 'ollama', enabled: true, apiKey: '', model: 'llama3' }), false)).toBe(true);
  });

  it('skips providers missing a key or model', () => {
    expect(isUsable(cfg({ id: 'groq', enabled: true, apiKey: '', model: 'm' }), true)).toBe(false);
    expect(isUsable(cfg({ id: 'groq', enabled: true, apiKey: 'k', model: ' ' }), true)).toBe(false);
  });

  it('adds the backup model right after its main model', () => {
    const s = defaultSettings();
    s.cloudConsent = true;
    s.providers[0]!.apiKey = 'k';
    s.providers[1] = cfg({ id: 'groq', enabled: true, apiKey: 'g', model: 'llama' });
    expect(buildChain(s).providers.map((p) => p.name)).toEqual(['Gemini', 'Gemini (gemini-3.5-flash-lite)', 'Groq']);
  });

  it('gives settings saved before backups existed the default backup model', async () => {
    await fakeBrowser.storage.local.set({
      settings: { cloudConsent: true, providers: [{ id: 'gemini', enabled: true, apiKey: 'k', model: 'gemini-3.8-flash' }] },
    });
    expect((await loadSettings()).providers[0]!.backupModel).toBe('gemini-3.5-flash-lite');
  });
});
