import { detectFields, type DetectOptions, type Registry } from './detect';
import { collectValues, fillFields } from './fill';
import type { PageApi } from './types';

export function createPageApi(doc: Document, opts: DetectOptions = { layout: true }): PageApi {
  const registry: Registry = new Map();
  return {
    detect: () => detectFields(doc, registry, opts),
    fill: (plan) => fillFields(registry, plan),
    collect: (ids) => collectValues(registry, ids),
  };
}
