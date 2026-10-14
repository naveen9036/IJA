import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { ANALYSIS, fixture, mockGemini, openPanelFor, uploadProfile } from './helpers';

const PROFILE = {
  contact: { name: 'Sam Lee', email: 'sam@example.com', location: 'Berlin, Germany' },
  headline: 'Machine Learning Engineer',
  summary: 'ML engineer.',
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

const TAILORED = {
  resume: {
    ...PROFILE,
    summary: 'Machine learning engineer focused on NLP with PyTorch.',
    skills: ['PyTorch', 'Python', 'Kafka'],
    experience: [
      {
        ...PROFILE.experience[0],
        bullets: ['Trained NLP models with PyTorch used by 3 teams', 'Cut inference latency by 75%'],
      },
    ],
  },
  notes: ['Moved PyTorch to the front of skills'],
};

async function pdfText(path: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)) });
  const doc = await task.promise;
  const content = await (await doc.getPage(1)).getTextContent();
  await task.destroy();
  return content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
}

test('generates, checks, edits, and downloads a tailored resume', async ({ context, extensionId }) => {
  await context.route('https://careers.proseware.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('generic.html') }),
  );
  const prompts = await mockGemini(context, { job: ANALYSIS, resume: PROFILE, tailor: TAILORED });

  const jobPage = await context.newPage();
  await jobPage.goto('https://careers.proseware.example/jobs/ml');
  const panel = await openPanelFor(context, extensionId, 'https://careers.proseware.example/*');

  await uploadProfile(panel);
  await panel.getByRole('button', { name: 'Job', exact: true }).click();
  await panel.getByRole('button', { name: 'Analyze this page' }).click();
  await expect(panel.getByTestId('match-score')).toBeVisible();

  await panel.getByRole('button', { name: 'Resume', exact: true }).click();
  await panel.getByRole('button', { name: 'Generate tailored resume' }).click();

  const review = panel.getByRole('region', { name: 'Review warnings' });
  await expect(review).toContainText('Removed: Skill "Kafka" is not in your profile');
  await expect(review).toContainText('number "75" is not in your profile');
  expect(prompts.find((p) => p.includes('You tailor a resume'))).toContain('Strong Python and PyTorch skills');

  await panel.getByText('ML Engineer @ Fabrikam').click();
  await panel.getByText('Show original').click();
  await expect(panel.getByText('Cut inference latency by 30%')).toBeVisible();
  await panel
    .getByLabel('Achievements (one per line)')
    .fill('Trained NLP models with PyTorch used by 3 teams\nCut inference latency by 30%');
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel.getByText('Changes saved.')).toBeVisible();

  const [docx] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Download DOCX' }).click()]);
  expect(docx.suggestedFilename()).toBe('Sam_Lee_Proseware_Machine_Learning_Engineer.docx');

  const [pdf] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Download PDF' }).click()]);
  expect(pdf.suggestedFilename()).toBe('Sam_Lee_Proseware_Machine_Learning_Engineer.pdf');
  const text = await pdfText((await pdf.path())!);
  expect(text).toContain('Sam Lee');
  expect(text).toContain('Cut inference latency by 30%');
  expect(text).not.toContain('Kafka');

  await panel.reload();
  await panel.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Regenerate' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'All changes saved' })).toBeVisible();
});
