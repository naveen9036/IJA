import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { fixture, mockGemini, openPanelFor, uploadProfile } from './helpers';

const PROFILE = {
  contact: {
    name: 'Sam Lee',
    email: 'sam@example.com',
    phone: '+49 30 1234567',
    location: 'Berlin, Germany',
    links: ['https://www.linkedin.com/in/samlee', 'https://samlee.dev'],
  },
  headline: 'Machine Learning Engineer',
  skills: ['Python', 'PyTorch'],
  experience: [{ title: 'ML Engineer', company: 'Fabrikam', start: '2020-01', end: 'Present', bullets: ['Trained NLP models'] }],
};

/** Answers by question text; anything else is null. */
function answers(promptText: string) {
  const questions = JSON.parse(promptText.slice(promptText.indexOf('Questions (JSON):') + 'Questions (JSON):'.length)) as {
    id: string;
    question: string;
  }[];
  const known: Record<string, string> = {
    'Are you legally authorized to work in Germany?': 'Yes',
    'Why do you want to work at Proseware?': 'I want to build NLP products that help insurers.',
  };
  return { answers: questions.map((q) => ({ id: q.id, value: known[q.question] ?? null })) };
}

async function setApplicationAnswers(panel: Page) {
  await panel.getByLabel('Requires visa sponsorship?').selectOption('No');
  await panel.getByLabel(/Work authorization/).fill('EU citizen');
  await panel.getByRole('button', { name: 'Save profile' }).click();
  await expect(panel.getByText('Profile saved.')).toBeVisible();
}

test('autofills a form, skips sensitive fields, never submits, and reuses saved answers', async ({ context, extensionId }) => {
  await context.route('https://jobs.proseware.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('forms/basic.html') }),
  );
  const prompts = await mockGemini(context, { resume: PROFILE, answers });

  const printer = await context.newPage();
  await printer.setContent(`<h1>Sam Lee</h1><p>${'Machine learning engineer with NLP experience. '.repeat(5)}</p>`);
  const pdf = await printer.pdf();
  await printer.close();

  const form = await context.newPage();
  await form.goto('https://jobs.proseware.example/apply');
  const panel = await openPanelFor(context, extensionId, 'https://jobs.proseware.example/*');
  await uploadProfile(panel, { name: 'Sam_Lee.pdf', mimeType: 'application/pdf', buffer: pdf });
  await setApplicationAnswers(panel);

  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await panel.getByRole('button', { name: 'Autofill this page' }).click();
  await expect(panel.getByTestId('autofill-counts')).toBeVisible();

  const value = (sel: string) => form.locator(sel).inputValue();
  expect(await value('#first_name')).toBe('Sam');
  expect(await value('[name="job_application[last_name]"]')).toBe('Lee');
  expect(await value('[name="email"]')).toBe('sam@example.com');
  expect(await value('[name="phone"]')).toBe('+49 30 1234567');
  expect(await value('#li')).toBe('https://www.linkedin.com/in/samlee');
  expect(await value('#site')).toBe('https://samlee.dev');
  expect(await value('#country')).toBe('DE');
  expect(await value('#sponsor')).toBe('n');
  expect(await form.locator('input[name="auth"][value="1"]').isChecked()).toBe(true);
  expect(await value('#why')).toBe('I want to build NLP products that help insurers.');
  expect(await value('#gender')).toBe('');
  expect(await form.evaluate(() => (document.getElementById('resume') as HTMLInputElement).files?.[0]?.name)).toBe('Sam_Lee.pdf');
  expect(await form.evaluate(() => (window as unknown as { __submitted?: boolean }).__submitted)).toBeFalsy();
  expect(await form.locator('#first_name').getAttribute('data-ija-status')).toBe('filled');
  expect(await form.locator('#gender').getAttribute('data-ija-status')).toBe('review');
  await panel.getByText(/^Skipped \(\d+\)$/).click();
  await expect(panel.getByText('personal question; answer it yourself or save an answer')).toBeVisible();

  const answerPrompts = () => prompts.filter((p) => p.includes('answer job application form questions')).length;
  expect(answerPrompts()).toBe(1);

  await form.locator('#why').fill('Proseware applies NLP to real insurance problems.');
  await panel.getByRole('button', { name: 'Save my answers for next time' }).click();
  await expect(panel.getByText(/Saved \d+ answers? for next time/)).toBeVisible();

  await form.reload();
  await panel.getByRole('button', { name: 'Fill again' }).click();
  await expect(panel.getByRole('button', { name: 'Fill again' })).toBeEnabled();
  await expect(form.locator('#why')).toHaveValue('Proseware applies NLP to real insurance problems.');
  expect(await form.locator('input[name="auth"][value="1"]').isChecked()).toBe(true);
  expect(answerPrompts()).toBe(1);
  expect(await form.evaluate(() => (window as unknown as { __submitted?: boolean }).__submitted)).toBeFalsy();
});

test('fills fields in cross-origin iframes, shadow DOM, and controlled inputs', async ({ context, extensionId }) => {
  await context.route('https://careers.proseware.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('forms/iframe-host.html') }),
  );
  await context.route('https://boards.ats.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('forms/basic.html') }),
  );
  await context.route('https://forms.example/react', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('forms/react-like.html') }),
  );
  await context.route('https://forms.example/shadow', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('forms/shadow.html') }),
  );
  await mockGemini(context, { resume: PROFILE, answers: { answers: [] } });

  const host = await context.newPage();
  await host.goto('https://careers.proseware.example/apply');
  await host.frameLocator('#ats').locator('#first_name').waitFor();
  let panel = await openPanelFor(context, extensionId, 'https://careers.proseware.example/*');
  await uploadProfile(panel);
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await panel.getByRole('button', { name: 'Autofill this page' }).click();
  await expect(panel.getByTestId('autofill-counts')).toBeVisible();
  const frame = host.frameLocator('#ats');
  await expect(frame.locator('#first_name')).toHaveValue('Sam');
  await expect(frame.locator('[name="email"]')).toHaveValue('sam@example.com');
  await expect(frame.locator('#country')).toHaveValue('DE');

  const react = await context.newPage();
  await react.goto('https://forms.example/react');
  panel = await openPanelFor(context, extensionId, 'https://forms.example/react');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await panel.getByRole('button', { name: 'Autofill this page' }).click();
  await expect(panel.getByTestId('autofill-counts')).toBeVisible();
  await expect(react.locator('#rf-first')).toHaveValue('Sam');
  await expect(react.locator('#rf-email')).toHaveValue('sam@example.com');
  expect(await react.evaluate(() => (window as unknown as { __state: Record<string, string> }).__state)).toEqual({
    firstName: 'Sam',
    email: 'sam@example.com',
  });

  const shadow = await context.newPage();
  await shadow.goto('https://forms.example/shadow');
  panel = await openPanelFor(context, extensionId, 'https://forms.example/shadow');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await panel.getByRole('button', { name: 'Autofill this page' }).click();
  await expect(panel.getByTestId('autofill-counts')).toBeVisible();
  await expect(shadow.locator('apply-fields #s-name')).toHaveValue('Sam Lee');
  await expect(shadow.locator('apply-fields #s-city')).toHaveValue('Berlin');
  for (const p of [host, react, shadow]) {
    expect(await p.evaluate(() => (window as unknown as { __submitted?: boolean }).__submitted)).toBeFalsy();
  }
});
