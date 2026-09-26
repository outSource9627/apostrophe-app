import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvAction, IvGlow, IvLabel, IvOwedRow, IvStat } from '../../components/interviewer/iv'
import { EmError } from '../../components/employer/em'
import { formatPaise } from '../../lib/format/money'
import { useNow } from '../../lib/employer/useNow'
import { useAppConfig, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import { clock, hms, istDateKey, istTime, istWeekday, joinState, monthNameOf, owedClock, sessionLine } from '../../lib/interviewer/state'
import type { RootStackParamList } from '../../../App'

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
      <InterviewerShell bar="brand">
        {loading ? (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        ) : (
          <EmError title="Couldn’t load your home." body={error?.message} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { refresh() }} />} />
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

  let nextCard: React.ReactNode
  if (next) {
    const j = joinState(next, config, now)
    const toStart = Math.max(0, Math.floor((Date.parse(next.slotStart) - now) / 1000))
    const today = istDateKey(next.slotStart) === istDateKey(now)
    const when = today ? istTime(next.slotStart) : `${istWeekday(next.slotStart)} · ${istTime(next.slotStart)}`
    const label =
      j.kind === 'open' ? (j.rejoin ? 'Rejoin room' : 'Join room')
        : j.kind === 'closed' ? 'Join window closed'
          : j.opensInSec != null ? `Join opens in ${clock(j.opensInSec)}` : 'Join opens before the start'
    nextCard = (
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerDetail', { id: next.interviewId })} style={({ pressed }) => [styles.next, pressed && styles.pressed]}>
        <IvGlow />
        <View style={styles.nextTop}>
          <IvLabel tone="accent">{`NEXT · ${when.toUpperCase()}`}</IvLabel>
          <Text style={[text.metaTile, styles.fig]}>{clock(toStart)}</Text>
        </View>
        <View style={styles.who}>
          <Text style={text.displayCard} numberOfLines={1}>{next.student.name}</Text>
          <Text style={[text.uiSm, styles.muted]} numberOfLines={1}>{sessionLine({ tier: next.tier, domain: next.domain, languages: next.student.languages, language: next.language })}</Text>
        </View>
        <IvAction
          label={label}
          tone={j.kind === 'open' && !suspended ? 'accent' : 'off'}
          onPress={j.kind === 'open' && !suspended ? () => navigation.navigate('InterviewerRoom', { id: next.interviewId }) : undefined}
        />
      </Pressable>
    )
  } else {
    const openSlots = me.availability?.openSlots ?? 0
    nextCard = (
      <View style={styles.next}>
        <IvGlow />
        <IvLabel tone="accent">NEXT</IvLabel>
        <View style={styles.who}>
          <Text style={text.displayCard}>No interviews booked.</Text>
          <Text style={[text.uiSm, styles.muted]}>
            {openSlots > 0 ? `${openSlots} open ${openSlots === 1 ? 'slot is' : 'slots are'} published for students to book.` : 'Publish hours so students can book you.'}
          </Text>
        </View>
        <IvAction label={openSlots > 0 ? 'Open more hours' : 'Publish hours'} onPress={() => navigation.navigate('InterviewerAvailability')} />
      </View>
    )
  }

  return (
    <InterviewerShell bar="brand">
      <View style={styles.grid}>
        <View style={styles.row}>
          <IvStat k="DONE" v={s ? String(s.conducted) : '—'} />
          <IvStat k="COMPLETION" v={pct(s?.completionPct)} tone={s?.completionPct != null ? 'success' : 'ink'} />
        </View>
        <View style={styles.row}>
          <IvStat k="ON-TIME" v={pct(s?.onTimeScorecardPct)} tone={s?.onTimeScorecardPct != null ? 'success' : 'ink'} />
          <IvStat k={month ? monthNameOf(month.month).toUpperCase() : 'THIS MONTH'} v={month ? formatPaise(month.earnedPaise) : '—'} />
        </View>
      </View>

      {nextCard}

      <IvLabel style={styles.section}>SCORECARDS OWED</IvLabel>
      {open.length === 0 && closed.length === 0 ? (
        <View style={styles.none}><Text style={[text.uiSm, styles.success]}>None to write. Every scorecard is in.</Text></View>
      ) : (
        <>
          {open.map((r) => {
            const c = owedClock(r, config, now)
            const secs = c.status === 'OPEN' || c.status === 'URGENT' ? c.secondsLeft : 0
            return (
              <IvOwedRow
                key={r.interviewId}
                name={r.student.name}
                line={r.payable ? `${formatPaise(r.feePaise)} releases on submit` : 'Submit to close the interview'}
                clock={hms(secs)}
                urgent={c.status === 'URGENT'}
                onPress={() => navigation.navigate('ScorecardDraft', { id: r.interviewId })}
              />
            )
          })}
          {closed.map((r) => (
            <IvOwedRow key={r.interviewId} name={r.student.name} line="Closed · fee withheld" clock="00:00:00" onPress={() => navigation.navigate('InterviewerDetail', { id: r.interviewId })} />
          ))}
        </>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  success: { color: color.success },
  loading: { paddingVertical: space['3xl'] },
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  next: { borderRadius: radius['card-lg'], backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, padding: spaceHalf['4.5'], gap: space.md, overflow: 'hidden' },
  nextTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fig: { letterSpacing: 0 },
  who: { gap: space['2xs'] + 1 },
  section: { marginTop: space.xs },
  none: { borderRadius: radius.panel, backgroundColor: color.successWash, borderWidth: borderWidth.thin, borderColor: color.successEdge, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'] },
})
