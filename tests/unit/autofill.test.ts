import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { buildAnswerPrompt } from '@/lib/autofill/answer';
import { chooseOption, mapField, type AutofillContext } from '@/lib/autofill/map';
import { createPageApi } from '@/lib/autofill/page';
import { findSaved, qaKey, type QaEntry } from '@/lib/autofill/qa';
import type { FieldDescriptor } from '@/lib/autofill/types';
import { emptyApplicationInfo, ProfileDataSchema } from '@/lib/profile/schema';

const html = readFileSync(new URL('../fixtures/forms/basic.html', import.meta.url), 'utf8');

function basic() {
  const dom = new JSDOM(html, { url: 'https://boards.ats.example/forms/basic.html' });
  const api = createPageApi(dom.window.document, { layout: false });
  return { dom, doc: dom.window.document, api, fields: api.detect().fields };
}

const byLabel = (fields: FieldDescriptor[], label: string) => {
  const f = fields.find((x) => x.label === label);
  if (!f) throw new Error(`No field "${label}" in ${JSON.stringify(fields.map((x) => x.label))}`);
  return f;
};

const ctx = (over: Partial<AutofillContext> = {}): AutofillContext => ({
  profile: ProfileDataSchema.parse({
    contact: {
      name: 'Sam Lee',
      email: 'sam@example.com',
      phone: '+49 30 1234567',
      location: 'Berlin, Germany',
      links: ['https://www.linkedin.com/in/samlee', 'https://samlee.dev'],
    },
    experience: [{ company: 'Fabrikam', title: 'ML Engineer', start: '2020-01', end: 'Present', bullets: [] }],
  }),
  info: { ...emptyApplicationInfo(), requiresSponsorship: 'No', workAuthorization: 'EU citizen' },
  hasResumeFile: true,
  hasCoverLetter: false,
  coverLetterText: '',
  qa: [],
  ...over,
});

describe('detectFields', () => {
  it('finds visible fields and resolves labels with each strategy', () => {
    const { fields } = basic();
    expect(fields.map((f) => f.label)).toEqual([
      'First Name',
      'Last Name',
      'Email address',
      'Phone',
      'LinkedIn Profile',
      'Website',
      'Resume/CV',
      'Country',
      'Are you legally authorized to work in Germany?',
      'Will you now or in the future require visa sponsorship?',
      'Why do you want to work at Proseware?',
      'Gender',
    ]);
    const radio = byLabel(fields, 'Are you legally authorized to work in Germany?');
    expect(radio.kind).toBe('radio');
    expect(radio.options).toEqual([
      { value: '1', label: 'Yes' },
      { value: '0', label: 'No' },
    ]);
    expect(byLabel(fields, 'Resume/CV')).toMatchObject({ kind: 'file', accept: '.pdf,.doc,.docx' });
    expect(byLabel(fields, 'First Name').required).toBe(true);
  });

  it('uses humanized names when nothing else labels a field', () => {
    const dom = new JSDOM('<form><input name="job_application[middle_name]"></form>', { url: 'https://x.example' });
    const { fields } = createPageApi(dom.window.document, { layout: false }).detect();
    expect(fields[0]!.label).toBe('middle name');
  });

  it('finds fields inside open shadow roots', () => {
    const dom = new JSDOM('<form><div id="host"></div></form>', { url: 'https://x.example' });
    const root = dom.window.document.getElementById('host')!.attachShadow({ mode: 'open' });
    root.innerHTML = '<label for="c">City</label><input id="c" name="city">';
    const { fields } = createPageApi(dom.window.document, { layout: false }).detect();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.label).toBe('City');
  });
});

describe('mapField', () => {
  it('maps profile fields and options', () => {
    const { fields } = basic();
    const m = (label: string) => mapField(byLabel(fields, label), ctx());
    expect(m('First Name').value).toBe('Sam');
    expect(m('Last Name').value).toBe('Lee');
    expect(m('Email address').value).toBe('sam@example.com');
    expect(m('Phone').value).toBe('+49 30 1234567');
    expect(m('LinkedIn Profile').value).toBe('https://www.linkedin.com/in/samlee');
    expect(m('Website').value).toBe('https://samlee.dev');
    expect(m('Resume/CV').file).toBe('resume');
    expect(m('Country').optionValue).toBe('DE');
    expect(m('Will you now or in the future require visa sponsorship?').optionValue).toBe('n');
  });

  it('sends questions it cannot answer to the LLM', () => {
    const { fields } = basic();
    const auth = mapField(byLabel(fields, 'Are you legally authorized to work in Germany?'), ctx());
    expect(auth.key).toBe('workAuthorization');
    expect(auth.optionValue).toBeUndefined();
    expect(auth.askLlm).toBe(true);
    expect(mapField(byLabel(fields, 'Why do you want to work at Proseware?'), ctx()).askLlm).toBe(true);
  });

  it('skips sensitive fields unless the user saved an answer', () => {
    const gender = byLabel(basic().fields, 'Gender');
    const skipped = mapField(gender, ctx());
    expect(skipped.sensitive).toBe(true);
    expect(skipped.askLlm).toBeFalsy();
    expect(skipped.optionValue).toBeUndefined();
    const qa: QaEntry[] = [{ key: qaKey('Gender'), question: 'Gender', answer: 'Decline to self-identify', updatedAt: 0 }];
    expect(mapField(gender, ctx({ qa })).optionValue).toBe('x');
  });

  it('does not treat a two-letter region as a country', () => {
    const { fields } = basic();
    const c = ctx();
    c.profile.contact.location = 'Austin, TX';
    expect(mapField(byLabel(fields, 'Country'), c).source).toBe('none');
  });
});

