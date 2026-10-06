import React, { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative as FF, opacity, space } from '../../theme'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { Skel, StateBlock } from '../../components/tab/kit'
import type { InterviewerInterviewDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { useNow } from '../../lib/employer/useNow'
import {
  clock, groupOf, hms, interviewClock, istTime, istWeekday, joinState, owedClock, pastLabel, sessionLine, type InterviewGroup,
} from '../../lib/interviewer/state'
import { reasonOf, useAppConfig, useInterviewerInterviews, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import { interviewerLateInput, isLate, lateClock, lateJoin, lateRulesOf } from '../../lib/interviews/late'
import { LateBand, LatePill, OtherLine, lateCard, lateTint } from '../../lib/interviews/LateJoin'
import type { RootStackParamList } from '../../../App'

type Tab = 'all' | InterviewGroup
type Tone = 'green' | 'violet' | 'amber' | 'red' | 'gray'
const ORDER: Record<InterviewGroup, number> = { live: 0, owed: 1, upcoming: 2, past: 3 }
const GROUP_NAME: Record<InterviewGroup, string> = { live: 'Live', owed: 'Scorecards owed', upcoming: 'Upcoming', past: 'Past' }
const TONE: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: color.successSoft, fg: color.success },
  violet: { bg: color.accentSoft, fg: color.accentHover },
  amber: { bg: color.warningSoft, fg: color.warning },
  red: { bg: color.dangerSoft, fg: color.danger },
  gray: { bg: color.surfaceMuted, fg: color.textMuted },
}

/** An urgent row's soft red wash, fading out to the right. */
function UrgentWash() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="ivWash" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color.dangerSoft} stopOpacity={1} />
          <Stop offset="0.55" stopColor={color.dangerSoft} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#ivWash)" />
    </Svg>
  )
}

