import { readFileSync } from 'node:fs';
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from './fixtures';

declare const chrome: {
  storage: { local: { set(items: object): Promise<void> } };
  tabs: { query(q: object): Promise<{ id?: number }[]> };
};

export const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

export const ANALYSIS = {
  isJobPosting: true,
  title: 'Machine Learning Engineer',
  company: 'Proseware',
  location: 'Berlin, Germany',
  workMode: 'hybrid',
  employmentType: 'full-time',
  seniority: 'mid',
  yearsExperience: 3,
  salary: '',
  mustHave: ['Python', 'PyTorch', 'Docker'],
  niceToHave: [],
  responsibilities: ['Train NLP models'],
};

export type PromptKind = 'resume' | 'job' | 'tailor' | 'letter' | 'answers' | 'other';

export function promptKind(body: string): PromptKind {
  if (body.includes('convert resume text')) return 'resume';
  if (body.includes('You tailor a resume')) return 'tailor';
  if (body.includes('answer job application form questions')) return 'answers';
  if (body.includes('cover letter')) return 'letter';
  if (body.includes('extract structured data from a web page')) return 'job';
  return 'other';
}

type Reply = object | ((promptText: string) => object);

/** Mocks Gemini; replies are chosen by prompt kind. Returns the non-resume prompts it received. */
export async function mockGemini(context: BrowserContext, replies: Partial<Record<PromptKind, Reply>>) {
  const prompts: string[] = [];
  await context.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const body = route.request().postData() ?? '';
    const kind = promptKind(body);
    if (kind !== 'resume') prompts.push(body);
    const reply = replies[kind] ?? replies.job ?? {};
    const promptText = (JSON.parse(body) as { contents: { parts: { text: string }[] }[] }).contents[0]!.parts[0]!.text;
    const text = JSON.stringify(typeof reply === 'function' ? reply(promptText) : reply);
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
  });
  return prompts;
}

export async function openPanelFor(context: BrowserContext, extensionId: string, urlPattern: string): Promise<Page> {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.evaluate(() =>
    chrome.storage.local.set({
      settings: { cloudConsent: true, providers: [{ id: 'gemini', enabled: true, apiKey: 'k', model: 'gemini-3.8-flash' }] },
    }),
  );
  const tabId = await panel.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]?.id, urlPattern);
  expect(tabId).toBeTruthy();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`);
  return panel;
}

export async function uploadProfile(
  panel: Page,
  file: { name: string; mimeType: string; buffer: Buffer } = {
    name: 'cv.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Sam Lee, ML engineer. '.repeat(10)),
  },
) {
  await panel.getByRole('button', { name: 'Profile', exact: true }).click();
  await panel.locator('input[type=file]').setInputFiles(file);
  await expect(panel.getByText(/Parsed with Gemini/)).toBeVisible();
  await panel.getByRole('button', { name: 'Save profile' }).click();
  await expect(panel.getByText('Profile saved.')).toBeVisible();
}
