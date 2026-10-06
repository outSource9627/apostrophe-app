import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmSteps, EmWell, type EmTone, type StepState } from '../../components/employer/em'
import {
  CountCard, FilmStill, GlassPill, Meter, StudioCard, StudioChip, StudioGreeting, StudioLabel,
} from '../../components/employer/studio'
import { fetchShortlist } from '../../lib/api/employerShortlist'
import { fetchEmployerInterests, liveInterestOutcome } from '../../lib/api/employerInterests'
import { fetchEmployerJobs } from '../../lib/api/employerJobs'
import { fetchFeedFilters, listSavedSearches } from '../../lib/api/employerFeed'
import { getEmployerThreads } from '../../lib/api/employerChat'
import type { NotificationRow } from '../../lib/api/account'
import { useChatUnread } from '../../lib/employer/useNavCounts'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import { ensureDeck, upcoming, useFeedDeck } from '../../lib/employer/feedDeck'
import { filterCount } from '../../lib/employer/feedFilters'
import type { RootStackParamList } from '../../../App'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { EmployerMe, EmployerState } from '../../lib/api/employer'
import { formatIstStep, needsAction, promptState } from '../../lib/employer/state'
import { EmployerLoadState, requirementActions, type DocumentKey } from './EmployerStatusScreen'

export interface EmployerHomeScreenProps {
  /** EM-05, optionally scrolled to one requirement. */
  onDocuments: (focus?: DocumentKey) => void
  /** EM-06. */
  onStatus: () => void
  /** EM-08, the candidate feed, from a verified employer's home. */
  onFeed?: () => void
}

/** How many of the next cards Home shows. They are the feed's own first cards (lib/employer/feedDeck). */
const HOME_FILMS = 4
/** A UI window, not an admin value: what “this week” and “soon” mean on the counts. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const SOON_MS = 48 * 60 * 60 * 1000
/** The title moves into the bar once the greeting has scrolled under it. */
const COLLAPSE_AT = height['screen-header']

const IST_OFFSET_MS = 330 * 60 * 1000
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const istParts = (t: number) => {
  const d = new Date(t + IST_OFFSET_MS)
  return { wd: d.getUTCDay(), d: d.getUTCDate(), mo: d.getUTCMonth(), y: d.getUTCFullYear(), h: d.getUTCHours(), mi: d.getUTCMinutes() }
}
/** 'Wednesday, 1 October' in IST. */
const istLongDate = (t: number) => {
  const p = istParts(t)
  return `${WEEKDAY[p.wd]}, ${p.d} ${MONTH[p.mo]}`
}
/** '14 Sep' in IST. */
const istDayMonth = (iso: string) => {
  const p = istParts(new Date(iso).getTime())
  return `${p.d} ${MON[p.mo]}`
}
/** An activity row's time: the clock today, “Yesterday”, else the day. */
const activityWhen = (iso: string, now: number) => {
  const t = new Date(iso).getTime()
  const a = istParts(t)
  const b = istParts(now)
  const y = istParts(now - 24 * 60 * 60 * 1000)
  if (a.y === b.y && a.mo === b.mo && a.d === b.d) return `${a.h % 12 === 0 ? 12 : a.h % 12}:${String(a.mi).padStart(2, '0')} ${a.h < 12 ? 'AM' : 'PM'}`
  if (a.y === y.y && a.mo === y.mo && a.d === y.d) return 'Yesterday'
  return `${a.d} ${MON[a.mo]}`
}

/**
 * Home (docs/employer-app-studio.html · H1–H3).
 *
 * Verified: the greeting, the verified strip, “Today’s feed” — the next films,
 * the day’s allowance and the one violet action — then the four counts, recent
 * activity and live jobs. The title moves into the bar once the greeting has
 * scrolled away (H2).
 *
 * The films are the FEED’S OWN first cards (lib/employer/feedDeck): the server
 * charges a card every time it delivers one, so Home never reads a separate
 * page — the Feed picks up exactly the cards shown here.
 *
 * Pending (H3): one status card — badge, sentence, the timeline, the reviewer’s
 * words when there are any, the next action and Company profile — over what
 * verification unlocks. When a read sees approval land, Home hands over to the
 * Status screen, where the Verified Employer moment is drawn.
 *
 * Every count comes from its own endpoint and shows “—” if that read fails.
 */
