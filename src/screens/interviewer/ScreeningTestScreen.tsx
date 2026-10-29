import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  borderWidth, color, fontFamilyNative as FF, fontSize, height, leadingNative, opacity, radius, space, spaceHalf, trackingNative,
} from '../../theme'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Icon, type IconName } from '../../components/ui/Icon'
import { Toast } from '../../components/ui/overlay'
import { text } from '../../components/ui/typography'
import { BrandScreen, SheetTitle } from '../../components/auth/kit'
import { EmFoot } from '../../components/employer/em'
import {
  ArrowButton, OfflineBanner, OptionCard, QuestionHead, QuestionMap, QuestionText, SavedMark, ScreeningDialog, SectionStrips, StateBlock, TestBar,
} from '../../components/interviewer/screening'
import { CONNECTION_DROPPED, messageOf } from '../employer/EmployerRegisterScreen'
import {
  getScreening, getScreeningAttempt, isUnknownToken, saveScreeningAnswer, screeningRefusal, startScreening, submitScreening,
  type ScreeningAttempt, type ScreeningQuestion, type ScreeningState,
} from '../../lib/api/screening'
import {
  LOW_TIME_MS, PREPARING_RETRY_MS, SECTION_NAME, answeredCount, clockSync, closedState, mmss, remainingMs, sectionRuns,
  type ClockSync, type ClosedState,
} from '../../lib/interviewer/screening'
import { forgetScreening, patchScreening, readScreening } from '../../lib/interviewer/screeningStore'
import { fmtDayMon } from '../../lib/chat/format'
import { useOnline } from '../../lib/useOnline'
import { SUPPORT_EMAIL } from '../../lib/support'
import type { RootStackParamList } from '../../../App'

type Phase =
  | { k: 'loading' }
  | { k: 'error'; message: string }
  | { k: 'rules' }
  | { k: 'preparing' }
  | { k: 'test' }
  | { k: 'submitted' }
  | ClosedState

const TERMINAL = new Set<Phase['k']>(['submitted', 'timeup', 'already', 'expired'])

/** The rules, word for word (build spec · client copy). */
const RULES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'clock', title: 'The clock keeps running', body: 'If you leave, time still counts. At zero, your answers are submitted.' },
  { icon: 'check', title: 'Answers save as you go', body: 'Lose your connection? Open the test again and carry on.' },
  { icon: 'grid', title: 'Move freely', body: 'Skip, come back, change an answer, until you submit.' },
  { icon: 'test', title: 'One attempt', body: 'Once you start, the test can’t be restarted.' },
]

const TOAST_MS = 4000

/**
 * The interviewer screening test (docs/screening-test-mockups.html · app,
 * screens 2–6 and the edge states), reached from "Application received." or
 * Join us with the token kept on this phone. One route, one state machine:
 *
 *   loading → rules ("Before you start") → [preparing] → test → submitted
 *                                    ↘ timeup · already · expired
 *
 * The server owns the clock: the time left is `deadlineAt − serverNow` at the
 * last fetch minus what this phone has counted since (lib/interviewer/
 * screening), re-synced on every return to the foreground and every
 * reconnect. At zero the phone submits (the server also does, at the deadline).
 * A pick is PUT the moment it is tapped; one the server has not confirmed is
 * kept on this phone and sent again on reconnect, every 10 s, and when the test
 * is opened again. Back during the test asks first, because the clock keeps
 * running. No score is shown, ever — the API does not send one.
 */
