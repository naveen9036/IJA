import { extractFrame } from '@/lib/extract/page';

// Injected on demand into every frame of the active tab; the return value goes back to scripting.executeScript.
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main() {
    return extractFrame(document, window);
  },
});
