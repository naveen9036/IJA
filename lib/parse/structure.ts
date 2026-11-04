import type { FallbackChain, ChainResult } from '../llm/fallback';
import { PROFILE_JSON_SHAPE, ProfileDataSchema, type ProfileData } from '../profile/schema';

const MAX_RESUME_CHARS = 30_000;

const SYSTEM = `You convert resume text into JSON.
Rules:
- Copy facts exactly as written. Never invent, infer, or embellish companies, titles, dates, skills, or numbers.
- Use "" or [] when a field is missing.
- Dates: "YYYY-MM" when month is known, "YYYY" otherwise, "Present" for current roles.
- "skills": every skill as a separate item (e.g. "Python", "Kubernetes"), no category names.
- "skillGroups": if the resume groups skills under labels (e.g. "Languages:", "Backend:", "Cloud:"), copy each label and its skills in the same order; otherwise [].
- "bullets": one achievement per item, without bullet symbols.
- "tech" in a role: the items of that role's "Technologies:" / "Tech stack:" line, if present.
- Projects listed under a job (with their own name and technologies) go in "projects".
- "languages": spoken languages, if listed.
- "certifications": certifications and awards, one per item.
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