export function EmployerHomeScreen({ onDocuments, onStatus, onFeed }: EmployerHomeScreenProps) {
  const { state, error, refresh, justVerified } = useEmployer()
  const [scrolled, setScrolled] = useState(false)
  const scrolledRef = useRef(false)
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > COLLAPSE_AT
    if (next !== scrolledRef.current) {
      scrolledRef.current = next
      setScrolled(next)
    }
  }, [])

  const handedOver = useRef(false)
  useEffect(() => {
    if (!justVerified || handedOver.current) return
    handedOver.current = true
    onStatus()
  }, [justVerified, onStatus])

  if (!state) {
    return (
      <EmployerShell title="Home">
        <EmployerLoadState error={error} onRetry={refresh} />
      </EmployerShell>
    )
  }

  const first = state.company.authorisedPerson.name.trim().split(/\s+/)[0] ?? ''
  const prompt = promptState(state, { justVerified })
  const verified = prompt === null || prompt === 'verified'

  return (
    <EmployerShell
      title={scrolled ? 'Home' : undefined}
      big={false}
      barBorder={scrolled}
      onScroll={onScroll}
    >
      <StudioGreeting
        eyebrow={verified ? istLongDate(Date.now()) : undefined}
        title={verified ? `Welcome back, ${first}.` : `Welcome, ${first}.`}
      />
      {verified ? (
        <VerifiedHome state={state} onFeed={onFeed} />
      ) : (
        <>
          <PendingCard state={state} prompt={prompt} onDocuments={onDocuments} onStatus={onStatus} />
          <StudioCard>
            <StudioLabel>Unlocks when you’re verified</StudioLabel>
            {UNLOCKS.map((t) => (
              <View key={t} style={styles.unlock}>
                <Icon name="lock" size={space.lg - 1} tint={color.textSubtle} weight={2} />
                <Text style={[text.uiMd, styles.secondary]}>{t}</Text>
              </View>
            ))}
          </StudioCard>
        </>
      )}
    </EmployerShell>
  )
}

/** What is locked until a reviewer approves — product copy. */
const UNLOCKS = [
  'Browse the candidate feed',
  'Play videos and full interviews',
  'Shortlist candidates',
  'Send Interests',
  'Post jobs',
  'Chat with connections',
]

const DOC_NAME: Record<'COMPANY_PROOF' | 'PHOTO_ID', string> = { COMPANY_PROOF: 'Company proof', PHOTO_ID: 'Photo ID' }

/** '+91 98450 21734' when the number is a ten-digit Indian mobile; as stored otherwise. */
function mobileLine(m: string) {
  const digits = m.replace(/\D/g, '')
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 10 ? digits : null
  return ten ? `+91 ${ten.slice(0, 5)} ${ten.slice(5)}` : m
}

/**
 * H3 · the pending card. Four pending states share it: each has its badge,
 * sentence, timeline step and one action.
 */
