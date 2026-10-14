import { expect, test } from './fixtures';
import { ANALYSIS, fixture, mockGemini, openPanelFor } from './helpers';

test('analyzes a job page on an unknown site and caches the result', async ({ context, extensionId }) => {
  await context.route('https://careers.proseware.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('generic.html') }),
  );
  const prompts = await mockGemini(context, { job: ANALYSIS });

  const jobPage = await context.newPage();
  await jobPage.goto('https://careers.proseware.example/jobs/ml?utm_source=test');
  const panel = await openPanelFor(context, extensionId, 'https://careers.proseware.example/*');

  await panel.getByRole('button', { name: 'Analyze this page' }).click();
  await expect(panel.getByRole('heading', { name: 'Machine Learning Engineer' })).toBeVisible();
  await expect(panel.getByText('Proseware · Berlin, Germany · hybrid · full-time')).toBeVisible();
  await expect(panel.getByText('PyTorch', { exact: true })).toBeVisible();

  expect(prompts).toHaveLength(1);
  expect(prompts[0]).toContain('Strong Python and PyTorch skills');
  expect(prompts[0]).not.toContain('Account Executive');

  await panel.reload();
  await panel.getByRole('button', { name: 'Analyze this page' }).click();
  await expect(panel.getByText(/saved result/)).toBeVisible();
  expect(prompts).toHaveLength(1);

  await panel.getByRole('button', { name: 'Re-analyze' }).click();
  await expect(panel.getByText(/with Gemini/)).toBeVisible();
  expect(prompts).toHaveLength(2);
});

test('reads a job description from a cross-origin iframe', async ({ context, extensionId }) => {
  await context.route('https://www.tailspin.example/**', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<html><head><title>Careers at Tailspin</title></head><body><h1>Join us</h1>
        <iframe src="https://job-boards.greenhouse.io/embed/job_app?for=tailspin&token=123" width="800" height="900"></iframe>
        </body></html>`,
    }),
  );
  await context.route('https://job-boards.greenhouse.io/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('greenhouse.html') }),
  );
  const prompts = await mockGemini(context, { job: { ...ANALYSIS, title: 'Data Analyst', company: 'Tailspin Toys' } });

  const jobPage = await context.newPage();
  await jobPage.goto('https://www.tailspin.example/careers?gh_jid=123');
  await jobPage.frameLocator('iframe').locator('h1').waitFor();
  const panel = await openPanelFor(context, extensionId, 'https://www.tailspin.example/*');

  await panel.getByRole('button', { name: 'Analyze this page' }).click();
  await expect(panel.getByRole('heading', { name: 'Data Analyst' })).toBeVisible();
  await expect(panel.getByText(/Greenhouse reader/)).toBeVisible();
  expect(prompts[0]).toContain('Advanced SQL');
  expect(prompts[0]).toContain('Company: Tailspin Toys');
  expect(prompts[0]).toContain('Page URL: https://www.tailspin.example/careers?gh_jid=123');
});

test('shows a match score once a profile is saved', async ({ context, extensionId }) => {
  await context.route('https://careers.proseware.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('generic.html') }),
  );
  await mockGemini(context, {
    job: ANALYSIS,
    resume: {
      contact: { name: 'Sam Lee', location: 'Berlin, Germany' },
      headline: 'Machine Learning Engineer',
      skills: ['Python', 'PyTorch', 'Docker'],
      experience: [{ title: 'ML Engineer', company: 'Fabrikam', start: '2020-01', end: 'Present', bullets: ['Trained NLP models'] }],
    },
  });

  const jobPage = await context.newPage();
  await jobPage.goto('https://careers.proseware.example/jobs/ml');
  const panel = await openPanelFor(context, extensionId, 'https://careers.proseware.example/*');

  await panel.getByRole('button', { name: 'Analyze this page' }).click();
  await expect(panel.getByText('Add your resume to see how well you match this job.')).toBeVisible();

  await panel.getByRole('button', { name: 'Go to Profile' }).click();
  await panel
    .locator('input[type=file]')
    .setInputFiles({ name: 'cv.txt', mimeType: 'text/plain', buffer: Buffer.from('Sam Lee, ML engineer. '.repeat(10)) });
  await expect(panel.getByText(/Parsed with Gemini/)).toBeVisible();
  await panel.getByRole('button', { name: 'Save profile' }).click();
  await expect(panel.getByText('Profile saved.')).toBeVisible();

  await panel.getByRole('button', { name: 'Job', exact: true }).click();
  const score = Number(await panel.getByTestId('match-score').textContent());
  expect(score).toBeGreaterThanOrEqual(75);
  await expect(panel.getByText('Strong match', { exact: true })).toBeVisible();
  await expect(panel.getByText('3 of 3 must-have requirements met').first()).toBeVisible();
});

test('explains when the page has no job description', async ({ context, extensionId }) => {
  await context.route('https://recipes.example/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: fixture('not-a-job.html') }),
  );
  const prompts = await mockGemini(context, { job: ANALYSIS });
  const page = await context.newPage();
  await page.goto('https://recipes.example/sourdough');
  const panel = await openPanelFor(context, extensionId, 'https://recipes.example/*');

  await panel.getByRole('button', { name: 'Analyze this page' }).click();
  await expect(panel.getByText(/Could not find a job description/)).toBeVisible();
  expect(prompts).toHaveLength(0);
});
