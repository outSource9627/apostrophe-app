import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvOwedRow } from '../../components/interviewer/iv'
import { EmEmpty, EmError, EmPills } from '../../components/employer/em'
import { listScorecards, type ScorecardOwedRowDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { useNow } from '../../lib/employer/useNow'
import { hms, istDay, owedClock } from '../../lib/interviewer/state'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

type Tab = 'open' | 'closed'

/**
 * Scorecards owed (no artboard — M1's owed rows, as a page). GET
 * /interviewers/me/scorecards: open rows with their live clock (red under
 * `scorecardReminderHoursBefore`) and what submitting releases; closed rows
 * (past `dueAt`) with the fee withheld. Allowed while suspended.
 */
export function PendingScorecardsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const config = useAppConfig()
  const now = useNow() || Date.now()
  const [rows, setRows] = useState<ScorecardOwedRowDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('open')

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows((await listScorecards('ALL')).rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your scorecards.')
    }
  }, [])
  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  const open = (rows ?? []).filter((r) => !r.overdue)
  const closed = (rows ?? []).filter((r) => r.overdue)
  const shown = tab === 'open' ? open : closed

  return (
    <InterviewerShell back={() => navigation.goBack()} title="Scorecards owed" sub={rows ? `${open.length} open · ${closed.length} closed` : undefined} scroll={false}>
      {rows === null && !error ? (
        <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : error && !rows ? (
        <View style={styles.pad}><EmError title="Couldn’t load your scorecards." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /></View>
      ) : (rows ?? []).length === 0 ? (
        <View style={[styles.pad, styles.center]}><EmEmpty icon="check" title="None to write." body="Every scorecard is in." /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.interviewId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<EmPills<Tab> items={[{ key: 'open', label: 'Open', count: open.length }, { key: 'closed', label: 'Closed', count: closed.length }]} value={tab} onChange={setTab} />}
          ListHeaderComponentStyle={styles.pillsWrap}
          ListEmptyComponent={<Text style={[text.uiMd, styles.muted, styles.none]}>Nothing here.</Text>}
          renderItem={({ item: r }) => {
            const c = owedClock(r, config, now)
            const secs = c.status === 'OPEN' || c.status === 'URGENT' ? c.secondsLeft : 0
            return (
              <IvOwedRow
                name={r.student.name}
                line={r.overdue ? `${istDay(r.slotStart)} · closed · fee withheld` : r.payable ? `${istDay(r.slotStart)} · ${formatPaise(r.feePaise)} releases on submit` : `${istDay(r.slotStart)} · submit to close it`}
                clock={hms(secs)}
                urgent={c.status === 'URGENT'}
                onPress={() => navigation.navigate(r.overdue ? 'InterviewerDetail' : 'ScorecardDraft', { id: r.interviewId })}
              />
            )
          }}
        />
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  muted: { color: color.textMuted },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  pillsWrap: { marginHorizontal: -space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
})
