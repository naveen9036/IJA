import { expect, test } from './fixtures';

declare const chrome: { storage: { local: { set(items: object): Promise<void> } } };

const RESUME_HTML = `<html><body style="font-family: sans-serif">
<h1>Jane Doe</h1>
<p>jane.doe@example.com | +1 555 0100 | Austin, TX</p>
<h2>Experience</h2>
<p><b>Senior Software Engineer</b>, Acme Corp, 2021-03 to Present</p>
<ul><li>Built Kubernetes-based deployment platform used by 40 teams.</li>
<li>Cut CI time by 60% with Bazel remote caching.</li></ul>
<h2>Education</h2><p>B.S. Computer Science, University of Texas, 2017</p>
<h2>Skills</h2><p>TypeScript, Go, Kubernetes, PostgreSQL</p>
</body></html>`;

const PARSED = {
  contact: { name: 'Jane Doe', email: 'jane.doe@example.com', phone: '+1 555 0100', location: 'Austin, TX', links: [] },
  headline: 'Senior Software Engineer',
  summary: '',
  experience: [
    {
      company: 'Acme Corp',
      title: 'Senior Software Engineer',
      location: '',
      start: '2021-03',
      end: 'Present',
      bullets: ['Built Kubernetes-based deployment platform used by 40 teams.'],
    },
  ],
  education: [{ institution: 'University of Texas', degree: 'B.S.', field: 'Computer Science', start: '', end: '2017' }],
  skills: ['TypeScript', 'Go', 'Kubernetes', 'PostgreSQL'],
};

test('uploads a PDF resume, parses it, and saves the profile', async ({ context, extensionId }) => {
  const printer = await context.newPage();
  await printer.setContent(RESUME_HTML);
  const pdf = await printer.pdf();
  await printer.close();

  let sentResumeText = '';
  let sentKey = '';
  await context.route('https://generativelanguage.googleapis.com/**', async (route) => {
    sentKey = route.request().headers()['x-goog-api-key'] ?? '';
    sentResumeText = route.request().postData() ?? '';
    await route.fulfill({
      json: { candidates: [{ content: { parts: [{ text: JSON.stringify(PARSED) }] }, finishReason: 'STOP' }] },
    });
  });

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.evaluate(() =>
    chrome.storage.local.set({
      settings: {
        cloudConsent: true,
        providers: [{ id: 'gemini', enabled: true, apiKey: 'test-key', model: 'gemini-3.8-flash' }],
      },
    }),
  );

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: pdf });

  await expect(page.getByText('Parsed with Gemini')).toBeVisible();
  expect(sentKey).toBe('test-key');
  expect(sentResumeText).toContain('Bazel remote caching');
  await expect(page.getByLabel('Name')).toHaveValue('Jane Doe');
  await expect(page.getByText('Senior Software Engineer @ Acme Corp')).toBeVisible();

  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByText(/Saved: resume\.pdf \(v1/)).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('jane.doe@example.com');
});

test('shows a clear error when no provider is configured', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from('Jane Doe. '.repeat(30)) });
  await expect(page.getByText(/No AI provider is set up yet/)).toBeVisible();
});
