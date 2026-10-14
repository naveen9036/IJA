import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defaultSettings, isUsable, loadSettings, saveSettings } from '@/lib/settings';

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
    const gemini = { id: 'gemini' as const, enabled: true, apiKey: 'k', model: 'm' };
    expect(isUsable(gemini, false)).toBe(false);
    expect(isUsable(gemini, true)).toBe(true);
  });

  it('allows Ollama without a key or consent', () => {
    expect(isUsable({ id: 'ollama', enabled: true, apiKey: '', model: 'llama3' }, false)).toBe(true);
  });

  it('skips providers missing a key or model', () => {
    expect(isUsable({ id: 'groq', enabled: true, apiKey: '', model: 'm' }, true)).toBe(false);
    expect(isUsable({ id: 'groq', enabled: true, apiKey: 'k', model: ' ' }, true)).toBe(false);
  });
});
