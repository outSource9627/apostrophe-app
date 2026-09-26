import React, { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvLabel } from '../../components/interviewer/iv'
import { EmBadge, EmEmpty, EmError, EmPills, type EmTone } from '../../components/employer/em'
import type { InterviewerInterviewDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { useNow } from '../../lib/employer/useNow'
import {
  clock, groupOf, hms, interviewClock, istTime, istWeekday, joinState, pastLabel, sessionLine, type InterviewGroup,
} from '../../lib/interviewer/state'
import { reasonOf, useAppConfig, useInterviewerInterviews, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

type Tab = 'all' | InterviewGroup
const ORDER: Record<InterviewGroup, number> = { live: 0, owed: 1, upcoming: 2, past: 3 }

/**
 * Interviews (no artboard — the drawn screens' language). Pills with counts
 * over the server's list, grouped by what the interviewer can do: live (the
 * join window is open), scorecard owed, upcoming, past. Each row: the date and
 * time, the candidate, the session line, the status, the fee, and the one
 * action — Join, Scorecard, or Details.
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
  const shown = tab === 'all' ? rows : rows.filter((r) => r.g === tab)
  const suspendedList = reasonOf(error) === 'ACCOUNT_SUSPENDED'

  const open = (i: InterviewerInterviewDto) => navigation.navigate('InterviewerDetail', { id: i.id })

  let body: React.ReactNode
  if (suspendedList) {
    const owed = me?.scorecardsOwed?.rows ?? []
    body = (
      <View style={styles.pad}>
        <IvLabel>SCORECARDS OWED</IvLabel>
        {owed.length === 0 ? <Text style={[text.uiSm, styles.muted]}>None to write.</Text> : owed.map((r) => (
          <Pressable key={r.interviewId} accessibilityRole="button" onPress={() => navigation.navigate('ScorecardDraft', { id: r.interviewId })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.grow}>
              <Text style={text.uiBaseSemi}>{r.student.name}</Text>
              <Text style={[text.uiXs, styles.muted]}>{[r.tier, r.domain].filter(Boolean).join(' · ')}</Text>
            </View>
            <EmBadge label={r.overdue ? 'Closed' : 'Scorecard due'} tone={r.overdue ? 'red' : 'violet'} small />
          </Pressable>
        ))}
      </View>
    )
  } else if (interviews === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !interviews) {
    body = <View style={styles.pad}><EmError title="Couldn’t load your interviews." body={error.message} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { refresh() }} />} /></View>
  } else if (rows.length === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty icon="cal" title="No interviews yet." body="Students book the hours you publish. Open more hours to be booked sooner." action={<Button variant="primary" size="pair" label="Open more hours" onPress={() => navigation.navigate('InterviewerAvailability')} />} />
      </View>
    )
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={(r) => r.i.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <EmPills<Tab>
            items={[
              { key: 'all', label: 'All', count: rows.length },
              ...(count('live') ? [{ key: 'live' as Tab, label: 'Live', count: count('live') }] : []),
              { key: 'upcoming', label: 'Upcoming', count: count('upcoming') },
              { key: 'owed', label: 'Owed', count: count('owed') },
              { key: 'past', label: 'Past', count: count('past') },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
        ListHeaderComponentStyle={styles.pillsWrap}
        ListEmptyComponent={<Text style={[text.uiMd, styles.muted, styles.none]}>Nothing here.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.textSubtle} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false) }} />}
        renderItem={({ item: { i, g } }) => {
          let badge: { label: string; tone: EmTone }
          let line: string | null = null
          let action: React.ReactNode = null
          if (g === 'live') {
            const j = joinState(i, config, now)
            badge = { label: i.status === 'IN_PROGRESS' ? 'In progress' : 'Join open', tone: 'green' }
            action = <Button variant="primary" size="sm" label={j.kind === 'open' && j.rejoin ? 'Rejoin' : 'Join'} disabled={!!me && me.status === 'SUSPENDED'} onPress={() => navigation.navigate('InterviewerRoom', { id: i.id })} />
          } else if (g === 'upcoming') {
            const j = joinState(i, config, now)
            badge = { label: 'Booked', tone: 'violet' }
            if (j.kind === 'locked' && j.opensInSec != null && j.opensInSec < 6 * 3600) line = `Join opens in ${clock(j.opensInSec)}`
          } else if (g === 'owed') {
            const c = interviewClock(i, config, now)
            badge = { label: 'Scorecard due', tone: c.status === 'URGENT' ? 'red' : 'violet' }
            if (c.status === 'OPEN' || c.status === 'URGENT') line = `${hms(c.secondsLeft)} left to submit`
            action = <Button variant="secondary" size="sm" label="Scorecard" onPress={() => navigation.navigate('ScorecardDraft', { id: i.id })} />
          } else {
            const p = pastLabel(i, config, now)
            badge = { label: p.text, tone: p.tone }
          }
          const feeShown = g !== 'past' || pastLabel(i, config, now).text === 'Paid'
          return (
            <Pressable accessibilityRole="button" onPress={() => open(i)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.when}>
                <Text style={[text.metaSm, styles.muted, styles.mono]}>{istWeekday(i.slotStart).toUpperCase()}</Text>
                <Text style={text.uiMdSemi}>{istTime(i.slotStart)}</Text>
              </View>
              <View style={styles.grow}>
                <Text style={text.uiBaseSemi} numberOfLines={1}>{i.student.name}</Text>
                <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sessionLine({ tier: i.tier, domain: i.domain, languages: i.student.languages, language: i.language })}</Text>
                {!!line && <Text style={[text.metaSm, styles.accentText, styles.mono]}>{line.toUpperCase()}</Text>}
                <View style={styles.meta}>
                  <EmBadge label={badge.label} tone={badge.tone} small />
                  <Text style={[text.metaBase, styles.muted]}>{feeShown ? formatPaise(i.feePaise) : '—'}</Text>
                </View>
              </View>
              {action}
            </Pressable>
          )
        }}
      />
    )
  }

  return (
    <InterviewerShell title="Interviews" sub={interviews ? `${count('upcoming') + count('live')} UPCOMING · ${count('owed')} SCORECARDS OWED` : undefined} scroll={false}>
      {body}
    </InterviewerShell>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  accentText: { color: color.accentText },
  mono: { letterSpacing: trackingNative.eyebrow },
  pad: { flex: 1, paddingHorizontal: space.lg, gap: space.sm },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  pillsWrap: { marginHorizontal: -space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  gap: { height: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'] },
  when: { width: height.fab + space.md, gap: space['2xs'] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space['2xs'] },
})
