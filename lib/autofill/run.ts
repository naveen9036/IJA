import { browser } from 'wxt/browser';
import { db, getDocument, getProfile, getResumeDocument } from '../db';
import { fileName } from '../export/layout';
import { letterText, type LetterContent } from '../letter/schema';
import { buildChain, loadSettings } from '../settings';
import { pageOverlay } from '../job/scanOverlay';
import { answerQuestions } from './answer';
import { mapField, withValue, type AutofillContext, type MappedField } from './map';
import { qaKey } from './qa';
import type { CollectedValue, FieldDescriptor, FileRef, FillItem, FillPlan, FillResult, FrameFields, PageApi } from './types';

export interface FrameRun {
  frameId: number;
  frameUrl: string;
  mapped: MappedField[];
}

export interface SummaryRow {
  frameId: number;
  id: string;
  label: string;
  value?: string;
  reason?: string;
}

export interface AutofillSummary {
  filled: SummaryRow[];
  review: SummaryRow[];
  skipped: SummaryRow[];
  runs: FrameRun[];
}

export async function detectTab(tabId: number): Promise<{ frameId: number; fields: FrameFields }[]> {
  const results = await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['/content-scripts/autofill.js'],
  });
  return results
    .filter((r) => r.result && Array.isArray((r.result as FrameFields).fields))
    .map((r) => ({ frameId: r.frameId, fields: r.result as FrameFields }));
}

async function fillFrame(tabId: number, frameId: number, plan: FillPlan): Promise<FillResult[]> {
  const [r] = await browser.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: (p: FillPlan) => (globalThis as unknown as { __ija: PageApi }).__ija.fill(p),
    args: [plan],
  });
  return (r?.result as FillResult[] | undefined) ?? [];
}

async function collectFrame(tabId: number, frameId: number, ids: string[]): Promise<CollectedValue[]> {
  const [r] = await browser.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: (i: string[]) => (globalThis as unknown as { __ija: PageApi }).__ija.collect(i),
    args: [ids],
  });
  return (r?.result as CollectedValue[] | undefined) ?? [];
}

async function toFileRef(blob: Blob, name: string): Promise<FileRef> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name, type: blob.type || 'application/pdf', base64: btoa(bin) };
}

const qid = (frameId: number, id: string) => `${frameId}:${id}`;

function toItem(m: MappedField, files: { resume?: FileRef; coverLetter?: FileRef }): FillItem | null {
  const f = m.field;
  if (m.file) {
    const file = files[m.file];
    return file ? { id: f.id, file } : null;
  }
  if (f.kind === 'checkbox' && m.optionValue) return { id: f.id, checked: m.optionValue === 'true' };
  if ((f.kind === 'select' || f.kind === 'radio') && m.optionValue !== undefined) return { id: f.id, optionValue: m.optionValue };
  if (f.kind !== 'select' && f.kind !== 'radio' && f.kind !== 'checkbox' && m.value) return { id: f.id, value: m.value };
  if (m.sensitive || f.required || m.askLlm || m.value) return { id: f.id, review: true };
  return null;
}

export async function autofillTab(
  tabId: number,
  opts: { jobId: string | null; overwrite: boolean; signal?: AbortSignal },
): Promise<AutofillSummary> {
  await pageOverlay.show(tabId, 'Filling the form…');
  try {
    const summary = await autofill(tabId, opts);
    await pageOverlay.finish(tabId, true, `${summary.filled.length} fields filled – review before submitting`);
    return summary;
  } catch (e) {
    await pageOverlay.finish(tabId, false, 'Could not fill this form');
    throw e;
  }
}

