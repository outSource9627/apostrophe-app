import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative as FF, opacity } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { Skel, StateBlock } from '../../components/tab/kit'
import { formatPaise } from '../../lib/format/money'
import { useNow } from '../../lib/employer/useNow'
import { useAppConfig, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import { clock, hms, istDateKey, istTime, istWeekday, joinState, monthNameOf, owedClock, sessionLine } from '../../lib/interviewer/state'
import type { RootStackParamList } from '../../../App'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The greeting and the date line, from the device clock (the dashboard carries no name). */
function Greeting({ nowMs }: { nowMs: number }) {
  const d = new Date(nowMs)
  const h = d.getHours()
  return (
    <View style={styles.greet}>
      <Text accessibilityRole="header" style={styles.greetTitle}>{h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}</Text>
      <Text style={styles.greetDate}>{`${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`}</Text>
    </View>
  )
}

/** A tile: tinted 20px chip + sentence-case label over a 33/700 figure that steps down for long values. */
function Tile({ label, value, icon, tint, ok }: { label: string; value: string; icon: IconName; tint: 'info' | 'ok' | 'warn' | 'acc'; ok?: boolean }) {
  const t = { info: [color.infoSoft, color.info], ok: [color.successSoft, color.success], warn: [color.warningSoft, color.warning], acc: [color.accentSoft, color.accent] }[tint]
  const dash = value === '—'
  const size = value.length >= 9 ? 22 : value.length === 8 ? 26 : value.length === 7 ? 29 : 33
  return (
    <View style={styles.tile}>
      <View style={styles.tileTop}>
        <View style={[styles.chip, { backgroundColor: t[0] }]}><Icon name={icon} size={13} tint={t[1]} weight={1.9} /></View>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.fig, { fontSize: size }, ok && !dash && { color: color.success }, dash && { color: color.textSubtle }]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

/** The dark card's violet bloom. */
function HeroGlow() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="hGlow" cx="100%" cy="0%" rx="70%" ry="60%" fx="100%" fy="0%">
          <Stop offset="0" stopColor={color.accentBright} stopOpacity={0.3} />
          <Stop offset="0.7" stopColor={color.accentBright} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#hGlow)" />
    </Svg>
  )
}

/** An urgent row's soft red wash, fading out to the right. */
function UrgentWash() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="uWash" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color.dangerSoft} stopOpacity={1} />
          <Stop offset="0.55" stopColor={color.dangerSoft} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#uWash)" />
    </Svg>
  )
}

type PillTone = 'ok' | 'off'
function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <View style={[styles.pill, tone === 'ok' ? styles.pillOk : styles.pillOff]}>
      {tone === 'ok' && <View style={styles.pillDot} />}
      <Text style={[styles.pillText, { color: tone === 'ok' ? color.successOnInk : color.textOnInkMuted }]}>{label.toUpperCase()}</Text>
    </View>
  )
}

/** The 56px pill: locked (muted, lock), open (white, green dot), rejoin (violet, white dot). */
function JoinButton({ kind, label, lockedIcon, onPress }: { kind: 'locked' | 'open' | 'rejoin'; label: string; lockedIcon?: boolean; onPress?: () => void }) {
  const fg = kind === 'locked' ? color.textOnInkBody : kind === 'open' ? color.accentDeep : color.textInverse
  const bg = kind === 'locked' ? 'rgba(255, 255, 255, 0.09)' : kind === 'open' ? color.surface : color.accent
  const mono = kind === 'locked' && label.startsWith('Join opens in ')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.jb, { backgroundColor: bg }, pressed && styles.pressed]}
    >
      {kind === 'locked' ? (lockedIcon !== false && <Icon name="lock" size={20} tint={fg} weight={1.9} />) : <View style={[styles.jbDot, { backgroundColor: kind === 'open' ? color.successFill : color.textInverse }]} />}
      {mono ? (
        <Text style={[styles.jbText, { color: fg }]} numberOfLines={1}>{'Join opens in '}<Text style={styles.jbMono}>{label.slice('Join opens in '.length)}</Text></Text>
      ) : (
        <Text style={[styles.jbText, { color: fg }]} numberOfLines={1}>{label}</Text>
      )}
    </Pressable>
  )
}