export function ScreeningTestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { token } = useRoute<RouteProp<RootStackParamList, 'InterviewerScreening'>>().params
  const insets = useSafeAreaInsets()
  const online = useOnline()

  const [phase, setPhaseState] = useState<Phase>({ k: 'loading' })
  const [info, setInfo] = useState<ScreeningState | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [startBusy, setStartBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const [questions, setQuestions] = useState<ScreeningQuestion[]>([])
  const [answers, setAnswers] = useState<Array<number | null>>([])
  const [pos, setPos] = useState(0)
  const [sync, setSync] = useState<ClockSync | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [, setPendingRev] = useState(0)

  const [mapOpen, setMapOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'danger' } | null>(null)

  // What callbacks, timers and listeners read without going stale.
  const phaseRef = useRef<Phase['k']>('loading')
  const infoRef = useRef<ScreeningState | null>(null)
  const questionsRef = useRef<ScreeningQuestion[]>([])
  const answersRef = useRef<Array<number | null>>([])
  const pending = useRef(new Map<number, number | null>())
  const inflight = useRef(new Set<number>())
  const closing = useRef(false)
  const finishing = useRef(false)
  const warned = useRef(false)
  const leaving = useRef(false)
  const leaveAction = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null)
  const mounted = useRef(true)
  const prepTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const tryStartRef = useRef<() => void>(() => {})

  const setPhase = (p: Phase) => {
    phaseRef.current = p.k
    if (mounted.current) setPhaseState(p)
  }
  const bump = () => { if (mounted.current) setPendingRev((n) => n + 1) }

  function showToast(message: string, tone: 'neutral' | 'danger' = 'neutral') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, tone })
    toastTimer.current = setTimeout(() => { if (mounted.current) setToast(null) }, TOAST_MS)
  }

  /** Out of the test for good: submitted here, out of time, taken already or expired. */
  function land(p: ClosedState | { k: 'submitted' }) {
    if (TERMINAL.has(phaseRef.current)) return // the first word on how it ended stands
    closing.current = true
    finishing.current = true
    if (prepTimer.current) clearTimeout(prepTimer.current)
    setMapOpen(false)
    setSubmitOpen(false)
    setLeaveOpen(false)
    forgetScreening(token)
    setPhase(p)
  }

  /** Ask the server where the test stands after a refusal, and land there; `fallback` when it can't be asked. */
  async function closeOut(fallback: () => void) {
    if (closing.current) return
    closing.current = true
    try {
      const s = await getScreening(token)
      const closed = closedState(s)
      if (closed) return land(closed)
      closing.current = false
      if (s.status === 'IN_PROGRESS' && s.deadlineAt) {
        setSync(clockSync(s.deadlineAt, s.serverNow, Date.now()))
        setNow(Date.now())
      }
    } catch (e) {
      if (isUnknownToken(e)) return land({ k: 'expired', until: null })
      closing.current = false
      fallback()
    }
  }

  function persistPending() {
    patchScreening(token, { pending: Object.fromEntries(pending.current) })
  }

  /** Send one pick. A newer pick made while this one was in flight goes straight after it. */
  async function push(index: number): Promise<void> {
    if (inflight.current.has(index) || !pending.current.has(index) || closing.current) return
    const option = pending.current.get(index) ?? null
    inflight.current.add(index)
    let refused = false
    try {
      await saveScreeningAnswer(token, index, option)
      if (pending.current.has(index) && pending.current.get(index) === option) {
        pending.current.delete(index)
        persistPending()
        bump()
      }
    } catch (e) {
      const reason = screeningRefusal(e)
      if (reason === 'DEADLINE_PASSED') {
        refused = true
        closeOut(() => land({ k: 'timeup', answered: answeredCount(answersRef.current), total: questionsRef.current.length }))
      } else if (reason === 'SUBMITTED') {
        refused = true
        closeOut(() => land({ k: 'already', on: null }))
      } else if (isUnknownToken(e)) {
        refused = true
        land({ k: 'expired', until: null })
      }
      // Anything else (no network, rate-limited, a 5xx) stays pending and goes again.
    } finally {
      inflight.current.delete(index)
    }
    if (!refused && pending.current.has(index) && pending.current.get(index) !== option) await push(index)
  }

  const flushAll = () => Promise.all([...pending.current.keys()].map((i) => push(i)))

  /** Into the test with the attempt the server sent (start or resume). */
  async function enter(a: ScreeningAttempt) {
    if (a.status === 'SUBMITTED') {
      return closeOut(() => land({ k: 'already', on: null }))
    }
    const qs = [...a.questions].sort((x, y) => x.index - y.index)
    const ans: Array<number | null> = []
    qs.forEach((q) => { ans[q.index] = a.answers[q.index] ?? null })

    // Picks this phone made but the server never confirmed (offline, or the app was closed).
    pending.current.clear()
    const kept = await readScreening()
    if (kept?.token === token) {
      setEmail(kept.email)
      for (const [k, v] of Object.entries(kept.pending ?? {})) {
        const i = Number(k)
        const valid = v === null || (typeof v === 'number' && v >= 0 && v < 4)
        if (valid && qs.some((q) => q.index === i)) {
          pending.current.set(i, v)
          ans[i] = v
        }
      }
    }
    patchScreening(token, { deadlineAt: a.deadlineAt })

    questionsRef.current = qs
    answersRef.current = ans
    setQuestions(qs)
    setAnswers(ans)
    const firstOpen = qs.findIndex((q) => ans[q.index] == null)
    setPos(firstOpen >= 0 ? firstOpen : 0)
    setSync(clockSync(a.deadlineAt, a.serverNow, Date.now()))
    setNow(Date.now())
    setPhase({ k: 'test' })
    flushAll()
  }

  async function openAttempt() {
    try {
      await enter(await getScreeningAttempt(token))
    } catch (e) {
      if (screeningRefusal(e) === 'NOT_STARTED') return setPhase({ k: 'rules' })
      if (isUnknownToken(e)) return land({ k: 'expired', until: null })
      setPhase({ k: 'error', message: messageOf(e) })
    }
  }

  async function load() {
    closing.current = false
    finishing.current = false
    setPhase({ k: 'loading' })
    try {
      const s = await getScreening(token)
      infoRef.current = s
      setInfo(s)
      const closed = closedState(s)
      if (closed) return land(closed)
      if (s.status === 'IN_PROGRESS') return openAttempt()
      setPhase({ k: 'rules' })
    } catch (e) {
      if (isUnknownToken(e)) return land({ k: 'expired', until: null })
      setPhase({ k: 'error', message: messageOf(e) })
    }
  }

  /** Start (or, while getting ready, ask again). PREPARING means the clock has not started. */
  async function tryStart() {
    if (prepTimer.current) clearTimeout(prepTimer.current)
    try {
      await enter(await startScreening(token))
    } catch (e) {
      const reason = screeningRefusal(e)
      const again = () => { prepTimer.current = setTimeout(() => tryStartRef.current(), PREPARING_RETRY_MS) }
      if (reason === 'PREPARING') {
        setPhase({ k: 'preparing' })
        again()
      } else if (reason === 'EXPIRED') {
        land({ k: 'expired', until: infoRef.current?.expiresAt ?? null })
      } else if (reason === 'SUBMITTED') {
        closeOut(() => land({ k: 'already', on: null }))
      } else if (isUnknownToken(e)) {
        land({ k: 'expired', until: null })
      } else if (phaseRef.current === 'preparing') {
        again() // Still getting ready; a dropped request is just asked again.
      } else {
        setStartError(messageOf(e))
      }
    }
  }
  tryStartRef.current = () => { tryStart() }

  async function begin() {
    if (startBusy) return
    setStartBusy(true)
    setStartError(null)
    await tryStart()
    if (mounted.current) setStartBusy(false)
  }

  /** Back in the foreground or online again: take the server's clock, and its word on whether the test is still open. */
  async function resync() {
    try {
      const s = await getScreening(token)
      const closed = closedState(s)
      if (closed) return land(closed)
      if (s.status === 'IN_PROGRESS' && s.deadlineAt) {
        setSync(clockSync(s.deadlineAt, s.serverNow, Date.now()))
        setNow(Date.now())
      }
    } catch {
      /* The phone's own count carries on until the next sync. */
    }
  }

  /** Zero on the clock: send what is left and submit. The server does the same at the deadline. */
  async function finishOnTime() {
    if (finishing.current) return
    finishing.current = true
    setMapOpen(false)
    setSubmitOpen(false)
    setLeaveOpen(false)
    await flushAll()
    try {
      const r = await submitScreening(token)
      land({ k: 'timeup', answered: r.answered, total: r.total })
    } catch (e) {
      if (isUnknownToken(e)) return land({ k: 'expired', until: null })
      land({ k: 'timeup', answered: answeredCount(answersRef.current), total: questionsRef.current.length })
    }
  }

  async function submitNow() {
    if (submitBusy || finishing.current) return
    setSubmitBusy(true)
    finishing.current = true
    const failed = (message: string) => {
      finishing.current = false
      if (!mounted.current) return
      setSubmitBusy(false)
      setSubmitOpen(false) // so the toast reads clear of the scrim
      showToast(message, 'danger')
    }
    await flushAll()
    // A pick the server hasn't got would be lost by submitting now; the clock still submits at zero.
    if (pending.current.size && !closing.current) return failed(CONNECTION_DROPPED)
    try {
      // Idempotent: if a refusal has already closed the test, `land` keeps that screen.
      await submitScreening(token)
      land({ k: 'submitted' })
    } catch (e) {
      if (isUnknownToken(e)) return land({ k: 'expired', until: null })
      failed(messageOf(e))
    }
  }

  function choose(option: number) {
    const q = questionsRef.current[pos]
    if (!q || phaseRef.current !== 'test' || finishing.current) return
    if (answersRef.current[q.index] === option && !pending.current.has(q.index)) return
    const next = answersRef.current.slice()
    next[q.index] = option
    answersRef.current = next
    setAnswers(next)
    pending.current.set(q.index, option)
    persistPending()
    bump()
    push(q.index)
  }

  function go(to: number) {
    setPos(Math.max(0, Math.min(questionsRef.current.length - 1, to)))
    scroller.current?.scrollTo({ y: 0, animated: false })
  }

  /** Join us is under the apply flow; leaving goes back to it, where a test still open is offered again. */
  const joinUsBelow = () => navigation.getState().routes.some((r) => r.name === 'JoinUs')
  function done() {
    leaving.current = true
    if (joinUsBelow()) navigation.popTo('JoinUs')
    else navigation.navigate('JoinUs')
  }

  // ── effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    mounted.current = true
    readScreening().then((kept) => { if (kept?.token === token && mounted.current) setEmail(kept.email) })
    load()
    return () => {
      mounted.current = false
      if (prepTimer.current) clearTimeout(prepTimer.current)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
    // Once per token; the functions read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Back during the test asks first; after it, Back goes to Join us like Done.
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (leaving.current) return
    const k = phaseRef.current
    if (k === 'test') {
      e.preventDefault()
      leaveAction.current = e.data.action
      setLeaveOpen(true)
    } else if (TERMINAL.has(k) && joinUsBelow()) {
      e.preventDefault()
      requestAnimationFrame(done)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [navigation])

  // The second hand. Only differences of the phone's clock are used.
  useEffect(() => {
    if (phase.k !== 'test') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase.k])

  // Unconfirmed picks go again every 10 s while the test is open.
  useEffect(() => {
    if (phase.k !== 'test') return
    const id = setInterval(() => { if (pending.current.size) flushAll() }, PREPARING_RETRY_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.k])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && phaseRef.current === 'test') resync() })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current && phaseRef.current === 'test') {
      flushAll()
      resync()
    }
    wasOnline.current = online
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const left = sync ? remainingMs(sync, now) : 0
  const total = questions.length
  const answered = answeredCount(answers)

  // Zero submits; the last five minutes turn the timer amber and say so once.
  useEffect(() => {
    if (phase.k !== 'test' || !sync) return
    if (left <= 0) {
      finishOnTime()
    } else if (left <= LOW_TIME_MS && !warned.current) {
      warned.current = true
      showToast(`5 minutes left. Unanswered: ${total - answered}.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase.k, sync])

  // ── drawing ────────────────────────────────────────────────────────────────

  const back = (onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={space.md} onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <Icon name="chevL" size={space.xl + space['2xs']} tint={color.text} weight={2} />
    </Pressable>
  )

  const plain = (body: React.ReactNode, foot?: React.ReactNode, onBack: () => void = done) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.topRow}>{back(onBack)}</View>
      {body}
      {!!foot && <View style={[styles.plainFoot, { paddingBottom: spaceHalf['4.5'] + insets.bottom }]}>{foot}</View>}
    </View>
  )
  const doneButton = <Button variant="primary" size="cta" full label="Done" onPress={done} />

  if (phase.k === 'loading') {
    return <View style={[styles.page, styles.centre]}><ActivityIndicator color={color.accent} /></View>
  }

  if (phase.k === 'error') {
    return plain(
      <StateBlock icon="wifi" tone="quiet" body={phase.message} />,
      <Button variant="primary" size="cta" full label="Try again" onPress={() => { load() }} />,
      () => navigation.goBack(),
    )
  }

  if (phase.k === 'expired') {
    const until = phase.until ? `It worked until ${fmtDayMon(phase.until)}. ` : ''
    return plain(<StateBlock icon="cal" tone="quiet" title="This link has expired" body={`${until}Write to us at ${SUPPORT_EMAIL}.`} />, doneButton)
  }

  if (phase.k === 'already') {
    const on = phase.on ? `You took this test on ${fmtDayMon(phase.on)}. ` : ''
    return plain(<StateBlock icon="check" tone="ok" title="Already submitted" body={`${on}Each application gets one attempt.`} />, doneButton)
  }

  if (phase.k === 'timeup') {
    return plain(
      <StateBlock icon="clock" tone="amber" title="Time’s up" body={`Your answers were submitted for you. ${phase.answered} of ${phase.total} were answered.`} />,
      doneButton,
    )
  }

  if (phase.k === 'preparing') {
    return plain(
      <StateBlock icon="spark" tone="quiet" title="Getting your test ready…" body="Usually under a minute. The clock hasn’t started." />,
      undefined,
      () => navigation.goBack(),
    )
  }

  if (phase.k === 'submitted') {
    return (
      <BrandScreen
        title="Apply to interview"
        sub="We read every application and reply by email."
        onBack={done}
        footer={doneButton}
      >
        <View style={styles.done}>
          <View style={styles.doneMark}>
            <Icon name="check" size={spaceHalf['6'] + spaceHalf['1.5']} tint={color.success} weight={2.4} />
          </View>
          <SheetTitle>Test submitted.</SheetTitle>
          <Text style={styles.doneBody}>Thank you. Your application is now with our team.</Text>
          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={[styles.stepNum, styles.stepOk]}><Icon name="check" size={space.md + 1} tint={color.success} weight={3} /></View>
              <View style={[styles.grow, styles.stepBody]}><Text style={styles.stepText}>Application and test sent</Text></View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <View style={[styles.grow, styles.stepBody]}><Text style={[styles.stepText, styles.stepNow]}>A person on our team reads both</Text></View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <View style={[styles.grow, styles.stepBody]}>
                <Text style={styles.stepText}>If we go ahead, we create your account</Text>
                {!!email && <Text style={styles.stepSub}>{`Your sign-in details arrive by email at ${email}`}</Text>}
              </View>
            </View>
          </View>
        </View>
      </BrandScreen>
    )
  }

  if (phase.k === 'rules') {
    const s = info
    const minutes = s?.timeLimitMinutes ?? 0
    const counts = s?.counts
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <ScrollView style={styles.grow} contentContainerStyle={styles.rulesBody}>
          {back(() => navigation.goBack())}
          <Text style={styles.rulesTitle} accessibilityRole="header">Screening test</Text>
          {!!s && <Text style={[text.uiMd, styles.muted, styles.rulesLine]}>{`${s.total} questions in ${minutes} minutes. Pick one answer for each.`}</Text>}
          {!!counts && (
            <View style={styles.secRow}>
              {(['TECHNICAL', 'REASONING', 'IQ', 'GK'] as const).map((k) => (
                <View key={k} style={styles.secCell}>
                  <Text style={styles.secNum}>{String(counts[k])}</Text>
                  <Text style={[text.ui2xs, styles.muted, styles.centreText]}>{SECTION_NAME[k]}</Text>
                </View>
              ))}
            </View>
          )}
          {!!s && s.domains.length > 0 && (counts?.TECHNICAL ?? 0) > 0 && (
            <Text style={styles.hint}>{`Technical questions cover the domains you picked: ${s.domains.join(', ')}.`}</Text>
          )}
          <View style={styles.rules}>
            {RULES.map((r) => (
              <View key={r.title} style={styles.rule}>
                <View style={styles.ruleIcon}><Icon name={r.icon} size={space.lg + 1} tint={color.textSecondary} weight={2} /></View>
                <View style={styles.grow}>
                  <Text style={text.uiMd}>{r.title}</Text>
                  <Text style={styles.ruleSub}>{r.body}</Text>
                </View>
              </View>
            ))}
          </View>
          {!!startError && <Banner tone="danger" style={styles.startError}>{startError}</Banner>}
        </ScrollView>
        <View style={[styles.plainFoot, { paddingBottom: spaceHalf['4.5'] + insets.bottom }]}>
          <Button
            variant="primary"
            size="cta"
            full
            busy={startBusy}
            label={`Start · ${mmss(minutes * 60 * 1000)}`}
            onPress={() => { begin() }}
          />
        </View>
      </View>
    )
  }

  // ── the test ───────────────────────────────────────────────────────────────
  const q = questions[pos]
  const runs = sectionRuns(questions, answers)
  const last = pos === total - 1
  const saved = !!q && answers[q.index] != null && !pending.current.has(q.index)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <TestBar position={pos} total={total} leftMs={left} onMap={() => setMapOpen(true)} />
      <SectionStrips runs={runs} current={q?.section ?? ''} />
      {!online && <OfflineBanner />}
      <View style={styles.grow}>
        <ScrollView ref={scroller} style={styles.grow} contentContainerStyle={styles.qBody}>
          {!!q && (
            <>
              <QuestionHead q={q} />
              <QuestionText>{q.text}</QuestionText>
              <View style={styles.opts} accessibilityRole="radiogroup">
                {q.options.map((o, i) => (
                  <OptionCard key={`${q.index}-${i}`} at={i} label={o} on={answers[q.index] === i} onPress={() => choose(i)} />
                ))}
              </View>
              {saved && <SavedMark />}
            </>
          )}
        </ScrollView>
        {!!toast && <View style={styles.toast} pointerEvents="none"><Toast message={toast.message} tone={toast.tone} /></View>}
      </View>
      <EmFoot>
        <Button variant="outline" size="block" icon="chevL" label="Previous" disabled={pos === 0} onPress={() => go(pos - 1)} style={styles.prev} />
        {last ? (
          <Button variant="primary" size="cta" label="Submit test" onPress={() => setSubmitOpen(true)} style={styles.next} />
        ) : (
          <ArrowButton label="Next" onPress={() => go(pos + 1)} style={styles.next} />
        )}
      </EmFoot>

      <QuestionMap
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        runs={runs}
        questions={questions}
        answers={answers}
        current={pos}
        total={total}
        answered={answered}
        onJump={(p) => { setMapOpen(false); go(p) }}
        onSubmit={() => { setMapOpen(false); setSubmitOpen(true) }}
      />
      <ScreeningDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Submit your test?"
        body={`You’ve answered ${answered} of ${total}. After you submit, you can’t change any answer.`}
        primary={{ label: 'Submit', onPress: () => { submitNow() } }}
        secondary={{ label: 'Keep going', onPress: () => setSubmitOpen(false) }}
        busy={submitBusy}
      />
      <ScreeningDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        icon="clock"
        title="Leave the test?"
        body="If you leave, time still counts. At zero, your answers are submitted."
        primary={{ label: 'Keep going', onPress: () => setLeaveOpen(false) }}
        secondary={{
          label: 'Leave',
          onPress: () => {
            setLeaveOpen(false)
            leaving.current = true
            if (leaveAction.current) navigation.dispatch(leaveAction.current)
            else navigation.goBack()
          },
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  centreText: { textAlign: 'center' },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },

  topRow: { paddingHorizontal: space.lg, paddingTop: spaceHalf['3.5'] },
  back: { alignSelf: 'flex-start', marginLeft: -space['2xs'] },
  plainFoot: { paddingHorizontal: space.lg, paddingTop: space.sm, backgroundColor: color.background },

  rulesBody: { paddingHorizontal: space.lg, paddingTop: spaceHalf['3.5'], paddingBottom: space.xl },
  rulesTitle: {
    marginTop: spaceHalf['3.5'], fontFamily: FF.bodyBold, fontSize: fontSize['display-sm'], lineHeight: leadingNative['display-sm'],
    letterSpacing: trackingNative['snug-sm'], color: color.text,
  },
  rulesLine: { marginTop: space.xs },
  secRow: { flexDirection: 'row', gap: spaceHalf['1.5'], marginTop: space.lg },
  secCell: {
    flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: space.sm,
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius.tile,
  },
  secNum: { fontFamily: FF.bodyBold, fontSize: fontSize['display-xs'], lineHeight: leadingNative['display-xs'], color: color.text, fontVariant: ['tabular-nums'] },
  hint: { marginTop: space.sm, fontFamily: FF.body, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'], color: color.textMuted },
  rules: { gap: space.md, marginTop: spaceHalf['4.5'] },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  ruleIcon: {
    width: height['control-banner'], height: height['control-banner'], borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceMuted,
  },
  ruleSub: { fontFamily: FF.body, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'], color: color.textMuted },
  startError: { marginTop: space.lg },

  qBody: { paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.xl },
  opts: { gap: spaceHalf['2.5'], marginTop: spaceHalf['4.5'] },
  toast: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  prev: { flex: 1 },
  next: { flex: 1.4 },

  // "Test submitted." — the apply flow's received state, three steps.
  done: { alignItems: 'center', gap: space.md, paddingTop: space['3xl'] },
  doneMark: {
    width: height['deck-action'], height: height['deck-action'], borderRadius: radius.pill,
    backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center',
  },
  doneBody: {
    fontFamily: FF.body, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-base'],
    color: color.textMuted, textAlign: 'center',
  },
  steps: {
    alignSelf: 'stretch', gap: spaceHalf['2.5'], padding: space.lg, marginTop: space.xs,
    backgroundColor: color.surface, borderRadius: radius['card-lg'], borderWidth: borderWidth.thin, borderColor: color.border,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'] },
  stepNum: {
    width: height.glyph, height: height.glyph, borderRadius: radius.pill, backgroundColor: color.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepOk: { backgroundColor: color.successSoft },
  stepNumText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-xs'], color: color.accentText, fontVariant: ['tabular-nums'] },
  stepBody: { paddingTop: space['2xs'] },
  stepText: { fontFamily: FF.body, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.text },
  stepNow: { fontFamily: FF.bodySemiBold },
  stepSub: { marginTop: space['2xs'], fontFamily: FF.body, fontSize: fontSize['meta-md'], lineHeight: leadingNative['ui-xs'], color: color.textMuted },
})
