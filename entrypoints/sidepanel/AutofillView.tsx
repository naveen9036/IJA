import { useEffect, useRef, useState } from 'react';
import { autofillTab, saveAnswers, type AutofillSummary, type SummaryRow } from '@/lib/autofill/run';
import { getTargetTabId, requestSiteAccess } from '@/lib/job/capture';

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
  const color = { green: 'text-green-800', amber: 'text-amber-900', gray: 'text-gray-600' }[tone];
  return (
    <details className="card" open={tone === 'amber'}>
      <summary className={`cursor-pointer text-sm font-semibold ${color}`}>
        {title} ({rows.length})
      </summary>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((r) => (
          <li key={`${r.frameId}:${r.id}`} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium" title={r.label}>
                {r.label || '(unlabelled field)'}
              </div>
              {r.value && <div className="truncate text-xs text-gray-700">{r.value}</div>}
              {r.reason && <div className="text-xs text-gray-500">{r.reason}</div>}
            </div>
            {copy && r.value && (
              <button className="btn-secondary px-2 py-0.5 text-xs" onClick={() => navigator.clipboard.writeText(r.value!)}>
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
      <section className="card space-y-2">
        <p className="text-sm text-gray-600">
          Open the application form, then click Autofill. For multi-step forms, click Fill again on each step.
        </p>
        <button className="btn-primary w-full" disabled={!!busy} onClick={run}>
          {busy ? busy : summary ? 'Fill again' : 'Autofill this page'}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          Overwrite fields that already have a value
        </label>
        {error && <p className="text-sm whitespace-pre-wrap text-red-700">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
      </section>

      {summary && summary.runs.length > 0 && (
        <>
          <p className="text-sm" data-testid="autofill-counts">
            <span className="text-green-700">{summary.filled.length} filled</span> ·{' '}
            <span className="text-amber-700">{summary.review.length} need review</span> ·{' '}
            <span className="text-gray-600">{summary.skipped.length} skipped</span>
          </p>
          <Rows title="Needs review" rows={summary.review} tone="amber" copy />
          <Rows title="Filled" rows={summary.filled} tone="green" />
          <Rows title="Skipped" rows={summary.skipped} tone="gray" />
          <section className="card space-y-2">
            <p className="text-xs text-gray-600">
              After you edit or answer questions on the page, save them so IJA fills them in next time.
            </p>
            <button className="btn-secondary w-full" onClick={save}>
              Save my answers for next time
            </button>
          </section>
        </>
      )}

      <p className="text-xs text-gray-500">IJA never submits forms. Review everything before you submit.</p>
    </div>
  );
}