/** The sentence-case status pill; green carries a dot. */
function Pill({ label, tone }: { label: string; tone: Tone }) {
  const t = TONE[tone]
  return (
    <View style={[styles.bd, { backgroundColor: t.bg }]}>
      {tone === 'green' && <View style={styles.bdDot} />}
      <Text style={[styles.bdText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

/** The slim 34px action: violet (Join, Rejoin), red (Join, the student past the red point) or outline (Scorecard). */
function RowBtn({ label, variant, disabled, onPress }: { label: string; variant: 'pri' | 'red' | 'out'; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, variant === 'pri' ? styles.btnPri : variant === 'red' ? styles.btnRed : styles.btnOut, disabled && styles.btnOff, pressed && styles.pressed]}
    >
      <Text style={[styles.btnText, variant !== 'out' && styles.btnTextOn, disabled && styles.btnTextOff]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

/** A count chip: violet, or red when something owed is urgent. */
function Count({ n, red }: { n: number; red?: boolean }) {
  return (
    <View style={[styles.ct, red && { backgroundColor: color.dangerSoft }]}>
      <Text style={[styles.ctText, red && { color: color.danger }]}>{n}</Text>
    </View>
  )
}

function Chip({ label, count, on, onPress }: { label: string; count: number; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={onPress} style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      <View style={[styles.chipCt, on && styles.chipCtOn]}><Text style={[styles.chipCtText, on && styles.chipTextOn]}>{count}</Text></View>
    </Pressable>
  )
}

/** A rounded pulsing block for the loading state (the kit's Skel, clipped). */
function SkelBox({ w, h, round }: { w: number | `${number}%`; h: number; round?: boolean }) {
  return <View style={styles.clip}><Skel w={w} h={h} round={round} /></View>
}

/**
 * Interviews (approved design: docs/interviewer-interviews-mockup.html, option
 * A). Pills with counts over the server's list, grouped by what the interviewer
 * can do: Live (the join window is open), Scorecards owed, Upcoming, Past. Each
 * row: the date and time on the left (an hh:mm:ss clock under it when a
 * scorecard is owed), the candidate and fee, the session line, then the status,
 * the join countdown and the one action — Join or Rejoin, Scorecard.
 *
 * A Live row that is past its start before the session has begun carries the
 * late-join warning (lib/interviews/late.ts): the clock below zero, amber then
 * the red fill, and whether the student is in the room.
 *
 * Statuses and fees are the server's own (each interview's `feePaise`; "Paid"
 * only when the scorecard is in and the interview is payable). While suspended
 * the list is refused by the server, so the page shows the owed scorecards
 * from /interviewers/me instead.
 */
export function InterviewerInterviewsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { me } = useInterviewerMe()
  const { interviews, error, refresh } = useInterviewerInterviews()
  const config = useAppConfig()
  const now = useNow() || Date.now()
  const [tab, setTab] = useState<Tab>('all')
  const [refreshing, setRefreshing] = useState(false)

  const rows = useMemo(() => {
    const list = (interviews ?? []).map((i) => ({ i, g: groupOf(i, config, now) }))
    list.sort((a, b) => ORDER[a.g] - ORDER[b.g] || (a.g === 'past' ? b.i.slotStart.localeCompare(a.i.slotStart) : a.i.slotStart.localeCompare(b.i.slotStart)))
    return list
    // `now` ticks every second; the grouping only needs the minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviews, config, Math.floor(now / 60_000)])
  const count = (g: InterviewGroup) => rows.filter((r) => r.g === g).length
  const suspendedList = reasonOf(error) === 'ACCOUNT_SUSPENDED'

  const open = (i: InterviewerInterviewDto) => navigation.navigate('InterviewerDetail', { id: i.id })

  const lateRules = lateRulesOf(config)
  const renderRow = ({ i, g }: { i: InterviewerInterviewDto; g: InterviewGroup }, last: boolean) => {
    let badge: { label: string; tone: Tone }
    let opens: string | null = null
    const late = lateJoin(interviewerLateInput(i), lateRules, now)
    const warn = g === 'live' && late.phase !== 'off'
    let aside: { text: string; red: boolean } | null = null
    let urgent = false
    let action: React.ReactNode = null
    if (g === 'live') {
      const j = joinState(i, config, now)
      badge = { label: i.status === 'IN_PROGRESS' ? 'In progress' : 'Join open', tone: 'green' }
      action = <RowBtn variant={late.phase === 'red' ? 'red' : 'pri'} label={j.kind === 'open' && j.rejoin ? 'Rejoin' : 'Join'} disabled={!!me && me.status === 'SUSPENDED'} onPress={() => navigation.navigate('InterviewerRoom', { id: i.id })} />
    } else if (g === 'upcoming') {
      const j = joinState(i, config, now)
      badge = { label: 'Booked', tone: 'violet' }
      if (j.kind === 'locked' && j.opensInSec != null && j.opensInSec < 6 * 3600) opens = `Opens in ${clock(j.opensInSec)}`
    } else if (g === 'owed') {
      const c = interviewClock(i, config, now)
      urgent = c.status === 'URGENT'
      badge = { label: 'Scorecard due', tone: urgent ? 'red' : 'violet' }
      if (c.status === 'OPEN' || c.status === 'URGENT') aside = { text: hms(c.secondsLeft), red: urgent }
      action = <RowBtn variant="out" label="Scorecard" onPress={() => navigation.navigate('ScorecardDraft', { id: i.id })} />
    } else {
      const p = pastLabel(i, config, now)
      badge = { label: p.text, tone: p.tone }
    }
    const feeShown = g !== 'past' || pastLabel(i, config, now).text === 'Paid'
    return (
      <Pressable
        key={i.id}
        accessibilityRole="button"
        accessibilityLabel={g === 'owed' ? `${i.student.name}, scorecard due` : undefined}
        onPress={() => open(i)}
        style={({ pressed }) => [styles.ir, !last && styles.irRule, warn && lateCard(late, false), pressed && styles.pressed]}
      >
        {urgent && <UrgentWash />}
        <View style={styles.wh}>
          <Text style={styles.dy} numberOfLines={1}>{istWeekday(i.slotStart)}</Text>
          <Text style={styles.whTime} numberOfLines={1}>{istTime(i.slotStart)}</Text>
          {aside && <Text accessibilityLabel="Left to submit" style={[styles.ck, aside.red && { color: color.danger }]} numberOfLines={1}>{aside.text}</Text>}
        </View>
        <View style={styles.grow}>
          <View style={styles.nl}>
            <Text style={styles.nmx} numberOfLines={1}>{i.student.name}</Text>
            <Text style={styles.fe}>{feeShown ? formatPaise(i.feePaise) : '—'}</Text>
          </View>
          <Text style={styles.sub} numberOfLines={1}>{sessionLine({ tier: i.tier, domain: i.domain, languages: i.student.languages, language: i.language })}</Text>
          {warn && (
            <View style={styles.lateStack}>
              <LateBand j={late} />
              <OtherLine j={late} who={i.student.name.split(' ')[0] || i.student.name} />
            </View>
          )}
          <View style={styles.mt}>
            {warn && isLate(late) ? <LatePill j={late} /> : <Pill label={badge.label} tone={badge.tone} />}
            {warn && late.secondsLate > 0 && (
              <Text style={[styles.ln, styles.lnClock, { color: lateTint(late, false) ?? color.text }]} numberOfLines={1}>{lateClock(late)}</Text>
            )}
            {!!opens && <Text style={styles.ln} numberOfLines={1}>{opens}</Text>}
            {action}
          </View>
        </View>
      </Pressable>
    )
  }

  const card = (list: typeof rows) => <View style={styles.ow}>{list.map((r, k) => renderRow(r, k === list.length - 1))}</View>

  let body: React.ReactNode
  if (suspendedList) {
    const owed = me?.scorecardsOwed?.rows ?? []
    body = (
      <View style={styles.stack}>
        <View style={styles.oh}><Text accessibilityRole="header" style={styles.ohTitle}>Scorecards owed</Text></View>
        {owed.length === 0 ? <Text style={styles.nonetxt}>None to write.</Text> : (
          <View style={styles.ow}>
            {owed.map((r, k) => {
              const urgent = owedClock(r, config, now).status === 'URGENT'
              return (
                <Pressable key={r.interviewId} accessibilityRole="button" onPress={() => navigation.navigate('ScorecardDraft', { id: r.interviewId })} style={({ pressed }) => [styles.ir, styles.irFlex, k < owed.length - 1 && styles.irRule, pressed && styles.pressed]}>
                  {urgent && <UrgentWash />}
                  <View style={styles.grow}>
                    <Text style={[styles.nmx, r.overdue && { color: color.textSecondary }]} numberOfLines={1}>{r.student.name}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{[r.tier, r.domain].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pill label={r.overdue ? 'Closed' : 'Scorecard due'} tone={r.overdue ? 'red' : urgent ? 'red' : 'violet'} />
                </Pressable>
              )
            })}
          </View>
        )}
        <Text style={styles.note}>While suspended the server refuses the interview list, so the page falls back to the owed scorecards.</Text>
      </View>
    )
  } else if (interviews === null && !error) {
    body = (
      <>
        <View style={styles.chips}>{[0, 1, 2, 3].map((k) => <SkelBox key={k} w={96} h={40} round />)}</View>
        <View style={[styles.stack, styles.padTop]} accessibilityLabel="Loading your interviews">
          <View style={styles.ow}>
            {[0, 1, 2, 3].map((k) => (
              <View key={k} style={[styles.ir, k < 3 && styles.irRule]}>
                <View style={[styles.wh, styles.skelWh]}><Skel w="90%" h={11} /><Skel w="100%" h={15} /></View>
                <View style={[styles.grow, styles.skelGrow]}><Skel w="55%" h={16} /><Skel w="75%" h={13} /><Skel w="40%" h={20} round /></View>
              </View>
            ))}
          </View>
        </View>
      </>
    )
  } else if (error && !interviews) {
    body = <StateBlock icon="alert" title="Couldn’t load your interviews." body={error.message} action="Try again" onAction={() => { refresh() }} />
  } else if (rows.length === 0) {
    body = <StateBlock icon="cal" title="No interviews yet." body="Students book the hours you publish. Open more hours to be booked sooner." action="Open more hours" onAction={() => navigation.navigate('InterviewerAvailability')} />
  } else {
    const items: { key: Tab; label: string; n: number }[] = [
      { key: 'all', label: 'All', n: rows.length },
      ...(count('live') ? [{ key: 'live' as Tab, label: 'Live', n: count('live') }] : []),
      { key: 'upcoming', label: 'Upcoming', n: count('upcoming') },
      { key: 'owed', label: 'Owed', n: count('owed') },
      { key: 'past', label: 'Past', n: count('past') },
    ]
    const groups = (['live', 'owed', 'upcoming', 'past'] as InterviewGroup[]).filter((g) => count(g))
    const owedUrgent = rows.some((r) => r.g === 'owed' && interviewClock(r.i, config, now).status === 'URGENT')
    const shown = rows.filter((r) => r.g === tab)
    body = (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
          {items.map((it) => <Chip key={it.key} label={it.label} count={it.n} on={it.key === tab} onPress={() => setTab(it.key)} />)}
        </ScrollView>
        <View style={[styles.stack, styles.padTop]}>
          {tab === 'all' ? groups.map((g) => (
            <React.Fragment key={g}>
              <View style={styles.oh}>
                <Text accessibilityRole="header" style={styles.ohTitle}>{GROUP_NAME[g]}</Text>
                <Count n={count(g)} red={g === 'owed' && owedUrgent} />
              </View>
              {card(rows.filter((r) => r.g === g))}
            </React.Fragment>
          )) : shown.length ? card(shown) : <Text style={styles.nonetxt}>Nothing here.</Text>}
        </View>
      </>
    )
  }

  return (
    <InterviewerShell bar="brand" scroll={false}>
      <ScrollView
        style={styles.grow}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.textSubtle} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false) }} />}
      >
        <View style={styles.head}><Text accessibilityRole="header" style={styles.title}>Interviews</Text></View>
        {body}
      </ScrollView>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  clip: { overflow: 'hidden' },
  grow: { flex: 1, minWidth: 0 },
  page: { paddingBottom: space.lg },
  head: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  title: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 31.5, letterSpacing: -1.2, color: color.text },
  stack: { paddingHorizontal: 20, gap: 14 },
  padTop: { marginTop: 14 },

  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingLeft: 13, paddingRight: 7, borderRadius: 99, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.textSecondary },
  chipTextOn: { color: color.textInverse },
  chipCt: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 99, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  chipCtOn: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  chipCtText: { fontFamily: FF.bodySemiBold, fontSize: 12.5, color: color.textMuted },

  oh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, paddingHorizontal: 2 },
  ohTitle: { fontFamily: FF.bodyBold, fontSize: 19, letterSpacing: -0.57, color: color.text },
  ct: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 10, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  ctText: { fontFamily: FF.bodySemiBold, fontSize: 13, color: color.accentHover },

  ow: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 20, overflow: 'hidden' },
  ir: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, paddingHorizontal: 16 },
  irFlex: { alignItems: 'center' },
  irRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  wh: { width: 86, gap: 2, paddingTop: 1 },
  skelWh: { gap: 6 },
  skelGrow: { gap: 8 },
  dy: { fontFamily: FF.bodyMedium, fontSize: 11.5, color: color.textMuted },
  whTime: { fontFamily: FF.bodySemiBold, fontSize: 14.5, letterSpacing: -0.145, color: color.text },
  ck: { fontFamily: FF.bodyMedium, fontSize: 13, marginTop: 1, color: color.accentHover, fontVariant: ['tabular-nums'] },
  nl: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  nmx: { flexShrink: 1, fontFamily: FF.bodySemiBold, fontSize: 16.5, lineHeight: 20.6, letterSpacing: -0.33, color: color.text },
  fe: { fontFamily: FF.bodyMedium, fontSize: 13, color: color.textSecondary, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted },
  mt: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, minHeight: 26 },
  ln: { flexShrink: 1, fontFamily: FF.bodyMedium, fontSize: 13, color: color.accentHover, fontVariant: ['tabular-nums'] },
  lnClock: { fontFamily: FF.bodySemiBold },
  lateStack: { gap: space.sm, marginTop: space.sm },

  bd: { flexDirection: 'row', alignItems: 'center', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10 },
  bdDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6, backgroundColor: color.successFill },
  bdText: { fontFamily: FF.bodySemiBold, fontSize: 13, lineHeight: 17, letterSpacing: -0.065 },

  btn: { marginLeft: 'auto', height: 34, borderRadius: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnPri: { backgroundColor: color.accent },
  btnRed: { backgroundColor: color.dangerFill },
  btnOut: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.borderStrong },
  btnOff: { backgroundColor: color.surfaceMuted, borderColor: color.surfaceMuted },
  btnText: { fontFamily: FF.bodyBold, fontSize: 14, color: color.text },
  btnTextOn: { color: color.textInverse },
  btnTextOff: { color: color.textSubtle },

  nonetxt: { paddingVertical: 26, paddingHorizontal: 4, textAlign: 'center', fontFamily: FF.body, fontSize: 16, color: color.textMuted },
  note: { paddingHorizontal: 4, fontFamily: FF.body, fontSize: 13, lineHeight: 18.2, color: color.textMuted },
})
