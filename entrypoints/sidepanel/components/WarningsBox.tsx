import type { VerifyWarning } from '@/lib/resume/verify';

export function WarningsBox({ title, removed, warnings }: { title: string; removed: string[]; warnings: VerifyWarning[] }) {
  if (removed.length === 0 && warnings.length === 0) return null;
  return (
    <section className="card space-y-2 border-amber-300 bg-amber-50" aria-label="Review warnings">
      <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
      {removed.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-900">
          {removed.map((r) => (
            <li key={r}>Removed: {r}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
          {warnings.map((w, i) => (
            <li key={i}>
              <span className="font-medium">{w.path}</span>: {w.reason}
              {w.text && <div className="text-xs text-amber-800">“{w.text}”</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