describe('chooseOption', () => {
  const opts = (...labels: string[]) => [{ value: '', label: 'Select...' }, ...labels.map((l, i) => ({ value: `v${i}`, label: l }))];
  it('handles yes/no, exact, partial, and no match', () => {
    expect(chooseOption('No', opts('Yes', 'No'))).toBe('v1');
    expect(chooseOption('yes, I am', opts('Yes', 'No'))).toBe('v0');
    expect(chooseOption('Germany', opts('France', 'Germany'))).toBe('v1');
    expect(chooseOption('United States', opts('United States of America', 'United Kingdom'))).toBe('v0');
    expect(chooseOption('Bachelor’s degree', opts("Bachelor's Degree (BA/BS)", "Master's Degree"))).toBe('v0');
    expect(chooseOption('Antarctica', opts('France', 'Germany'))).toBeNull();
    expect(chooseOption('Select', opts('France'))).toBeNull();
  });
});

describe('saved answers', () => {
  const entries: QaEntry[] = [
    { key: qaKey('How did you hear about us?'), question: 'How did you hear about us?', answer: 'LinkedIn', updatedAt: 0 },
  ];
  it('matches exactly and by similar wording', () => {
    expect(findSaved('How did you hear about us', entries)?.answer).toBe('LinkedIn');
    expect(findSaved('How did you hear about us? *', entries)?.answer).toBe('LinkedIn');
    expect(findSaved('How did you first hear about us?', entries)?.answer).toBe('LinkedIn');
    expect(findSaved('Why do you want to work here?', entries)).toBeUndefined();
  });
});

describe('fill', () => {
  it('fills values with events, never submits, and keeps existing values', () => {
    const { doc, api, fields, dom } = basic();
    let submitted = false;
    doc.getElementById('app')!.addEventListener('submit', () => (submitted = true));
    const events: string[] = [];
    doc.getElementById('first_name')!.addEventListener('input', () => events.push('input'));
    doc.getElementById('first_name')!.addEventListener('change', () => events.push('change'));
    (doc.querySelector('[name="email"]') as HTMLInputElement).value = 'mine@example.com';

    const id = (label: string) => byLabel(fields, label).id;
    const results = api.fill({
      items: [
        { id: id('First Name'), value: 'Sam' },
        { id: id('Email address'), value: 'sam@example.com' },
        { id: id('Country'), optionValue: 'DE' },
        { id: id('Are you legally authorized to work in Germany?'), optionValue: '1' },
        { id: id('Gender'), review: true },
      ],
    });

    expect(results.map((r) => r.status)).toEqual(['filled', 'skipped', 'filled', 'filled', 'marked']);
    expect((doc.getElementById('first_name') as HTMLInputElement).value).toBe('Sam');
    expect(events).toEqual(['input', 'change']);
    expect((doc.querySelector('[name="email"]') as HTMLInputElement).value).toBe('mine@example.com');
    expect((doc.getElementById('country') as HTMLSelectElement).value).toBe('DE');
    expect((doc.querySelector('input[name="auth"][value="1"]') as HTMLInputElement).checked).toBe(true);
    expect(doc.getElementById('gender')!.getAttribute('data-ija-status')).toBe('review');
    expect((doc.getElementById('gender') as HTMLSelectElement).value).toBe('');
    expect(submitted).toBe(false);
    dom.window.close();
  });

  it('collects answers with option labels', () => {
    const { doc, api, fields } = basic();
    (doc.getElementById('why') as HTMLTextAreaElement).value = 'Because of NLP.';
    (doc.querySelector('input[name="auth"][value="0"]') as HTMLInputElement).checked = true;
    const ids = ['Why do you want to work at Proseware?', 'Are you legally authorized to work in Germany?', 'Country'].map(
      (l) => byLabel(fields, l).id,
    );
    expect(api.collect(ids).map((v) => v.value)).toEqual(['Because of NLP.', 'No']);
  });
});

describe('buildAnswerPrompt', () => {
  it('lists questions with options and marks labels untrusted', () => {
    const { fields } = basic();
    const p = buildAnswerPrompt([byLabel(fields, 'Will you now or in the future require visa sponsorship?')], ctx().profile, ctx().info, null, []);
    expect(p.system).toMatch(/untrusted/);
    expect(p.system).toMatch(/Never answer questions about gender/);
    expect(p.user).toContain('"options":["--","Yes","No"]');
  });
});
