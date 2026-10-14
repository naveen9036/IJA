import { useEffect, useRef, useState } from 'react';
import {
  db,
  documentId,
  getDocument,
  getProfile,
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
import { WarningsBox } from './components/WarningsBox';

type LetterRecord = DocumentRecord<LetterContent>;

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
        jobId ? getDocument<ProfileData>(jobId, 'resume') : undefined,
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

  if (!loaded) return <p className="text-sm text-gray-500">Loading…</p>;

  if (!job || !job.analysis.isJobPosting) {
    return (
      <section className="card text-sm">
        Analyze a job posting first.{' '}
        <button className="text-blue-700 underline" onClick={onOpenJob}>
          Go to Job
        </button>
      </section>
    );
  }
  if (!profile) {
    return (
      <section className="card text-sm">
        Add your resume first.{' '}
        <button className="text-blue-700 underline" onClick={onOpenProfile}>
          Go to Profile
        </button>
      </section>
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
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold">
          Cover letter for {role}
          {company && ` at ${company}`}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tone">
            <select
              className="input"
              value={options.tone}
              onChange={(e) => setOptions({ ...options, tone: e.target.value as LetterTone })}
            >
              <option value="professional">Professional</option>
              <option value="warm">Warm</option>
              <option value="concise">Concise</option>
            </select>
          </Field>
          <Field label="Length">
            <select
              className="input"
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: e.target.value as LetterLength })}
            >
              <option value="short">Short (~150 words)</option>
              <option value="standard">Standard (~250 words)</option>
              <option value="long">Long (~350 words)</option>
            </select>
          </Field>
        </div>
        <TextArea
          label="Anything to mention? (optional, e.g. referred by Alex)"
          rows={2}
          value={options.notes}
          onChange={(notes) => setOptions({ ...options, notes })}
        />
        <p className="text-xs text-gray-500">
          Uses {tailored ? 'your tailored resume for this job' : 'your profile'}; only facts from it are allowed.
        </p>
        <button className="btn-primary w-full" disabled={!!busy} onClick={generate}>
          {doc ? 'Regenerate' : 'Generate cover letter'}
        </button>
        {busy && (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <span>{busy}</span>
            {abortRef.current && (
              <button className="btn-secondary px-2 py-0.5" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            )}
          </div>
        )}
        {error && <p className="text-sm whitespace-pre-wrap text-red-700">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
        {doc && <p className="text-xs text-gray-500">Generated with {doc.provider}.</p>}
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

          <div className="sticky bottom-0 space-y-2 border-t border-gray-200 bg-gray-50 py-2">
            <button className="btn-secondary w-full" disabled={!dirty || !!busy} onClick={save}>
              {dirty ? 'Save changes' : 'All changes saved'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-secondary" disabled={!!busy} onClick={copy}>
                Copy text
              </button>
              <button className="btn-primary" disabled={!!busy} onClick={() => download('docx')}>
                Download DOCX
              </button>
              <button className="btn-primary" disabled={!!busy} onClick={() => download('pdf')}>
                Download PDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
