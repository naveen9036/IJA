import type { FieldDescriptor, FieldKind, FieldOption, FrameFields } from './types';

export type Registry = Map<string, Element[]>;

export interface DetectOptions {
  /** False in jsdom, which has no layout; visibility then relies on styles only. */
  layout: boolean;
}

const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search']);
const KIND_BY_TYPE: Record<string, FieldKind> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  number: 'number',
  date: 'date',
  radio: 'radio',
  checkbox: 'checkbox',
  file: 'file',
};
const MAX_LABEL = 300;

const clean = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\*\s*/g, ' ')
    .replace(/\(required\)/i, '')
    .replace(/[\s:]+$/, '')
    .trim();

const humanize = (s: string) =>
  s
    .replace(/.*\[([^\]]+)\]$/, '$1')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.[\]]+/g, ' ')
    .trim()
    .toLowerCase();

/** Text of an element without the text of form controls inside it (e.g. a select's options). */
function ownText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('input, select, textarea, option, button, script, style').forEach((n) => n.remove());
  return clean(clone.textContent);
}

function isVisible(el: Element, opts: DetectOptions): boolean {
  const win = el.ownerDocument.defaultView;
  for (let n: Element | null = el; n; n = n.parentElement ?? ((n.getRootNode() as ShadowRoot).host ?? null)) {
    if (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('hidden')) return false;
    const style = win?.getComputedStyle(n);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }
  return !opts.layout || el.getClientRects().length > 0;
}

function byId(root: Document | ShadowRoot, id: string): Element | null {
  return root.getElementById?.(id) ?? root.querySelector(`[id="${id.replace(/["\\]/g, '\\$&')}"]`);
}

function labelFor(el: Element, root: Document | ShadowRoot): string {
  // A radio's own <label> is its option text; the question is the group's legend or label.
  if (el instanceof el.ownerDocument.defaultView!.HTMLInputElement && el.type === 'radio') {
    const legend = el.closest('fieldset')?.querySelector('legend');
    if (legend && ownText(legend)) return ownText(legend);
    const group = el.closest('[role="radiogroup"], [role="group"]');
    const groupLabel = group?.getAttribute('aria-labelledby');
    if (groupLabel) {
      const text = clean(byId(root, groupLabel)?.textContent);
      if (text) return text;
    }
    const aria = clean(group?.getAttribute('aria-label'));
    if (aria) return aria;
    const container = el.closest('label')?.parentElement ?? el.parentElement;
    if (container) {
      for (let sib = container.previousElementSibling; sib; sib = sib.previousElementSibling) {
        const text = ownText(sib);
        if (text) return text.length <= MAX_LABEL ? text : '';
      }
    }
    return humanize(el.getAttribute('name') ?? '');
  }

  const id = el.getAttribute('id');
  if (id) {
    const lbl = root.querySelector(`label[for="${id.replace(/["\\]/g, '\\$&')}"]`);
    if (lbl && ownText(lbl)) return ownText(lbl);
  }
  const wrapping = el.closest('label');
  if (wrapping && ownText(wrapping)) return ownText(wrapping);

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = clean(
      labelledBy
        .split(/\s+/)
        .map((ref) => byId(root, ref)?.textContent ?? '')
        .join(' '),
    );
    if (text) return text;
  }
  const aria = clean(el.getAttribute('aria-label'));
  if (aria) return aria;

  // Nearest text before the field: previous siblings, then the parent's previous siblings.
  let node: Element | null = el;
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      const text = ownText(sib);
      if (text) return text.length <= MAX_LABEL ? text : '';
    }
  }

  const placeholder = clean(el.getAttribute('placeholder'));
  if (placeholder) return placeholder;
  return humanize(el.getAttribute('name') || id || '');
}

function optionLabel(radio: HTMLInputElement, root: Document | ShadowRoot): string {
  const id = radio.id;
  const forLabel = id ? root.querySelector(`label[for="${id.replace(/["\\]/g, '\\$&')}"]`) : null;
  return clean(forLabel?.textContent) || clean(radio.closest('label')?.textContent) || clean(radio.getAttribute('aria-label')) || radio.value;
}

