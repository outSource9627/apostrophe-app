import React, { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UnfinishedCard } from '../components/UnfinishedCard'
import { PayBar } from '../components/PayBar'
import { api } from '../lib/api'
import { setFeedVisibility } from '../lib/api/student'
import { filmStateOf, greetingFor, latestCompleted, loadDashboard, longDate, nextUpcoming, untilLabel, type DashboardData, type FilmState } from '../lib/home/dashboard'
import { fmtShortDate, fmtTime } from '../lib/interviews/slots'
import {
  AppHeader, Avatar, Banner, Body, Card, CreditChip, Display, ErrorState, Eyebrow, Fab, FilmThumb, InkButton, InkCard, InkPill, Meta,
  Skeleton, StatusPill, Toggle, text, type Tone,
} from '../components/ui'
import { color, space, spaceHalf, radius, borderWidth, height } from '../theme'

interface Me {
  paid: boolean
  name?: string
  city?: string
  qualification?: string
  unusedCount: number
}
interface Config {
  qualifications: { value: string; tier: string }[]
  tiers: { tier: string; amountPaise: number; durationMin: number }[]
}

const QUALIFICATION_LABEL: Record<string, string> = {
  CLASS_12: 'Class 12',
  GRADUATION: 'Graduation',
  POST_GRADUATION: 'Post Graduation',
  PHD: 'PhD',
}

const BEATS = [
  { n: '01', title: 'Pick a slot that suits you', body: 'Evenings and weekends included.' },
  { n: '02', title: 'Talk to a person, not a form', body: 'Twenty minutes on video.' },
  { n: '03', title: 'Employers come to you', body: 'Shortlists stay private until someone sends Interest.' },
]

/**
 * Where signing in lands. ST-12 — an unpaid student may sign in, see pricing,
 * read static content and pay, and nothing else.
 *
 * So this does not hide the product behind a locked door: it shows them the
 * card they already half own, and makes paying the obvious next move. Once
 * paid, Home is the design's dashboard (Student App Android, M4).
 */
