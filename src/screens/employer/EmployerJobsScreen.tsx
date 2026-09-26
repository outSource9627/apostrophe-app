import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, opacity, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Fab, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, EmEmpty, EmError, EmPills } from '../../components/employer/em'
import { fetchEmployerJobs, type EmployerJobRow } from '../../lib/api/employerJobs'
import { JOB_VIEW_LABEL, JOB_VIEW_TONE, hoursPhrase, jobMeta, jobView, useJobConfig, type JobView } from '../../lib/employer/jobs'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { RootStackParamList } from '../../../App'

type Tab = 'ALL' | JobView

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'LIVE', label: 'Live' },
  { key: 'IN_REVIEW', label: 'In review' },
  { key: 'NOT_APPROVED', label: 'Not approved' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PAUSED', label: 'Paused' },
  { key: 'CLOSED', label: 'Closed' },
]

/** The API lists at most this many per request; an employer's posts are read in one go and filtered here. */
const PER_PAGE = 100

/** VIEWS · SAVES · APPS · SHORTL. — the four live counters. */
export function JobCounters({ job }: { job: Pick<EmployerJobRow, 'counters'> }) {
  const cells: [number, string][] = [
    [job.counters.views, 'VIEWS'],
    [job.counters.saves, 'SAVES'],
    [job.counters.applications, 'APPS'],
    [job.counters.shortlisted, 'SHORTL.'],
  ]
  return (
    <View style={styles.counters}>
      {cells.map(([n, l]) => (
        <View key={l} style={styles.counter}>
          <Text style={text.uiBaseSemi}>{n.toLocaleString('en-IN')}</Text>
          <Text style={[text.metaXs, styles.subtle, styles.mono]}>{l}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * EM-17 · Jobs (Employer Android). Pill tabs with counts over every state a
 * post can be in — "Not approved" is derived (a draft carrying the moderator's
 * reason). Each card: the title and its state, the meta line, the counters once
 * a post has been live, the moderation note, and the one next step. The FAB
 * posts a new job. EM-17b is the empty list.
 */
export function EmployerJobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { state } = useEmployer()
  const verified = Boolean(state?.verified)
  const { moderationHours } = useJobConfig()

  const [rows, setRows] = useState<EmployerJobRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('ALL')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchEmployerJobs({ perPage: PER_PAGE })
      setRows(res?.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your job posts.')
    }
  }, [])

  // Every return reads again: a post edited, paused or approved elsewhere shows as it is.
  useEffect(() => {
    if (verified && focused) load()
  }, [verified, focused, load])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { ALL: 0, LIVE: 0, IN_REVIEW: 0, NOT_APPROVED: 0, DRAFT: 0, PAUSED: 0, CLOSED: 0 }
    for (const r of rows ?? []) {
      c.ALL += 1
      c[jobView(r)] += 1
    }
    return c
  }, [rows])
  const shown = useMemo(() => (rows ?? []).filter((r) => tab === 'ALL' || jobView(r) === tab), [rows, tab])
  const post = () => navigation.navigate('JobEditor', {})

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load your jobs." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if (counts.ALL === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty
          icon="brief"
          title="No job posts yet."
          body={`Posts appear in the student job feed once approved${moderationHours ? `, usually within ${hoursPhrase(moderationHours)}` : ''}.`}
          action={<Button variant="primary" size="pair" icon="plus" label="Post a job" onPress={post} />}
        />
      </View>
    )
  } else {
    body = (
      <>
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Gap}
          ListHeaderComponent={<EmPills<Tab> items={TABS.filter((t) => t.key === 'ALL' || counts[t.key] > 0).map((t) => ({ ...t, count: counts[t.key] }))} value={tab} onChange={setTab} />}
          ListHeaderComponentStyle={styles.pillsWrap}
          ListEmptyComponent={<Text style={[text.uiMd, styles.muted, styles.none]}>Nothing here.</Text>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={color.textSubtle}
              onRefresh={async () => {
                setRefreshing(true)
                await load()
                setRefreshing(false)
              }}
            />
          }
          renderItem={({ item }) => {
            const v = jobView(item)
            const showCounters = v === 'LIVE' || v === 'PAUSED' || v === 'CLOSED'
            const note =
              v === 'IN_REVIEW'
                ? `In moderation${moderationHours ? ` · usually within ${hoursPhrase(moderationHours)}` : ''}`
                : v === 'NOT_APPROVED' && item.moderation.reason
                  ? `Moderator: ${item.moderation.reason}`
                  : null
            const edit = () => navigation.navigate('JobEditor', { id: item.id })
            return (
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('EmployerJobDetail', { id: item.id })} style={({ pressed }) => pressed && styles.pressed}>
                <EmCard tone={v === 'NOT_APPROVED' ? 'danger' : undefined}>
                  <View style={styles.top}>
                    <Text style={[text.uiLeadSemi, styles.grow]}>{item.title}</Text>
                    <EmBadge label={JOB_VIEW_LABEL[v]} tone={JOB_VIEW_TONE[v]} small />
                  </View>
                  {!!jobMeta(item) && <Text style={[text.metaSm, styles.muted, styles.mono]}>{jobMeta(item)}</Text>}
                  {showCounters && <JobCounters job={item} />}
                  {!!note && <Text style={[text.uiXs, v === 'NOT_APPROVED' ? styles.danger : styles.warning]}>{note}</Text>}
                  {v === 'LIVE' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      label={`View applicants (${item.counters.applications})`}
                      onPress={() => navigation.navigate('JobApplications', { id: item.id })}
                    />
                  ) : v === 'NOT_APPROVED' ? (
                    <Button variant="outline" size="sm" label="Edit and resubmit" style={styles.start} onPress={edit} />
                  ) : v === 'DRAFT' ? (
                    <Button variant="outline" size="sm" label="Continue editing" style={styles.start} onPress={edit} />
                  ) : null}
                </EmCard>
              </Pressable>
            )
          }}
        />
        <Fab label="Post a job" onPress={post} glyph={<Icon name="plus" size={space.xl} tint={color.textInverse} weight={2.2} />} />
      </>
    )
  }

  const live = counts.LIVE
  return (
    <EmployerShell
      title="Jobs"
      sub={rows ? `${counts.ALL} ${counts.ALL === 1 ? 'POST' : 'POSTS'} · ${live} LIVE` : undefined}
      scroll={false}
    >
      {body}
    </EmployerShell>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  warning: { color: color.warning },
  mono: { letterSpacing: trackingNative.eyebrow },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  pillsWrap: { marginHorizontal: -space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space['4xl'] + space['2xl'] },
  gap: { height: spaceHalf['2.5'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  start: { alignSelf: 'flex-start' },
  counters: { flexDirection: 'row', gap: space.xs },
  counter: { flex: 1, gap: space['2xs'] },
})
