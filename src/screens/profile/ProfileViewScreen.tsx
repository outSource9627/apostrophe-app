import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api, ApiClientError } from '../../lib/api'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Banner, Body, Button, Display, Eyebrow, Figure, Meta, Sheet, VerifiedSeal } from '../../components/ui'
import {
  PersonalStep, EducationStep, ExperienceStep, SkillsStep, PreferencesStep, DocumentsStep,
  type Config, type StepProps,
} from './wizardSteps'

type StepKey = 'personal' | 'education' | 'experience' | 'skills' | 'preferences' | 'documents'
interface Profile {
  photoKey: string | null; dateOfBirth: string | null; gender: string | null; city: string | null; languages: string[]
  education: any | null
  experience: { id?: string; company?: string; role?: string; from?: string; to?: string; description?: string }[]
  skills: { id?: string; name: string; status: string }[]
  preferences: any | null
  documents: { kind: string; key: string; name?: string }[]
  portfolioLinks: string[]
  publishedAt: string | null
  completion: { pct: number; canBook: boolean; missing: string[] }
}
interface Audience { hiddenFromFeed: boolean; published: boolean }

const STEP_BODIES: Record<StepKey, (p: StepProps) => React.ReactElement> = {
  personal: PersonalStep, education: EducationStep, experience: ExperienceStep,
  skills: SkillsStep, preferences: PreferencesStep, documents: DocumentsStep,
}
const TITLES: Record<StepKey, string> = { personal: 'Basics', education: 'Education', experience: 'Experience', skills: 'Skills', preferences: 'Preferences', documents: 'Documents' }
const LBL: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other', PREFER_NOT_TO_SAY: 'Prefer not to say', GRADUATION: 'Graduation', CLASS_12: 'Class 12', POST_GRADUATION: 'Post graduation', PHD: 'PhD', PERCENTAGE: 'percentage', CGPA: 'CGPA', IMMEDIATE: 'Immediately', DAYS_15: 'Within 15 days', DAYS_30: 'Within 30 days', DAYS_60: 'Within 60 days', FULL_TIME: 'Full time', PART_TIME: 'Part time', INTERNSHIP: 'Internship', CONTRACT: 'Contract', REMOTE: 'Remote', HYBRID: 'Hybrid' }
const lbl = (v?: string) => (v ? LBL[v] ?? v : undefined)

function draftFor(step: StepKey, p: Profile): Record<string, unknown> {
  switch (step) {
    case 'personal': return { photoKey: p.photoKey ?? undefined, dateOfBirth: p.dateOfBirth?.slice(0, 10), gender: p.gender ?? undefined, city: p.city ?? undefined, languages: p.languages }
    case 'education': return { ...(p.education ?? {}) }
    case 'experience': return { experience: (p.experience ?? []).map((e) => ({ ...e, from: e.from?.slice(0, 10), to: e.to?.slice(0, 10) })) }
    case 'skills': return { skills: (p.skills ?? []).map((s) => s.name) }
    case 'preferences': return { ...(p.preferences ?? {}) }
    case 'documents': return { documents: (p.documents ?? []).map(({ kind, key, name }) => ({ kind, key, name })), portfolioLinks: p.portfolioLinks ?? [] }
  }
}

/**
 * ST-20 — the finished profile as its owner sees it: all six sections on one
 * page, each editable IN PLACE via a sheet (not a trip to a form), with the
 * verified video resume at the top. Mirrors the web ProfileViewClient; the
 * sheet reuses the same wizard step bodies so the two never drift.
 */
