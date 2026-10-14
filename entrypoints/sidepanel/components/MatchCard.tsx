import type { MatchResult, RequirementMatch } from '@/lib/score/score';

const scoreColor = (s: number) => (s >= 75 ? 'text-green-700' : s >= 55 ? 'text-blue-700' : s >= 35 ? 'text-amber-700' : 'text-red-700');
const barColor = (s: number) => (s >= 0.75 ? 'bg-green-500' : s >= 0.55 ? 'bg-blue-500' : s >= 0.35 ? 'bg-amber-500' : 'bg-red-500');

function Mark({ r }: { r: RequirementMatch }) {
  if (!r.scored) return <span className="text-gray-400" title="Not scored">–</span>;
  if (r.credit >= 1) return <span className="text-green-700" title="You have this">✓</span>;
  if (r.credit >= 0.5) return <span className="text-amber-600" title="Partly">◐</span>;
  return <span className="text-red-600" title="Not found in your profile">✗</span>;
}

export function RequirementList({ title, items }: { title: string; items: RequirementMatch[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-gray-600 uppercase">{title}</h3>
      <ul className="space-y-0.5 text-sm">
        {items.map((r, i) => (
          <li key={`${i}-${r.text}`} className="flex gap-2">
            <Mark r={r} />
            <span className={r.scored ? '' : 'text-gray-500'}>
              {r.text}
              {r.missing.length > 0 && r.missing[0] !== r.text && (
                <span className="text-xs text-red-600"> (missing {r.missing.join(', ')})</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchCard({ match }: { match: MatchResult }) {
  return (
    <section className="card space-y-3" aria-label="Match score">
      <div className="flex items-center gap-3">
        <div className={`text-4xl font-bold ${scoreColor(match.score)}`} data-testid="match-score">
          {match.score}
        </div>
        <div>
          <div className={`font-semibold ${scoreColor(match.score)}`}>{match.label}</div>
          <div className="text-xs text-gray-500">out of 100</div>
        </div>
      </div>

      {match.warnings.map((w) => (
        <p key={w} className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {w}
        </p>
      ))}

      <p className="text-sm text-gray-700">{match.summary}</p>

      <div className="space-y-2">
        {match.components.map((c) => (
          <div key={c.key}>
            <div className="flex justify-between text-xs">
              <span className="font-medium">
                {c.label} <span className="text-gray-400">({c.weight}%)</span>
              </span>
              <span className="text-gray-600">{c.score === null ? 'not scored' : `${Math.round(c.score * 100)}%`}</span>
            </div>
            <div className="h-1.5 rounded bg-gray-100">
              {c.score !== null && (
                <div className={`h-1.5 rounded ${barColor(c.score)}`} style={{ width: `${Math.max(2, c.score * 100)}%` }} />
              )}
            </div>
            <div className="text-xs text-gray-500">{c.detail}</div>
          </div>
        ))}
      </div>

      {match.missingKeywords.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-gray-600 uppercase">Not in your profile</h3>
          <div className="flex flex-wrap gap-1">
            {match.missingKeywords.map((k) => (
              <span key={k} className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-800">
                {k}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500">If you do have one of these, add it to your profile so it counts.</p>
        </div>
      )}
    </section>
  );
}
