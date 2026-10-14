import type { FallbackChain, ChainResult } from '../llm/fallback';
import { PROFILE_JSON_SHAPE, ProfileDataSchema, type ProfileData } from '../profile/schema';

const MAX_RESUME_CHARS = 30_000;

const SYSTEM = `You convert resume text into JSON.
Rules:
- Copy facts exactly as written. Never invent, infer, or embellish companies, titles, dates, skills, or numbers.
- Use "" or [] when a field is missing.
- Dates: "YYYY-MM" when month is known, "YYYY" otherwise, "Present" for current roles.
- "skills": individual skills as separate items (e.g. "Python", "Kubernetes"), no categories.
- "bullets": one achievement per item, without bullet symbols.
- Reply with JSON only.`;

export function buildStructurePrompt(rawText: string) {
  return {
    system: SYSTEM,
    user: `Return JSON with exactly this shape:\n${PROFILE_JSON_SHAPE}\n\nResume text:\n"""\n${rawText.slice(0, MAX_RESUME_CHARS)}\n"""`,
    temperature: 0,
  };
}

export function structureResume(
  chain: FallbackChain,
  rawText: string,
  signal?: AbortSignal,
): Promise<ChainResult<ProfileData>> {
  return chain.completeJson(buildStructurePrompt(rawText), ProfileDataSchema, signal);
}
