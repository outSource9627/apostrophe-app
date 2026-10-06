import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getAudience } from '../../lib/api/account'
import { getInterests, type InterestRow } from '../../lib/api/chat'
import { getApplications, type ApplicationStatus } from '../../lib/api/jobs'
import { fmtDayMon, fmtStampFull, interestClock, ist } from '../../lib/chat/format'
import { applicationMark } from '../../lib/jobs/format'
import { borderWidth, color, fontFamilyNative as FF, fontSize } from '../../theme'
import { InkPill } from '../../components/ui'
import { DetailHeader, Panel, Skel, StateBlock } from '../../components/tab/kit'

const DAY = 86_400_000
const WEEKS = 8
/** The server sends at most this many Interests (newest first); past it the counts cover only those. */
const INTEREST_CAP = 100
const APPLICATION_PAGE = 100
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * ST-48 — Your stats, as analytics: who is looking (views, by day), who kept you
 * (shortlists), who asked (Interests, by week and by outcome), where your
 * applications stand, and how complete the profile they are judging is.
 *
 * Every figure is a COUNT the server already holds — HOW MANY employers
 * shortlisted you, never WHICH (rule 3): no company name, avatar or "most
 * recent" anywhere on this screen. Views per day come from the server's daily
 * split (`viewsByDay`, counted daily only since it shipped); Interests and
 * applications are counted here from the student's own lists. One hue for every
 * bar (magnitude, never identity); tap a bar to read its day or week. When views
 * and shortlists are both zero the figures drain to grey and the honest "it's
 * early" card appears.
 */
