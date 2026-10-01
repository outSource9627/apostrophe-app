import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../lib/api'
import { color, space, spaceHalf, borderWidth, fontFamilyNative as FF } from '../theme'
import { Banner, Body, Button, Eyebrow, Figure, Meta, ProgressBar, ScreenHeader, StatusPill, text } from '../components/ui'
import { Btn, DetailHeader, Skel, StateBlock } from '../components/tab/kit'
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

  if (profileQ.isError || configQ.isError) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <DetailHeader title="Profile" onBack={onExit} />
        <StateBlock
          icon="alert"
          title="Could not load your profile."
          body="Check your connection and try again."
          action="Try again"
          onAction={() => { profileQ.refetch(); configQ.refetch() }}
        />
      </View>
    )
  }

  if (profileQ.isPending || configQ.isPending || !stepKey || !profile) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <DetailHeader title="Profile" onBack={onExit} />
        <View style={styles.loading}><Skel w="100%" h={22} /><Skel w="100%" h={36} /><Skel w="100%" h={56} /><Skel w="100%" h={56} /><Skel w="100%" h={56} /><Skel w="100%" h={56} /></View>
      </View>
    )
  }

  const steps = configQ.data!.profile.steps
  const current = steps.find((s) => s.key === stepKey)!
  const isLast = current.step === steps.length
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
      <DetailHeader
        title="Profile"
        onBack={onExit}
        right={
          <Pressable accessibilityRole="button" onPress={onExit} hitSlop={8} style={styles.saveExit}>
            <Text style={styles.saveExitText}>Save &amp; exit</Text>
          </Pressable>
        }
      />
      <View style={styles.bars}>
        {steps.map((st) => (
          <View key={st.step} style={styles.barHit}>
            <View style={[styles.bar, st.step < current.step && styles.barDone, st.step === current.step && styles.barOn]} />
          </View>
        ))}
      </View>

      <View style={styles.gate}>
        <Text style={styles.gateText}>{online ? `NOW ${comp.pct}%` : `${comp.pct}% AS OF ${savedAt ? clockTime(savedAt).toUpperCase() : 'LAST SAVE'}`}</Text>
        <Text style={[styles.gateText, { color: color.text }]}>{comp.canBook ? `PAST ${gate}%` : `BOOK AT ${gate}% · ${toGo}% TO GO`}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepEyebrow}>
          {`STEP ${current.step} OF ${steps.length}${OPTIONAL.has(stepKey) ? ' · OPTIONAL' : ''}`}
        </Text>
        <Text style={styles.stepTitle}>{current.label}</Text>
        {!online && (
          <View style={styles.bannerGap}>
            <Banner
              tone="info"
              title="Offline"
              reference={queued > 0 ? `Queued · ${queued} ${queued === 1 ? 'change' : 'changes'}` : undefined}
            >
              What you type is saved on this phone and syncs the moment you are back. Keep going — nothing is lost.
            </Banner>
          </View>
        )}
        {banner ? <View style={styles.bannerGap}><Banner tone={banner.tone}>{banner.text}</Banner></View> : null}
        <Body_ draft={draft} patch={patch} config={configQ.data as Config} profile={profile} />
        <StillNeeded comp={comp} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.savedRow}>
          {saving === 'saved' && <View style={styles.savedDot} />}
          <Text style={[styles.saveText, saving === 'queued' && { color: color.info }]}>
            {saving === 'saving' ? 'SAVING…' : saving === 'saved' ? `SAVED${savedAt ? ` · ${clockTime(savedAt).toUpperCase()}` : ''}` : saving === 'queued' ? `QUEUED${queued > 1 ? ` · ${queued}` : ''} · WILL SYNC` : 'SAVES AS YOU TYPE'}
          </Text>
        </View>
        <View style={styles.footRow}>
          {current.step > 1 && <Btn variant="outline" label="Back" style={styles.footBtn} onPress={() => goTo(steps.find((s) => s.step === current.step - 1)!.key as StepKey, profile)} />}
          <Btn variant="ink" label={isLast ? 'Finish' : 'Continue'} busy={busy} style={styles.footBtnGrow} onPress={next} />
        </View>
      </View>
    </View>
  )
}

