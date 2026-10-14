import { z } from 'zod';
import { ProfileDataSchema, type ProfileData } from '../profile/schema';

export const TailoredResumeSchema = z.object({
  resume: ProfileDataSchema,
  notes: z
    .array(z.string())
    .nullish()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean)),
});

export type ResumeDoc = ProfileData;
