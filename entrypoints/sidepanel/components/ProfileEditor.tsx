import type { ReactNode } from 'react';
import type { ProfileData } from '@/lib/profile/schema';
import { CsvInput, LinesInput, ListSection, TextArea, TextInput } from './fields';

export default function ProfileEditor({
  value,
  onChange,
  roleExtra,
}: {
  value: ProfileData;
  onChange: (v: ProfileData) => void;
  /** Extra content under each experience entry, e.g. the original bullets. */
  roleExtra?: (index: number) => ReactNode;
}) {
  const set = (patch: Partial<ProfileData>) => onChange({ ...value, ...patch });
  const setContact = (patch: Partial<ProfileData['contact']>) => set({ contact: { ...value.contact, ...patch } });

  return (
    <>
      <section className="card space-y-2">
        <h3 className="text-sm font-semibold">Contact</h3>
        <TextInput label="Name" value={value.contact.name} onChange={(name) => setContact({ name })} />
        <TextInput label="Email" value={value.contact.email} onChange={(email) => setContact({ email })} />
        <TextInput label="Phone" value={value.contact.phone} onChange={(phone) => setContact({ phone })} />
        <TextInput label="Location" value={value.contact.location} onChange={(location) => setContact({ location })} />
        <LinesInput label="Links" rows={2} value={value.contact.links} onChange={(links) => setContact({ links })} />
      </section>

      <section className="card space-y-2">
        <TextInput label="Headline" value={value.headline} onChange={(headline) => set({ headline })} />
        <TextArea label="Summary" rows={4} value={value.summary} onChange={(summary) => set({ summary })} />
        <CsvInput label="Skills" value={value.skills} onChange={(skills) => set({ skills })} />
        <LinesInput
          label="Certifications"
          rows={2}
          value={value.certifications}
          onChange={(certifications) => set({ certifications })}
        />
      </section>

      <ListSection
        title="Experience"
        items={value.experience}
        onChange={(experience) => set({ experience })}
        create={() => ({ company: '', title: '', location: '', start: '', end: '', bullets: [] })}
        itemTitle={(x) => [x.title, x.company].filter(Boolean).join(' @ ')}
        render={(x, u, i) => (
          <>
            <TextInput label="Title" value={x.title} onChange={(title) => u({ title })} />
            <TextInput label="Company" value={x.company} onChange={(company) => u({ company })} />
            <TextInput label="Location" value={x.location} onChange={(location) => u({ location })} />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Start" placeholder="YYYY-MM" value={x.start} onChange={(start) => u({ start })} />
              <TextInput label="End" placeholder="YYYY-MM or Present" value={x.end} onChange={(end) => u({ end })} />
            </div>
            <LinesInput label="Achievements" rows={5} value={x.bullets} onChange={(bullets) => u({ bullets })} />
            {roleExtra?.(i)}
          </>
        )}
      />

      <ListSection
        title="Education"
        items={value.education}
        onChange={(education) => set({ education })}
        create={() => ({ institution: '', degree: '', field: '', start: '', end: '', grade: '' })}
        itemTitle={(x) => [x.degree, x.institution].filter(Boolean).join(', ')}
        render={(x, u) => (
          <>
            <TextInput label="Institution" value={x.institution} onChange={(institution) => u({ institution })} />
            <TextInput label="Degree" value={x.degree} onChange={(degree) => u({ degree })} />
            <TextInput label="Field of study" value={x.field} onChange={(field) => u({ field })} />
            <div className="grid grid-cols-3 gap-2">
              <TextInput label="Start" value={x.start} onChange={(start) => u({ start })} />
              <TextInput label="End" value={x.end} onChange={(end) => u({ end })} />
              <TextInput label="Grade" value={x.grade} onChange={(grade) => u({ grade })} />
            </div>
          </>
        )}
      />

      <ListSection
        title="Projects"
        items={value.projects}
        onChange={(projects) => set({ projects })}
        create={() => ({ name: '', description: '', tech: [], bullets: [] })}
        itemTitle={(x) => x.name}
        render={(x, u) => (
          <>
            <TextInput label="Name" value={x.name} onChange={(name) => u({ name })} />
            <TextArea label="Description" value={x.description} onChange={(description) => u({ description })} />
            <CsvInput label="Tech" value={x.tech} onChange={(tech) => u({ tech })} />
            <LinesInput label="Highlights" value={x.bullets} onChange={(bullets) => u({ bullets })} />
          </>
        )}
      />
    </>
  );
}