function StillNeeded({ comp }: { comp: Completion }) {
  if (comp.blockers.length === 0 && comp.missing.length === 0) return null
  return (
    <View style={styles.needed}>
      <Text style={styles.stepEyebrow}>{comp.canBook ? 'READY TO BOOK' : 'STILL NEEDED'}</Text>
      {comp.blockers.map((b) => (
        <View key={b} style={styles.neededRow}>
          <Text style={styles.neededText}>{b}</Text>
          <StatusPill tone="warning" label="required" />
        </View>
      ))}
      {comp.missing.length > 0 && <Text style={styles.neededSub}>Still to fill in: {comp.missing.join(' · ')}</Text>}
    </View>
  )
}

function DoneView({ insets, comp, gate, onBook, onBack }: { insets: { top: number; bottom: number }; comp: Completion; gate: number; onBook: () => void; onBack: () => void }) {
  const toGo = Math.max(0, gate - Math.floor(comp.pct))
  const short = comp.steps.filter((s) => !s.optional && s.missing.length > 0)
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader title="Profile" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.doneScroll}>
        {comp.canBook ? (
          <>
            <Eyebrow tone="accent">Profile complete</Eyebrow>
            <Text style={[text.displayHeading, styles.doneTitle]}>Now for the interview.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg }}>
              <Figure value={`${comp.pct}%`} />
              <StatusPill tone="success" label="ready to book" />
            </View>
            <Body tone="muted" style={{ marginTop: space.lg }}>Book a slot and a real interviewer will take you through it — that recording becomes the profile employers watch.</Body>
            <View style={{ marginTop: space['2xl'] }}><Button variant="primary" size="lg" full label="Book an interview" onPress={onBook} /></View>
          </>
        ) : (
          <>
            <Eyebrow tone="accent">Almost there</Eyebrow>
            <Text style={[text.displayHeading, styles.doneTitle]}>{comp.pct}% of the way.</Text>
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

const MONO = { fontFamily: FF.monoMedium, fontSize: 11 } as const
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  loading: { padding: 20, gap: 14 },
  saveExit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  saveExitText: { fontFamily: FF.bodyMedium, fontSize: 15, color: color.textMuted },
  bars: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 4 },
  barHit: { flex: 1, height: 22, justifyContent: 'center' },
  bar: { height: 4, borderRadius: 3, backgroundColor: color.surfaceSunken },
  barDone: { backgroundColor: color.accentMuted },
  barOn: { backgroundColor: color.accent },
  gate: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 6 },
  gateText: { ...MONO, letterSpacing: 1.54, color: color.textSubtle },
  stepEyebrow: { ...MONO, letterSpacing: 0.88, color: color.accent },
  stepTitle: { fontFamily: FF.bodySemiBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.55, color: color.text, marginTop: 6, marginBottom: 16 },
  bannerGap: { marginBottom: 16 },
  scroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 },
  needed: { marginTop: 24, borderRadius: 12, backgroundColor: color.surfaceMuted, padding: 16, gap: 8 },
  neededRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  neededText: { flex: 1, fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.text },
  neededSub: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted, marginTop: 4 },
  doneSection: { paddingVertical: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  footer: { backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingHorizontal: 24, paddingTop: 12, gap: 8 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.successFill },
  saveText: { ...MONO, letterSpacing: 1.54, color: color.textSubtle },
  footRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  footBtn: { height: 52 },
  footBtnGrow: { height: 52, flex: 1 },
  // DoneView (the finish screen) keeps its own layout.
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { marginTop: space.xs + space['2xs'], marginBottom: space.lg },
  doneScroll: { paddingHorizontal: spaceHalf['6'], paddingTop: spaceHalf['6'], paddingBottom: space['4xl'] },
})
