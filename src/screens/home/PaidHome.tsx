import React, { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { setFeedVisibility } from '../../lib/api/student'
import {
  filmStateOf, greetingFor, latestCompleted, loadDashboard, longDate, nextUpcoming, untilLabel,
  type DashboardData, type FilmState,
} from '../../lib/home/dashboard'
import { fmtShortDate, fmtTime } from '../../lib/interviews/slots'
import { hoursPhrase, minutesPhrase, useBookingRules } from '../../lib/interviews/rules'
import { isLate, lateClock, lateClockLabel, useStudentLate, type LateJoin } from '../../lib/interviews/late'
import { LateBand, LateDrain, LatePill, OtherLine, RedInkFill, lateCard, lateJoinRed, lateTint } from '../../lib/interviews/LateJoin'
import { fmtStampZone } from '../../lib/chat/format'
import { ErrorState, FilmThumb, Sheet, Skeleton, StatusPill, Toggle, text, type Tone } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { borderWidth, color, fontFamilyNative as FF, opacity, radius, space } from '../../theme'
import { useLightStatusBar } from '../../lib/useLightStatusBar'
import { FeedVisibilitySheet } from '../profile/FeedVisibilitySheet'

/**
 * The paid student's Home, as the signed-off mockup draws it
 * (docs/home-jobs-mockup.html): a violet header carrying the greeting, a small
 * credit chip and Chat; the visibility switch; the audience numbers; the next
 * interview; the video resume and scorecard; and the two job lists. Every
 * number comes from the dashboard API; the screen derives words, never facts.
 * Tapping a card opens its detail sheet. No shadows.
 */

export interface PaidHomeProps {
  me: { name?: string; unusedCount: number }
  onBook: () => void
  onJoin: (id: string) => void
  onReschedule: (id: string) => void
  onFeedback: (id: string) => void
  onVideoResume: () => void
  onChat: () => void
  onInterests: () => void
  onInterviews: () => void
  onSavedJobs: () => void
  onApplications: () => void
}

type SheetKey = 'views' | 'shortlist' | 'interests' | 'interview' | 'film' | 'score' | null

const creditLabel = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`

function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

const FILM_PILL: Record<FilmState, { tone: Tone; label: string }> = {
  published: { tone: 'success', label: '✓ Published' },
  processing: { tone: 'warning', label: 'Rendering' },
  failed: { tone: 'danger', label: 'Could not be made' },
  unpublished: { tone: 'danger', label: 'Taken down' },
  none: { tone: 'neutral', label: 'No film yet' },
}

export function PaidHome(props: PaidHomeProps) {
  const { me, onBook, onChat, onInterviews, onSavedJobs, onApplications } = props
  const insets = useSafeAreaInsets()
  const now = useNow()
  const today = new Date(now)
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: loadDashboard })
  const [sheet, setSheet] = useState<SheetKey>(null)
  // The gradient is drawn at the header's measured size; a percentage-sized SVG collapses inside a content-sized view.
  const [hdr, setHdr] = useState({ w: 0, h: 0 })
  useLightStatusBar()

  const firstName = me.name?.split(' ')[0]
  const greeting = firstName ? `${greetingFor(today.getHours())}, ${firstName}` : greetingFor(today.getHours())
  const data = dash.data

  return (
    <View style={s.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={dash.isRefetching} onRefresh={() => dash.refetch().then(() => undefined)} tintColor={color.textSubtle} />
        }
      >
        {/* ── header ─────────────────────────────────────────────── */}
        <View
          style={[s.header, { paddingTop: insets.top + 14 }]}
          onLayout={(e) => setHdr({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {hdr.w > 0 && (
            <Svg style={StyleSheet.absoluteFill} width={hdr.w} height={hdr.h}>
              <Defs>
                <LinearGradient id="homeHdr" x1="0" y1="0" x2="0.3" y2="1">
                  <Stop offset="0" stopColor={color.accentBright} />
                  <Stop offset="1" stopColor={color.accentDeep} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={hdr.w} height={hdr.h} fill="url(#homeHdr)" />
            </Svg>
          )}
          <View style={s.headerRow}>
            <View style={s.headerText}>
              <Text style={s.date}>{longDate(today)}</Text>
              <Text style={s.greeting} numberOfLines={2}>{greeting}</Text>
            </View>
            <View style={s.headerRight}>
              {me.unusedCount > 0 && (
                <View style={s.credit}><Text style={s.creditText}>{creditLabel(me.unusedCount)}</Text></View>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Chat" onPress={onChat} style={({ pressed }) => [s.chatBtn, pressed && s.pressed]}>
                <Icon name="chat" size={22} tint={color.textInverse} />
              </Pressable>
            </View>
          </View>
        </View>

        {dash.isPending ? (
          <View style={s.pad}><Skeleton lines={4} /></View>
        ) : dash.isError || !data ? (
          <View style={s.pad}>
            <ErrorState title="Could not load your dashboard." body="Nothing has changed on your account. Pull down to try again." />
          </View>
        ) : (
          <Body
            data={data}
            now={now}
            props={props}
            open={setSheet}
            onSavedJobs={onSavedJobs}
            onApplications={onApplications}
            onInterviews={onInterviews}
          />
        )}
      </ScrollView>

      {!!data && data.interviews.length > 0 && (
        <Pressable accessibilityRole="button" onPress={onBook} style={({ pressed }) => [s.fab, pressed && s.pressed]}>
          <Icon name="plus" size={22} tint={color.textInverse} weight={2.2} />
          <Text style={s.fabText}>Book interview</Text>
        </Pressable>
      )}

      {!!data && <Sheets data={data} now={now} sheet={sheet} close={() => setSheet(null)} props={props} />}
    </View>
  )
}

function Body({
  data, now, props, open, onSavedJobs, onApplications, onInterviews,
}: {
  data: DashboardData
  now: number
  props: PaidHomeProps
  open: (k: SheetKey) => void
  onSavedJobs: () => void
  onApplications: () => void
  onInterviews: () => void
}) {
  const next = nextUpcoming(data.interviews, now)
  const done = latestCompleted(data.interviews)
  const film = filmStateOf(data.film, data.audience, done)
  const a = data.audience

  return (
    <>
      <View style={s.overlap}><VisibilityCard audience={a} /></View>

      <View style={[s.pad, s.gapTop]}>
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Your audience</Text>
            <Pressable hitSlop={8} onPress={props.onInterests}><Text style={s.link}>View interests</Text></Pressable>
          </View>
          <View style={s.metrics}>
            <Metric n={a.profileViews} label="Profile views" onPress={() => open('views')} />
            <Metric n={a.shortlistCount} label="Shortlisted by employers" onPress={() => open('shortlist')} />
            <Metric n={a.openInterests} label="Open interests" flag={a.openInterests > 0 ? 'Needs reply' : undefined} last onPress={() => open('interests')} />
          </View>
        </View>
      </View>

      <Section title={next ? 'Upcoming interview' : 'Next step'} action={next ? 'View all' : undefined} onAction={onInterviews} />
      <View style={s.pad}>
        <UpcomingCard iv={next} now={now} props={props} onOpen={() => open('interview')} />
      </View>

      <Section title="Your profile" />
      <View style={[s.pad, s.stack]}>
        <FilmCard film={film} data={data} onPress={() => (film === 'none' ? props.onBook() : open('film'))} />
        {!!data.feedback && !!done && <ScoreCard feedback={data.feedback} onPress={() => open('score')} />}
      </View>

      <Section title="Your jobs" />
      <View style={s.pad}>
        <View style={s.card}>
          <JobRow icon="heart" bg={color.accentSoft} fg={color.accent} title="Saved jobs" sub="Roles you saved from the feed" onPress={onSavedJobs} />
          <View style={s.rowRule} />
          <JobRow icon="clip" bg={color.successSoft} fg={color.successFill} title="Applications" sub="Where each application has reached" onPress={onApplications} />
        </View>
      </View>
    </>
  )
}

// ── pieces ────────────────────────────────────────────────────────────────────

function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!action && <Pressable hitSlop={8} onPress={onAction}><Text style={s.link}>{action}</Text></Pressable>}
    </View>
  )
}

function Metric({ n, label, flag, last, onPress }: { n: number; label: string; flag?: string; last?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.metric, last && s.metricLast]}>
      <Text style={s.metricNum}>{n}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      {!!flag && <Text style={s.metricFlag}>{flag}</Text>}
    </Pressable>
  )
}

/**
 * The one switch that removes the student from the employer feed. Until a film
 * is published there is nothing to switch, so it shows its not-applicable state.
 * Either way it asks first (FeedVisibilitySheet); a failure stays in the sheet.
 */
function VisibilityCard({ audience }: { audience: DashboardData['audience'] }) {
  const qc = useQueryClient()
  const [ask, setAsk] = useState<boolean | null>(null)
  const mut = useMutation({
    mutationFn: (hidden: boolean) => setFeedVisibility(hidden),
    onSuccess: () => setAsk(null),
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
    <View style={s.stack}>
      <View style={[s.card, s.visRow]}>
        <View style={[s.halo, { backgroundColor: live ? color.successHalo : color.neutralHalo }]}>
          <View style={[s.haloDot, { backgroundColor: live ? color.successFill : color.textSubtle }]} />
        </View>
        <View style={s.grow}>
          <Text style={s.visTitle}>{title}</Text>
          <Text style={s.sub}>{sub}</Text>
        </View>
        <Toggle
          on={live}
          tone="success"
          disabled={state === 'none'}
          // While a change is in flight the switch ignores presses instead of going `disabled`.
          onChange={mut.isPending ? undefined : (next) => { mut.reset(); setAsk(!next) }}
          label="Show me in the employer feed"
        />
      </View>
      <FeedVisibilitySheet
        hide={ask}
        busy={mut.isPending}
        error={mut.isError ? 'Could not change your visibility. Nothing was changed. Try again.' : null}
        onConfirm={(hide) => mut.mutate(hide)}
        onClose={() => setAsk(null)}
      />
    </View>
  )
}

function UpcomingCard({
  iv, now, props, onOpen,
}: { iv?: DashboardData['interviews'][number]; now: number; props: PaidHomeProps; onOpen: () => void }) {
  if (!iv) {
    return (
      <View style={s.ink}>
        <View style={s.inkPill}><Text style={s.inkPillText}>Next step</Text></View>
        <Text style={s.inkTitle}>No interview booked yet</Text>
        <Text style={s.inkSub}>Your interview is filmed, and that film becomes your video resume.</Text>
        <View style={s.inkActions}>
          <Pressable accessibilityRole="button" onPress={props.onBook} style={({ pressed }) => [s.inkBtn, s.inkBtnGrow, pressed && s.pressed]}>
            <Text style={s.inkBtnText}>Book an interview</Text>
          </Pressable>
        </View>
      </View>
    )
  }
  return <NextCard iv={iv} now={now} props={props} onOpen={onOpen} />
}

/**
 * The next interview on its ink card. While its join window is open the card carries the
 * late-join warning (docs/late-join-mockups.html, red fill): the clock to the start, then
 * below zero; amber once the student is late, the red fill from `booking.lateRedMinutes`;
 * and whether the interviewer is in the room — a yes/no, never a name (SC-16).
 */
function NextCard({ iv: snapshot, now: coarseNow, props, onOpen }: { iv: DashboardData['interviews'][number]; now: number; props: PaidHomeProps; onOpen: () => void }) {
  const { iv, late, now } = useStudentLate(snapshot, coarseNow)
  const joinable = iv.roomReady || iv.status === 'IN_PROGRESS'
  const on = late.phase !== 'off'
  const red = late.phase === 'red'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the interview details"
      onPress={onOpen}
      style={({ pressed }) => [s.ink, lateCard(late, true), pressed && s.pressed]}
    >
      {red && <RedInkFill />}
      <View style={s.inkTop}>
        {isLate(late) ? <LatePill j={late} onInk /> : (
          <View style={s.inkPill}><Text style={s.inkPillText}>{iv.status === 'IN_PROGRESS' ? 'In progress' : 'Upcoming'}</Text></View>
        )}
        <Text style={s.inkUntil}>{untilLabel(iv, now)}</Text>
      </View>
      <View style={s.inkHead}>
        <View style={s.grow}>
          <Text style={s.inkTitle}>{`${fmtShortDate(iv.slotStart)} · ${fmtTime(iv.slotStart)}`}</Text>
          <Text style={s.inkSub}>{`${iv.durationMin}-minute interview · IST${iv.interviewer ? ` · with ${iv.interviewer.name}` : ''}`}</Text>
        </View>
        {on && <InkClock late={late} />}
      </View>
      {on && (
        <View style={[s.lateStack, s.lateTop]}>
          <LateDrain j={late} onInk />
          <LateBand j={late} onInk />
          <OtherLine j={late} who="Interviewer" onInk />
        </View>
      )}
      <View style={s.inkActions}>
        <Pressable accessibilityRole="button" onPress={() => props.onJoin(iv.id)} style={({ pressed }) => [s.inkBtn, s.inkBtnGrow, red && lateJoinRed.button, pressed && s.pressed]}>
          <Text style={[s.inkBtnText, red && lateJoinRed.label]}>{joinable ? 'Join interview' : 'Test my setup'}</Text>
        </Pressable>
        {iv.canReschedule && (
          <Pressable accessibilityRole="button" onPress={() => props.onReschedule(iv.id)} style={({ pressed }) => [s.inkBtn, s.inkBtnGhost, pressed && s.pressed]}>
            <Text style={s.inkBtnGhostText}>Reschedule</Text>
          </Pressable>
        )}
      </View>
      {!iv.interviewer && <Text style={s.inkNote}>Your interviewer is revealed when the session starts.</Text>}
    </Pressable>
  )
}

/** "Starts in 04:12", then "Since the start −02:14" in the late colour. */
function InkClock({ late }: { late: LateJoin }) {
  return (
    <View style={s.clockCol}>
      <Text style={[text.uiXsMedium, s.clockLabel]}>{lateClockLabel(late)}</Text>
      <Text style={[text.displayGreet, s.clockFig, { color: lateTint(late, true) ?? color.textInverse }]} numberOfLines={1}>{lateClock(late)}</Text>
    </View>
  )
}

function filmLine(film: FilmState, data: DashboardData): string {
  const live = !data.audience.hiddenFromFeed
  const held = data.film?.held ?? false
  const pending = data.film?.pipelinePending ?? false
  return {
    // IC-05: a top-up still owed keeps a READY film off the feed, whatever the visibility switch says.
    published: held ? 'Held back until your top-up is settled' : live ? 'Live in employer feeds' : 'Hidden from employers',
    processing: pending ? 'Not ready yet. We cannot say when it will be.' : 'Your interview is being prepared.',
    failed: 'We could not make a film from your interview.',
    unpublished: 'Your film has been taken down, so employers cannot see it.',
    none: 'The film from your interview is what employers watch before they read a word.',
  }[film]
}

function FilmCard({ film, data, onPress }: { film: FilmState; data: DashboardData; onPress: () => void }) {
  const pill = FILM_PILL[film]
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.card, s.cardRow, pressed && s.pressed]}>
      {film === 'published' && <FilmThumb width={68} />}
      <View style={s.grow}>
        <StatusPill tone={pill.tone} label={pill.label} />
        <Text style={s.rowTitle}>Your video resume</Text>
        <Text style={s.sub}>{filmLine(film, data)}</Text>
      </View>
      <Icon name="chevR" size={18} tint={color.textSubtle} />
    </Pressable>
  )
}

function ScoreCard({ feedback, onPress }: { feedback: NonNullable<DashboardData['feedback']>; onPress: () => void }) {
  const ready = feedback !== 'awaiting' && feedback !== 'unavailable'
  const label = ready ? 'Scorecard' : feedback === 'unavailable' ? 'No scorecard' : 'Scorecard on its way'
  const line = ready
    ? `Overall ${feedback.scorecard.scores.overall} / 10`
    : feedback === 'unavailable' ? 'No feedback for this interview' : 'We’ll notify you the moment it lands.'
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.card, s.cardRow, pressed && s.pressed]}>
      <View style={s.grow}>
        <StatusPill tone={ready ? 'accent' : 'neutral'} label={label} />
        <Text style={s.rowTitle}>{line}</Text>
      </View>
      {ready && <Icon name="chevR" size={18} tint={color.textSubtle} />}
    </Pressable>
  )
}

function JobRow({
  icon, bg, fg, title, sub, onPress,
}: { icon: IconName; bg: string; fg: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.jobRow, pressed && s.pressed]}>
      <View style={[s.jobIcon, { backgroundColor: bg }]}><Icon name={icon} size={20} tint={fg} /></View>
      <View style={s.grow}>
        <Text style={s.jobTitle}>{title}</Text>
        <Text style={s.jobSub}>{sub}</Text>
      </View>
      <Icon name="chevR" size={18} tint={color.textSubtle} />
    </Pressable>
  )
}

// ── detail sheets ─────────────────────────────────────────────────────────────

function Sheets({
  data, now, sheet, close, props,
}: { data: DashboardData; now: number; sheet: SheetKey; close: () => void; props: PaidHomeProps }) {
  const a = data.audience
  const next = nextUpcoming(data.interviews, now)
  const done = latestCompleted(data.interviews)
  const film = filmStateOf(data.film, data.audience, done)
  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api.get<{ scorecard?: { windowHours?: number } }>('/config') })
  const windowHours = cfg.data?.scorecard?.windowHours

  const act = (fn: () => void) => () => { close(); fn() }
  const primary = (label: string, fn: () => void) => (
    <Pressable accessibilityRole="button" onPress={act(fn)} style={({ pressed }) => [s.shBtn, s.shBtnPri, pressed && s.pressed]}>
      <Text style={s.shBtnPriText}>{label}</Text>
    </Pressable>
  )
  const secondary = (label: string, fn: () => void) => (
    <Pressable accessibilityRole="button" onPress={act(fn)} style={({ pressed }) => [s.shBtn, s.shBtnOut, pressed && s.pressed]}>
      <Text style={s.shBtnOutText}>{label}</Text>
    </Pressable>
  )

  if (sheet === 'views') {
    return (
      <S open onClose={close} title="Profile views">
        <Text style={s.big}>{a.profileViews}</Text>
        <Text style={s.prose}>How many times an employer has opened your full profile from the feed. It counts views, not who they were.</Text>
      </S>
    )
  }
  if (sheet === 'shortlist') {
    return (
      <S open onClose={close} title="Shortlisted by employers">
        <Text style={s.big}>{a.shortlistCount}</Text>
        <Rule>This is a live count across all employers. It never says which employers shortlisted you, and a shortlist does not notify you. It is private to them.</Rule>
      </S>
    )
  }
  if (sheet === 'interests') {
    return (
      <S open onClose={close} title="Open interests" primary={primary('Open Interests', props.onInterests)}>
        <Text style={s.big}>{a.openInterests}</Text>
        <Text style={s.prose}>An Interest is an employer asking to talk. Accept to open a chat, or decline — declining is silent and the employer sees only “Not accepted”.</Text>
      </S>
    )
  }
  if (sheet === 'interview' && next) {
    return <InterviewSheet next={next} now={now} close={close} props={props} act={act} secondary={secondary} />
  }
  if (sheet === 'film') {
    const pill = FILM_PILL[film]
    return (
      <S
        open
        onClose={close}
        title="Your video resume"
        primary={primary('Open video resume', props.onVideoResume)}
      >
        <View style={s.cardRow}>
          {film === 'published' && <FilmThumb width={68} />}
          <View style={s.grow}>
            <StatusPill tone={pill.tone} label={pill.label} />
            {film === 'published' && <Text style={s.rowTitle}>Verified interview</Text>}
            {!!data.film?.interviewedAt && <Text style={s.sub}>{`Interviewed ${fmtShortDate(data.film.interviewedAt)}`}</Text>}
          </View>
        </View>
        <Rule>{filmLine(film, data)}</Rule>
        {film === 'unpublished' && !!data.film?.reason && <Rule>{data.film.reason}</Rule>}
        {film === 'published' && <Rule>Employers always see your verified interview first. You can switch visibility on the Home screen.</Rule>}
      </S>
    )
  }
  if (sheet === 'score' && data.feedback && done) {
    const f = data.feedback
    if (f === 'awaiting' || f === 'unavailable') {
      return (
        <S open onClose={close} title="Your scorecard" secondary={secondary('Back to my interviews', props.onInterviews)}>
          {f === 'awaiting' ? (
            <>
              <Text style={s.headline}>Your feedback is on its way.</Text>
              <Text style={s.prose}>
                {windowHours != null
                  ? `Your interviewer writes it up after the session and has up to ${hoursPhrase(windowHours)} after the session to send it — we’ll notify you the moment it does.`
                  : 'Your interviewer writes it up after the session — we’ll notify you the moment it does.'}
              </Text>
            </>
          ) : (
            <Text style={s.headline}>Feedback will not be available for this interview.</Text>
          )}
        </S>
      )
    }
    const sc = f.scorecard
    return (
      <S open onClose={close} title="Your scorecard">
        <Text style={s.sub}>{fmtStampZone(f.slotStart)}</Text>
        <View style={s.scoreHero}>
          <View style={s.scoreNum}>
            <Text style={s.scoreBig}>{sc.scores.overall}</Text>
            <Text style={s.scoreOf}>/10</Text>
          </View>
          <View style={s.grow}>
            <Text style={s.scoreEyebrow}>Overall score</Text>
            <Text style={s.scoreBody}>From your interviewer, out of ten.</Text>
          </View>
        </View>
        <View style={s.privateRow}>
          <Text style={s.privateTag}>Private</Text>
          <Text style={s.privateText}>Employers never see your scores or this note — only your video resume.</Text>
        </View>
        <View style={s.card}>
          {([
            ['Communication', sc.scores.communication],
            ['Domain knowledge', sc.scores.domainKnowledge],
            ['Confidence and presence', sc.scores.confidence],
            ['Problem solving', sc.scores.problemSolving],
          ] as const).map(([label, v], i, all) => (
            <View key={label} style={[s.scoreRow, i < all.length - 1 && s.scoreRowRule]}>
              <Text style={s.scoreLabel}>{label}</Text>
              <Text style={s.scoreVal}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={s.card}>
          <Text style={[s.noteHead, { color: color.success }]}>↑ Did well</Text>
          <Text style={s.prose}>{sc.strengths}</Text>
        </View>
        <View style={s.card}>
          <Text style={[s.noteHead, { color: color.warning }]}>→ Sharpen</Text>
          <Text style={s.prose}>{sc.improvements}</Text>
        </View>
      </S>
    )
  }
  return null
}

/**
 * The next interview's sheet. While the join window is open it carries the same warning as
 * the card — the band and whether the interviewer is in — and Join turns red past the red point.
 */
function InterviewSheet({
  next: snapshot, now: coarseNow, close, props, act, secondary,
}: {
  next: DashboardData['interviews'][number]
  now: number
  close: () => void
  props: PaidHomeProps
  act: (fn: () => void) => () => void
  secondary: (label: string, fn: () => void) => React.ReactNode
}) {
  const { rules } = useBookingRules()
  const { iv: next, late, now } = useStudentLate(snapshot, coarseNow)
  const joinable = next.roomReady || next.status === 'IN_PROGRESS'
  const red = late.phase === 'red'
  return (
    <S
      open
      onClose={close}
      title="Your interview"
      primary={
        <Pressable accessibilityRole="button" onPress={act(() => props.onJoin(next.id))} style={({ pressed }) => [s.shBtn, s.shBtnPri, red && lateJoinRed.button, pressed && s.pressed]}>
          <Text style={s.shBtnPriText}>{joinable ? 'Join interview' : 'Test my setup'}</Text>
        </Pressable>
      }
      secondary={next.canReschedule ? secondary('Reschedule', () => props.onReschedule(next.id)) : undefined}
    >
      {late.phase !== 'off' && (
        <View style={s.lateStack}>
          <LateBand j={late} />
          <OtherLine j={late} who="Interviewer" />
        </View>
      )}
      <View style={s.facts}>
        <Fact k="Date" v={fmtShortDate(next.slotStart)} />
        <Fact k="Time" v={`${fmtTime(next.slotStart)} IST`} />
        <Fact k="Length" v={`${next.durationMin} minutes`} />
        <Fact k={late.secondsLate > 0 ? 'Since the start' : 'Starts'} v={late.phase !== 'off' ? lateClock(late) : untilLabel(next, now)} tint={lateTint(late, false)} />
      </View>
      {!!rules && (
        <Rule>
          {`The join button opens ${minutesPhrase(rules.joinOpensMinutesBefore)} before the start${
            rules.noShowMinutesAfter != null ? ` and stays open for ${minutesPhrase(rules.noShowMinutesAfter)} after` : ''
          }.`}
        </Rule>
      )}
      <Rule>The device check is required before you join: camera, microphone, speaker and network.</Rule>
      {!!rules && next.canReschedule && (
        <Rule>
          {`You can reschedule for free up to ${hoursPhrase(rules.rescheduleCutoffHours)} before.${
            rules.freeCancellationHours != null ? ` Cancel more than ${hoursPhrase(rules.freeCancellationHours)} ahead for a full refund.` : ''
          }`}
        </Rule>
      )}
      <Rule>Your interviewer’s name and photo appear when the session starts.</Rule>
    </S>
  )
}

/** The shared Sheet with the mockup's 14-point rhythm between its blocks. */
function S({ children, ...rest }: React.ComponentProps<typeof Sheet>) {
  return <Sheet {...rest}><View style={s.sbody}>{children}</View></Sheet>
}

const Fact = ({ k, v, tint }: { k: string; v: string; tint?: string | null }) => (
  <View style={s.fact}>
    <Text style={s.factKey}>{k}</Text>
    <Text style={[s.factVal, !!tint && { color: tint }]}>{v}</Text>
  </View>
)
const Rule = ({ children }: { children: React.ReactNode }) => (
  <View style={s.rule}><Text style={s.ruleText}>{children}</Text></View>
)

// ── styles (mockup measurements; theme colours and faces) ─────────────────────

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  content: { paddingBottom: 130 },
  pad: { paddingHorizontal: 20 },
  gapTop: { marginTop: 12 },
  stack: { gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },

  header: { backgroundColor: color.accentDeep, paddingHorizontal: 20, paddingBottom: 70, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  date: { fontFamily: FF.body, fontSize: 14, color: color.accentMuted },
  greeting: { fontFamily: FF.bodyBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.66, color: color.textInverse, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  credit: {
    paddingVertical: 6, paddingHorizontal: 9, borderRadius: radius.pill,
    backgroundColor: color.onInkGround, borderWidth: borderWidth.thin, borderColor: color.onInkEdge,
  },
  creditText: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.textInverse, fontVariant: ['tabular-nums'] },
  chatBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.onInkPlay, alignItems: 'center', justifyContent: 'center' },

  overlap: { marginTop: -44, paddingHorizontal: 20 },
  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, padding: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text },
  link: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.accent },
  sub: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted },

  visRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  halo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  haloDot: { width: 11, height: 11, borderRadius: 6 },
  visTitle: { fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text },

  metrics: { flexDirection: 'row' },
  metric: { flex: 1, paddingHorizontal: 12, borderRightWidth: borderWidth.thin, borderRightColor: color.border },
  metricLast: { borderRightWidth: 0, paddingRight: 0 },
  metricNum: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 32, letterSpacing: -1.35, color: color.text },
  metricLabel: { fontFamily: FF.body, fontSize: 13, lineHeight: 17, color: color.textMuted, marginTop: 6 },
  metricFlag: { fontFamily: FF.bodyMedium, fontSize: 10, color: color.accent, marginTop: 6 },

  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  sectionTitle: { fontFamily: FF.bodyBold, fontSize: 19, letterSpacing: -0.48, color: color.text },

  ink: { backgroundColor: color.ink, borderRadius: 18, padding: 18 },
  inkTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inkPill: { alignSelf: 'flex-start', backgroundColor: color.onInkGround, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  inkPillText: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.textInverse },
  inkUntil: { fontFamily: FF.bodyMedium, fontSize: 11, color: color.textOnInkMuted },
  inkTitle: { fontFamily: FF.bodyBold, fontSize: 22, letterSpacing: -0.66, color: color.textInverse, marginTop: 12 },
  // The late-join clock sits beside the title, its foot on the subtitle's line (the mockup's row).
  inkHead: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  clockCol: { alignItems: 'flex-end' },
  clockLabel: { color: color.textOnInkBody },
  clockFig: { fontVariant: ['tabular-nums'] },
  lateStack: { gap: space.md },
  lateTop: { marginTop: space.lg },
  inkSub: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textOnInkBody, marginTop: 4 },
  inkActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inkBtn: { height: 46, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  inkBtnGrow: { flex: 1 },
  inkBtnText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.accentDeep },
  inkBtnGhost: { backgroundColor: 'transparent', borderWidth: borderWidth.thin, borderColor: color.onInkOutline },
  inkBtnGhostText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.textInverse },
  inkNote: { fontFamily: FF.body, fontSize: 12.5, color: color.textOnInkSubtle, marginTop: 12 },

  rowTitle: { fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text, marginTop: 6 },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  jobIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  jobTitle: { fontFamily: FF.bodySemiBold, fontSize: 16, color: color.text },
  jobSub: { fontFamily: FF.body, fontSize: 13.5, color: color.textMuted },
  rowRule: { height: borderWidth.thin, backgroundColor: color.border, marginVertical: 10 },

  fab: {
    position: 'absolute', right: 16, bottom: 16, height: 52, borderRadius: radius.pill, backgroundColor: color.accent,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 20,
  },
  fabText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.textInverse },

  // sheets
  sbody: { gap: 14 },
  big: { fontFamily: FF.bodyBold, fontSize: 56, lineHeight: 58, letterSpacing: -2.8, color: color.text },
  prose: { fontFamily: FF.body, fontSize: 15, lineHeight: 23, color: color.textSecondary },
  headline: { fontFamily: FF.bodyBold, fontSize: 28, lineHeight: 31, letterSpacing: -1.1, color: color.text },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { width: '48%', flexGrow: 1, backgroundColor: color.surfaceMuted, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13 },
  factKey: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.textMuted },
  factVal: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text, marginTop: 3 },
  rule: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  ruleText: { fontFamily: FF.body, fontSize: 14, lineHeight: 21, color: color.textSecondary },
  shBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, flex: 1 },
  shBtnPri: { backgroundColor: color.accent },
  shBtnPriText: { fontFamily: FF.bodyBold, fontSize: 16, color: color.textInverse },
  shBtnOut: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  shBtnOutText: { fontFamily: FF.bodyBold, fontSize: 16, color: color.text },

  scoreHero: { backgroundColor: color.ink, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18 },
  scoreNum: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  scoreBig: { fontFamily: FF.bodyBold, fontSize: 64, lineHeight: 66, letterSpacing: -3, color: color.textInverse },
  scoreOf: { fontFamily: FF.body, fontSize: 16, color: color.textOnInkSubtle },
  scoreEyebrow: { fontFamily: FF.bodyMedium, fontSize: 11, color: color.accentMuted },
  scoreBody: { fontFamily: FF.body, fontSize: 14, color: color.textOnInkSoft, marginTop: 4 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.successSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  privateTag: { fontFamily: FF.bodyMedium, fontSize: 10.5, color: color.textInverse, backgroundColor: color.successFill, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7, overflow: 'hidden' },
  privateText: { flex: 1, fontFamily: FF.body, fontSize: 13, color: color.success },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  scoreRowRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  scoreLabel: { fontFamily: FF.body, fontSize: 15, color: color.text },
  scoreVal: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  noteHead: { fontFamily: FF.bodySemiBold, fontSize: 14, marginBottom: 6 },
})
