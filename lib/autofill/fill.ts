import type { Registry } from './detect';
import type { CollectedValue, FillItem, FillPlan, FillResult } from './types';

const GREEN = '#16a34a';
const AMBER = '#f59e0b';

function highlight(el: Element, status: 'filled' | 'review') {
  const h = el as HTMLElement;
  h.style.outline = `2px solid ${status === 'filled' ? GREEN : AMBER}`;
  h.style.outlineOffset = '1px';
  h.setAttribute('data-ija-status', status);
  h.addEventListener(
    'input',
    (e) => {
      if (!e.isTrusted) return;
      h.style.outline = '';
      h.style.outlineOffset = '';
      h.removeAttribute('data-ija-status');
    },
    { once: true },
  );
}

/** Sets value through the prototype setter so frameworks that track `.value` (React) see the change. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function fire(el: Element, ...types: string[]) {
  const win = el.ownerDocument.defaultView!;
  for (const type of types) {
    el.dispatchEvent(type === 'blur' ? new win.FocusEvent('blur') : new win.Event(type, { bubbles: true }));
  }
}

function accepts(accept: string, name: string, type: string): boolean {
  if (!accept.trim()) return true;
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  return accept
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .some((a) => a === ext || a === type || (a.endsWith('/*') && type.startsWith(a.slice(0, -1))));
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fillOne(els: Element[], item: FillItem, overwrite: boolean): FillResult {
  const id = item.id;
  const el = els[0];
  if (!el) return { id, status: 'failed', reason: 'field no longer on the page' };
  const win = el.ownerDocument.defaultView!;

  if (item.review) {
    els.forEach((e) => highlight(e, 'review'));
    return { id, status: 'marked' };
  }

  if (el instanceof win.HTMLInputElement && el.type === 'radio') {
    const radios = els as HTMLInputElement[];
    if (!overwrite && radios.some((r) => r.checked)) return { id, status: 'skipped', reason: 'already answered' };
    const target = radios.find((r, i) => (r.value || `__${i}`) === item.optionValue);
    if (!target) return { id, status: 'failed', reason: 'option not found' };
    if (!target.checked) target.click();
    radios.forEach((r) => highlight(r, 'filled'));
    return { id, status: 'filled' };
  }

  if (el instanceof win.HTMLInputElement && el.type === 'checkbox') {
    if (item.checked === undefined) return { id, status: 'skipped', reason: 'no answer' };
    if (el.checked !== item.checked) el.click();
    highlight(el, 'filled');
    return { id, status: 'filled' };
  }

  if (el instanceof win.HTMLInputElement && el.type === 'file') {
    const f = item.file;
    if (!f) return { id, status: 'skipped', reason: 'no file' };
    if (!overwrite && el.files?.length) return { id, status: 'skipped', reason: 'already has a file' };
    if (!accepts(el.accept, f.name, f.type)) return { id, status: 'skipped', reason: 'file type not accepted' };
    if (typeof win.DataTransfer !== 'function') return { id, status: 'failed', reason: 'file upload not supported here' };
    const dt = new win.DataTransfer();
    dt.items.add(new win.File([decodeBase64(f.base64) as BlobPart], f.name, { type: f.type }));
    el.files = dt.files;
    fire(el, 'input', 'change');
    highlight(el, 'filled');
    return { id, status: 'filled' };
  }

  if (el instanceof win.HTMLSelectElement) {
    if (item.optionValue === undefined) return { id, status: 'skipped', reason: 'no matching option' };
    if (!overwrite && el.selectedIndex > 0 && el.value) return { id, status: 'skipped', reason: 'already selected' };
    setNativeValue(el, item.optionValue);
    fire(el, 'input', 'change', 'blur');
    highlight(el, 'filled');
    return { id, status: el.value === item.optionValue ? 'filled' : 'failed' };
  }

  const value = item.value ?? '';
  if (!value) return { id, status: 'skipped', reason: 'no value' };

  if (el instanceof win.HTMLInputElement || el instanceof win.HTMLTextAreaElement) {
    if (!overwrite && el.value.trim() && el.value !== value) return { id, status: 'skipped', reason: 'already filled' };
    el.focus();
    setNativeValue(el, el.maxLength > 0 ? value.slice(0, el.maxLength) : value);
    fire(el, 'input', 'change', 'blur');
    highlight(el, 'filled');
    return { id, status: 'filled' };
  }

  const h = el as HTMLElement;
  if (!overwrite && h.textContent?.trim()) return { id, status: 'skipped', reason: 'already filled' };
  h.focus();
  const inserted = typeof el.ownerDocument.execCommand === 'function' && el.ownerDocument.execCommand('insertText', false, value);
  if (!inserted) {
    h.textContent = value;
    fire(h, 'input');
  }
  highlight(h, 'filled');
  return { id, status: 'filled' };
}

/** Fills planned values. Never submits forms or clicks buttons. */
export function fillFields(registry: Registry, plan: FillPlan): FillResult[] {
  return plan.items.map((item) => {
    try {
      return fillOne(registry.get(item.id) ?? [], item, !!plan.overwrite);
    } catch (e) {
      return { id: item.id, status: 'failed' as const, reason: (e as Error).message };
    }
  });
}

/** Current values, with option labels for selects and radios so saved answers read naturally. */
export function collectValues(registry: Registry, ids: string[]): CollectedValue[] {
  const out: CollectedValue[] = [];
  for (const id of ids) {
    const els = registry.get(id) ?? [];
    const el = els[0];
    if (!el) continue;
    const win = el.ownerDocument.defaultView!;
    let value = '';
    if (el instanceof win.HTMLInputElement && el.type === 'radio') {
      const checked = (els as HTMLInputElement[]).find((r) => r.checked);
      const lbl = checked?.closest('label')?.textContent ?? (checked?.id ? el.ownerDocument.querySelector(`label[for="${checked.id}"]`)?.textContent : null);
      value = (lbl ?? checked?.value ?? '').trim();
    } else if (el instanceof win.HTMLInputElement && el.type === 'checkbox') {
      value = el.checked ? 'Yes' : 'No';
    } else if (el instanceof win.HTMLSelectElement) {
      value = el.selectedIndex > 0 || el.value ? (el.options[el.selectedIndex]?.textContent ?? '').trim() : '';
    } else if (el instanceof win.HTMLInputElement || el instanceof win.HTMLTextAreaElement) {
      value = el.type === 'file' ? '' : el.value.trim();
    } else {
      value = (el.textContent ?? '').trim();
    }
    if (value) out.push({ id, value });
  }
  return out;
}
