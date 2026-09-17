import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api, ApiClientError } from '../lib/api'
import { color, space, radius, borderWidth } from '../theme'
import { AppBar, Banner, Body, Button, Display, Eyebrow, Figure, Meta, ProgressBar, StatusPill } from '../components/ui'
import { useOnline } from '../lib/useOnline'
import { clockTime, dequeue, enqueue, peek, readQueue, type StepKey } from '../lib/profile/queue'
import {
  PersonalStep, EducationStep, ExperienceStep, SkillsStep, PreferencesStep, DocumentsStep,
  type Config, type StepProps,
} from './profile/wizardSteps'

interface CompletionStep { step: number; key: string; label: string; weight: number; earned: number; optional: boolean; missing: string[] }
interface Completion { pct: number; canBook: boolean; missing: string[]; blockers: string[]; steps: CompletionStep[] }
interface Profile {
  photoKey: string | null
  dateOfBirth: string | null
  gender: string | null
  city: string | null
  languages: string[]
  education: Record<string, unknown> | null
  experience: { id?: string; company?: string; role?: string; from?: string; to?: string }[]
  skills: { name: string; status: string }[]
  preferences: Record<string, unknown> | null
  documents: { kind: string; key: string; name?: string }[]
  portfolioLinks: string[]
  stepsCompleted: number[]
  resumeStep: number
  completion: Completion
}

const AUTOSAVE_MS = 1200
const OPTIONAL = new Set(['experience', 'documents'])
const BODIES: Record<StepKey, (p: StepProps) => React.ReactElement> = {
  personal: PersonalStep, education: EducationStep, experience: ExperienceStep,
  skills: SkillsStep, preferences: PreferencesStep, documents: DocumentsStep,
}

function draftFor(step: StepKey, p: Profile): Record<string, unknown> {
  switch (step) {
    case 'personal': return { photoKey: p.photoKey ?? undefined, dateOfBirth: p.dateOfBirth?.slice(0, 10), gender: p.gender ?? undefined, city: p.city ?? undefined, languages: p.languages ?? [] }
    case 'education': return { ...(p.education ?? {}) }
    case 'experience': return { experience: (p.experience ?? []).map((e) => ({ ...e, from: e.from?.slice(0, 10), to: e.to?.slice(0, 10) })) }
    case 'skills': return { skills: (p.skills ?? []).map((s) => s.name) }
    case 'preferences': return { ...(p.preferences ?? {}) }
    case 'documents': return { documents: (p.documents ?? []).map(({ kind, key, name }) => ({ kind, key, name })), portfolioLinks: p.portfolioLinks ?? [] }
  }
}

type SaveState = 'idle' | 'saving' | 'saved' | 'queued'

/**
 * ST-13 → ST-19 — the six-step profile wizard, the app half of the web flow:
 * per-step autosave, an offline queue that survives the tab, a gate that shows
 * the distance to book, and a completion screen that either unlocks booking or
 * names exactly what is missing.
 */