export function StatsScreen({ onBack, onVideoResume, onVisibility, onProfile, onInterests, onApplications }: {
  onBack: () => void; onVideoResume: () => void; onVisibility: () => void
  onProfile?: () => void; onInterests?: () => void; onApplications?: () => void
}) {
  const insets = useSafeAreaInsets()
  const [now] = useState(() => Date.now())
  const q = useQuery({ queryKey: ['audience'], queryFn: () => getAudience() })
  // Each card below has its own failure: the headline numbers are still worth showing without them.
  const interestsQ = useQuery({ queryKey: ['interests'], queryFn: () => getInterests() })
  const appsQ = useQuery({ queryKey: ['applications', 'stats'], queryFn: () => getApplications(undefined, 1, APPLICATION_PAGE) })
  const profileQ = useQuery({ queryKey: ['profile'], queryFn: () => api.get<{ completion?: { pct: number; missing: string[] } }>('/students/me/profile') })

  const bar = <DetailHeader title="Your stats" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) {
    return frame(
      <View style={styles.skels}>
        <Skel w="100%" h={220} />
        <View style={styles.cells}><View style={styles.grow}><Skel w="100%" h={110} /></View><View style={styles.grow}><Skel w="100%" h={110} /></View></View>
        <Skel w="100%" h={180} />
      </View>,
    )
  }
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load your stats." body="Try again in a moment." action="Try again" onAction={() => { void q.refetch() }} />)

  const a = q.data!
  const empty = a.shortlistCount === 0 && a.profileViews === 0
  const live = a.published !== false
  const days = a.viewsByDay ?? []
  const completion = profileQ.data?.completion

  return frame(
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Panel style={styles.hero}>
        <Text style={styles.label}>Profile views</Text>
        <Text style={[styles.figure, empty && styles.figureDim]}>{a.profileViews}</Text>
        <Text style={styles.sub}>all time</Text>
        {days.length > 0 && <ViewsChart days={days} hadEarlier={a.profileViews > 0} />}
      </Panel>

      <View style={styles.cells}>
        <Tile value={a.shortlistCount} label="employers shortlisted you" dim={empty} />
        <Tile value={a.openInterests} label={a.openInterests === 1 ? 'Interest waiting for your reply' : 'Interests waiting for your reply'} dim={a.openInterests === 0} onPress={a.openInterests > 0 ? onInterests : undefined} />
      </View>

      <InterestsCard q={interestsQ} now={now} onOpen={onInterests} />
      <ApplicationsCard q={appsQ} onOpen={onApplications} />
      {!!completion && <CompletionCard pct={completion.pct} missing={completion.missing} onProfile={onProfile} />}

      {/* All three headline numbers are running totals, not a window — say so rather than imply one. */}
      <Text style={styles.foot}>{`Totals are all time · as of ${fmtStampFull(now)}`}</Text>

      <View style={styles.well}>
        <Text style={styles.wellLabel}>Anonymous by design</Text>
        <Text style={styles.wellText}>You see how many employers viewed or shortlisted you, never which ones — and they aren&rsquo;t told you saw the number.</Text>
      </View>

      {empty && (
        <View style={styles.ink}>
          <InkPill label={live ? 'It’s early' : 'Not live yet'} />
          <Text style={styles.inkTitle}>{live ? 'Employers are only just finding you.' : 'Nobody can see you yet.'}</Text>
          <Text style={styles.inkBody}>
            {live
              ? 'A new profile usually gets its first views within a week or two of joining the feed.'
              : 'Your profile joins the employer feed when your interview film is published.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onVideoResume} style={({ pressed }) => [styles.inkBtn, pressed && styles.pressed]}>
            <Text style={styles.inkBtnText}>{live ? 'Add another video' : 'See your profile'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onVisibility} hitSlop={8} style={styles.inkLink}>
            <Text style={styles.inkLinkText}>Check who can see you →</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>,
  )
}

/** A server day key ('2026-10-05') as the instant that IST day began. */
const dayStart = (key: string) => `${key}T00:00:00.000+05:30`
const dayName = (key: string) => `${DOW[ist(dayStart(key)).dow]} ${fmtDayMon(dayStart(key))}`

/** Views per day for the last 30 days: the one chart the server's daily split feeds. */
function ViewsChart({ days, hadEarlier }: { days: { date: string; views: number }[]; hadEarlier: boolean }) {
  const total = days.reduce((n, d) => n + d.views, 0)
  const busiest = days.reduce((b, d) => (d.views > b.views ? d : b), days[0])
  return (
    <View style={styles.chartBlock}>
      {/* The daily split is newer than the total: say so rather than draw an empty month under a real number. */}
      {total === 0 && hadEarlier && <Text style={styles.note}>Views are now counted day by day. Earlier views are in the total above but not drawn here.</Text>}
      <Columns
        heading={`Last ${days.length} days`}
        summary={`${total} ${total === 1 ? 'view' : 'views'}`}
        values={days.map((d) => d.views)}
        describe={(i) => `${dayName(days[i].date)} · ${days[i].views} ${days[i].views === 1 ? 'view' : 'views'}`}
        startLabel={fmtDayMon(dayStart(days[0].date))}
        endLabel="Today"
        a11y={`Profile views per day, last ${days.length} days: ${total} in all${total ? `, most on ${dayName(busiest.date)} with ${busiest.views}` : ''}.`}
      />
    </View>
  )
}

/**
 * A single-series column chart: one hue, 4px-rounded tops square on a hairline
 * baseline, a 2px gap between columns, the top value as the only tick. A tap
 * reads one column in the heading line; a second tap on it goes back to the total.
 */
function Columns({ heading, summary, values, describe, startLabel, endLabel, a11y }: {
  heading: string; summary: string; values: number[]; describe: (i: number) => string
  startLabel: string; endLabel: string; a11y: string
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const max = Math.max(1, ...values)
  return (
    <View style={styles.chart}>
      <View style={styles.chartHead}>
        <Text style={styles.chartHeading}>{heading}</Text>
        <Text style={styles.chartValue} accessibilityLiveRegion="polite">{picked === null ? summary : describe(picked)}</Text>
      </View>
      <View accessible accessibilityLabel={a11y} style={styles.plot}>
        <Text style={styles.tick}>{String(max)}</Text>
        <View style={styles.topRule} />
        <View style={styles.columns}>
          {values.map((v, i) => {
            const on = picked === i
            const dim = picked !== null && !on
            return (
              <Pressable key={i} accessibilityLabel={describe(i)} onPress={() => setPicked(on ? null : i)} style={styles.slot}>
                {v > 0
                  ? <View style={[styles.col, { height: `${(v / max) * 100}%` }, dim && styles.colDim]} />
                  : <View style={styles.colZero} />}
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{startLabel}</Text>
        <Text style={styles.axisText}>{endLabel}</Text>
      </View>
    </View>
  )
}

function Tile({ value, label, dim, onPress }: { value: number; label: string; dim: boolean; onPress?: () => void }) {
  const body = (
    <>
      <Text style={[styles.tileFigure, dim && styles.figureDim]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </>
  )
  if (!onPress) return <Panel style={styles.tile}>{body}</Panel>
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.grow, pressed && styles.pressed]}>
      <Panel style={styles.tileFill}>{body}</Panel>
    </Pressable>
  )
}

/** One labelled count with a bar against the largest in its group (magnitude, one hue). */
function Breakdown({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <View style={styles.rows}>
      {rows.map((r) => (
        <View key={r.label} style={styles.row} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
          <Text style={styles.rowLabel}>{r.label}</Text>
          <View style={styles.rowTrack}>
            {r.value > 0 && <View style={[styles.rowFill, { width: `${(r.value / max) * 100}%` }]} />}
          </View>
          <Text style={styles.rowValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  )
}

function CardHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.cardHead}>
      <Text style={styles.cardTitle}>{title}</Text>
      {!!action && !!onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}><Text style={styles.cardAction}>{action}</Text></Pressable>
      )}
    </View>
  )
}

function Failed({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={styles.failed}>
      <Text style={styles.sub}>{text}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}><Text style={styles.cardAction}>Try again</Text></Pressable>
    </View>
  )
}

/** Interests received: by week (rolling seven-day windows ending today), then by outcome, then the reply rate. */
function InterestsCard({ q, now, onOpen }: { q: { data?: InterestRow[]; isPending: boolean; isError: boolean; refetch: () => unknown }; now: number; onOpen?: () => void }) {
  const stats = useMemo(() => {
    const rows = q.data ?? []
    const weeks = Array.from({ length: WEEKS }, () => 0)
    for (const r of rows) {
      const ago = Math.floor((now - +new Date(r.sentAt)) / (7 * DAY))
      if (ago >= 0 && ago < WEEKS) weeks[WEEKS - 1 - ago] += 1
    }
    // A SENT Interest past its clock has lapsed, exactly as the Interests tab reads it.
    const waiting = rows.filter((r) => r.status === 'SENT' && interestClock(r.sentAt, r.expiresAt, now).reading !== 'spent').length
    const accepted = rows.filter((r) => r.status === 'ACCEPTED').length
    const declined = rows.filter((r) => r.status === 'DECLINED').length
    const lapsed = rows.length - waiting - accepted - declined
    return { total: rows.length, weeks, waiting, accepted, declined, lapsed, capped: rows.length >= INTEREST_CAP }
  }, [q.data, now])

  // Week i is the seven days ending (WEEKS - 1 - i) weeks before now.
  const weekStart = (i: number) => new Date(now - (WEEKS - i) * 7 * DAY).toISOString()
  const decided = stats.accepted + stats.declined + stats.lapsed
  const replied = stats.accepted + stats.declined

  return (
    <Panel style={styles.card}>
      <CardHead title="Interests received" action={stats.total ? 'See all' : undefined} onAction={onOpen} />
      {q.isPending ? <Skel w="100%" h={120} /> : q.isError ? <Failed text="Could not load your Interests." onRetry={() => { q.refetch() }} /> : stats.total === 0 ? (
        <Text style={styles.sub}>No employer has sent you an Interest yet. They arrive here when an employer who watched your film asks to connect.</Text>
      ) : (
        <>
          <Columns
            heading={`Last ${WEEKS} weeks`}
            summary={`${stats.weeks.reduce((n, v) => n + v, 0)} received`}
            values={stats.weeks}
            describe={(i) => `${i === WEEKS - 1 ? 'This week' : `Week of ${fmtDayMon(weekStart(i))}`} · ${stats.weeks[i]} received`}
            startLabel={fmtDayMon(weekStart(0))}
            endLabel="This week"
            a11y={`Interests received per week, last ${WEEKS} weeks: ${stats.weeks.join(', ')}.`}
          />
          <Breakdown rows={[
            { label: 'Accepted', value: stats.accepted },
            { label: 'Declined', value: stats.declined },
            { label: 'Lapsed', value: stats.lapsed },
            { label: 'Waiting', value: stats.waiting },
          ]} />
          {decided > 0 && (
            <View style={styles.meterBlock}>
              <View style={styles.meterHead}>
                <Text style={styles.meterLabel}>You replied to</Text>
                <Text style={styles.meterValue}>{`${replied} of ${decided}`}</Text>
              </View>
              <View accessibilityRole="progressbar" accessibilityLabel="Interests you replied to" accessibilityValue={{ min: 0, max: decided, now: replied }} style={styles.meter}>
                <View style={[styles.meterFill, { width: `${(replied / decided) * 100}%` }]} />
              </View>
            </View>
          )}
          {stats.capped && <Text style={styles.note}>{`Counted from your ${INTEREST_CAP} most recent Interests.`}</Text>}
        </>
      )}
    </Panel>
  )
}

const APPLICATION_ORDER: ApplicationStatus[] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'CONNECTED', 'REJECTED']

/** Where every application stands, by its current status (each is counted once, at its latest step). */
function ApplicationsCard({ q, onOpen }: {
  q: { data?: { rows: { status: ApplicationStatus }[]; total: number }; isPending: boolean; isError: boolean; refetch: () => unknown }
  onOpen?: () => void
}) {
  const rows = q.data?.rows ?? []
  const total = q.data?.total ?? 0
  return (
    <Panel style={styles.card}>
      <CardHead title="Your applications" action={total ? 'See all' : undefined} onAction={onOpen} />
      {q.isPending ? <Skel w="100%" h={120} /> : q.isError ? <Failed text="Could not load your applications." onRetry={() => { q.refetch() }} /> : total === 0 ? (
        <Text style={styles.sub}>You haven&rsquo;t applied to a job yet. Swipe right on the job feed to save one, then apply from your saved list.</Text>
      ) : (
        <>
          <Text style={styles.cardFigure}>{`${total} ${total === 1 ? 'application' : 'applications'}`}</Text>
          <Breakdown rows={APPLICATION_ORDER.map((st) => ({ label: applicationMark(st).label, value: rows.filter((r) => r.status === st).length }))} />
          {total > rows.length && <Text style={styles.note}>{`Counted from your ${rows.length} most recent applications.`}</Text>}
        </>
      )}
    </Panel>
  )
}

function CompletionCard({ pct, missing, onProfile }: { pct: number; missing: string[]; onProfile?: () => void }) {
  const done = Math.min(100, Math.round(pct))
  return (
    <Panel style={styles.card}>
      <CardHead title="Profile strength" action={done < 100 ? 'Finish it' : undefined} onAction={onProfile} />
      <View style={styles.meterHead}>
        <Text style={styles.cardFigure}>{`${done}%`}</Text>
        <Text style={styles.meterLabel}>{done < 100 && missing[0] ? `still empty: ${missing[0]}` : 'of your profile is filled in'}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel="Profile filled in" accessibilityValue={{ min: 0, max: 100, now: done }} style={styles.meter}>
        <View style={[styles.meterFill, { width: `${done}%` }]} />
      </View>
    </Panel>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  skels: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  body: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 10 },
  grow: { flex: 1 },
  pressed: { opacity: 0.7 },

  hero: { padding: 18, gap: 4, borderRadius: 20 },
  label: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.textMuted },
  figure: { fontFamily: FF.bodyBold, fontSize: 64, lineHeight: 66, letterSpacing: -3.2, color: color.text },
  figureDim: { color: color.textSubtle },
  sub: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },

  cells: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, padding: 16, gap: 4, borderRadius: 20 },
  tileFill: { flex: 1, padding: 16, gap: 4, borderRadius: 20 },
  tileFigure: { fontFamily: FF.bodyBold, fontSize: 40, lineHeight: 44, letterSpacing: -1.6, color: color.text },
  tileLabel: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted },

  card: { padding: 16, gap: 14, borderRadius: 20 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontFamily: FF.bodyBold, fontSize: 17, letterSpacing: -0.34, color: color.text },
  cardAction: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.accent },
  cardFigure: { fontFamily: FF.bodyBold, fontSize: 24, letterSpacing: -0.72, color: color.text },
  failed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  note: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 18, color: color.textSubtle },

  chartBlock: { marginTop: 14, gap: 8 },
  chart: { gap: 8 },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  chartHeading: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.textSubtle },
  chartValue: { flexShrink: 1, fontFamily: FF.bodySemiBold, fontSize: 13.5, color: color.text, textAlign: 'right' },
  plot: { height: 96, justifyContent: 'flex-end' },
  tick: { position: 'absolute', top: -2, right: 0, fontFamily: FF.bodyMedium, fontSize: 10, fontVariant: ['tabular-nums'], color: color.textSubtle },
  topRule: { position: 'absolute', top: 12, left: 0, right: 22, height: borderWidth.thin, backgroundColor: color.borderSoft },
  columns: { height: 82, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  col: { width: '100%', maxWidth: 24, minHeight: 3, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: color.accent },
  colDim: { backgroundColor: color.accentMuted },
  colZero: { width: '100%', maxWidth: 24, height: 2, backgroundColor: color.surfaceSunken },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], fontVariant: ['tabular-nums'], color: color.textSubtle },

  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { width: 92, fontFamily: FF.body, fontSize: 14, color: color.textMuted },
  rowTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.surfaceSunken, overflow: 'hidden' },
  rowFill: { height: '100%', borderRadius: 4, backgroundColor: color.accent },
  rowValue: { minWidth: 24, fontFamily: FF.bodySemiBold, fontSize: 14, color: color.text, textAlign: 'right' },

  meterBlock: { gap: 8 },
  meterHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  meterLabel: { flexShrink: 1, fontFamily: FF.body, fontSize: 14, color: color.textMuted, textAlign: 'right' },
  meterValue: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.text },
  meter: { height: 8, borderRadius: 4, backgroundColor: color.accentSoft, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4, backgroundColor: color.accent },

  foot: { fontFamily: FF.body, fontSize: 13, lineHeight: 19, color: color.textSubtle, paddingHorizontal: 4, paddingTop: 4 },
  well: { marginTop: 4, backgroundColor: color.surfaceMuted, borderRadius: 14, padding: 14, gap: 4 },
  wellLabel: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.textMuted },
  wellText: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
  ink: { marginTop: 4, backgroundColor: color.ink, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 20, gap: 12, alignItems: 'flex-start' },
  inkTitle: { fontFamily: FF.bodyBold, fontSize: 24, lineHeight: 26, letterSpacing: -0.84, color: color.textOnInk },
  inkBody: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 22, color: color.textOnInkMuted },
  inkBtn: { height: 46, minWidth: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  inkBtnText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.ink },
  inkLink: { minHeight: 44, justifyContent: 'center' },
  inkLinkText: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.textOnInkMuted },
})
