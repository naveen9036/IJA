import { ChevronDown, CircleAlert, CircleCheck, Info, Lightbulb, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode, type SelectHTMLAttributes } from 'react';

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 -translate-x-1/2 translate-y-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition delay-150 duration-150 group-focus-within/tt:translate-y-0 group-focus-within/tt:opacity-100 group-hover/tt:translate-y-0 group-hover/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export function Select({
  options,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select className={`select ${className}`} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <LoaderCircle className={`${className} animate-spin motion-reduce:animate-none`} aria-hidden />;
}

/** Modern fluid AI processing animation — morphing orb with shimmer skeleton. */
export function AiScanLoader({ label }: { label: string }) {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-5 py-3 motion-reduce:animate-none">

      {/* Morphing orb stack */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Outer breathing glow ring */}
        <div
          className="animate-glow-pulse absolute inset-0 rounded-full motion-reduce:animate-none"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.18) 0%, transparent 70%)' }}
        />
        {/* Spinning dashed orbit */}
        <div
          className="animate-spin-slow absolute inset-1 rounded-full border-2 border-dashed border-indigo-300/60 motion-reduce:animate-none"
        />
        {/* Morphing blob core */}
        <div
          className="animate-morph animate-glow-pulse relative h-14 w-14 motion-reduce:animate-none"
          style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)',
            borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
          }}
        />
        {/* Sparkle icon centered on blob */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white drop-shadow"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
      </div>

      {/* Shimmer skeleton lines — suggest text being "read" */}
      <div className="w-full max-w-[140px] space-y-2">
        {[100, 80, 90, 65, 75].map((pct, i) => (
          <div key={i} className="h-1.5 overflow-hidden rounded-full bg-slate-100" style={{ width: `${pct}%` }}>
            <div
              className="animate-shimmer h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent motion-reduce:animate-none"
              style={{ animationDelay: `${i * 0.22}s` }}
            />
          </div>
        ))}
      </div>

      {/* Label + pulsing dots */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium tracking-wide text-indigo-700">{label}</p>
        <div className="flex items-center gap-1.5">
          {[0, 0.2, 0.4].map((delay, i) => (
            <span
              key={i}
              className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-indigo-400 motion-reduce:animate-none"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const TONES = {
  error: { icon: CircleAlert, cls: 'border-red-200 bg-red-50 text-red-800' },
  warning: { icon: TriangleAlert, cls: 'border-amber-200 bg-amber-50 text-amber-900' },
  success: { icon: CircleCheck, cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  info: { icon: Info, cls: 'border-indigo-200 bg-indigo-50 text-indigo-900' },
} as const;

export function Notice({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  const { icon: Icon, cls } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`animate-fade-in flex gap-2 rounded-lg border p-3 text-sm motion-reduce:animate-none ${cls}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 break-words whitespace-pre-wrap">{children}</div>
    </div>
  );
}

const helpKey = (id: string) => `ija.help.${id}`;

/** Title, purpose, and a collapsible "how to use" guide at the top of each tab. Closed until the user opens it. */
export function TabIntro({
  id,
  icon: Icon,
  title,
  summary,
  steps,
  tips = [],
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  steps: ReactNode[];
  tips?: ReactNode[];
}) {
  const [open, setOpen] = useState(() => localStorage.getItem(helpKey(id)) === 'open');
  const toggle = (next: boolean) => {
    setOpen(next);
    localStorage.setItem(helpKey(id), next ? 'open' : 'closed');
  };

  return (
    <section className="card space-y-3">
      <div className="flex items-start gap-3">
        <div className="animate-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm motion-reduce:animate-none">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{summary}</p>
        </div>
      </div>
      <details open={open} onToggle={(e) => toggle((e.target as HTMLDetailsElement).open)} className="group/help">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-indigo-700 select-none hover:text-indigo-800">
          <ChevronDown className="h-4 w-4 -rotate-90 transition group-open/help:rotate-0" aria-hidden />
          How to use this tab
        </summary>
        <div className="animate-fade-in mt-2 space-y-3 motion-reduce:animate-none">
          <ol className="space-y-1.5 text-sm text-slate-700">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {tips.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Good to know
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