export function ProfileViewScreen({ onBack, onBook, onVisibility, onVideos }: {
  onBack: () => void; onBook: () => void; onVisibility: () => void; onVideos: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<StepKey | null>(null)

  const profileQ = useQuery({ queryKey: ['profile'], queryFn: () => api.get<Profile>('/students/me/profile') })
  const configQ = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })
  const audienceQ = useQuery({ queryKey: ['audience'], queryFn: () => api.get<Audience>('/students/me/audience').catch(() => ({ hiddenFromFeed: false, published: false })) })
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api.get<{ name?: string; city?: string }>('/students/me') })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Your videos" onBack={onBack} action={undefined} />{child}</View>
  )
  if (profileQ.isPending || configQ.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (profileQ.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your profile.</Body></View>)

  const p = profileQ.data!, cfg = configQ.data!
  const published = audienceQ.data?.published ?? Boolean(p.publishedAt)
  const hidden = audienceQ.data?.hiddenFromFeed ?? false
  const firstMissing = p.completion.missing[0]

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Your videos" onBack={onBack} action={<Pressable onPress={onVideos}><Meta style={{ color: color.textMuted }}>VIDEOS</Meta></Pressable>} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>Your profile</Eyebrow>
          <Display level="lg">This is what an employer sees.</Display>
        </View>

        {published ? (
          <View style={styles.card}>
            <Body weight="semibold" size="lg">Your video resume</Body>
            <Body size="sm" tone="muted" style={{ marginTop: space.xs }}>The film from your interview. This is the only video employers see.</Body>
            <View style={{ marginTop: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <VerifiedSeal date={p.publishedAt ? fmtDate(p.publishedAt) : undefined} />
            </View>
          </View>
        ) : (
          <View style={styles.wellCard}>
            <Body weight="semibold" size="lg">Your video resume</Body>
            <Body size="sm" tone="muted" style={{ marginTop: space.xs }}>The interview you book becomes your video resume — the one thing employers watch before they read a word.</Body>
            <View style={{ marginTop: space.md, alignItems: 'flex-start' }}>
              <Button variant="primary" size="md" label="Book an interview" onPress={onBook} />
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <Figure value={`${p.completion.pct}%`} />
          <Body size="sm" tone="muted">of your profile is filled in</Body>
        </View>
        {firstMissing ? <Meta style={{ color: color.textSubtle }}>Still empty — {firstMissing}.</Meta> : null}

        <Pressable onPress={onVisibility} style={styles.feedRow}>
          <View style={{ flex: 1 }}>
            <Body weight="medium">{published && !hidden ? 'You are live in the employer feed' : 'Feed visibility'}</Body>
            <Body size="xs" tone="subtle">
              {published ? (hidden ? 'You are hidden. Tap to manage.' : 'Employers can find you and send an Interest.') : 'Your video resume unlocks the feed. Tap to manage.'}
            </Body>
          </View>
          <Chevron />
        </Pressable>

        <Section title="Basics" onEdit={() => setEditing('personal')}>
          <KV k="Name" v={meQ.data?.name} />
          <KV k="City" v={p.city ?? meQ.data?.city} />
          <KV k="Date of birth" v={p.dateOfBirth ? fmtDate(p.dateOfBirth) : undefined} />
          <KV k="Gender" v={lbl(p.gender ?? undefined)} />
          <KV k="Languages" v={p.languages.length ? p.languages.join(', ') : undefined} />
        </Section>

        <Section title="Education" onEdit={() => setEditing('education')}>
          <KV k="Qualification" v={lbl(p.education?.qualification)} />
          <KV k="Institution" v={p.education?.institution} />
          <KV k="Field of study" v={p.education?.fieldOfStudy} />
          <KV k="Year of completion" v={p.education?.yearOfCompletion ? String(p.education.yearOfCompletion) : undefined} />
          <KV k={`Score${p.education?.scoreType ? ` (${lbl(p.education.scoreType)})` : ''}`} v={p.education?.score != null ? String(p.education.score) : undefined} />
          {p.education?.documentKey ? <DocRow name={fileName(p.education.documentKey)} kind="qualification document" /> : null}
        </Section>

        <Section title="Experience" onEdit={() => setEditing('experience')}>
          {p.experience.length === 0 ? <Body size="sm" tone="subtle">Nothing added yet.</Body> : p.experience.map((e, i) => (
            <View key={e.id ?? i} style={{ gap: 2, marginBottom: space.md }}>
              <Display level="xs">{e.role ?? 'Role'}</Display>
              <Body size="sm" tone="muted">{[e.company, dateRange(e.from, e.to)].filter(Boolean).join(' · ')}</Body>
              {e.description ? <Body size="sm" tone="muted" style={{ marginTop: 2 }}>{e.description}</Body> : null}
            </View>
          ))}
        </Section>

        <Section title="Skills" onEdit={() => setEditing('skills')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {p.skills.map((s, i) => (
              <View key={s.id ?? i} style={[styles.skill, s.status === 'PENDING_REVIEW' && styles.skillPending]}>
                <Body size="sm" tone={s.status === 'PENDING_REVIEW' ? 'muted' : 'default'}>{s.name}</Body>
                {s.status === 'PENDING_REVIEW' ? <Meta style={{ color: color.info }}>  pending</Meta> : null}
              </View>
            ))}
          </View>
        </Section>

        <Section title="Preferences" onEdit={() => setEditing('preferences')}>
          <KV k="Roles you want" v={joinOr(p.preferences?.desiredRoles)} />
          <KV k="Where you would work" v={joinOr(p.preferences?.preferredLocations)} />
          <KV k="Kind of work" v={joinOr((p.preferences?.employmentTypes ?? []).map((t: string) => lbl(t)))} />
          <KV k="When you can join" v={lbl(p.preferences?.availabilityToJoin)} />
          <KV k="Expected salary" v={salary(p.preferences?.expectedSalaryMinPaise, p.preferences?.expectedSalaryMaxPaise)} />
        </Section>

        <Section title="Documents" onEdit={() => setEditing('documents')}>
          {p.documents.length === 0 && p.portfolioLinks.length === 0 ? <Body size="sm" tone="subtle">Nothing added yet.</Body> : (
            <>
              {p.documents.map((d) => <DocRow key={d.key} name={d.name ?? fileName(d.key)} kind={lbl(d.kind) ?? d.kind} />)}
              {p.portfolioLinks.map((l) => <Body key={l} size="sm" style={{ color: color.info, marginTop: space.xs }}>{l}</Body>)}
            </>
          )}
        </Section>
      </ScrollView>

      {editing ? (
        <EditSheet
          step={editing}
          profile={p}
          config={cfg}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['profile'] }) }}
          Body={STEP_BODIES[editing]}
          initial={draftFor(editing, p)}
          title={`Edit ${TITLES[editing]}`}
        />
      ) : null}
    </View>
  )
}

