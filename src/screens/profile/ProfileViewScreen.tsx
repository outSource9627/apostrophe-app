import React, { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api } from '../../lib/api'
import { color, space, borderWidth, fontFamilyNative as FF, fontSize } from '../../theme'
import {
  Banner, Body, Button, FilmThumb, ProgressBar, Sheet, StatusPill, UnverifiedMark, VerifiedSeal, text,
} from '../../components/ui'
import { Btn, DetailHeader, Panel, Skel, TextLink } from '../../components/tab/kit'
import type { Tone } from '../../components/ui'
import { getVideoResume, listSelfVideos, type SelfVideo, type VideoResume } from '../../lib/api/student'
import { fmtDayMonthYear } from '../../lib/chat/format'
import { clock } from '../../lib/employer/candidateFormat'
import type { UploadRule } from '../../lib/api/uploads'
import { label as kindLabel } from '../../lib/profile/labels'
import {
  documentsBody, openOwnDocument, ruleSentence, saveErrorText, useProfileUpload, withResume, withoutDocument,
  type DocEntry, type ProfileDocument,
} from '../../lib/profile/upload'
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
  documents: ProfileDocument[]
  portfolioLinks: string[]
  publishedAt: string | null
  completion: { pct: number; canBook: boolean; missing: string[] }
}
interface Audience { hiddenFromFeed: boolean; published: boolean }
/** What the film card is drawn from. The film's signed addresses are dropped on the way in, so none is held in the cache. */
type Film = Pick<VideoResume, 'status' | 'interviewedAt' | 'publishedAt' | 'pipelinePending' | 'reason' | 'held'>
const loadFilm = async (): Promise<Film> => {
  const f = await getVideoResume()
  return { status: f.status, interviewedAt: f.interviewedAt, publishedAt: f.publishedAt, pipelinePending: f.pipelinePending, reason: f.reason, held: f.held }
}

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
 *
 * The film card is drawn from the FILM's own state (`GET /students/me/video-resume`),
 * never from the audience flag: "not in the feed" is true of a film that is still
 * being made, one that failed and one an admin took down, and none of those is
 * "book an interview". Below the verified film sit the student's own videos, in a
 * dashed frame marked Unverified, so the two can never be mistaken for one another.
 *
 * Documents (ST-35): the résumé has its own row — View, Replace, Remove — and
 * each certificate can be opened, so the student can check the file employers
 * download.
 */