export function ProfileWizardScreen({ onExit, onBook }: { onExit: () => void; onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const online = useOnline()
  const profileQ = useQuery({ queryKey: ['profile'], queryFn: () => api.get<Profile>('/students/me/profile') })
  const configQ = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config & { profile: { steps: { key: string; step: number; label: string }[] }; booking: { minProfileCompletionPct: number } }>('/config') })

  const [stepKey, setStepKey] = useState<StepKey | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [queued, setQueued] = useState(0)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showDone, setShowDone] = useState(false)

  const draftRef = useRef(draft); useEffect(() => { draftRef.current = draft }, [draft])
  const stepRef = useRef<StepKey | null>(stepKey); useEffect(() => { stepRef.current = stepKey }, [stepKey])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Seed from the server, preferring anything queued offline (strictly newer).
  useEffect(() => {
    if (!profileQ.data || !configQ.data || stepKey !== null) return
    const p = profileQ.data
    setProfile(p)
    const steps = configQ.data.profile.steps
    const key = (steps.find((s) => s.step === p.resumeStep)?.key as StepKey) ?? 'personal'
    void (async () => {
      const pending = await peek(key)
      setStepKey(key)
      setDraft(pending?.draft ?? draftFor(key, p))
      const depth = (await readQueue()).length
      setQueued(depth)
      if (depth > 0) setSaving('queued')
    })()
  }, [profileQ.data, configQ.data, stepKey])

  const commit = useCallback(async (complete: boolean): Promise<Profile | null> => {
    const step = stepRef.current
    if (!step) return null
    const body = draftRef.current
    if (!online) {
      setQueued(await enqueue(step, body)); setSaving('queued'); setBusy(false); return null
    }
    setSaving('saving')
    try {
      const next = await api.patch<Profile>(`/students/me/profile/${step}`, body, { query: { complete } })
      await dequeue(step); setQueued((await readQueue()).length)
      setProfile(next); setSaving('saved'); setSavedAt(new Date())
      return next
    } catch (e) {
      if (!(e instanceof ApiClientError)) { setQueued(await enqueue(step, body)); setSaving('queued'); return null }
      setSaving('idle')
      if (complete) setBanner({ tone: 'danger', text: e.message })
      return null
    } finally { setBusy(false) }
  }, [online])

  // Reconnect: drain the queue oldest-first.
  useEffect(() => {
    if (!online) return
    let live = true
    void (async () => {
      const pending = await readQueue()
      if (pending.length === 0) return
      for (const q of pending) {
        try { const next = await api.patch<Profile>(`/students/me/profile/${q.step}`, q.draft, { query: { complete: false } }); if (!live) return; await dequeue(q.step); setProfile(next) }
        catch { break }
      }
      if (!live) return
      const left = (await readQueue()).length
      setQueued(left)
      if (left === 0) { setSaving('saved'); setSavedAt(new Date()) }
    })()
    return () => { live = false }
  }, [online])

  const patch = useCallback((next: Record<string, unknown>) => {
    setDraft((d) => ({ ...d, ...next }))
    setSaving((s) => (s === 'queued' ? s : 'idle'))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void commit(false), AUTOSAVE_MS)
  }, [commit])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (profileQ.isPending || configQ.isPending || !stepKey || !profile) {
    return <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}><ActivityIndicator color={color.textSubtle} /></View>
  }

  const steps = configQ.data!.profile.steps
  const current = steps.find((s) => s.key === stepKey)!
  const isLast = current.step === steps.length
  const done = new Set(profile.stepsCompleted)
  const gate = configQ.data!.booking.minProfileCompletionPct ?? 80
  const comp = profile.completion
  const Body_ = BODIES[stepKey]

  const goTo = (key: StepKey, p: Profile) => {
    if (timer.current) clearTimeout(timer.current)
    void (async () => {
      const pending = await peek(key)
      setStepKey(key); setDraft(pending?.draft ?? draftFor(key, p))
      setSaving(pending ? 'queued' : 'idle'); setBanner(null)
    })()
  }

  const next = async () => {
    setBusy(true)
    if (timer.current) clearTimeout(timer.current)
    const wasOffline = !online
    const saved = await commit(true)
    if (!saved) {
      if (wasOffline) setBanner({ tone: 'info', text: 'You are offline. This step is saved on your phone and syncs when you are back — carry on, or wait here.' })
      return
    }
    if (isLast) { setProfile(saved); setShowDone(true); return }
    goTo(steps.find((s) => s.step === current.step + 1)!.key as StepKey, saved)
  }

  if (showDone) return <DoneView insets={insets} comp={profile.completion} gate={gate} onBook={onBook} onBack={() => setShowDone(false)} />

  const toGo = Math.max(0, gate - Math.floor(comp.pct))

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Save & exit" onBack={onExit} />

      {!online && (
        <View style={styles.offline}>
          <View style={styles.offlineHead}>
            <Meta style={{ color: color.info }}>OFFLINE</Meta>
            {queued > 0 && <StatusPill tone="info" label={`Queued · ${queued} ${queued === 1 ? 'change' : 'changes'}`} />}
          </View>
          <Body size="sm" style={{ color: color.info }}>What you type is saved on this phone and syncs the moment you are back. Keep going — nothing is lost.</Body>
        </View>
      )}

      <View style={styles.gate}>
        <View style={styles.segments}>
          {steps.map((s) => (
            <View key={s.step} style={[styles.segment, done.has(s.step) && { backgroundColor: color.success }, s.key === stepKey && { backgroundColor: color.accent }]} />
          ))}
        </View>
        <View style={styles.gateLabels}>
          <Meta style={{ color: color.textSubtle }}>{online ? `NOW ${comp.pct}%` : `${comp.pct}% AS OF ${savedAt ? clockTime(savedAt).toUpperCase() : 'LAST SAVE'}`}</Meta>
          <Meta style={{ color: color.text }}>{comp.canBook ? `PAST ${gate}%` : `BOOK AT ${gate}% · ${toGo}% TO GO`}</Meta>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Eyebrow>Step {current.step} of {steps.length}{OPTIONAL.has(stepKey) ? ' · optional' : ''}</Eyebrow>
        <Display level="lg" style={{ marginTop: space.xs, marginBottom: space.lg }}>{current.label}</Display>
        {banner ? <View style={{ marginBottom: space.lg }}><Banner tone={banner.tone}>{banner.text}</Banner></View> : null}
        <Body_ draft={draft} patch={patch} config={configQ.data as Config} profile={profile} />
        <StillNeeded comp={comp} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.savedRow}>
          {saving === 'saved' && <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M20 6 9 17l-5-5" stroke={color.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
          <Meta style={{ color: saving === 'queued' ? color.info : color.textSubtle }}>
            {saving === 'saving' ? 'SAVING…' : saving === 'saved' ? `SAVED${savedAt ? ` · ${clockTime(savedAt).toUpperCase()}` : ''}` : saving === 'queued' ? `QUEUED${queued > 1 ? ` · ${queued}` : ''} · WILL SYNC` : 'SAVES AS YOU TYPE'}
          </Meta>
        </View>
        <View style={styles.footRow}>
          {current.step > 1 && <Button variant="outline" size="md" label="Back" onPress={() => goTo(steps.find((s) => s.step === current.step - 1)!.key as StepKey, profile)} />}
          <View style={{ flex: 1 }}>
            <Button variant="primary" size="md" full busy={busy} label={isLast ? 'Finish' : 'Continue'} onPress={next} />
          </View>
        </View>
      </View>
    </View>
  )
}