export function HomeScreen({
  onPay, onBook, onJoin, onReschedule, onFeedback, onVideoResume, onAccount,
}: {
  onPay: () => void
  onBook: () => void
  onJoin: (id: string) => void
  onReschedule: (id: string) => void
  onFeedback: (id: string) => void
  onVideoResume: () => void
  onAccount: () => void
}) {
  const insets = useSafeAreaInsets()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/students/me') })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  if (me.isPending || config.isPending) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <AppHeader />
        <View style={styles.scroll}><Skeleton lines={3} /></View>
      </View>
    )
  }

  if (me.isError || !me.data || !config.data) {
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
        <ErrorState title="Could not load your account." />
      </View>
    )
  }

  const initials = initialsOf(me.data.name)

  if (me.data.paid) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <PaidHome
          me={me.data}
          initials={initials}
          onBook={onBook}
          onJoin={onJoin}
          onReschedule={onReschedule}
          onFeedback={onFeedback}
          onVideoResume={onVideoResume}
          onAccount={onAccount}
        />
      </View>
    )
  }

  const tier = config.data.qualifications.find((q) => q.value === me.data.qualification)?.tier
  const price = config.data.tiers.find((t) => t.tier === tier)
  const firstName = me.data.name?.split(' ')[0]
  const qualificationLabel = me.data.qualification
    ? QUALIFICATION_LABEL[me.data.qualification] ?? me.data.qualification
    : undefined

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppHeader>{!!initials && <Avatar initials={initials} />}</AppHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Eyebrow>
          {firstName ? `${firstName.toUpperCase()} · ACCOUNT CREATED` : 'ACCOUNT CREATED'}
        </Eyebrow>
        <Display level="md" style={styles.headline}>One conversation</Display>
        <Display level="md" style={styles.headlineMuted}>away from being seen.</Display>

        <View style={styles.cardWrap}>
          <UnfinishedCard
            name={me.data.name ?? 'Your name'}
            city={me.data.city}
            qualificationLabel={qualificationLabel}
          />
          <Body size="sm" tone="subtle" style={styles.caption}>
            This is the card an employer sees. Everything but the film is already yours.
          </Body>
        </View>

        <View style={styles.beats}>
          {BEATS.map((b) => (
            <View key={b.n} style={styles.beat}>
              <Meta style={styles.beatNumber}>{b.n}</Meta>
              <View style={styles.beatBody}>
                <Body size="sm" weight="medium">{b.title}</Body>
                <Body size="sm" tone="muted" style={styles.beatText}>{b.body}</Body>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <PayBar
        amountPaise={price?.amountPaise}
        tierLabel={qualificationLabel}
        durationMin={price?.durationMin}
        onPay={onPay}
      />
    </View>
  )
}

const initialsOf = (name?: string) => name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() ?? ''

/** A clock the screen re-reads every minute, so "In 3 hours" does not go stale on a screen left open. */
function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

/** "1 CREDIT" / "3 CREDITS" — nothing at all when there is none, rather than a zero. */
const creditLabel = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`

function PaidHome({
  me, initials, onBook, onJoin, onReschedule, onFeedback, onVideoResume, onAccount,
}: {
  me: Me
  initials: string
  onBook: () => void
  onJoin: (id: string) => void
  onReschedule: (id: string) => void
  onFeedback: (id: string) => void
  onVideoResume: () => void
  onAccount: () => void
}) {
  const now = useNow()
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: loadDashboard })
  const firstName = me.name?.split(' ')[0]
  const today = new Date(now)

  return (
    <View style={styles.page}>
      <AppHeader>
        {me.unusedCount > 0 && <CreditChip label={creditLabel(me.unusedCount)} />}
        {!!initials && <Avatar initials={initials} onPress={onAccount} />}
      </AppHeader>

      <ScrollView
        contentContainerStyle={styles.dash}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => dash.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
      >
        <View style={styles.greeting}>
          <Body size="sm" tone="muted">{longDate(today)}</Body>
          <Display level="md">
            {firstName ? `${greetingFor(today.getHours())}, ${firstName}` : greetingFor(today.getHours())}
          </Display>
        </View>

        {dash.isPending ? (
          <Skeleton lines={3} />
        ) : dash.isError || !dash.data ? (
          <ErrorState
            title="Could not load your dashboard."
            body="Nothing has changed on your account. Pull down to try again."
          />
        ) : (
          <Dashboard
            data={dash.data}
            now={now}
            onBook={onBook}
            onJoin={onJoin}
            onReschedule={onReschedule}
            onFeedback={onFeedback}
            onVideoResume={onVideoResume}
          />
        )}
      </ScrollView>

      <Fab
        label="Book interview"
        onPress={onBook}
        glyph={<Text style={styles.fabPlus}>+</Text>}
      />
    </View>
  )
}

function Dashboard({
  data, now, onBook, onJoin, onReschedule, onFeedback, onVideoResume,
}: {
  data: DashboardData
  now: number
  onBook: () => void
  onJoin: (id: string) => void
  onReschedule: (id: string) => void
  onFeedback: (id: string) => void
  onVideoResume: () => void
}) {
  const next = nextUpcoming(data.interviews, now)
  const done = latestCompleted(data.interviews)
  const film = filmStateOf(data.film, data.audience, done)

  return (
    <>
      <VisibilityCard audience={data.audience} />
      <UpcomingCard iv={next} now={now} onBook={onBook} onJoin={onJoin} onReschedule={onReschedule} />
      <FilmCard state={film} live={!data.audience.hiddenFromFeed} pending={data.film?.pipelinePending ?? false} onBook={onBook} onVideoResume={onVideoResume} />
      {data.feedback && done && (
        <ScorecardRow feedback={data.feedback} onPress={() => onFeedback(done.id)} />
      )}
    </>
  )
}

/**
 * The one switch that removes the student from the employer feed. Until a film
 * is published there is nothing to switch, so it shows its not-applicable state
 * rather than a control that would do nothing.
 */
function VisibilityCard({ audience }: { audience: DashboardData['audience'] }) {
  const qc = useQueryClient()
  const [failed, setFailed] = useState(false)
  const mut = useMutation({
    mutationFn: (hidden: boolean) => setFeedVisibility(hidden),
    onMutate: () => setFailed(false),
    onError: () => setFailed(true),
    onSettled: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  const state: 'live' | 'hidden' | 'none' = !audience.published ? 'none' : audience.hiddenFromFeed ? 'hidden' : 'live'
  const live = state === 'live'
  const title = { live: 'Live in employer feeds', hidden: 'Hidden from employers', none: 'Not live yet' }[state]
  const sub = {
    live: `${audience.profileViews} ${audience.profileViews === 1 ? 'view' : 'views'} · ${audience.openInterests} ${audience.openInterests === 1 ? 'interest' : 'interests'}`,
    hidden: 'Existing chats stay open',
    none: 'Comes out of your interview',
  }[state]

  return (
    <View style={styles.stack}>
      <Card style={styles.rowCard}>
        <View style={[styles.halo, { backgroundColor: live ? color.successHalo : color.neutralHalo }]}>
          <View style={[styles.dot, { backgroundColor: live ? color.successFill : color.textSubtle }]} />
        </View>
        <View style={styles.rowText}>
          <Body size="md" weight="semibold">{title}</Body>
          <Body size="xs" tone="muted">{sub}</Body>
        </View>
        <Toggle
          on={live}
          tone="success"
          disabled={state === 'none'}
          // While a change is in flight the switch ignores presses instead of going
          // `disabled`: that skin means "cannot be changed", not "wait half a second".
          onChange={mut.isPending ? undefined : (next) => mut.mutate(!next)}
          label="Show me in the employer feed"
        />
      </Card>
      {failed && <Banner tone="danger">Could not change your visibility. Nothing was changed. Try again.</Banner>}
    </View>
  )
}

/**
 * The next booked interview on the ink card — or, with nothing booked, the same
 * card saying so with the way to book. The design's preparation checklist has no
 * data behind it in this app and is not drawn.
 *
 * `Test my setup` and `Join interview` are the same door: the readiness screen
 * is the device check and it opens the room when the window is. The label
 * follows `roomReady`, which is the server's call.
 */
function UpcomingCard({
  iv, now, onBook, onJoin, onReschedule,
}: {
  iv?: DashboardData['interviews'][number]
  now: number
  onBook: () => void
  onJoin: (id: string) => void
  onReschedule: (id: string) => void
}) {
  if (!iv) {
    return (
      <InkCard>
        <InkPill label="Next step" />
        <Text style={[text.displaySm, styles.inkTitle]}>No interview booked yet</Text>
        <Text style={[text.uiSm, styles.inkSub]}>Your interview is filmed, and that film becomes your video resume.</Text>
        <View style={styles.inkActions}>
          <InkButton label="Book an interview" onPress={onBook} style={styles.grow} />
        </View>
      </InkCard>
    )
  }

  const joinable = iv.roomReady || iv.status === 'IN_PROGRESS'
  return (
    <InkCard>
      <View style={styles.inkTop}>
        <InkPill label={iv.status === 'IN_PROGRESS' ? 'In progress' : 'Upcoming'} />
        <Text style={[text.metaMd, styles.inkUntil]}>{untilLabel(iv, now).toUpperCase()}</Text>
      </View>
      <Text style={[text.displaySm, styles.inkTitle]}>{`${fmtShortDate(iv.slotStart)} · ${fmtTime(iv.slotStart)}`}</Text>
      <Text style={[text.uiSm, styles.inkSub]}>
        {`${iv.durationMin}-minute interview · IST${iv.interviewer ? ` · with ${iv.interviewer.name}` : ''}`}
      </Text>
      <View style={styles.inkActions}>
        <InkButton label={joinable ? 'Join interview' : 'Test my setup'} onPress={() => onJoin(iv.id)} style={styles.grow} />
        {iv.canReschedule && <InkButton variant="ghost" label="Reschedule" onPress={() => onReschedule(iv.id)} />}
      </View>
    </InkCard>
  )
}

const FILM_PILL: Record<FilmState, { tone: Tone; label: string }> = {
  published: { tone: 'success', label: '✓ Published' },
  processing: { tone: 'warning', label: 'Rendering' },
  failed: { tone: 'danger', label: 'Could not be made' },
  unpublished: { tone: 'danger', label: 'Taken down' },
  none: { tone: 'neutral', label: 'No film yet' },
}

/**
 * The video resume in whichever state the API reports it. The design draws two
 * cards (rendering, published); the API reports the student's one film, so one
 * card is drawn — the design's published row, or its rendering card's anatomy for
 * every other state (pill, title, one line). Render steps and a percentage have
 * no data behind them and are not drawn.
 */
function FilmCard({
  state, live, pending, onBook, onVideoResume,
}: { state: FilmState; live: boolean; pending: boolean; onBook: () => void; onVideoResume: () => void }) {
  const pill = FILM_PILL[state]
  const line = {
    published: live ? 'Live in employer feeds' : 'Hidden from employers',
    processing: pending ? 'Not ready yet. We cannot say when it will be.' : 'Your interview is being prepared.',
    failed: 'We could not make a film from your interview.',
    unpublished: 'Your film has been taken down, so employers cannot see it.',
    none: 'The film from your interview is what employers watch before they read a word.',
  }[state]
  // Every state but 'none' has something to say on the video-resume screen (the film, why it is not ready, or why it is down).
  const press = state === 'none' ? onBook : onVideoResume

  const inner = state === 'published' ? (
    <>
      <FilmThumb />
      <View style={styles.rowText}>
        <StatusPill tone={pill.tone} label={pill.label} />
        <Body size="base" weight="semibold">Your video resume</Body>
      </View>
    </>
  ) : (
    <View style={styles.rowText}>
      <StatusPill tone={pill.tone} label={pill.label} />
      <Body size="base" weight="semibold">Your video resume</Body>
      <Body size="xs" tone="muted">{line}</Body>
    </View>
  )

  return (
    <Pressable onPress={press} accessibilityRole="button">
      <Card style={styles.filmCard}>{inner}</Card>
    </Pressable>
  )
}

/** The newest scorecard, or the line that says it is on its way. */
function ScorecardRow({ feedback, onPress }: { feedback: NonNullable<DashboardData['feedback']>; onPress: () => void }) {
  const ready = feedback !== 'awaiting'
  return (
    <Pressable disabled={!ready} onPress={onPress} accessibilityRole="button">
      <Card style={styles.filmCard}>
        <View style={styles.rowText}>
          <StatusPill tone={ready ? 'accent' : 'neutral'} label={ready ? 'Scorecard' : 'Scorecard on its way'} />
          <Body size="base" weight="semibold">
            {ready ? `Overall ${feedback.scorecard.scores.overall} / 10` : 'We’ll notify you the moment it lands.'}
          </Body>
        </View>
        {ready && <Text style={styles.chevron}>›</Text>}
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space['2xl'] },
  headline: { marginTop: space.md },
  headlineMuted: { color: color.textMuted, marginTop: 0 },
  cardWrap: { marginTop: space.xl },
  caption: { marginTop: space.lg },
  beats: { marginTop: space.xl, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  beat: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  beatNumber: { width: space.xl, paddingTop: space['2xs'] },
  beatBody: { flex: 1 },
  beatText: { marginTop: space['2xs'] },

  // ── the paid dashboard ────────────────────────────────────────────────
  // Bottom padding clears the floating action: its height plus its own margin.
  dash: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: height.fab + space.lg * 2, gap: space.md },
  greeting: { paddingHorizontal: space.xs, gap: space['2xs'] },
  stack: { gap: space.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'], paddingHorizontal: space.lg, paddingVertical: spaceHalf['3.5'] },
  rowText: { flex: 1, gap: space['2xs'] },
  // A 10-point dot with a 5-point halo: the halo is a wider disc behind it, since RN has no spread shadow.
  halo: { width: height['status-halo'], height: height['status-halo'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: height['status-dot'], height: height['status-dot'], borderRadius: radius.pill },
  filmCard: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'], paddingHorizontal: space.lg, paddingVertical: space.md },
  chevron: { fontSize: height.glyph - 4, color: color.textSubtle },
  fabPlus: { color: color.textInverse, fontSize: height.glyph - 4 },

  inkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inkUntil: { color: color.textOnInkMuted },
  inkTitle: { color: color.textOnInk },
  inkSub: { color: color.textOnInkMuted },
  inkActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
})
