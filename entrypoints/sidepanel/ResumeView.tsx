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
import { downloadBlob, downloadZip } from '@/lib/export/download';
import { fileName } from '@/lib/export/layout';
import { cleanProfileData, type ProfileData } from '@/lib/profile/schema';
import { tailorResume } from '@/lib/resume/tailor';
import { verifyTailored } from '@/lib/resume/verify';
import { scoreMatch } from '@/lib/score/score';
import { buildChain, loadSettings } from '@/lib/settings';
import ProfileEditor from './components/ProfileEditor';
import { WarningsBox } from './components/WarningsBox';

type ResumeRecord = DocumentRecord<ProfileData>;

const norm = (s: string) => s.trim().toLowerCase();

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
        jobId ? getDocument<ProfileData>(jobId, 'resume') : undefined,
      ]);
      setJob(j ?? null);
      setProfile(p ?? null);
      setDoc(d ?? null);
      setDraft(d?.content ?? null);
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
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold">
          Tailored resume for {role}
          {company && ` at ${company}`}
        </h2>
        <p className="text-xs text-gray-500">
          Rewrites your summary and bullets for this job using only facts from your profile. Review it before you use it.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!!busy} onClick={generate}>
            {doc ? 'Regenerate' : 'Generate tailored resume'}
          </button>
          {busy && abortRef.current && (
            <button className="btn-secondary" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          )}
        </div>
        {busy && <p className="text-sm text-blue-700">{busy}</p>}
        {error && <p className="text-sm whitespace-pre-wrap text-red-700">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
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

          <div className="sticky bottom-0 space-y-2 border-t border-gray-200 bg-gray-50 py-2">
            <button className="btn-secondary w-full" disabled={!dirty || !!busy} onClick={save}>
              {dirty ? 'Save changes' : 'All changes saved'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-primary" disabled={!!busy} onClick={() => download('docx')}>
                Download DOCX
              </button>
              <button className="btn-primary" disabled={!!busy} onClick={() => download('pdf')}>
                Download PDF
              </button>
              <button className="btn-secondary" disabled={!!busy} onClick={() => download('zip')}>
                Both (.zip)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
