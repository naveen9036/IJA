import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: process.env.IJA_E2E ? '.output-e2e' : '.output',
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'IJA - Job Application Assistant',
    description: 'Match score, tailored resume, cover letter, and form autofill for any job page.',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      'https://api.groq.com/*',
      'https://openrouter.ai/*',
      'http://localhost:11434/*',
      // E2E builds pre-grant site access because tests cannot click Chrome's permission prompt.
      ...(process.env.IJA_E2E ? ['<all_urls>'] : []),
    ],
    // Requested on the first "Analyze" click so the extension can read job pages on any site.
    optional_host_permissions: ['<all_urls>'],
    // react-pdf's layout engine (yoga) is WASM; MV3 allows 'wasm-unsafe-eval' but not 'unsafe-eval'.
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';" },
    action: { default_title: 'Open IJA' },
  },
});