function PendingCard({
  state, prompt, onDocuments, onStatus,
}: {
  state: EmployerState
  prompt: 'todo' | 'review' | 'moreInfo' | 'rejected'
  onDocuments: (focus?: DocumentKey) => void
  onStatus: () => void
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const company = state.company.name
  const v = state.verification
  const hours = useEmployerConfig().verificationTargetHours ?? v.slaHours
  const missing = state.requirements.filter((r) => (r.key === 'COMPANY_PROOF' || r.key === 'PHOTO_ID') && r.status === 'MISSING')
  const acting = state.requirements.filter((r) => r.key !== 'WORK_EMAIL' && needsAction(r))
  const firstAction = requirementActions(acting).values().next().value
  const submittedKinds = [...new Set(state.documents.map((d) => d.kind))]
  const badge: Record<typeof prompt, { label: string; tone: EmTone; icon: IconName }> = {
    todo: { label: 'Pending verification', tone: 'amber', icon: 'clock' },
    review: { label: 'Pending verification', tone: 'amber', icon: 'clock' },
    moreInfo: { label: 'More documents', tone: 'violet', icon: 'file' },
    rejected: { label: 'Not approved', tone: 'red', icon: 'x' },
  }
  const title = {
    todo: `Verify ${company}.`,
    review: `We’re checking ${company}.`,
    moreInfo: 'One more document, please.',
    rejected: 'We couldn’t verify the company.',
  }[prompt]
  const decisionLine = hours ? `Usually within ${hours} hours. We’ll email you and notify you here.` : 'We’ll email you and notify you here.'
  const contact = [state.contact.email, state.contact.mobile ? mobileLine(state.contact.mobile) : null].filter(Boolean).join(' · ')
  const steps: { title: string; sub?: string; state: StepState }[] = [
    { title: 'Account created', state: 'done' },
    { title: 'Work email and mobile verified', sub: contact || undefined, state: 'done' },
    prompt === 'todo'
      ? { title: 'Documents to submit', sub: missing.map((r) => DOC_NAME[r.key as 'COMPANY_PROOF' | 'PHOTO_ID']).join(' · ') || undefined, state: 'now' }
      : {
          title: 'Documents submitted',
          sub: [submittedKinds.length ? submittedKinds.join(' and ') : null, v.submittedAt ? formatIstStep(v.submittedAt) : null].filter(Boolean).join(' · ') || undefined,
          state: 'done',
        },
    prompt === 'rejected'
      ? { title: 'Not approved', sub: 'Fix it and resubmit. There’s no limit.', state: 'bad' }
      : prompt === 'moreInfo'
        ? { title: 'More documents requested', sub: 'Add them and the review carries on', state: 'now' }
        : { title: 'Reviewer decision', sub: decisionLine, state: prompt === 'review' ? 'now' : 'todo' },
  ]
  const action =
    prompt === 'todo' ? { label: 'Submit documents', onPress: () => onDocuments() }
      : prompt === 'review' ? { label: 'View status', onPress: onStatus }
        : { label: prompt === 'moreInfo' ? 'Add document' : 'Update and resubmit', onPress: () => onDocuments(firstAction?.focus ?? undefined) }

  return (
    <StudioCard lift style={styles.pending}>
      <EmBadge label={badge[prompt].label} tone={badge[prompt].tone} icon={badge[prompt].icon} />
      <Text style={text.displaySm}>{title}</Text>
      <EmSteps steps={steps} />
      {(prompt === 'moreInfo' || prompt === 'rejected') && !!v.reason && (
        <EmWell label={prompt === 'rejected' ? 'Reason' : 'From the reviewer'} tone={prompt === 'rejected' ? 'red' : 'violet'}>{v.reason}</EmWell>
      )}
      <View style={styles.pair}>
        <Button variant="secondary" size="md" label={action.label} onPress={action.onPress} style={styles.grow} />
        <Button variant="outline" size="md" label="Company profile" onPress={() => navigation.navigate('EmployerCompany')} style={styles.grow} />
      </View>
    </StudioCard>
  )
}

const ACTIVITY_MARK: Partial<Record<NotificationRow['category'], { icon: IconName; bg: string; fg: string }>> = {
  CONNECTION: { icon: 'heart', bg: color.successSoft, fg: color.success },
  APPLICATION: { icon: 'users', bg: color.accentSoft, fg: color.accentText },
  MESSAGE: { icon: 'chat', bg: color.accentSoft, fg: color.accentText },
  JOB: { icon: 'brief', bg: color.surfaceMuted, fg: color.textSecondary },
}
function activityMark(n: NotificationRow) {
  if (/reject|declin|not_approved|not_accepted/i.test(n.kind)) return { icon: 'alert' as IconName, bg: color.dangerSoft, fg: color.danger }
  return ACTIVITY_MARK[n.category] ?? { icon: 'bell' as IconName, bg: color.accentSoft, fg: color.accentText }
}

/** H1 / H2 · verified. */
function VerifiedHome({ state, onFeed }: { state: EmployerMe; onFeed?: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const deck = useFeedDeck()
  const [now] = useState(() => Date.now())
  const approvedAt = state.verification.approvedAt ?? state.verification.reviewedAt
  const cards = deck.quota ?? state.limits?.cards ?? null
  const plays = state.limits?.videoPlays ?? null
  const cardsLeft = cards ? cards.remaining : null

  // The feed's first cards, read once for Home and the Feed together.
  useEffect(() => {
    if (cardsLeft === null || cardsLeft > 0) ensureDeck(HOME_FILMS)
  }, [cardsLeft])

  const saved = useQuery({ queryKey: ['employer', 'saved-searches'], queryFn: listSavedSearches })
  const filters = useQuery({ queryKey: ['employer', 'feed', 'filters'], queryFn: fetchFeedFilters })
  const shortlist = useQuery({ queryKey: ['employer', 'shortlist', 'recent'], queryFn: () => fetchShortlist({ perPage: 50, sort: 'ADDED' }) })
  const interests = useQuery({ queryKey: ['employer', 'interests', 'sent'], queryFn: () => fetchEmployerInterests({ outcome: 'SENT', perPage: 50 }) })
  const jobs = useQuery({ queryKey: ['employer', 'jobs', 'live'], queryFn: () => fetchEmployerJobs({ status: 'PUBLISHED', perPage: 50 }) })
  const threads = useQuery({ queryKey: ['employer', 'threads', 'live'], queryFn: () => getEmployerThreads({ archived: false, perPage: 50 }) })
  const chats = useChatUnread(true)
  const dash = '—'

  const inUse = saved.data?.find((s) => s.inUse)
  const nFilters = filters.data ? filterCount(filters.data.filters ?? {}) : 0
  const searchChip = inUse ? inUse.name : nFilters > 0 ? `${nFilters} ${nFilters === 1 ? 'filter' : 'filters'}` : 'All candidates'

  const shortTotal = shortlist.data ? shortlist.data.totalAll ?? shortlist.data.total : null
  const addedWeek = shortlist.data ? shortlist.data.rows.filter((r) => now - new Date(r.savedAt).getTime() < WEEK_MS).length : 0
  const addedMore = !!shortlist.data && addedWeek === shortlist.data.rows.length && (shortTotal ?? 0) > shortlist.data.rows.length

  const liveRows = interests.data ? interests.data.rows.filter((i) => liveInterestOutcome(i) === 'SENT') : []
  const awaiting = interests.data ? (interests.data.total > interests.data.rows.length ? interests.data.total : liveRows.length) : null
  const expiring = liveRows.filter((i) => {
    const left = new Date(i.expiresAt).getTime() - now
    return left > 0 && left <= SOON_MS
  }).length

  const liveJobs = jobs.data ? jobs.data.counts.PUBLISHED ?? jobs.data.total : null
  // Applicants are the sum over the live jobs — only honest while every live job was read.
  const applicants = jobs.data && liveJobs !== null && jobs.data.rows.length >= liveJobs
    ? jobs.data.rows.reduce((sum, j) => sum + j.counters.applications, 0) : null
  const talking = threads.data ? threads.data.rows.filter((t) => t.unread > 0).length : 0

  const films = upcoming(deck, HOME_FILMS)
  const spent = deck.cardLimit || cardsLeft === 0
  const filmsLoading = !spent && films.length === 0 && (deck.loading || !deck.started)
  const openFeed = onFeed ?? (() => navigation.navigate('EmployerFeed'))
  const notes = state.notifications.slice(0, 4)
  const live = (jobs.data?.rows ?? []).slice(0, 3)

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${state.company.name}, Verified Employer`}
        onPress={() => navigation.navigate('EmployerCompany')}
        style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
      >
        <View style={styles.stripMark}><Icon name="shield" size={space.lg + 2} tint={color.success} /></View>
        <View style={styles.grow}>
          <Text style={text.uiBaseSemi} numberOfLines={1}>{state.company.name}</Text>
          <Text style={[text.uiSm, styles.success]} numberOfLines={1}>
            {approvedAt ? `Verified Employer · approved ${istDayMonth(approvedAt)}` : 'Verified Employer'}
          </Text>
        </View>
        <Icon name="chevR" size={space.lg} tint={color.success} />
      </Pressable>

      <StudioCard lift style={styles.feedCard}>
        <View style={styles.rowBetween}>
          <StudioLabel>Today’s feed</StudioLabel>
          <StudioChip small icon="bookmark" label={searchChip} onPress={openFeed} />
        </View>

        {spent ? (
          <View style={styles.spent}>
            <Icon name="clock" size={space.lg + 2} tint={color.accentText} />
            <Text style={[text.uiMd, styles.secondary, styles.grow]}>
              {cards ? `That’s ${cards.limit} today · resets at midnight IST` : 'That’s today’s cards · resets at midnight IST'}
            </Text>
          </View>
        ) : filmsLoading ? (
          <View style={styles.films}>
            {Array.from({ length: HOME_FILMS }, (_, k) => <View key={k} style={styles.filmSkeleton} />)}
          </View>
        ) : films.length > 0 ? (
          <View style={styles.films}>
            {films.map((c, k) => (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={k === 0 ? `Next: ${c.name}` : c.name} onPress={openFeed} style={({ pressed }) => [styles.grow, pressed && styles.pressed]}>
                <FilmStill name={c.name} poster={c.posterUrl ?? c.photoUrl} width="100%" height={height['video-thumb'] + 2} play={k === 0 ? 'sm' : undefined}>
                  <Shade />
                  {k === 0 && <View style={styles.next}><GlassPill label="Next" /></View>}
                  <Text style={[text.uiXsSemi, styles.filmName]} numberOfLines={1}>{c.name.split(/\s+/)[0]}</Text>
                </FilmStill>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!!cards && <Meter label="Candidate cards" left={cards.remaining} limit={cards.limit} />}
        {!!plays && <Meter label="Full-video plays" left={plays.remaining} limit={plays.limit} tone="ink" />}
        {spent ? (
          <Button variant="secondary" size="cta" full label="Open shortlist" onPress={() => navigation.navigate('EmployerShortlist')} />
        ) : (
          <Button variant="primary" size="cta" full icon="play" label="Open the candidate feed" onPress={openFeed} />
        )}
      </StudioCard>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <CountCard
            icon="bookmark"
            value={shortTotal !== null ? String(shortTotal) : dash}
            label="Shortlist"
            sub={addedWeek > 0 ? `${addedWeek}${addedMore ? '+' : ''} added this week` : null}
            onPress={() => navigation.navigate('EmployerShortlist')}
          />
        </View>
        <View style={styles.cell}>
          <CountCard
            icon="heart"
            value={awaiting !== null ? String(awaiting) : dash}
            label="Awaiting reply"
            sub={expiring > 0 ? `${expiring} expire in 48 h` : null}
            onPress={() => navigation.navigate('EmployerInterests')}
          />
        </View>
        <View style={styles.cell}>
          <CountCard
            icon="brief"
            value={liveJobs !== null ? (applicants !== null ? `${liveJobs} · ${applicants}` : String(liveJobs)) : dash}
            label={applicants !== null ? 'Live jobs · applicants' : 'Live jobs'}
            sub={liveJobs !== null ? `${liveJobs} ${liveJobs === 1 ? 'job' : 'jobs'} live` : null}
            onPress={() => navigation.navigate('EmployerJobs')}
          />
        </View>
        <View style={styles.cell}>
          <CountCard
            icon="chat"
            value={String(chats)}
            label="Unread chats"
            sub={talking > 0 ? `${talking} ${talking === 1 ? 'conversation' : 'conversations'}` : null}
            onPress={() => navigation.navigate('EmployerChats')}
          />
        </View>
      </View>

      {notes.length > 0 && (
        <StudioCard style={styles.listCard}>
          <StudioLabel action="See all" onAction={() => navigation.navigate('EmployerNotifications')} style={styles.listHead}>Recent activity</StudioLabel>
          {notes.map((n) => {
            const m = activityMark(n)
            return (
              <Pressable key={n.id} accessibilityRole="button" onPress={() => navigation.navigate('EmployerNotifications')} style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
                <View style={[styles.mark, { backgroundColor: m.bg }]}><Icon name={m.icon} size={space.lg + 1} tint={m.fg} /></View>
                <View style={styles.grow}>
                  <Text style={text.uiMdSemi} numberOfLines={1}>{n.title}</Text>
                  {!!n.body && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{n.body}</Text>}
                </View>
                <Text style={[text.metaXs, styles.mono, styles.subtle]}>{activityWhen(n.createdAt, now)}</Text>
              </Pressable>
            )
          })}
        </StudioCard>
      )}

      {live.length > 0 && (
        <StudioCard style={styles.listCard}>
          <StudioLabel action="All jobs" onAction={() => navigation.navigate('EmployerJobs')} style={styles.listHead}>Live jobs</StudioLabel>
          {live.map((j) => (
            <Pressable key={j.id} accessibilityRole="button" onPress={() => navigation.navigate('EmployerJobDetail', { id: j.id })} style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
              <View style={styles.grow}>
                <Text style={text.uiMdSemi} numberOfLines={1}>{j.title}</Text>
                <Text style={[text.uiXs, styles.muted]}>{`${j.counters.views} views · ${j.counters.applications} applications`}</Text>
              </View>
              <EmBadge label="Live" tone="green" small />
            </Pressable>
          ))}
        </StudioCard>
      )}
    </>
  )
}

/** The dark foot on a film tile, under the first name. */
function Shade() {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1" pointerEvents="none">
      <Defs>
        <LinearGradient id="homeFilmShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.5" stopColor={color.inkDeep} stopOpacity={0} />
          <Stop offset="1" stopColor={color.inkDeep} stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill="url(#homeFilmShade)" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  mono: { letterSpacing: trackingNative.eyebrow },
  secondary: { color: color.textSecondary },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  success: { color: color.success },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },

  pending: { padding: spaceHalf['4.5'], gap: spaceHalf['3.5'] },
  pair: { flexDirection: 'row', gap: space.sm },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },

  strip: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'],
    borderRadius: radius.lg, backgroundColor: color.successWash, borderWidth: borderWidth.thin, borderColor: color.successEdge,
  },
  stripMark: { width: height['avatar-lg'], height: height['avatar-lg'], borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },

  feedCard: { gap: spaceHalf['3.5'] },
  films: { flexDirection: 'row', gap: space.sm },
  filmSkeleton: { flex: 1, height: height['video-thumb'] + 2, borderRadius: radius.tile, backgroundColor: color.surfaceSunken },
  next: { position: 'absolute', top: spaceHalf['1.5'], left: spaceHalf['1.5'] },
  filmName: { position: 'absolute', left: space.sm, right: spaceHalf['1.5'], bottom: spaceHalf['1.5'] + 1, color: color.textOnInk },
  spent: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], padding: space.md, borderRadius: radius.tile, backgroundColor: color.accentWash },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['2.5'] },
  cell: { width: '48%', flexGrow: 1 },

  listCard: { paddingVertical: spaceHalf['1.5'], paddingHorizontal: 0, gap: 0 },
  listHead: { paddingHorizontal: spaceHalf['3.5'], paddingTop: spaceHalf['2.5'], paddingBottom: spaceHalf['1.5'] },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: spaceHalf['2.5'], paddingHorizontal: spaceHalf['3.5'], borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },
  mark: { width: height['avatar-lg'], height: height['avatar-lg'], borderRadius: radius.md + 1, alignItems: 'center', justifyContent: 'center' },
})