function StillNeeded({ comp }: { comp: Completion }) {
  if (comp.blockers.length === 0 && comp.missing.length === 0) return null
  return (
    <View style={styles.needed}>
      <Eyebrow tone={comp.canBook ? undefined : 'accent'}>{comp.canBook ? 'Ready to book' : 'Still needed'}</Eyebrow>
      {comp.blockers.map((b) => (
        <View key={b} style={styles.neededRow}>
          <Body size="sm" style={{ flex: 1 }}>{b}</Body>
          <StatusPill tone="warning" label="required" />
        </View>
      ))}
      {comp.missing.length > 0 && <Body size="sm" tone="muted" style={{ marginTop: space.xs }}>Still to fill in: {comp.missing.join(' · ')}</Body>}
    </View>
  )
}

function DoneView({ insets, comp, gate, onBook, onBack }: { insets: { top: number; bottom: number }; comp: Completion; gate: number; onBook: () => void; onBack: () => void }) {
  const toGo = Math.max(0, gate - Math.floor(comp.pct))
  const short = comp.steps.filter((s) => !s.optional && s.missing.length > 0)
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Profile" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {comp.canBook ? (
          <>
            <Eyebrow>Profile complete</Eyebrow>
            <Display level="lg" style={{ marginTop: space.xs }}>Now for the interview.</Display>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg }}>
              <Figure value={`${comp.pct}%`} />
              <StatusPill tone="success" label="ready to book" />
            </View>
            <Body tone="muted" style={{ marginTop: space.lg }}>Book a slot and a real interviewer will take you through it — that recording becomes the profile employers watch.</Body>
            <View style={{ marginTop: space['2xl'] }}><Button variant="primary" size="lg" full label="Book an interview" onPress={onBook} /></View>
          </>
        ) : (
          <>
            <Eyebrow>Almost there</Eyebrow>
            <Display level="lg" style={{ marginTop: space.xs }}>{comp.pct}% of the way.</Display>
            <View style={{ marginTop: space.lg }}>
              <ProgressBar pct={comp.pct} gate={gate} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
                <Meta style={{ color: color.textSubtle }}>NOW {comp.pct}%</Meta>
                <Meta style={{ color: color.text }}>BOOK AT {gate}% · {toGo}% TO GO</Meta>
              </View>
            </View>
            {comp.blockers.length > 0 && <Body tone="muted" style={{ marginTop: space.lg }}>Some items below are required outright — no percentage buys them.</Body>}
            <View style={{ marginTop: space.lg }}>
              {short.map((s) => (
                <View key={s.key} style={styles.doneSection}>
                  <View style={styles.neededRow}>
                    <Eyebrow>{s.label} · step {s.step}</Eyebrow>
                    <Meta style={{ color: color.textSubtle }}>{s.earned} / {s.weight} PTS</Meta>
                  </View>
                  {s.missing.map((mi) => {
                    // A blocker is not a missing field: the qualification doc and
                    // the third skill are required outright. Tag those lines.
                    const docBlocked = comp.blockers.some((b) => b.toLowerCase().includes('document'))
                    const skillBlocked = comp.blockers.some((b) => b.toLowerCase().includes('skill'))
                    const required =
                      (s.key === 'education' && docBlocked && mi.toLowerCase().includes('document')) ||
                      (s.key === 'skills' && skillBlocked)
                    return (
                      <View key={mi} style={styles.neededRow}>
                        <Body size="sm" style={{ flex: 1, marginTop: space.xs }}>{mi}</Body>
                        {required && <StatusPill tone="warning" label="required" />}
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
            <View style={{ marginTop: space['2xl'], gap: space.md }}>
              <Button variant="primary" size="lg" full label="Finish your profile" onPress={onBack} />
              <Button variant="secondary" size="md" full disabled reason={`Locked until you reach ${gate}%. You are at ${comp.pct}%.`} label="Book an interview" />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { alignItems: 'center', justifyContent: 'center' },
  offline: { backgroundColor: color.infoSoft, paddingHorizontal: space.xl, paddingVertical: space.md, gap: space.xs },
  offlineHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gate: { paddingHorizontal: space.xl, paddingVertical: space.md, gap: space.sm, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  segments: { flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: color.surfaceSunken },
  gateLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scroll: { padding: space.xl, paddingBottom: space['4xl'] },
  needed: { marginTop: space['2xl'], borderRadius: radius.md, backgroundColor: color.surfaceMuted, padding: space.lg, gap: space.sm },
  neededRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  doneSection: { paddingVertical: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  footer: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  footRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
})
