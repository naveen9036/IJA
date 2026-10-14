import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import AutofillView from './AutofillView';
import CoverLetterView from './CoverLetterView';
import JobView from './JobView';
import ProfileView from './ProfileView';
import ResumeView from './ResumeView';
import SettingsView from './SettingsView';

const TABS = ['Job', 'Resume', 'Letter', 'Apply', 'Profile', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>('Job');
  const [jobId, setJobId] = useState<string | null>();

  useEffect(() => {
    db.jobs
      .orderBy('capturedAt')
      .last()
      .then((j) => setJobId((current) => current ?? j?.id ?? null));
  }, []);

  const openProfile = () => setTab('Profile');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white px-2 py-2">
        <span className="mr-2 font-semibold">IJA</span>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-1.5 py-1 text-sm ${tab === t ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {t}
          </button>
        ))}
      </header>
      <main className="p-3">
        {jobId === undefined ? null : tab === 'Job' ? (
          <JobView jobId={jobId} onJob={setJobId} onOpenProfile={openProfile} />
        ) : tab === 'Resume' ? (
          <ResumeView jobId={jobId} onOpenProfile={openProfile} onOpenJob={() => setTab('Job')} />
        ) : tab === 'Letter' ? (
          <CoverLetterView jobId={jobId} onOpenProfile={openProfile} onOpenJob={() => setTab('Job')} />
        ) : tab === 'Apply' ? (
          <AutofillView jobId={jobId} />
        ) : tab === 'Profile' ? (
          <ProfileView />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
