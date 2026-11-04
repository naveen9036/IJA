import { Copy, Download, Mail, Save, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  db,
  documentId,
  getDocument,
  getProfile,
  getResumeDocument,
  saveDocument,
  type DocumentRecord,
  type JobRecord,
  type ProfileRecord,
} from '@/lib/db';
import { downloadBlob } from '@/lib/export/download';
import { fileName } from '@/lib/export/layout';
import type { LetterRenderInput } from '@/lib/export/letterLayout';
import {
  defaultLetterOptions,
  letterText,
  wordCount,
  type CoverLetter,
  type LetterContent,
  type LetterLength,
  type LetterOptions,
  type LetterTone,
} from '@/lib/letter/schema';
import { verifyLetter } from '@/lib/letter/verify';
import { writeCoverLetter } from '@/lib/letter/write';
import type { ProfileData } from '@/lib/profile/schema';
import { scoreMatch } from '@/lib/score/score';
import { buildChain, loadSettings } from '@/lib/settings';
import { Field, TextArea, TextInput } from './components/fields';
import { Notice, Select, Spinner, TabIntro } from './components/ui';
import { WarningsBox } from './components/WarningsBox';

type LetterRecord = DocumentRecord<LetterContent>;

const intro = (
  <TabIntro
    id="letter"
    icon={Mail}
    title="Cover letter"
    summary="Write a cover letter for the analyzed job from your own experience."
    steps={[
      'Analyze a job in the Job tab first. If you also made a tailored resume, the letter is based on it.',
      'Pick a tone (Professional, Warm or Concise) and a length.',
      'Optionally add notes the letter should mention – a referral, why this company, a relocation plan.',
      <>
        Click <b>Generate cover letter</b> and read the review box: it flags placeholders like [Company], numbers that
        aren't in your profile, and a missing company name.
      </>,
      'Edit the greeting, paragraphs and sign-off, save, then copy the text or download DOCX or PDF.',
    ]}
    tips={[
      'Facts in your notes count as yours, so the AI may use them.',
      'Your name from Profile is always used as the signature.',
      'Tone, length and notes are remembered for this job.',
    ]}
  />
);