function OwedRow({ name, line, clock: clk, urgent, closed, last, onPress }: { name: string; line: string; clock: string; urgent?: boolean; closed?: boolean; last?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.or, !last && styles.orRule, pressed && styles.pressed]}>
      {urgent && <UrgentWash />}
      <View style={styles.grow}>
        <Text style={[styles.orName, closed && { color: color.textSecondary }]} numberOfLines={1}>{name}</Text>
        <Text style={styles.orSub} numberOfLines={1}>{line}</Text>
      </View>
      {closed ? (
        <Text style={[styles.ck, styles.ckDim]}>{clk}</Text>
      ) : (
        <View style={[styles.ckPill, urgent && { backgroundColor: color.dangerSoft }]}>
          <Text style={[styles.ck, urgent && { color: color.danger }]}>{clk}</Text>
        </View>
      )}
    </Pressable>
  )
}

/** A rounded pulsing block for the loading state (the kit's Skel, clipped to the card's radius). */
function SkelBox({ h, r, w = '100%' }: { h: number; r: number; w?: `${number}%` }) {
  return <View style={[styles.clip, { width: w, height: h, borderRadius: r }]}><Skel w="100%" h={h} /></View>
}

/**
 * M1 · Home (Interviewer App Android). Everything reads the Home fields of
 * GET /interviewers/me and `/config`; no interview list is fetched.
 *
 *   The four tiles    DONE (conducted over `stats.windowDays`), COMPLETION and
 *                     ON-TIME (the server's percentages — a dash while it has
 *                     none), and the month's earnings (`earnedThisMonth`).
 *   Next session      a live countdown to the start; the join button counts
 *                     down to the server's `joinOpensAt`, opens then (or when
 *                     the server says `roomReady`), and closes after the
 *                     no-show window. With nothing booked, the card says so and
 *                     points at Availability.
 *   Scorecards owed   each row's own deadline (`dueAt`) as a live hh:mm:ss, red
 *                     under `scorecardReminderHoursBefore`; closed rows below.
 */
