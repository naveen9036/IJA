import { useEffect, useRef, useState } from 'react';
import { getProfile, saveProfile, type ProfileRecord } from '@/lib/db';
import { extractResumeText } from '@/lib/parse/extract';
import { structureResume } from '@/lib/parse/structure';
import {
  cleanProfileData,
  emptyApplicationInfo,
  emptyProfileData,
  type ApplicationInfo,
  type ProfileData,
} from '@/lib/profile/schema';
import { buildChain, loadSettings } from '@/lib/settings';
import { TextInput } from './components/fields';
import ProfileEditor from './components/ProfileEditor';

const APP_INFO_LABELS: Record<keyof ApplicationInfo, string> = {
  workAuthorization: 'Work authorization (e.g. US citizen, H-1B, EU citizen)',
  requiresSponsorship: 'Requires visa sponsorship? (Yes/No)',
  noticePeriod: 'Notice period',
  expectedSalary: 'Expected salary',
  willingToRelocate: 'Willing to relocate? (Yes/No)',
};

export default function ProfileView() {
  const [record, setRecord] = useState<ProfileRecord | null>();
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [appInfo, setAppInfo] = useState<ApplicationInfo>(emptyApplicationInfo());
  const [pending, setPending] = useState<{ rawText: string; file: File } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getProfile().then((r) => {
      setRecord(r ?? null);
      if (r) {
        setDraft(r.data);
        setAppInfo({ ...emptyApplicationInfo(), ...r.applicationInfo });
      }
    });
  }, []);

  const upload = async (file: File) => {
    setError('');
    setNotice('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      setBusy('Reading file…');
      const rawText = await extractResumeText(file);
      setBusy('Extracting your profile with AI…');
      const chain = buildChain(await loadSettings());
      const { value, provider } = await structureResume(chain, rawText, ctrl.signal);
      setDraft(value);
      setPending({ rawText, file });
      setNotice(`Parsed with ${provider}. Check every field below, then save.`);
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy('');
      abortRef.current = null;
    }
  };

  const save = async () => {
    if (!draft) return;
    const saved = await saveProfile({
      data: cleanProfileData(draft),
      applicationInfo: appInfo,
      rawText: pending?.rawText ?? record?.rawText ?? '',
      resumeFile: pending?.file ?? record?.resumeFile,
      resumeFileName: pending?.file.name ?? record?.resumeFileName,
    });
    setRecord(saved);
    setDraft(saved.data);
    setPending(null);
    setNotice('Profile saved.');
  };

  if (record === undefined) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-3">
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold">Resume</h2>
        {record?.resumeFileName && (
          <p className="text-xs text-gray-600">
            Saved: {record.resumeFileName} (v{record.version}, {new Date(record.updatedAt).toLocaleString()})
          </p>
        )}
        <input
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          disabled={!!busy}
          className="block w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) upload(file);
          }}
        />
        {!draft && !busy && (
          <button className="btn-secondary" onClick={() => setDraft(emptyProfileData())}>
            Or enter details manually
          </button>
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <span>{busy}</span>
            <button className="btn-secondary px-2 py-0.5" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          </div>
        )}
        {error && <p className="text-sm whitespace-pre-wrap text-red-700">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
      </section>

      {draft && (
        <>
          <ProfileEditor value={draft} onChange={setDraft} />

          <section className="card space-y-2">
            <h3 className="text-sm font-semibold">Application answers</h3>
            <p className="text-xs text-gray-500">Not usually in a resume, but most application forms ask for them.</p>
            {(Object.keys(APP_INFO_LABELS) as (keyof ApplicationInfo)[]).map((k) => (
              <TextInput
                key={k}
                label={APP_INFO_LABELS[k]}
                value={appInfo[k]}
                onChange={(v) => setAppInfo({ ...appInfo, [k]: v })}
              />
            ))}
          </section>

          <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 py-2">
            <button className="btn-primary w-full" disabled={!!busy} onClick={save}>
              Save profile
            </button>
          </div>
        </>
      )}
    </div>
  );
}
