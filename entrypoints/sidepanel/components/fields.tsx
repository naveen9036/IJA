import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-0.5">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea className="input" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** Edits a string[] as one item per line. */
export function LinesInput({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  rows?: number;
}) {
  return (
    <TextArea
      label={`${label} (one per line)`}
      rows={rows}
      value={value.join('\n')}
      onChange={(v) => onChange(v.split('\n'))}
    />
  );
}

/** Edits a string[] as a comma-separated list. */
export function CsvInput({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <TextArea
      label={`${label} (comma-separated)`}
      value={value.join(', ')}
      onChange={(v) => onChange(v.split(',').map((s) => s.trimStart()))}
    />
  );
}

export function ListSection<T>({
  title,
  items,
  onChange,
  create,
  render,
  itemTitle,
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  itemTitle: (item: T) => string;
}) {
  const update = (i: number, patch: Partial<T>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button className="btn-secondary px-2 py-0.5" onClick={() => onChange([...items, create()])}>
          + Add
        </button>
      </div>
      {items.map((item, i) => (
        <details key={i} className="rounded border border-gray-200 p-2" open={!itemTitle(item).trim()}>
          <summary className="cursor-pointer text-sm">{itemTitle(item).trim() || '(new)'}</summary>
          <div className="mt-2 space-y-2">
            {render(item, (patch) => update(i, patch), i)}
            <button className="btn-danger px-2 py-0.5" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        </details>
      ))}
    </section>
  );
}