export default function CoverLetterView({
  jobId,
  onOpenProfile,
  onOpenJob,
}: {
  jobId: string | null;
  onOpenProfile: () => void;
  onOpenJob: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [tailored, setTailored] = useState<ProfileData | null>(null);
  const [doc, setDoc] = useState<LetterRecord | null>(null);
  const [options, setOptions] = useState<LetterOptions>(defaultLetterOptions());
  const [draft, setDraft] = useState<CoverLetter | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      const [j, p, d, r] = await Promise.all([
        jobId ? db.jobs.get(jobId) : undefined,
        getProfile(),
        jobId ? getDocument<LetterContent>(jobId, 'coverLetter') : undefined,
        jobId ? getResumeDocument(jobId) : undefined,
      ]);
      setJob(j ?? null);
      setProfile(p ?? null);
      setTailored(r?.content ?? null);
      setDoc(d ?? null);
      setDraft(d?.content.letter ?? null);
      if (d) setOptions(d.content.options);
      setLoaded(true);
    })();
    return () => abortRef.current?.abort();
  }, [jobId]);

  if (!loaded) return intro;

  if (!job || !job.analysis.isJobPosting) {
    return (
      <>
        {intro}
        <Notice tone="info">
          Analyze a job posting first.{' '}
          <button className="font-medium underline" onClick={onOpenJob}>
            Go to Job
          </button>
        </Notice>
      </>
    );
  }
  if (!profile) {
    return (
      <>
        {intro}
        <Notice tone="info">
          Add your resume first.{' '}
          <button className="font-medium underline" onClick={onOpenProfile}>
            Go to Profile
          </button>
        </Notice>
      </>
    );
  }

  const company = job.analysis.company || job.hints.company || '';
  const role = job.analysis.title || job.hints.title || '';
  const name = profile.data.contact.name;

  const generate = async () => {
    if (doc && !confirm('Replace the current cover letter (including your edits)?')) return;
    setError('');
    setNotice('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy('Writing your cover letter…');
    try {
      const chain = buildChain(await loadSettings());
      const match = scoreMatch(profile, job);
      const { value, provider } = await writeCoverLetter(chain, tailored ?? profile.data, job, match, options, ctrl.signal);
      const checked = verifyLetter(value, { profile: profile.data, rawText: profile.rawText, jobText: job.text, company, options });
      const now = Date.now();
      const record: LetterRecord = {
        id: documentId(job.id, 'coverLetter'),
        jobId: job.id,
        type: 'coverLetter',
        content: { letter: checked.letter, options },
        notes: [],
        warnings: checked.warnings,
        removed: [],
        provider,
        profileVersion: profile.version,
        createdAt: now,
        updatedAt: now,
      };
      await saveDocument(record);
      setDoc(record);
      setDraft(checked.letter);
      setDirty(false);
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy('');
      abortRef.current = null;
    }
  };

  const edit = (patch: Partial<CoverLetter>) => {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };

  const save = async () => {
    if (!doc || !draft) return;
    const letter = { ...draft, paragraphs: draft.paragraphs.map((p) => p.trim()).filter(Boolean) };
    const record = { ...doc, content: { letter, options }, updatedAt: Date.now() };
    await saveDocument(record);
    setDoc(record);
    setDraft(letter);
    setDirty(false);
    setNotice('Changes saved.');
  };

  const copy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(letterText(draft, name));
    setNotice('Copied to clipboard.');
  };

  const download = async (ext: 'docx' | 'pdf') => {
    if (!draft) return;
    setError('');
    setBusy('Preparing file…');
    try {
      const input: LetterRenderInput = { letter: draft, contact: profile.data.contact, company, location: job.analysis.location };
      const blob =
        ext === 'docx'
          ? await (await import('@/lib/export/letterDocx')).buildLetterDocx(input)
          : await (await import('@/lib/export/letterPdf')).buildLetterPdf(input);
      downloadBlob(blob, fileName(name, company, role, 'Cover_Letter', ext));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-3">
      {intro}
      <section className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          For {role}
          {company && ` at ${company}`}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tone">
            <Select
              value={options.tone}
              onChange={(e) => setOptions({ ...options, tone: e.target.value as LetterTone })}
              options={[
                { value: 'professional', label: 'Professional' },
                { value: 'warm', label: 'Warm' },
                { value: 'concise', label: 'Concise' },
              ]}
            />
          </Field>
          <Field label="Length">
            <Select
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: e.target.value as LetterLength })}
              options={[
                { value: 'short', label: 'Short (~150 words)' },
                { value: 'standard', label: 'Standard (~250 words)' },
                { value: 'long', label: 'Long (~350 words)' },
              ]}
            />
          </Field>
        </div>
        <TextArea
          label="Anything to mention? (optional, e.g. referred by Alex)"
          rows={2}
          value={options.notes}
          onChange={(notes) => setOptions({ ...options, notes })}
        />
        <p className="text-xs text-slate-500">
          Based on {tailored ? 'your tailored resume for this job' : 'your profile'}; only facts from it are allowed.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!!busy} onClick={generate}>
            {busy ? <Spinner /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {doc ? 'Regenerate' : 'Generate cover letter'}
          </button>
          {busy && abortRef.current && (
            <button className="btn-secondary" onClick={() => abortRef.current?.abort()}>
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </button>
          )}
        </div>
        {busy && <p className="text-sm text-indigo-700">{busy}</p>}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
        {doc && <p className="text-xs text-slate-500">Generated with {doc.provider}.</p>}
      </section>

      {doc && <WarningsBox title="Check these before sending" removed={doc.removed} warnings={doc.warnings} />}

      {draft && (
        <>
          <section className="card space-y-2">
            <TextInput label="Salutation" value={draft.salutation} onChange={(salutation) => edit({ salutation })} />
            {draft.paragraphs.map((p, i) => (
              <TextArea
                key={i}
                label={`Paragraph ${i + 1}`}
                rows={5}
                value={p}
                onChange={(v) => edit({ paragraphs: draft.paragraphs.map((x, j) => (j === i ? v : x)) })}
              />
            ))}
            <TextInput label="Closing" value={draft.closing} onChange={(closing) => edit({ closing })} />
            <p className="text-xs text-gray-500">
              Signed as {name || '(add your name in Profile)'} · {wordCount(draft.paragraphs)} words
            </p>
          </section>

          <div className="sticky bottom-0 -mx-3 space-y-2 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
            <button className="btn-secondary w-full" disabled={!dirty || !!busy} onClick={save}>
              <Save className="h-4 w-4" aria-hidden />
              {dirty ? 'Save changes' : 'All changes saved'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-secondary px-2" disabled={!!busy} onClick={copy}>
                <Copy className="h-4 w-4" aria-hidden />
                Copy text
              </button>
              <button className="btn-primary px-2" disabled={!!busy} onClick={() => download('docx')}>
                <Download className="h-4 w-4" aria-hidden />
                Download DOCX
              </button>
              <button className="btn-primary px-2" disabled={!!busy} onClick={() => download('pdf')}>
                <Download className="h-4 w-4" aria-hidden />
                Download PDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
