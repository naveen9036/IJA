export const MAX_CANDIDATE_CHARS = 15_000;

const JOB_KEYWORDS = [
  /responsibilit/i,
  /requirement/i,
  /qualification/i,
  /experience/i,
  /skills/i,
  /what you('|’)ll do/i,
  /about (the|this) (role|position|job)/i,
  /you will/i,
  /we('|’)re looking for|we are looking for/i,
  /benefits/i,
  /apply/i,
  /years of/i,
];

/** Number of distinct job-posting phrases in the text. */
export function jobKeywordHits(text: string): number {
  return JOB_KEYWORDS.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
}

export function cleanText(text: string, max = MAX_CANDIDATE_CHARS): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** innerText keeps visual line breaks; falls back to textContent where layout is unavailable. */
export function elementText(el: Element): string {
  const inner = (el as HTMLElement).innerText;
  return cleanText(typeof inner === 'string' && inner.trim() ? inner : blockText(el));
}

/** textContent with line breaks at block boundaries, for HTML strings and DOMs without layout. */
export function blockText(el: Element | DocumentFragment): string {
  const clone = el.cloneNode(true) as Element | DocumentFragment;
  clone.querySelectorAll('script, style, noscript, template, svg').forEach((n) => n.remove());
  clone.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  clone.querySelectorAll('li').forEach((n) => n.prepend('- '));
  clone
    .querySelectorAll('p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, section, article, tr')
    .forEach((n) => n.append('\n'));
  return cleanText(clone.textContent ?? '');
}

export function htmlToText(html: string, doc: Document): string {
  // Template content is inert: scripts never run and images never load.
  const tpl = doc.createElement('template');
  tpl.innerHTML = html;
  if (!/<[a-z]/i.test(html) && /&lt;[a-z]/i.test(html)) tpl.innerHTML = tpl.content.textContent ?? '';
  return blockText(tpl.content);
}

export function firstText(root: ParentNode, selectors: string[]): string {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    const text = el?.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}