export function ProfileViewScreen({ onBack, onBook, onVisibility, onVideos, onVideoResume }: {
  onBack: () => void; onBook: () => void; onVisibility: () => void; onVideos: () => void; onVideoResume: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<StepKey | null>(null)

  const profileQ = useQuery({ queryKey: ['profile'], queryFn: () => api.get<Profile>('/students/me/profile') })
  const configQ = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })
  const audienceQ = useQuery({ queryKey: ['audience'], queryFn: () => api.get<Audience>('/students/me/audience').catch(() => ({ hiddenFromFeed: false, published: false })) })
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api.get<{ name?: string; city?: string }>('/students/me') })
  // Each has its own failure: the profile is still worth showing without them.
  const filmQ = useQuery({ queryKey: ['video-resume', 'profile-view'], queryFn: loadFilm })
  const videosQ = useQuery({ queryKey: ['videos'], queryFn: listSelfVideos })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><DetailHeader title="Profile" onBack={onBack} />{child}</View>
  )
  if (profileQ.isPending || configQ.isPending) {
    return frame(<View style={styles.loading}><Skel w="100%" h={24} /><Skel w="100%" h={120} /><Skel w="100%" h={80} /><Skel w="100%" h={160} /></View>)
  }
  if (profileQ.isError) return frame(<View style={styles.centre}><Text style={styles.errorText}>Could not load your profile.</Text></View>)

  const p = profileQ.data!, cfg = configQ.data!
  const published = audienceQ.data?.published ?? Boolean(p.publishedAt)
  const hidden = audienceQ.data?.hiddenFromFeed ?? false
  const firstMissing = p.completion.missing[0]

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <DetailHeader title="Profile" onBack={onBack} right={<TextLink label="Videos" onPress={onVideos} />} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Your profile</Text>
          <Text style={styles.title}>This is what an employer sees.</Text>
        </View>

        {filmQ.isPending ? (
          <Panel style={styles.filmPanel}><Skel w="100%" h={16} /><Skel w="100%" h={16} /><Skel w="100%" h={16} /></Panel>
        ) : filmQ.isError ? (
          <Panel>
            <Text style={styles.filmTitle}>Your video resume</Text>
            <Text style={styles.sub}>Could not load your video resume.</Text>
            <View style={styles.leftBtn}><SmallBtn label="Try again" onPress={() => { filmQ.refetch() }} /></View>
          </Panel>
        ) : (
          <FilmCard film={filmQ.data} onOpen={onVideoResume} onBook={onBook} />
        )}

        <Panel style={styles.completion}>
          <View style={styles.pctRow}>
            <Text style={styles.pct}>{`${p.completion.pct}%`}</Text>
            <Text style={styles.pctNote}>{firstMissing ? `filled in · still empty: ${firstMissing}` : 'of your profile is filled in'}</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(p.completion.pct), min: 0, max: 100 }} style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.min(100, p.completion.pct)}%` }]} />
          </View>
        </Panel>

        <Pressable accessibilityRole="button" onPress={onVisibility}>
          <Panel style={styles.feedRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedTitle}>{published && !hidden ? 'You are live in the employer feed' : 'Feed visibility'}</Text>
              <Text style={styles.xs}>
                {published ? (hidden ? 'You are hidden. Tap to manage.' : 'Employers can find you and send an Interest.') : 'Your video resume unlocks the feed. Tap to manage.'}
              </Text>
            </View>
            <Chevron />
          </Panel>
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
          {p.experience.length === 0 ? <Text style={styles.empty}>Nothing added yet.</Text> : p.experience.map((e, i) => (
            <View key={e.id ?? i} style={[styles.xp, i === 0 && styles.xpFirst]}>
              <Text style={styles.xpRole}>{e.role ?? 'Role'}</Text>
              <Text style={styles.sub}>{[e.company, dateRange(e.from, e.to)].filter(Boolean).join(' · ')}</Text>
              {e.description ? <Text style={styles.sub}>{e.description}</Text> : null}
            </View>
          ))}
        </Section>

        <Section title="Skills" onEdit={() => setEditing('skills')}>
          <View style={styles.skills}>
            {p.skills.map((s, i) => {
              const pending = s.status === 'PENDING_REVIEW'
              return (
                <View key={s.id ?? i} style={[styles.skill, pending && styles.skillPending]}>
                  <Text style={[styles.skillText, pending && styles.skillTextPending]}>{pending ? `${s.name}  ·  pending` : s.name}</Text>
                </View>
              )
            })}
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
          <DocumentsBlock profile={p} rules={cfg.uploads} />
        </Section>

        <SelfVideosSection query={videosQ} onManage={onVideos} />
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

/** The mockup's 40-high small button: outline, 14 bold. */
function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  )
}

/**
 * The video-resume card in whichever state the film is in — one card, the same anatomy in every state (the still, the
 * title, a line, a mark, the way in), so only the still, the line and the mark say what is true. Every state but NONE
 * opens the video-resume screen, which says the rest; NONE is the one state that books. Nothing here names a time: the
 * API says when no render pipeline is working on the film yet, and a card for that must not say "soon".
 */
function FilmCard({ film, onOpen, onBook }: { film: Film; onOpen: () => void; onBook: () => void }) {
  if (film.status === 'NONE') {
    return (
      <Panel tone="muted" style={styles.wellPanel}>
        <Text style={styles.filmTitle}>Your video resume</Text>
        <Text style={styles.sub}>The interview you book becomes your video resume — the one thing employers watch before they read a word.</Text>
        <View style={styles.leftBtn}><Btn label="Book an interview" onPress={onBook} /></View>
      </Panel>
    )
  }
  const { line, mark, action } = describeFilm(film)
  return (
    <Panel style={styles.filmPanel}>
      <View style={styles.filmTop}>
        <FilmThumb status={film.status} width={56} />
        <View style={styles.filmText}>
          <Text style={styles.filmTitle}>Your video resume</Text>
          <Text style={styles.sub}>{line}</Text>
        </View>
      </View>
      <View style={styles.filmFoot}>
        {mark}
        <SmallBtn label={action} onPress={onOpen} />
      </View>
    </Panel>
  )
}

function describeFilm(film: Film): { line: string; mark: React.ReactNode; action: string } {
  switch (film.status) {
    case 'PUBLISHED': {
      // The seal carries the day of the INTERVIEW; `publishedAt` is set once and never moves, so it only stands in when there is no interview date.
      const at = film.interviewedAt ?? film.publishedAt
      return {
        // IC-05: a top-up still owed keeps the film off the feed, and "Employers watch this first" would not be true.
        line: film.held
          ? 'Your video resume is not live yet. A top-up on your interview is outstanding — employers cannot see it until it is settled.'
          : 'The film from your interview. Employers watch this first; any videos you add yourself appear below it, marked as not verified.',
        mark: <VerifiedSeal date={at ? fmtDayMonthYear(at) : undefined} />,
        action: 'Watch my film',
      }
    }
    case 'FAILED':
      return {
        line: 'We could not make a film from your interview. Talk to support and we will look into it.',
        mark: <StatusPill tone="danger" label="Could not be made" />,
        action: 'See details',
      }
    case 'UNPUBLISHED':
      return {
        line: `Your film has been taken down, so employers cannot see it.${film.reason ? ` Reason: ${film.reason}` : ''}`,
        mark: <StatusPill tone="danger" label="Taken down" />,
        action: 'See details',
      }
    default:
      // PROCESSING (NONE is drawn by the caller).
      return {
        line: film.pipelinePending
          ? 'Your interview is done, but your film is not ready yet. We cannot say when it will be. It will appear here once it is.'
          : 'Your interview is done and your film is being prepared. It will appear here when it is ready.',
        mark: <StatusPill tone="warning" label="Processing" />,
        action: 'See details',
      }
  }
}

const KIND_LABEL: Record<SelfVideo['kind'], string> = { INTRO: 'Introduction', PROJECT: 'A project', SKILL: 'A skill' }
const SELF_STATUS: Record<SelfVideo['status'], { label: string; tone: Tone }> = {
  APPROVED: { label: 'Live on your profile', tone: 'success' },
  PENDING: { label: 'Waiting for review', tone: 'warning' },
  REJECTED: { label: 'Not published', tone: 'danger' },
}

/**
 * The student's own short videos, set apart from the verified film: dashed frame on the sunken ground, no seal, and the
 * Unverified mark on every row — the same structural difference the video components draw (self-recorded is never mistaken
 * for the interview). Read from `GET /students/me/videos`; adding, editing and removing happen on the videos screen.
 */
function SelfVideosSection({ query, onManage }: { query: { isPending: boolean; isError: boolean; data?: { videos: SelfVideo[] } }; onManage: () => void }) {
  const videos = query.data?.videos ?? []
  return (
    <View style={styles.selfSection}>
      <View style={styles.sectionHead}>
        <Text style={styles.eyebrow}>Your videos</Text>
        <Pressable accessibilityRole="button" onPress={onManage} style={styles.editBtn} hitSlop={space.sm}>
          <Text style={styles.editText}>Manage videos</Text>
        </Pressable>
      </View>
      {query.isPending ? <View style={{ gap: 10 }}><Skel w="100%" h={16} /><Skel w="100%" h={16} /></View> : query.isError ? (
        <Text style={styles.empty}>Could not load your videos.</Text>
      ) : videos.length === 0 ? (
        <Text style={styles.empty}>No videos yet.</Text>
      ) : videos.map((v, i) => {
        const st = SELF_STATUS[v.status]
        const length = clock(v.durationSec)
        return (
          <View key={v.id} style={[styles.selfRow, i === 0 && styles.selfRowFirst]}>
            <Text style={styles.selfTitle} numberOfLines={1}>{v.title || KIND_LABEL[v.kind]}</Text>
            <Text style={styles.eyebrow}>{[KIND_LABEL[v.kind], length].filter(Boolean).join(' · ')}</Text>
            <View style={styles.selfMarks}>
              <StatusPill tone={st.tone} label={st.label} />
              <UnverifiedMark />
            </View>
          </View>
        )
      })}
    </View>
  )
}

/**
 * ST-35 — the Documents section's files. The résumé is one row of its own:
 * View opens it through the same 15-minute link an employer's download uses;
 * Replace uploads a new file and swaps it in place (the server keeps one
 * résumé); Remove asks first. With no résumé the row offers the upload, under
 * the server's file rule. Each certificate has View. Both save the documents
 * step's whole body — the other files and the links go back as they are.
 */
function DocumentsBlock({ profile, rules }: { profile: Profile; rules?: Record<string, UploadRule> }) {
  const qc = useQueryClient()
  const upload = useProfileUpload()
  const [viewing, setViewing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // An upload outlives the render that started it: the swap is made into the profile as it is THEN.
  const latest = useRef(profile)
  latest.current = profile

  const documents = profile.documents ?? []
  const resume = documents.find((d) => d.kind === 'RESUME') ?? null
  const others = documents.filter((d) => d.kind !== 'RESUME')
  const rule = rules?.RESUME

  const save = useMutation({
    mutationFn: (next: DocEntry[]) =>
      api.patch('/students/me/profile/documents', documentsBody(next, latest.current.portfolioLinks ?? [])),
    // Held pending until the profile has been read again, so the row never shows the old file as current.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
  const busy = save.isPending || upload.uploading

  async function view(id: string) {
    if (viewing) return
    setError(null)
    upload.setError(null)
    setViewing(id)
    const failed = await openOwnDocument(id)
    setViewing(null)
    if (failed) setError(failed)
  }

  async function replace() {
    if (busy) return
    setError(null)
    const done = await upload.run('RESUME', rule)
    if (!done) return
    try {
      await save.mutateAsync(withResume(latest.current.documents ?? [], { kind: 'RESUME', key: done.key, name: done.name }))
    } catch (e) {
      setError(saveErrorText(e))
    }
  }

  async function confirmRemove() {
    const current = latest.current.documents?.find((d) => d.kind === 'RESUME')
    if (!current) return setRemoving(false)
    setRemoveError(null)
    try {
      await save.mutateAsync(withoutDocument(latest.current.documents ?? [], current.key))
      setRemoving(false)
    } catch (e) {
      setRemoveError(saveErrorText(e))
    }
  }

  const resumeName = resume ? resume.name || fileName(resume.key) : ''
  const failure = error ?? upload.error
  return (
    <>
      {upload.uploading ? (
        <View style={styles.uploadBlock}>
          <View style={styles.progressHead}>
            <Text style={styles.sub} numberOfLines={1}>Uploading…</Text>
            <Text style={[text.metaMd, styles.pctText]}>{`${Math.round((upload.progress ?? 0) * 100)}%`}</Text>
          </View>
          <ProgressBar pct={(upload.progress ?? 0) * 100} tone="accent" thin />
          <View style={styles.leftBtn}><SmallBtn label="Cancel" onPress={upload.cancel} /></View>
        </View>
      ) : resume ? (
        <View>
          <DocRow name={resumeName} kind={kindLabel(resume.kind)} />
          <View style={styles.docActions}>
            {save.isPending ? <ActivityIndicator color={color.textMuted} /> : (
              <>
                {!!resume.id && <DocAction label="View" a11y={`View ${resumeName}`} busy={viewing === resume.id} onPress={() => { if (resume.id) view(resume.id) }} />}
                <DocAction label="Replace" a11y="Replace your résumé" onPress={() => { replace() }} />
                <DocAction label="Remove" a11y="Remove your résumé" onPress={() => { setRemoveError(null); setRemoving(true) }} />
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.addResume}>
          {save.isPending ? <ActivityIndicator color={color.textMuted} /> : <SmallBtn label="Add a résumé" onPress={() => { replace() }} />}
          <Text style={styles.xs}>{ruleSentence(rule)}</Text>
        </View>
      )}
      {others.map((d) => {
        const name = d.name || fileName(d.key)
        return (
          <DocRow
            key={d.key}
            name={name}
            kind={kindLabel(d.kind)}
            action={d.id ? <DocAction label="View" a11y={`View ${name}`} busy={viewing === d.id} onPress={() => { if (d.id) view(d.id) }} /> : undefined}
          />
        )
      })}
      {profile.portfolioLinks.map((l) => <Text key={l} style={styles.link}>{l}</Text>)}
      {!!failure && <View style={styles.docBanner}><Banner tone="danger">{failure}</Banner></View>}

      <Sheet open={removing} onClose={() => { if (!save.isPending) setRemoving(false) }} title="Remove this résumé?">
        {!!resumeName && <Body size="sm" weight="medium">{resumeName}</Body>}
        {!!removeError && <Banner tone="danger">{removeError}</Banner>}
        <View style={styles.sheetButtons}>
          <Btn variant="destructive" busy={save.isPending} label="Remove" accessibilityLabel={`Remove ${resumeName}`} onPress={() => { confirmRemove() }} />
          <Btn variant="quiet" label="Keep it" disabled={save.isPending} onPress={() => setRemoving(false)} />
        </View>
      </Sheet>
    </>
  )
}

/** A document's text action, in the section's own Edit style. */
function DocAction({ label, a11y, busy, onPress }: { label: string; a11y: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ busy: !!busy }} disabled={busy} onPress={onPress} style={styles.editBtn} hitSlop={space.sm}>
      {busy ? <ActivityIndicator color={color.accent} /> : <Text style={styles.editText}>{label}</Text>}
    </Pressable>
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
    // A refused field says why ("Keep one résumé…"), which the request's own message does not.
    onError: (e) => setError(saveErrorText(e)),
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
    <Panel style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.eyebrow}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editBtn} hitSlop={space.sm}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>
      <View>{children}</View>
    </Panel>
  )
}

function KV({ k, v }: { k: string; v?: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, !v && styles.kvEmpty]}>{v ?? 'Not set yet'}</Text>
    </View>
  )
}
function DocRow({ name, kind, action }: { name: string; kind: string; action?: React.ReactNode }) {
  return (
    <View style={styles.doc}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M14 3v5h5M7 3h8l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke={color.textMuted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.docName} numberOfLines={1}>{name}</Text>
        <Text style={styles.docKind}>{kind}</Text>
      </View>
      {action}
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

const LABEL = { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'] } as const
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: FF.body, fontSize: 15, color: color.textMuted },
  loading: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30, gap: 10 },
  pressed: { opacity: 0.6 },
  titleBlock: { gap: 4, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6 },
  eyebrow: { ...LABEL, color: color.textMuted },
  title: { fontFamily: FF.bodySemiBold, fontSize: 26, lineHeight: 30, letterSpacing: -0.78, color: color.text },
  sub: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
  xs: { fontFamily: FF.body, fontSize: 12, lineHeight: 17, color: color.textSubtle, marginTop: 2 },
  empty: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textSubtle },
  link: { fontFamily: FF.body, fontSize: 14, color: color.accentText, marginTop: 8 },
  completion: { paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  pct: { fontFamily: FF.bodyMedium, fontSize: 28, letterSpacing: -0.84, fontVariant: ['tabular-nums'], color: color.successFill },
  pctNote: { flex: 1, fontFamily: FF.body, fontSize: 13, color: color.textMuted },
  bar: { height: 4, borderRadius: 3, backgroundColor: color.surfaceSunken, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: color.successFill },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedTitle: { fontFamily: FF.bodyMedium, fontSize: 15, color: color.text },
  filmPanel: { gap: 14 },
  wellPanel: { gap: 10, borderColor: 'transparent' },
  filmTitle: { fontFamily: FF.bodyBold, fontSize: 17, letterSpacing: -0.34, color: color.text },
  leftBtn: { alignItems: 'flex-start' },
  filmTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  filmText: { flex: 1, minWidth: 0, gap: 4 },
  filmFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  smallBtn: { height: 40, minWidth: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  smallBtnText: { fontFamily: FF.bodyBold, fontSize: 14, color: color.text },
  // The self-recorded frame: dashed on the sunken ground, the way the video components set it apart from the verified film.
  selfSection: { gap: 10, backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.borderStrong, borderStyle: 'dashed', borderRadius: 20, padding: 16 },
  selfRow: { gap: 4, paddingTop: 10, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  selfRowFirst: { paddingTop: 0, borderTopWidth: 0 },
  selfTitle: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.text },
  selfMarks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  editBtn: { minHeight: 32, justifyContent: 'center' },
  editText: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.accent },
  kv: { gap: 2, marginBottom: 12 },
  kvKey: { ...LABEL, color: color.textSubtle },
  kvVal: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.text },
  kvEmpty: { color: color.textSubtle },
  xp: { gap: 3, paddingVertical: 14, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  xpFirst: { paddingTop: 0, borderTopWidth: 0 },
  xpRole: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: { height: 32, borderRadius: 16, paddingHorizontal: 13, justifyContent: 'center', backgroundColor: color.surfaceMuted },
  skillPending: { backgroundColor: 'transparent', borderWidth: borderWidth.thin, borderColor: color.borderStrong, borderStyle: 'dashed' },
  skillText: { fontFamily: FF.bodyMedium, fontSize: 14, color: color.text },
  skillTextPending: { color: color.textMuted },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: color.surfaceMuted, padding: 12, marginTop: 4 },
  docName: { fontFamily: FF.body, fontSize: 14, color: color.text },
  docKind: { ...LABEL, color: color.textSubtle },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xs },
  addResume: { alignItems: 'flex-start', gap: space.sm },
  uploadBlock: { gap: space.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  pctText: { color: color.text },
  docBanner: { marginTop: space.sm },
  sheetButtons: { marginTop: space.sm, gap: space.sm },
})
