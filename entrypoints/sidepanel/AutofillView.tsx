import { BookmarkPlus, CircleCheck, ClipboardCheck, Copy, ShieldCheck, TriangleAlert, Wand2, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { autofillTab, saveAnswers, type AutofillSummary, type SummaryRow } from '@/lib/autofill/run';
import { getTargetTabId, requestSiteAccess } from '@/lib/job/capture';
import { Notice, Spinner, TabIntro } from './components/ui';

const ROW_TONES: Record<'green' | 'amber' | 'gray', { color: string; icon: LucideIcon }> = {
  green: { color: 'text-emerald-700', icon: CircleCheck },
  amber: { color: 'text-amber-800', icon: TriangleAlert },
  gray: { color: 'text-slate-600', icon: X },
};

function Rows({
  title,
  rows,
  tone,
  copy,
}: {
  title: string;
  rows: SummaryRow[];
  tone: 'green' | 'amber' | 'gray';
  copy?: boolean;
}) {
  if (!rows.length) return null;
  const { color, icon: Icon } = ROW_TONES[tone];
  return (
    <details className="card group/rows" open={tone === 'amber'}>
      <summary className={`flex cursor-pointer list-none items-center gap-2 text-sm font-semibold select-none ${color}`}>
        <Icon className="h-4 w-4" aria-hidden />
        <span>{`${title} (${rows.length})`}</span>
      </summary>
      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {rows.map((r) => (
          <li key={`${r.frameId}:${r.id}`} className="flex items-start gap-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-800" title={r.label}>
                {r.label || '(unlabelled field)'}
              </div>
              {r.value && <div className="truncate text-xs text-slate-600">{r.value}</div>}
              {r.reason && <div className="text-xs text-slate-500">{r.reason}</div>}
            </div>
            {copy && r.value && (
              <button
                className="btn-secondary px-2 py-1 text-xs"
                aria-label={`Copy ${r.label}`}
                onClick={() => navigator.clipboard.writeText(r.value!)}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function AutofillView({ jobId }: { jobId: string | null }) {
  const [summary, setSummary] = useState<AutofillSummary | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    setError('');
    setNotice('');
    const granted = await requestSiteAccess();
    if (!granted) {
      setError('IJA needs permission to fill forms on this page. Click again and choose Allow.');
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy('Filling the form…');
    try {
      const id = await getTargetTabId();
      setTabId(id);
      const result = await autofillTab(id, { jobId, overwrite, signal: ctrl.signal });
      setSummary(result);
      if (!result.runs.length) setNotice('No form fields found on this page.');
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy('');
      abortRef.current = null;
    }
  };

  const save = async () => {
    if (!summary || tabId === null) return;
    setError('');
    try {
      const n = await saveAnswers(tabId, summary.runs);
      setNotice(n ? `Saved ${n} answer${n === 1 ? '' : 's'} for next time.` : 'No answers to save yet.');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <TabIntro
        id="apply"
        icon={ClipboardCheck}
        title="Autofill application"
        summary="Fill the application form on the current page with one click. You stay in control: IJA never submits."
        steps={[
          'Open the job application form in this browser window and sign in to the site if it asks.',
          <>
            Click <b>Autofill this page</b>. Name, contact details, links, location, current job, education, work
            authorization and your resume file are filled from your profile.
          </>,
          'Fields outlined in green were filled. Amber outlines and the review list below need your attention – use Copy for dropdowns the extension could not set.',
          'Answer personal questions (gender, race, veteran, disability) yourself.',
          'For multi-step forms, click Fill again after each step loads.',
          'After correcting answers on the page, save them so the next application reuses them.',
        ]}
        tips={[
          'Open questions like “Why do you want to work here?” are answered by the AI from your profile in one request; unclear ones are left empty.',
          'If you made a tailored resume or cover letter for this job, those PDFs are attached instead of your original file.',
          'Fields that already have a value are left alone unless you tick Overwrite.',
        ]}
      />

      <section className="card space-y-3">
        <button className="btn-primary w-full" disabled={!!busy} onClick={run}>
          {busy ? <Spinner /> : <Wand2 className="h-4 w-4" aria-hidden />}
          {busy ? busy : summary ? 'Fill again' : 'Autofill this page'}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded accent-indigo-600"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          Overwrite fields that already have a value
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
      </section>

      {summary && summary.runs.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center" data-testid="autofill-counts">
            <div className="rounded-xl bg-emerald-50 p-2">
              <div className="text-xl font-bold text-emerald-700">{summary.filled.length}</div>
              <div className="text-xs text-emerald-800">filled</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-2">
              <div className="text-xl font-bold text-amber-700">{summary.review.length}</div>
              <div className="text-xs text-amber-800">need review</div>
            </div>
            <div className="rounded-xl bg-slate-100 p-2">
              <div className="text-xl font-bold text-slate-600">{summary.skipped.length}</div>
              <div className="text-xs text-slate-600">skipped</div>
            </div>
          </div>
          <Rows title="Needs review" rows={summary.review} tone="amber" copy />
          <Rows title="Filled" rows={summary.filled} tone="green" />
          <Rows title="Skipped" rows={summary.skipped} tone="gray" />
          <section className="card space-y-2">
            <p className="text-xs text-slate-600">
              Edited or answered something on the page? Save it and IJA fills it in for you next time.
            </p>
            <button className="btn-secondary w-full" onClick={save}>
              <BookmarkPlus className="h-4 w-4" aria-hidden />
              Save my answers for next time
            </button>
          </section>
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        IJA never submits forms. Review everything before you submit.
      </p>
    </div>
  );
}
