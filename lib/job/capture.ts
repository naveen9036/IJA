import { browser } from 'wxt/browser';
import { db, type JobRecord } from '../db';
import { jobUrlKey, pickBest, textHash } from '../extract/merge';
import type { FrameResult } from '../extract/types';
import { buildChain, loadSettings } from '../settings';
import { analyzeJob } from './analyze';
import { pageOverlay } from './scanOverlay';

const ALL_SITES = { origins: ['<all_urls>'] };

/** Must be the first await in a click handler so Chrome still treats it as a user gesture. */
export function requestSiteAccess(): Promise<boolean> {
  return browser.permissions.request(ALL_SITES);
}

export async function getTargetTabId(): Promise<number> {
  // Lets tests open the side panel as a normal tab and point it at another tab.
  const override = Number(new URLSearchParams(location.search).get('tabId'));
  if (override) return override;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('No active tab found.');
  return tab.id;
}

export async function captureTab(tabId: number): Promise<FrameResult[]> {
  let results;
  try {
    results = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['/content-scripts/extract.js'],
    });
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (/cannot (access|be scripted)|chrome:\/\/|extensions gallery|permission/i.test(msg)) {
      throw new Error('This page cannot be read (browser or store pages are protected). Open a job page and try again.');
    }
    throw e;
  }
  return results
    .map((r) => r.result as FrameResult | undefined)
    .filter((r): r is FrameResult => !!r && Array.isArray(r.candidates));
}

export interface AnalyzeOutcome {
  record: JobRecord;
  cached: boolean;
}

export async function analyzeTab(tabId: number, opts: { force?: boolean; signal?: AbortSignal } = {}): Promise<AnalyzeOutcome> {
  await pageOverlay.show(tabId, 'Reading the job description…');
  try {
    const outcome = await analyze(tabId, opts);
    await pageOverlay.finish(tabId, true, outcome.cached ? 'Job loaded' : 'Job analyzed');
    return outcome;
  } catch (e) {
    await pageOverlay.finish(tabId, false, opts.signal?.aborted ? 'Cancelled' : 'Could not analyze this page');
    throw e;
  }
}

async function analyze(tabId: number, opts: { force?: boolean; signal?: AbortSignal }): Promise<AnalyzeOutcome> {
  const page = pickBest(await captureTab(tabId));
  if (!page) {
    throw new Error('Could not find a job description on this page. Highlight the job description text and click Analyze again.');
  }

  const id = jobUrlKey(page.pageUrl);
  const hash = textHash(page.candidate.text);
  if (!opts.force) {
    const existing = await db.jobs.get(id);
    if (existing?.textHash === hash) return { record: existing, cached: true };
  }

  await pageOverlay.show(tabId, 'Matching requirements with AI…');
  const { value, provider } = await analyzeJob(buildChain(await loadSettings()), page, opts.signal);
  const record: JobRecord = {
    id,
    url: page.pageUrl,
    pageTitle: page.pageTitle,
    source: page.candidate.source,
    adapter: page.candidate.adapter,
    hints: page.candidate.hints,
    text: page.candidate.text,
    textHash: hash,
    analysis: value,
    provider,
    capturedAt: Date.now(),
  };
  await db.jobs.put(record);
  return { record, cached: false };
}
