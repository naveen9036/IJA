import Dexie, { type EntityTable } from 'dexie';
import type { QaEntry } from './autofill/qa';
import type { ExtractSource, JobHints } from './extract/types';
import type { JobAnalysis } from './job/schema';
import type { ApplicationInfo, ProfileData } from './profile/schema';

export interface ProfileRecord {
  id: 'me';
  data: ProfileData;
  applicationInfo: ApplicationInfo;
  rawText: string;
  resumeFile?: Blob;
  resumeFileName?: string;
  /** Incremented on every save; used later to invalidate cached analyses. */
  version: number;
  updatedAt: number;
}

export interface JobRecord {
  /** Normalized job URL. */
  id: string;
  url: string;
  pageTitle: string;
  source: ExtractSource;
  adapter?: string;
  hints: JobHints;
  text: string;
  textHash: string;
  analysis: JobAnalysis;
  provider: string;
  capturedAt: number;
}

export type DocumentType = 'resume' | 'coverLetter';

export interface DocumentRecord<T = unknown> {
  /** `${jobId}:${type}` so each job keeps one document of each type. */
  id: string;
  jobId: string;
  type: DocumentType;
  content: T;
  notes: string[];
  warnings: { path: string; text: string; reason: string }[];
  removed: string[];
  provider: string;
  profileVersion: number;
  createdAt: number;
  updatedAt: number;
}

export const documentId = (jobId: string, type: DocumentType) => `${jobId}:${type}`;

export async function getDocument<T>(jobId: string, type: DocumentType): Promise<DocumentRecord<T> | undefined> {
  return (await db.documents.get(documentId(jobId, type))) as DocumentRecord<T> | undefined;
}

export async function saveDocument<T>(record: DocumentRecord<T>): Promise<void> {
  await db.documents.put({ ...record, updatedAt: Date.now() });
}

export const db = new Dexie('ija') as Dexie & {
  profile: EntityTable<ProfileRecord, 'id'>;
  jobs: EntityTable<JobRecord, 'id'>;
  documents: EntityTable<DocumentRecord, 'id'>;
  qa: EntityTable<QaEntry, 'id'>;
};

db.version(1).stores({
  profile: 'id',
});
db.version(2).stores({
  jobs: 'id, capturedAt',
});
db.version(3).stores({
  documents: 'id, jobId, type, createdAt',
});
db.version(4).stores({
  qa: '++id, &key',
});

export async function getProfile(): Promise<ProfileRecord | undefined> {
  return db.profile.get('me');
}

export async function saveProfile(
  update: Omit<ProfileRecord, 'id' | 'version' | 'updatedAt'>,
): Promise<ProfileRecord> {
  return db.transaction('rw', db.profile, async () => {
    const existing = await db.profile.get('me');
    const record: ProfileRecord = {
      ...update,
      id: 'me',
      version: (existing?.version ?? 0) + 1,
      updatedAt: Date.now(),
    };
    await db.profile.put(record);
    return record;
  });
}

export async function deleteAllData(): Promise<void> {
  await db.delete();
  await db.open();
}
