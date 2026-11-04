import { BriefcaseBusiness, ClipboardCheck, FileText, Mail, Settings, UserRound, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import AutofillView from './AutofillView';
import CoverLetterView from './CoverLetterView';
import JobView from './JobView';
import ProfileView from './ProfileView';
import ResumeView from './ResumeView';
import SettingsView from './SettingsView';
import { Logo } from './components/Logo';
import { Tooltip } from './components/ui';

const TABS: { id: Tab; icon: LucideIcon }[] = [
  { id: 'Job', icon: BriefcaseBusiness },
  { id: 'Resume', icon: FileText },
  { id: 'Letter', icon: Mail },
  { id: 'Apply', icon: ClipboardCheck },
  { id: 'Profile', icon: UserRound },
  { id: 'Settings', icon: Settings },
];
type Tab = 'Job' | 'Resume' | 'Letter' | 'Apply' | 'Profile' | 'Settings';

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
  const openJob = () => setTab('Job');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-2.5 px-4 pt-3">
          <Logo className="h-8 w-8 shrink-0 drop-shadow-sm" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-slate-900">IJA</div>
            <div className="text-xs text-slate-500">Intelligent Job Assistant</div>
          </div>
        </div>
        <nav className="flex justify-between px-3 pt-2 pb-2" aria-label="Sections">
          {TABS.map(({ id, icon: Icon }) => {
            const active = tab === id;
            return (
              <Tooltip key={id} label={id}>
                <button
                  aria-label={id}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setTab(id)}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'text-slate-500 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
                >
                  <Icon className={`h-5 w-5 transition ${active ? 'scale-110' : ''}`} aria-hidden />
                </button>
              </Tooltip>
            );
          })}
        </nav>
      </header>
      <main key={tab} className="animate-fade-in space-y-3 p-3 motion-reduce:animate-none">
        {jobId === undefined ? null : tab === 'Job' ? (
          <JobView jobId={jobId} onJob={setJobId} onOpenProfile={openProfile} />
        ) : tab === 'Resume' ? (
          <ResumeView jobId={jobId} onOpenProfile={openProfile} onOpenJob={openJob} />
        ) : tab === 'Letter' ? (
          <CoverLetterView jobId={jobId} onOpenProfile={openProfile} onOpenJob={openJob} />
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
