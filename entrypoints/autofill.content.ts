import { createPageApi } from '@/lib/autofill/page';
import type { PageApi } from '@/lib/autofill/types';

// Injected on demand into every frame. Later fill/collect calls reach the same API through globalThis.__ija.
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main() {
    const g = globalThis as unknown as { __ija?: PageApi };
    g.__ija ??= createPageApi(document);
    return g.__ija.detect();
  },
});
