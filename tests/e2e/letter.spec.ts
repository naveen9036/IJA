import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { ANALYSIS, fixture, mockGemini, openPanelFor, uploadProfile } from './helpers';

const PROFILE = {
  contact: { name: 'Sam Lee', email: 'sam@example.com', location: 'Berlin, Germany' },
  headline: 'Machine Learning Engineer',
  skills: ['Python', 'PyTorch', 'Docker'],
  experience: [
    {
      title: 'ML Engineer',
      company: 'Fabrikam',
      start: '2020-01',
      end: 'Present',
      bullets: ['Trained NLP models used by 3 teams', 'Cut inference latency by 30%'],
    },
  ],
};

const filler = 'I enjoy building reliable machine learning systems with a focus on quality and measurable impact. '.repeat(4);

const LETTER = {
  salutation: 'Dear Hiring Manager,',
  paragraphs: [
    `I am excited to apply to [Company] as a Machine Learning Engineer. ${filler}`,
    `At Fabrikam I trained NLP models used by 3 teams and cut inference latency by 30% with PyTorch. ${filler}`,
    `I would welcome the chance to discuss how I can help. ${filler}`,
  ],
  closing: 'Sincerely,',
};

test('generates, checks, edits, copies, and downloads a cover letter', async ({ context, extensionId }) => {
  await context.route('https://careers.proseware.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('generic.html') }),
  );
  const prompts = await mockGemini(context, { job: ANALYSIS, resume: PROFILE, letter: LETTER });

  const jobPage = await context.newPage();
  await jobPage.goto('https://careers.proseware.example/jobs/ml');
  const panel = await openPanelFor(context, extensionId, 'https://careers.proseware.example/*');
  // Playwright can't grant clipboard permissions to extension origins, so record what the app writes.
  await panel.addInitScript(() => {
    const w = window as unknown as { __copied: string };
    navigator.clipboard.writeText = async (t: string) => {
      w.__copied = t;
    };
  });

  await uploadProfile(panel);
  await panel.getByRole('button', { name: 'Job', exact: true }).click();
  await panel.getByRole('button', { name: 'Analyze this page' }).click();
  await expect(panel.getByTestId('match-score')).toBeVisible();

  await panel.getByRole('button', { name: 'Letter', exact: true }).click();
  await panel.getByLabel('Tone').selectOption('warm');
  await panel.getByLabel(/Anything to mention/).fill('Referred by Alex Kim');
  await panel.getByRole('button', { name: 'Generate cover letter' }).click();

  const review = panel.getByRole('region', { name: 'Review warnings' });
  await expect(review).toContainText('placeholder "[Company]" needs replacing');
  await expect(review).toContainText('the company name "Proseware" is not mentioned');
  const letterPrompt = prompts.find((p) => p.includes('cover letter'))!;
  expect(letterPrompt).toContain('Referred by Alex Kim');
  expect(letterPrompt).toContain('warm and personable');

  const p1 = panel.getByLabel('Paragraph 1');
  await p1.fill((await p1.inputValue()).replace('[Company]', 'Proseware'));
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel.getByText('Changes saved.')).toBeVisible();

  await panel.reload();
  await panel.getByRole('button', { name: 'Letter', exact: true }).click();
  await expect(panel.getByLabel('Paragraph 1')).toHaveValue(/apply to Proseware as/);
  await expect(panel.getByLabel('Tone')).toHaveValue('warm');

  await panel.getByRole('button', { name: 'Copy text' }).click();
  await expect(panel.getByText('Copied to clipboard.')).toBeVisible();
  const copied = await panel.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied.startsWith('Dear Hiring Manager,\n\nI am excited to apply to Proseware')).toBe(true);
  expect(copied.endsWith('Sincerely,\nSam Lee')).toBe(true);

  const [pdf] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Download PDF' }).click()]);
  expect(pdf.suggestedFilename()).toBe('Sam_Lee_Proseware_Machine_Learning_Engineer_Cover_Letter.pdf');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync((await pdf.path())!)) });
  const content = await (await (await task.promise).getPage(1)).getTextContent();
  await task.destroy();
  const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  expect(text).toContain('Sam Lee');
  expect(text).toContain('Dear Hiring Manager,');
  expect(text).not.toContain('[Company]');

  const [docx] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Download DOCX' }).click()]);
  expect(docx.suggestedFilename()).toBe('Sam_Lee_Proseware_Machine_Learning_Engineer_Cover_Letter.docx');
  expect(readFileSync((await docx.path())!).subarray(0, 2).toString()).toBe('PK');
});
