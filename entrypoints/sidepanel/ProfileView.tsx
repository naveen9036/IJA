import { FileUp, PencilLine, Save, UserRound, X } from 'lucide-react';
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
import { buildChain, isUsable, loadSettings, PROVIDER_META } from '@/lib/settings';
import { Field, TextInput } from './components/fields';
import ProfileEditor from './components/ProfileEditor';
import { Notice, Select, Spinner, AiScanLoader, TabIntro } from './components/ui';

const APP_INFO_LABELS: Record<keyof ApplicationInfo, string> = {
  workAuthorization: 'Work authorization (e.g. US citizen, H-1B, EU citizen)',
  requiresSponsorship: 'Requires visa sponsorship?',
  noticePeriod: 'Notice period',
  expectedSalary: 'Expected salary',
  willingToRelocate: 'Willing to relocate?',
};

const YES_NO = new Set<keyof ApplicationInfo>(['requiresSponsorship', 'willingToRelocate']);
const YES_NO_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];

export default function ProfileView() {
  const [record, setRecord] = useState<ProfileRecord | null>();
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [appInfo, setAppInfo] = useState<ApplicationInfo>(emptyApplicationInfo());
  const [pending, setPending] = useState<{ rawText: string; file: File } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [settingsWarning, setSettingsWarning] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getProfile().then((r) => {
      setRecord(r ?? null);
      if (r) {
        setDraft(r.data);
        setAppInfo({ ...emptyApplicationInfo(), ...r.applicationInfo });
      }
    });
    // Check if any provider is ready to use and give a specific actionable hint
    loadSettings().then((s) => {
      const hasUsable = s.providers.some((p) => isUsable(p, s.cloudConsent));
      if (hasUsable) { setSettingsWarning(''); return; }
      const hasEnabledCloud = s.providers.some((p) => p.enabled && PROVIDER_META[p.id].cloud);
      const hasKey = s.providers.some((p) => p.enabled && !!p.apiKey.trim() && PROVIDER_META[p.id].needsKey);
      if (hasEnabledCloud && (hasKey || !s.providers.some((p) => p.enabled && PROVIDER_META[p.id].needsKey))) {
        // Provider enabled + key present but cloud consent not ticked
        setSettingsWarning('AI provider is set up but cloud consent is not enabled. Go to Settings and tick "I understand; allow free cloud providers", then Save settings.');
      } else if (hasKey && !s.cloudConsent) {
        setSettingsWarning('API key is saved but cloud consent is not enabled. Go to Settings, tick "I understand; allow free cloud providers", then Save settings.');
      } else {
        setSettingsWarning('No AI provider is set up yet. Go to Settings, add a free API key and save.');
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

  if (record === undefined) return null;

  return (
    <div className="space-y-3">
      <TabIntro
        id="profile"
        icon={UserRound}
        title="Your profile"
        summary="Your resume as structured data. Every other tab works from what you save here."
        steps={[
          'Upload your resume (PDF, Word .docx or .txt). The text is read on your computer.',
          'The AI sorts it into contact details, experience, education, projects and skills.',
          'Check every field and fix anything that was read wrongly – this is the only source of truth for scores, resumes, letters and forms.',
          'Fill in the application answers at the bottom (work authorization, sponsorship, notice period, salary, relocation).',
          <>
            Click <b>Save profile</b>.
          </>,
        ]}
        tips={[
          'Everything stays in this browser. Delete it any time from Settings.',
          'Your original file is kept so Apply can attach it to application forms.',
          'Upload a newer resume whenever you like; tailored resumes made earlier tell you when your profile has changed.',
        ]}
      />

      <section className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Resume file</h3>
        {record?.resumeFileName && (
          <p className="text-xs text-slate-600">
            Saved: {record.resumeFileName} (v{record.version}, {new Date(record.updatedAt).toLocaleString()})
          </p>
        )}
        <label
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
            busy ? 'pointer-events-none opacity-60' : 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-400 hover:bg-indigo-50'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && !busy) upload(file);
          }}
        >
          <FileUp className="h-6 w-6 text-indigo-600" aria-hidden />
          <span className="text-sm font-medium text-slate-800">
            {record?.resumeFileName ? 'Upload a new resume' : 'Upload your resume'}
          </span>
          <span className="text-xs text-slate-500">Click or drop a PDF, DOCX or TXT file (max 5 MB)</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            disabled={!!busy}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) upload(file);
            }}
          />
        </label>
        {!draft && !busy && (
          <button className="btn-secondary w-full" onClick={() => setDraft(emptyProfileData())}>
            <PencilLine className="h-4 w-4" aria-hidden />
            Or enter details manually
          </button>
        )}
        {busy === 'Reading file…' && (
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <Spinner />
            <span className="flex-1">{busy}</span>
            <button className="btn-secondary px-2 py-1" onClick={() => abortRef.current?.abort()}>
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </button>
          </div>
        )}
        {busy && busy !== 'Reading file…' && (
          <div className="relative">
            <AiScanLoader label={busy} />
            <div className="mt-1 flex justify-center">
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => abortRef.current?.abort()}>
                <X className="h-3 w-3" aria-hidden />
                Cancel
              </button>
            </div>
          </div>
        )}
        {settingsWarning && !error && <Notice tone="error">{settingsWarning}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
      </section>

      {draft && (
        <>
          <ProfileEditor value={draft} onChange={setDraft} />

          <section className="card space-y-2">
            <h3 className="text-sm font-semibold">Application answers</h3>
            <p className="text-xs text-slate-500">Not usually in a resume, but most application forms ask for them.</p>
            {(Object.keys(APP_INFO_LABELS) as (keyof ApplicationInfo)[]).map((k) =>
              YES_NO.has(k) ? (
                <Field key={k} label={APP_INFO_LABELS[k]}>
                  <Select
                    value={appInfo[k]}
                    onChange={(e) => setAppInfo({ ...appInfo, [k]: e.target.value })}
                    options={
                      YES_NO_OPTIONS.some((o) => o.value === appInfo[k])
                        ? YES_NO_OPTIONS
                        : [...YES_NO_OPTIONS, { value: appInfo[k], label: appInfo[k] }]
                    }
                  />
                </Field>
              ) : (
                <TextInput
                  key={k}
                  label={APP_INFO_LABELS[k]}
                  value={appInfo[k]}
                  onChange={(v) => setAppInfo({ ...appInfo, [k]: v })}
                />
              ),
            )}
          </section>

          <div className="sticky bottom-0 -mx-3 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
            <button className="btn-primary w-full" disabled={!!busy} onClick={save}>
              <Save className="h-4 w-4" aria-hidden />
              Save profile
            </button>
          </div>
        </>
      )}
    </div>
  );
}