function* walk(root: Document | ShadowRoot): Generator<[Element, Document | ShadowRoot]> {
  for (const el of root.querySelectorAll('*')) {
    yield [el, root];
    if (el.shadowRoot) yield* walk(el.shadowRoot);
  }
}

let counter = 0;

function assignId(el: Element): string {
  const existing = el.getAttribute('data-ija-id');
  if (existing) return existing;
  const id = `f${++counter}`;
  el.setAttribute('data-ija-id', id);
  return id;
}

/** Finds fillable fields in the document and its open shadow roots, and tags them with `data-ija-id`. */
export function detectFields(doc: Document, registry: Registry, opts: DetectOptions): FrameFields {
  registry.clear();
  const win = doc.defaultView!;
  const fields: FieldDescriptor[] = [];
  const radioGroups = new Map<string, FieldDescriptor>();

  for (const [el, root] of walk(doc)) {
    let kind: FieldKind | null = null;
    if (el instanceof win.HTMLInputElement) {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (SKIP_INPUT_TYPES.has(type)) continue;
      kind = KIND_BY_TYPE[type] ?? 'text';
    } else if (el instanceof win.HTMLTextAreaElement) kind = 'textarea';
    else if (el instanceof win.HTMLSelectElement) {
      if (el.multiple) continue;
      kind = 'select';
    } else if ((el as HTMLElement).isContentEditable || el.getAttribute('contenteditable') === 'true') kind = 'contenteditable';
    if (!kind || (el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly || !isVisible(el, opts)) continue;

    const input = el as HTMLInputElement;
    if (kind === 'radio') {
      const groupKey = `${root === doc ? '' : 'shadow:'}${input.form?.id ?? ''}|${input.name || assignId(el)}`;
      let group = radioGroups.get(groupKey);
      if (!group) {
        const id = assignId(el);
        group = {
          id,
          kind,
          label: labelFor(el, root),
          name: input.name,
          idAttr: input.id,
          autocomplete: '',
          placeholder: '',
          required: input.required,
          options: [],
          currentValue: '',
        };
        radioGroups.set(groupKey, group);
        registry.set(id, []);
        fields.push(group);
      } else {
        el.setAttribute('data-ija-id', group.id);
      }
      const opt: FieldOption = { value: input.value || `__${group.options!.length}`, label: optionLabel(input, root) };
      group.options!.push(opt);
      if (input.checked) group.currentValue = opt.value;
      group.required ||= input.required;
      registry.get(group.id)!.push(el);
      continue;
    }

    const id = assignId(el);
    registry.set(id, [el]);
    const field: FieldDescriptor = {
      id,
      kind,
      label: labelFor(el, root),
      name: el.getAttribute('name') ?? '',
      idAttr: el.getAttribute('id') ?? '',
      autocomplete: (el.getAttribute('autocomplete') ?? '').toLowerCase(),
      placeholder: el.getAttribute('placeholder') ?? '',
      required: input.required || el.getAttribute('aria-required') === 'true',
      currentValue: '',
    };

    if (kind === 'select') {
      const sel = el as HTMLSelectElement;
      field.options = [...sel.options].map((o) => ({ value: o.value, label: clean(o.textContent) }));
      field.currentValue = sel.selectedIndex > 0 || sel.value ? sel.value : '';
    } else if (kind === 'file') {
      field.accept = input.accept;
      field.currentValue = input.files?.[0]?.name ?? '';
    } else if (kind === 'checkbox') {
      field.currentValue = input.checked ? 'true' : '';
    } else if (kind === 'contenteditable') {
      field.currentValue = clean(el.textContent);
    } else {
      field.currentValue = input.value ?? '';
      if (input.maxLength > 0) field.maxLength = input.maxLength;
    }
    fields.push(field);
  }

  return { frameUrl: win.location.href, fields };
}