async function autofill(
  tabId: number,
  opts: { jobId: string | null; overwrite: boolean; signal?: AbortSignal },
): Promise<AutofillSummary> {
  const frames = await detectTab(tabId);
  const profile = await getProfile();
  if (!profile) throw new Error('Add your resume in the Profile tab first.');

  const [job, resumeDoc, letterDoc, qa] = await Promise.all([
    opts.jobId ? db.jobs.get(opts.jobId) : undefined,
    opts.jobId ? getResumeDocument(opts.jobId) : undefined,
    opts.jobId ? getDocument<LetterContent>(opts.jobId, 'coverLetter') : undefined,
    db.qa.toArray(),
  ]);
  const ctx: AutofillContext = {
    profile: profile.data,
    info: profile.applicationInfo,
    hasResumeFile: !!resumeDoc || !!profile.resumeFile,
    hasCoverLetter: !!letterDoc,
    coverLetterText: letterDoc ? letterText(letterDoc.content.letter, profile.data.contact.name) : '',
    qa,
  };

  const runs: FrameRun[] = frames
    .filter((f) => f.fields.fields.length > 0)
    .map((f) => ({ frameId: f.frameId, frameUrl: f.fields.frameUrl, mapped: f.fields.fields.map((x) => mapField(x, ctx)) }));

  const toAsk = runs.flatMap((r) =>
    r.mapped
      .filter((m) => m.askLlm && !m.sensitive && (opts.overwrite || !m.field.currentValue))
      .map((m) => ({ run: r, m, q: { ...m.field, id: qid(r.frameId, m.field.id) } as FieldDescriptor })),
  );
  if (toAsk.length) {
    let answers: Map<string, string> | null = null;
    try {
      const chain = buildChain(await loadSettings());
      answers = await answerQuestions(chain, toAsk.map((a) => a.q), profile.data, profile.applicationInfo, job ?? null, qa, opts.signal);
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      toAsk.forEach(({ m }) => (m.reason = `AI answer unavailable: ${(e as Error).message.split('\n')[0]}`));
    }
    for (const { run, m, q } of toAsk) {
      const v = answers?.get(q.id);
      if (!v) continue;
      const i = run.mapped.indexOf(m);
      run.mapped[i] = { ...withValue({ ...m, source: 'llm', askLlm: false, reason: undefined }, v), askLlm: false };
    }
  }

  const files: { resume?: FileRef; coverLetter?: FileRef } = {};
  const needs = new Set(runs.flatMap((r) => r.mapped.map((m) => m.file).filter(Boolean)));
  const name = profile.data.contact.name;
  const company = job?.analysis.company ?? '';
  const role = job?.analysis.title ?? '';
  if (needs.has('resume')) {
    if (resumeDoc) {
      const { buildResumePdf } = await import('../export/resumePdf');
      files.resume = await toFileRef(await buildResumePdf(resumeDoc.content), fileName(name, company, role, '', 'pdf'));
    } else if (profile.resumeFile) {
      files.resume = await toFileRef(profile.resumeFile, profile.resumeFileName ?? 'resume.pdf');
    }
  }
  if (needs.has('coverLetter') && letterDoc) {
    const { buildLetterPdf } = await import('../export/letterPdf');
    const blob = await buildLetterPdf({
      letter: letterDoc.content.letter,
      contact: profile.data.contact,
      company,
      location: job?.analysis.location ?? '',
    });
    files.coverLetter = await toFileRef(blob, fileName(name, company, role, 'Cover_Letter', 'pdf'));
  }

  const summary: AutofillSummary = { filled: [], review: [], skipped: [], runs };
  for (const run of runs) {
    const items = run.mapped.map((m) => toItem(m, files)).filter((x): x is FillItem => !!x);
    const results = new Map((await fillFrame(tabId, run.frameId, { items, overwrite: opts.overwrite })).map((r) => [r.id, r]));
    for (const m of run.mapped) {
      const row: SummaryRow = { frameId: run.frameId, id: m.field.id, label: m.field.label || m.field.name, value: m.file ? files[m.file]?.name : m.value };
      const r = results.get(m.field.id);
      if (r?.status === 'filled') summary.filled.push(row);
      else if (m.sensitive) summary.skipped.push({ ...row, reason: m.reason });
      else if (r?.status === 'skipped' && /already/.test(r.reason ?? '')) summary.skipped.push({ ...row, reason: r.reason });
      else if (r || m.field.required) summary.review.push({ ...row, reason: r?.reason ?? m.reason ?? 'needs your answer' });
      else summary.skipped.push({ ...row, reason: m.reason });
    }
  }
  return summary;
}

/** Saves the user's current answers to non-profile questions so the next autofill reuses them. */
export async function saveAnswers(tabId: number, runs: FrameRun[]): Promise<number> {
  let saved = 0;
  for (const run of runs) {
    const fields = run.mapped.filter((m) => m.saveable && m.field.kind !== 'file' && m.field.label);
    if (!fields.length) continue;
    const values = await collectFrame(tabId, run.frameId, fields.map((m) => m.field.id));
    for (const v of values) {
      const question = fields.find((m) => m.field.id === v.id)!.field.label;
      const key = qaKey(question);
      if (!key) continue;
      const existing = await db.qa.where('key').equals(key).first();
      await db.qa.put({ ...(existing?.id ? { id: existing.id } : {}), key, question, answer: v.value, updatedAt: Date.now() });
      saved++;
    }
  }
  return saved;
}