function EditSheet({ step, profile, config, onClose, onSaved, Body: StepBody, initial, title }: {
  step: StepKey; profile: Profile; config: Config; onClose: () => void; onSaved: () => void
  Body: (p: StepProps) => React.ReactElement; initial: Record<string, unknown>; title: string
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(initial)
  const [error, setError] = useState<string | null>(null)
  const mut = useMutation({
    mutationFn: () => api.patch(`/students/me/profile/${step}`, draft),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiClientError ? e.message : 'Could not save. Try again.'),
  })
  const patch = (next: Record<string, unknown>) => setDraft((d) => ({ ...d, ...next }))
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      primary={<Button variant="primary" size="block" full busy={mut.isPending} label="Save" onPress={() => mut.mutate()} />}
      secondary={<Button variant="outline" size="block" full label="Cancel" onPress={onClose} />}
    >
      <View style={{ gap: space.lg }}>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <StepBody draft={draft} patch={patch} config={config} profile={profile} />
      </View>
    </Sheet>
  )
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Eyebrow>{title}</Eyebrow>
        <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={8}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke={color.textMuted} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          <Meta style={{ color: color.textMuted }}>EDIT</Meta>
        </Pressable>
      </View>
      {children}
    </View>
  )
}

function KV({ k, v }: { k: string; v?: string }) {
  return (
    <View style={styles.kv}>
      <Meta style={{ color: color.textSubtle }}>{k.toUpperCase()}</Meta>
      <Body size="sm" tone={v ? 'default' : 'subtle'}>{v ?? 'Not set yet'}</Body>
    </View>
  )
}
function DocRow({ name, kind }: { name: string; kind: string }) {
  return (
    <View style={styles.doc}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M14 3v5h5M7 3h8l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke={color.textMuted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body size="sm" numberOfLines={1}>{name}</Body>
        <Meta style={{ color: color.textSubtle }}>{kind}</Meta>
      </View>
    </View>
  )
}
function Chevron() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="m9 18 6-6-6-6" stroke={color.textSubtle} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}

const fmtDate = (iso: string) => {
  const d = new Date(iso); const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
const dateRange = (from?: string, to?: string) => {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const f = (s?: string) => { if (!s) return null; const d = new Date(s); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
  return [f(from), f(to)].filter(Boolean).join(' — ') || undefined
}
const fileName = (key: string) => key.split('/').pop() ?? key
const joinOr = (a?: string[]) => (a && a.length ? a.join(', ') : undefined)
function salary(min?: number, max?: number): string | undefined {
  if (min == null) return undefined
  const l = (p: number) => { const rs = p / 100; return rs >= 100000 ? `₹${Number.isInteger(rs / 100000) ? rs / 100000 : (rs / 100000).toFixed(1)} LPA` : `₹${Math.round(rs).toLocaleString('en-IN')}` }
  return max == null ? l(min) : `${l(min).replace(' LPA', '')} – ${l(max)}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  card: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, padding: space.lg },
  wellCard: { borderRadius: radius.lg, backgroundColor: color.surfaceMuted, padding: space.lg },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg },
  section: { gap: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: space.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36 },
  kv: { gap: 2, marginBottom: space.sm },
  skill: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, backgroundColor: color.surfaceMuted, paddingHorizontal: space.md, paddingVertical: space.sm },
  skillPending: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong, borderStyle: 'dashed' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, backgroundColor: color.surfaceMuted, padding: space.md, marginTop: space.xs },
})