export function InterviewerDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { me, error, loading, refresh, suspended } = useInterviewerMe()
  const config = useAppConfig()
  const now = useNow() || Date.now()

  if (!me) {
    return (
      <InterviewerShell bar="brand" contentGap="lg">
        <Greeting nowMs={now} />
        {loading ? (
          <View style={styles.stack} accessibilityLabel="Loading your home">
            <SkelBox h={270} r={24} />
            <View style={styles.grid}>
              {[0, 1, 2, 3, 4, 5].map((i) => <View key={i} style={styles.cell}><SkelBox h={88} r={18} /></View>)}
            </View>
            <SkelBox h={22} r={10} w="45%" />
            <SkelBox h={140} r={20} />
          </View>
        ) : (
          <StateBlock icon="alert" title="Couldn’t load your home." body={error?.message} action="Try again" onAction={() => { refresh() }} />
        )}
      </InterviewerShell>
    )
  }

  const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}%`)
  const s = me.stats
  const month = me.earnedThisMonth
  const next = me.nextSession ?? null
  const owed = me.scorecardsOwed?.rows ?? []
  const open = owed.filter((r) => !r.overdue)
  const closed = owed.filter((r) => r.overdue)
  const openSlots = me.availability?.openSlots ?? 0
  const monthLabel = month ? (() => { const m = monthNameOf(month.month); return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase() })() : 'This month'

  let nextCard: React.ReactNode
  if (next) {
    const j = joinState(next, config, now)
    const toStart = Math.max(0, Math.floor((Date.parse(next.slotStart) - now) / 1000))
    const today = istDateKey(next.slotStart) === istDateKey(now)
    const when = today ? istTime(next.slotStart) : `${istWeekday(next.slotStart)} · ${istTime(next.slotStart)}`
    const rejoin = j.kind === 'open' && j.rejoin
    const started = rejoin || j.kind === 'closed'
    const label =
      j.kind === 'open' ? (j.rejoin ? 'Rejoin room' : 'Join room')
        : j.kind === 'closed' ? 'Join window closed'
          : j.opensInSec != null ? `Join opens in ${clock(j.opensInSec)}` : 'Join opens before the start'
    const canJoin = j.kind === 'open' && !suspended
    const pill = suspended ? { l: 'Paused', t: 'off' as const }
      : rejoin ? { l: 'In progress', t: 'ok' as const }
        : j.kind === 'open' ? { l: 'Join open', t: 'ok' as const }
          : j.kind === 'closed' ? { l: 'Closed', t: 'off' as const }
            : { l: 'Join locked', t: 'off' as const }
    nextCard = (
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerDetail', { id: next.interviewId })} style={({ pressed }) => [styles.nx, pressed && styles.pressed]}>
        <HeroGlow />
        <View style={styles.nxTop}>
          <Text style={styles.nxLabel} numberOfLines={1}>{`NEXT · ${when.toUpperCase()}`}</Text>
          <StatusPill label={pill.l} tone={pill.t} />
        </View>
        <View style={styles.cd}>
          <Text style={styles.cdFig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{started ? '00:00' : clock(toStart)}</Text>
          <Text style={styles.cdUnit}>{started ? 'Started' : 'to start'}</Text>
        </View>
        <View style={styles.who}>
          <Text style={styles.nm} numberOfLines={1}>{next.student.name}</Text>
          <Text style={styles.nmLine} numberOfLines={1}>{sessionLine({ tier: next.tier, domain: next.domain, languages: next.student.languages, language: next.language })}</Text>
        </View>
        <JoinButton
          kind={canJoin ? (rejoin ? 'rejoin' : 'open') : 'locked'}
          label={label}
          onPress={canJoin ? () => navigation.navigate('InterviewerRoom', { id: next.interviewId }) : undefined}
        />
      </Pressable>
    )
  } else {
    nextCard = (
      <View style={styles.nx}>
        <HeroGlow />
        <View style={styles.nxTop}><Text style={styles.nxLabel}>NEXT</Text></View>
        <View style={styles.who0}>
          <Text style={styles.nm}>No interviews booked.</Text>
          <Text style={styles.nmLine}>
            {openSlots > 0 ? `${openSlots} open ${openSlots === 1 ? 'slot is' : 'slots are'} published for students to book.` : 'Publish hours so students can book you.'}
          </Text>
        </View>
        <JoinButton kind="open" label={openSlots > 0 ? 'Open more hours' : 'Publish hours'} onPress={() => navigation.navigate('InterviewerAvailability')} />
      </View>
    )
  }

  const rows = [
    ...open.map((r) => ({ r, closed: false })),
    ...closed.map((r) => ({ r, closed: true })),
  ]

  return (
    <InterviewerShell bar="brand" contentGap="lg">
      <Greeting nowMs={now} />
      <View style={styles.stack}>
        {nextCard}

        <View style={styles.grid}>
          <View style={styles.cell}><Tile label="Done" value={s ? String(s.conducted) : '—'} icon="checkCircle" tint="info" /></View>
          <View style={styles.cell}><Tile label="Completion" value={pct(s?.completionPct)} icon="pie" tint="ok" ok={s?.completionPct != null} /></View>
          <View style={styles.cell}><Tile label="On-time" value={pct(s?.onTimeScorecardPct)} icon="clock" tint="warn" ok={s?.onTimeScorecardPct != null} /></View>
          <View style={styles.cell}><Tile label={monthLabel} value={month ? formatPaise(month.earnedPaise) : '—'} icon="rupee" tint="acc" /></View>
          <View style={styles.cell}><Tile label="Wallet" value={me.wallet ? formatPaise(me.wallet.availablePaise) : '—'} icon="wallet" tint="acc" /></View>
          <View style={styles.cell}><Tile label="Open slots" value={me.availability ? String(openSlots) : '—'} icon="cal" tint="acc" /></View>
        </View>

        <View style={styles.oh}>
          <Text accessibilityRole="header" style={styles.ohTitle}>Scorecards owed</Text>
          {open.length > 0 && <View style={styles.ct}><Text style={styles.ctText}>{open.length}</Text></View>}
        </View>
        {rows.length === 0 ? (
          <View style={styles.none}>
            <View style={styles.noneChip}><Icon name="checkCircle" size={19} tint={color.success} weight={1.9} /></View>
            <Text style={styles.noneText}>None to write. Every scorecard is in.</Text>
          </View>
        ) : (
          <View style={styles.ow}>
            {rows.map(({ r, closed: isClosed }, i) => {
              const last = i === rows.length - 1
              if (isClosed) {
                return <OwedRow key={r.interviewId} closed last={last} name={r.student.name} line="Closed · fee withheld" clock="00:00:00" onPress={() => navigation.navigate('InterviewerDetail', { id: r.interviewId })} />
              }
              const c = owedClock(r, config, now)
              const secs = c.status === 'OPEN' || c.status === 'URGENT' ? c.secondsLeft : 0
              return (
                <OwedRow
                  key={r.interviewId}
                  last={last}
                  name={r.student.name}
                  line={r.payable ? `${formatPaise(r.feePaise)} releases on submit` : 'Submit to close the interview'}
                  clock={hms(secs)}
                  urgent={c.status === 'URGENT'}
                  onPress={() => navigation.navigate('ScorecardDraft', { id: r.interviewId })}
                />
              )
            })}
          </View>
        )}
      </View>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  clip: { overflow: 'hidden' },
  grow: { flex: 1, minWidth: 0 },
  stack: { gap: 14 },
  greet: { paddingTop: 6, paddingBottom: 4, paddingHorizontal: 4 },
  greetTitle: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 33, letterSpacing: -1.2, color: color.text },
  greetDate: { fontFamily: FF.bodyMedium, fontSize: 15, letterSpacing: -0.075, color: color.textMuted, marginTop: 6 },

  nx: { backgroundColor: color.ink, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, gap: 12, overflow: 'hidden' },
  nxTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nxLabel: { flexShrink: 1, fontFamily: FF.monoMedium, fontSize: 12, letterSpacing: 1.2, color: color.accentMuted },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 11 },
  pillOk: { backgroundColor: color.successOnInkSoft },
  pillOff: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2CC891', marginRight: 6 },
  pillText: { fontFamily: FF.monoMedium, fontSize: 12, letterSpacing: 0.72 },
  cd: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  cdFig: { flexShrink: 1, fontFamily: FF.monoMedium, fontSize: 54, lineHeight: 60, letterSpacing: -2.16, color: color.textOnInk },
  cdUnit: { fontFamily: FF.bodyMedium, fontSize: 14, color: color.textOnInkBody },
  who: { borderTopWidth: borderWidth.thin, borderTopColor: 'rgba(255, 255, 255, 0.12)', paddingTop: 12 },
  who0: { gap: 5 },
  nm: { fontFamily: FF.bodyBold, fontSize: 23, lineHeight: 28, letterSpacing: -0.8, color: color.textOnInk },
  nmLine: { fontFamily: FF.body, fontSize: 15, lineHeight: 21, color: color.textOnInkMuted, marginTop: 5 },
  jb: { height: 56, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  jbDot: { width: 9, height: 9, borderRadius: 5 },
  jbText: { fontFamily: FF.bodyBold, fontSize: 17, letterSpacing: -0.17 },
  jbMono: { fontFamily: FF.monoMedium },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexGrow: 1, flexBasis: '45%', minWidth: 0 },
  tile: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 5, justifyContent: 'center' },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  chip: { width: 20, height: 20, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { flexShrink: 1, fontFamily: FF.bodyMedium, fontSize: 14, lineHeight: 17, letterSpacing: -0.07, color: color.textMuted },
  fig: { fontFamily: FF.bodyBold, fontSize: 33, lineHeight: 36, letterSpacing: -1.5, fontVariant: ['tabular-nums'], color: color.text },

  oh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingHorizontal: 2 },
  ohTitle: { fontFamily: FF.bodyBold, fontSize: 19, letterSpacing: -0.57, color: color.text },
  ct: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 10, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  ctText: { fontFamily: FF.bodySemiBold, fontSize: 13, color: color.accentHover },
  ow: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 20, overflow: 'hidden' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 18, minHeight: 68 },
  orRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  orName: { fontFamily: FF.bodySemiBold, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.33, color: color.text },
  orSub: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted, marginTop: 3 },
  ckPill: { borderRadius: 99, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: color.surfaceMuted },
  ck: { fontFamily: FF.monoMedium, fontSize: 13, color: color.text },
  ckDim: { color: color.textSubtle },
  none: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, backgroundColor: color.successSoft, borderWidth: borderWidth.thin, borderColor: color.successEdge, padding: 18 },
  noneChip: { width: 34, height: 34, borderRadius: 11, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  noneText: { flex: 1, fontFamily: FF.bodySemiBold, fontSize: 16, lineHeight: 22, color: color.success },
})
