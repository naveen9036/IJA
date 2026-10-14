import { useEffect, useMemo, useRef, useState } from 'react';
import { db, getProfile, type JobRecord, type ProfileRecord } from '@/lib/db';
import { analyzeTab, getTargetTabId, requestSiteAccess } from '@/lib/job/capture';
import { scoreMatch } from '@/lib/score/score';
import { MatchCard, RequirementList } from './components/MatchCard';

const SOURCE_LABEL: Record<JobRecord['source'], string> = {
  selection: 'your highlighted text',
  adapter: 'site-specific reader',
  jsonld: 'structured job data on the page',
  readability: 'main page content',
  heuristic: 'best matching page section',
};

function Chips({ items, tone }: { items: string[]; tone: 'blue' | 'gray' }) {
  const cls = tone === 'blue' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s, i) => (
        <span key={`${i}-${s}`} className={`rounded border px-1.5 py-0.5 text-xs ${cls}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

export default function JobView({
  jobId,
  onJob,
  onOpenProfile,
}: {
  jobId: string | null;
  onJob: (id: string) => void;
  onOpenProfile: () => void;
}) {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getProfile().then((p) => setProfile(p ?? null));
    if (jobId) {
      db.jobs.get(jobId).then((j) => {
        if (j) {
          setJob((current) => current ?? j);
          setCached(true);
        }
      });
    }
    return () => abortRef.current?.abort();
  }, []);

  const match = useMemo(
    () => (job?.analysis.isJobPosting && profile ? scoreMatch(profile, job) : null),
    [job, profile],
  );

  const analyze = async (force: boolean) => {
    setError('');
    const granted = await requestSiteAccess();
    if (!granted) {
      setError('IJA needs permission to read the job page. Click Analyze again and choose Allow.');
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    try {
      const outcome = await analyzeTab(await getTargetTabId(), { force, signal: ctrl.signal });
      setJob(outcome.record);
      setCached(outcome.cached);
      onJob(outcome.record.id);
      setProfile((await getProfile()) ?? null);
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const a = job?.analysis;

  return (
    <div className="space-y-3">
      <section className="card space-y-2">
        <p className="text-sm text-gray-600">
          Open a job posting on any site, then click Analyze. To pick the text yourself, highlight the job description
          first.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => analyze(false)}>
            {busy ? 'Analyzing…' : 'Analyze this page'}
          </button>
          {busy && (
            <button className="btn-secondary" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          )}
        </div>
        {error && <p className="text-sm whitespace-pre-wrap text-red-700">{error}</p>}
      </section>

      {job && a && !a.isJobPosting && (
        <section className="card border-amber-300 bg-amber-50 text-sm">
          This page doesn't look like a single job posting. Open the job's own page, or highlight the job description
          and click Analyze again.
        </section>
      )}

      {job && a?.isJobPosting && match && <MatchCard match={match} />}

      {job && a?.isJobPosting && !profile && (
        <section className="card border-blue-200 bg-blue-50 text-sm">
          Add your resume to see how well you match this job.{' '}
          <button className="text-blue-700 underline" onClick={onOpenProfile}>
            Go to Profile
          </button>
        </section>
      )}

      {job && a?.isJobPosting && (
        <section className="card space-y-3">
          <div>
            <h2 className="text-base font-semibold">{a.title || job.hints.title || job.pageTitle}</h2>
            <p className="text-sm text-gray-700">
              {[a.company, a.location, a.workMode, a.employmentType].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-gray-500">
              {[
                a.seniority && `Seniority: ${a.seniority}`,
                a.yearsExperience !== null && `${a.yearsExperience}+ years`,
                a.salary && `Salary: ${a.salary}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="truncate text-xs text-gray-400" title={job.url}>
              {job.url}
            </p>
          </div>

          {match ? (
            <>
              <RequirementList title="Must have" items={match.mustHave} />
              <RequirementList title="Nice to have" items={match.niceToHave} />
            </>
          ) : (
            <>
              {a.mustHave.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase">Must have</h3>
                  <Chips items={a.mustHave} tone="blue" />
                </div>
              )}
              {a.niceToHave.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase">Nice to have</h3>
                  <Chips items={a.niceToHave} tone="gray" />
                </div>
              )}
            </>
          )}
          {a.responsibilities.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-gray-600 uppercase">Responsibilities</summary>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {a.responsibilities.map((r, i) => (
                  <li key={`${i}-${r}`}>{r}</li>
                ))}
              </ul>
            </details>
          )}
          <details>
            <summary className="cursor-pointer text-xs text-gray-500">
              Read from {job.adapter ? `${job.adapter} reader` : SOURCE_LABEL[job.source]}
              {cached ? ' (saved result)' : ` with ${job.provider}`}
            </summary>
            <pre className="mt-1 max-h-64 overflow-auto text-xs whitespace-pre-wrap text-gray-700">{job.text}</pre>
          </details>
          <button className="btn-secondary" disabled={busy} onClick={() => analyze(true)}>
            Re-analyze
          </button>
        </section>
      )}
    </div>
  );
}
