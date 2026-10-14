import { test as base, chromium, expect, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output-e2e/chrome-mv3');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      // Branded Chrome ignores --load-extension; point at Chrome for Testing / Chromium if Playwright's own is missing.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },
});

export { expect };
