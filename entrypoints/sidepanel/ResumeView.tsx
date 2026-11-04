import { Download, FileArchive, FileText, Save, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  db,
  documentId,
  getProfile,
  getResumeDocument,
  saveDocument,
  type DocumentRecord,
  type JobRecord,
  type ProfileRecord,
} from '@/lib/db';
import { downloadBlob, downloadZip } from '@/lib/export/download';
import { fileName } from '@/lib/export/layout';
import { cleanProfileData, type ProfileData } from '@/lib/profile/schema';
import { tailorResume } from '@/lib/resume/tailor';
import { verifyTailored } from '@/lib/resume/verify';
import { scoreMatch } from '@/lib/score/score';
import { buildChain, loadSettings } from '@/lib/settings';
import ProfileEditor from './components/ProfileEditor';
import { Notice, Spinner, TabIntro } from './components/ui';
import { WarningsBox } from './components/WarningsBox';

type ResumeRecord = DocumentRecord<ProfileData>;

const norm = (s: string) => s.trim().toLowerCase();

const intro = (
  <TabIntro
    id="resume"
    icon={FileText}
    title="Tailored resume"
    summary="Rewrite your resume for the analyzed job, using only facts from your profile."
    steps={[
      'Analyze a job in the Job tab, and make sure your resume is saved in Profile.',
      <>
        Click <b>Generate tailored resume</b>. The AI rewrites your summary and bullet points around this job's
        requirements.
      </>,
      'Read the amber review box. Anything the AI invented – a skill, a role, a number – is removed or flagged so you can fix it.',
      'Edit any section below. Open a role to compare the new bullets with the ones from your profile.',
      'Save your edits, then download Word (DOCX), PDF, or both as a zip.',
    ]}
    tips={[
      'Contact details, education, employers, job titles and dates always come from your profile – the AI cannot change them.',
      'The files use a single-column layout without tables or images, which applicant tracking systems read reliably.',
      'One tailored resume is kept per job. Regenerating replaces it, so download first if you want to keep a version.',
    ]}
  />
);

export default function ResumeView({
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
  const [doc, setDoc] = useState<ResumeRecord | null>(null);
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      const [j, p, d] = await Promise.all([
        jobId ? db.jobs.get(jobId) : undefined,
        getProfile(),
        jobId ? getResumeDocument(jobId) : undefined,
      ]);
      setJob(j ?? null);
      setProfile(p ?? null);
      setDoc(d ?? null);
      setDraft(d?.content ?? null);
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

  const generate = async () => {
    if (doc && !confirm('Replace the current tailored resume (including your edits)?')) return;
    setError('');
    setNotice('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy('Tailoring your resume…');
    try {
      const chain = buildChain(await loadSettings());
      const match = scoreMatch(profile, job);
      const { value, provider } = await tailorResume(chain, profile.data, job, match, ctrl.signal);
      const verified = verifyTailored(profile.data, value.resume, profile.rawText);
      const now = Date.now();
      const record: ResumeRecord = {
        id: documentId(job.id, 'resume'),
        jobId: job.id,
        type: 'resume',
        content: verified.resume,
        notes: value.notes,
        warnings: verified.warnings,
        removed: verified.removed,
        provider,
        profileVersion: profile.version,
        createdAt: now,
        updatedAt: now,
      };
      await saveDocument(record);
      setDoc(record);
      setDraft(record.content);
      setDirty(false);
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy('');
      abortRef.current = null;
    }
  };

  const save = async () => {
    if (!doc || !draft) return;
    const record = { ...doc, content: cleanProfileData(draft), updatedAt: Date.now() };
    await saveDocument(record);
    setDoc(record);
    setDraft(record.content);
    setDirty(false);
    setNotice('Changes saved.');
  };

  const files = async (which: ('docx' | 'pdf')[]) => {
    const resume = cleanProfileData(draft!);
    const name = (ext: string) => fileName(resume.contact.name, company, role, '', ext);
    const out: { name: string; blob: Blob }[] = [];
    if (which.includes('docx')) {
      const { buildResumeDocx } = await import('@/lib/export/resumeDocx');
      out.push({ name: name('docx'), blob: await buildResumeDocx(resume) });
    }
    if (which.includes('pdf')) {
      const { buildResumePdf } = await import('@/lib/export/resumePdf');
      out.push({ name: name('pdf'), blob: await buildResumePdf(resume) });
    }
    return out;
  };

  const download = async (which: 'docx' | 'pdf' | 'zip') => {
    setError('');
    setBusy('Preparing file…');
    try {
      if (which === 'zip') {
        const all = await files(['docx', 'pdf']);
        await downloadZip(all, fileName(draft!.contact.name, company, role, '', 'zip'));
      } else {
        const [f] = await files([which]);
        if (f) downloadBlob(f.blob, f.name);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const originalRole = (i: number) => {
    const edited = draft?.experience[i];
    if (!edited) return undefined;
    return (
      profile.data.experience.find((o) => norm(o.company) === norm(edited.company) && norm(o.title) === norm(edited.title)) ??
      profile.data.experience[i]
    );
  };

  return (
    <div className="space-y-3">
      {intro}
      <section className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          For {role}
          {company && ` at ${company}`}
        </h3>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!!busy} onClick={generate}>
            {busy ? <Spinner /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {doc ? 'Regenerate' : 'Generate tailored resume'}
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
        {doc && doc.profileVersion !== profile.version && (
          <p className="text-xs text-amber-700">Your profile changed after this was generated. Regenerate to include it.</p>
        )}
        {doc && <p className="text-xs text-gray-500">Generated with {doc.provider}.</p>}
      </section>

      {doc && <WarningsBox title="Check these before using the resume" removed={doc.removed} warnings={doc.warnings} />}

      {doc && doc.notes.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-semibold">What changed</summary>
          <ul className="mt-1 list-disc pl-5">
            {doc.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}

      {draft && (
        <>
          <ProfileEditor
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setDirty(true);
            }}
            roleExtra={(i) => {
              const o = originalRole(i);
              return o?.bullets.length ? (
                <details className="rounded bg-gray-50 p-2 text-xs">
                  <summary className="cursor-pointer text-gray-600">Show original</summary>
                  <ul className="mt-1 list-disc pl-4 text-gray-700">
                    {o.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </details>
              ) : null;
            }}
          />

          <div className="sticky bottom-0 -mx-3 space-y-2 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
            <button className="btn-secondary w-full" disabled={!dirty || !!busy} onClick={save}>
              <Save className="h-4 w-4" aria-hidden />
              {dirty ? 'Save changes' : 'All changes saved'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-primary px-2" disabled={!!busy} onClick={() => download('docx')}>
                <Download className="h-4 w-4" aria-hidden />
                Download DOCX
              </button>
              <button className="btn-primary px-2" disabled={!!busy} onClick={() => download('pdf')}>
                <Download className="h-4 w-4" aria-hidden />
                Download PDF
              </button>
              <button className="btn-secondary px-2" disabled={!!busy} onClick={() => download('zip')}>
                <FileArchive className="h-4 w-4" aria-hidden />
                Both (.zip)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
