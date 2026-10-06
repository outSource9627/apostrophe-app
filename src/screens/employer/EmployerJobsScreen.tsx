import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, height, opacity, radius, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmError, EmWell, type EmTone } from '../../components/employer/em'
import { ChipRow, StudioCard, StudioChip, StudioState } from '../../components/employer/studio'
import { fetchEmployerJobs, type EmployerJobListResponse, type EmployerJobRow, type JobStatus } from '../../lib/api/employerJobs'
import { salaryLine } from '../../lib/employer/candidateFormat'
import { JOB_VIEW_LABEL, JOB_VIEW_TONE, deadlinePassed, hoursPhrase, istDay, jobView, useJobConfig, type JobView } from '../../lib/employer/jobs'
import { employmentLabel } from '../../lib/jobs/format'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { RootStackParamList } from '../../../App'

/**
 * The status chips (J1). They filter by the post's stored status, so "Drafts"
 * holds both plain drafts and the ones a moderator sent back ("Not approved" is
 * derived per card, never a status of its own). Paused is not drawn in the
 * design's sample; it appears only when a post is paused, so none goes missing.
 */
const CHIPS: { key: JobStatus; label: string }[] = [
  { key: 'PUBLISHED', label: 'Live' },
  { key: 'PENDING_MODERATION', label: 'In review' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PAUSED', label: 'Paused' },
  { key: 'CLOSED', label: 'Closed' },
]

/** The API lists at most this many per request; an employer's posts are read in one go and filtered here. */
const PER_PAGE = 100

/** Views · Saves · Apps · Shortl. — the four live counters (the job detail's row). */
export function JobCounters({ job }: { job: Pick<EmployerJobRow, 'counters'> }) {
  const cells: [number, string][] = [
    [job.counters.views, 'Views'],
    [job.counters.saves, 'Saves'],
    [job.counters.applications, 'Apps'],
    [job.counters.shortlisted, 'Shortl.'],
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

/** The design's muted tile: the four all-time counters, number over a lowercase word. */
function CounterTile({ job }: { job: Pick<EmployerJobRow, 'counters'> }) {
  const cells: [number, string][] = [
    [job.counters.views, 'views'],
    [job.counters.saves, 'saves'],
    [job.counters.applications, 'applied'],
    [job.counters.shortlisted, 'shortlisted'],
  ]
  return (
    <View style={styles.tile} accessible accessibilityLabel={cells.map(([n, l]) => `${n} ${l}`).join(', ')}>
      {cells.map(([n, l]) => (
        <View key={l} style={styles.cell}>
          <Text style={[text.uiLeadSemi, styles.tnum]}>{n.toLocaleString('en-IN')}</Text>
          <Text style={[text.ui2xs, styles.muted]} numberOfLines={1}>{l}</Text>
        </View>
      ))}
    </View>
  )
}

/** 'Pune · Full-time · ₹3.5–5 LPA'. */
function whereLine(job: EmployerJobRow): string {
  return [
    job.location,
    job.remote && !/remote/i.test(job.location ?? '') ? 'Remote' : null,
    job.employmentType ? employmentLabel(job.employmentType as Parameters<typeof employmentLabel>[0]) : null,
    salaryLine(job.salary),
  ].filter(Boolean).join(' · ')
}

/** 'Closes 15 Oct', or 'Closed 15 Oct' once the IST day is over. */
const closesLine = (iso: string) => `${deadlinePassed(iso) ? 'Closed' : 'Closes'} ${istDay(iso)}`

/** The design greys a paused post with a closed one (Live green, In review amber, Not approved red). */
const pillTone = (v: JobView): EmTone => (v === 'PAUSED' ? 'gray' : JOB_VIEW_TONE[v])

/** The server's per-status counts; a tally of the rows when an older server sends none. */
function countsOf(res: EmployerJobListResponse | null, rows: EmployerJobRow[]): Record<JobStatus, number> {
  const c: Record<JobStatus, number> = { DRAFT: 0, PENDING_MODERATION: 0, PUBLISHED: 0, PAUSED: 0, CLOSED: 0 }
  if (res?.counts && Object.keys(res.counts).length) {
    for (const k of Object.keys(c) as JobStatus[]) c[k] = res.counts[k] ?? 0
  } else {
    for (const r of rows) if (r.status in c) c[r.status] += 1
  }
  return c
}

/**
 * J1 · Jobs (Employer Android, the Studio direction): "Post a job" in the bar,
 * status chips with the server's counts (ink when on), and a card per post —
 * the title and its state, where · type · pay, the four counters once a post
 * has been live, the deadline, the openings, the job video, and "Applicants".
 * A post the moderator sent back carries the reason in a red well and "Edit and
 * resubmit". EM-17b is the empty list.
 */
export function EmployerJobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const { state } = useEmployer()
  const verified = Boolean(state?.verified)
  const { moderationHours } = useJobConfig()

  const [res, setRes] = useState<EmployerJobListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<JobStatus>('PUBLISHED')
  /** The first read picks the first chip that has posts in it; after that the chip is the employer's. */
  const picked = useRef(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await fetchEmployerJobs({ perPage: PER_PAGE })
      setRes(next ?? { rows: [], total: 0, page: 1, perPage: PER_PAGE, counts: {} })
      if (!picked.current) {
        picked.current = true
        const c = countsOf(next, next?.rows ?? [])
        const first = CHIPS.find((t) => c[t.key] > 0)
        if (first) setTab(first.key)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your job posts.')
    }
  }, [])

  // Every return reads again: a post edited, paused or approved elsewhere shows as it is.
  useEffect(() => {
    if (verified && focused) load()
  }, [verified, focused, load])

  const rows = res?.rows ?? null
  const counts = useMemo(() => countsOf(res, rows ?? []), [res, rows])
  const all = CHIPS.reduce((n, t) => n + counts[t.key], 0)
  const shown = useMemo(() => (rows ?? []).filter((r) => r.status === tab), [rows, tab])
  const chips = CHIPS.filter((t) => t.key !== 'PAUSED' || counts.PAUSED > 0 || tab === 'PAUSED')
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
  } else if (all === 0 && (rows ?? []).length === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <StudioState
          icon="brief"
          title="No job posts yet."
          body={`Posts appear in the student job feed once approved${moderationHours ? `, usually within ${hoursPhrase(moderationHours)}` : ''}.`}
        >
          <Button variant="primary" size="pair" icon="plus" label="Post a job" onPress={post} />
        </StudioState>
      </View>
    )
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <ChipRow>
            {chips.map((t) => (
              <StudioChip key={t.key} label={t.label} count={counts[t.key]} dark={tab === t.key} onPress={() => setTab(t.key)} />
            ))}
          </ChipRow>
        }
        ListHeaderComponentStyle={styles.chipsWrap}
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
        renderItem={({ item }) => (
          <JobCard
            job={item}
            moderationHours={moderationHours}
            onOpen={() => navigation.navigate('EmployerJobDetail', { id: item.id })}
            onApplicants={() => navigation.navigate('JobApplications', { id: item.id })}
            onEdit={() => navigation.navigate('JobEditor', { id: item.id })}
          />
        )}
      />
    )
  }

  return (
    <EmployerShell
      title="Jobs"
      big={false}
      right={
        verified ? (
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            label="Post a job"
            onPress={post}
            hitSlop={{ top: (height.tap - height['control-banner']) / 2, bottom: (height.tap - height['control-banner']) / 2 }}
            style={styles.post}
          />
        ) : undefined
      }
      scroll={false}
    >
      {body}
    </EmployerShell>
  )
}

/** One post: title and state, where · type · pay, the counters or the state's note, then the deadline line. */
function JobCard({
  job, moderationHours, onOpen, onApplicants, onEdit,
}: { job: EmployerJobRow; moderationHours?: number; onOpen: () => void; onApplicants: () => void; onEdit: () => void }) {
  const v = jobView(job)
  const hasBeenLive = v === 'LIVE' || v === 'PAUSED' || v === 'CLOSED'
  const where = whereLine(job)
  const openings = job.vacancies > 0 ? `${job.vacancies} ${job.vacancies === 1 ? 'opening' : 'openings'}` : null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${JOB_VIEW_LABEL[v]}`}
      onPress={onOpen}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <StudioCard style={styles.card}>
        <View style={styles.top}>
          <View style={styles.titleCol}>
            <Text style={[text.uiLeadSemi, styles.title]}>{job.title}</Text>
            {!!where && <Text style={[text.uiSm, styles.muted]}>{where}</Text>}
          </View>
          <EmBadge label={JOB_VIEW_LABEL[v]} tone={pillTone(v)} />
        </View>

        {hasBeenLive && <CounterTile job={job} />}
        {v === 'IN_REVIEW' && (
          <Text style={[text.uiXs, styles.warning]}>{`In moderation${moderationHours ? ` · usually within ${hoursPhrase(moderationHours)}` : ''}`}</Text>
        )}
        {v === 'NOT_APPROVED' && !!job.moderation.reason && <EmWell label="Moderator" tone="red">{job.moderation.reason}</EmWell>}

        <View style={styles.foot}>
          {job.applicationDeadline ? (
            <View style={styles.fact}>
              <Icon name="cal" size={space.md} tint={color.textMuted} />
              <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{closesLine(job.applicationDeadline)}</Text>
            </View>
          ) : (
            <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>No deadline</Text>
          )}
          {!!openings && (
            <>
              <View style={styles.dot} />
              <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{openings}</Text>
            </>
          )}
          {job.hasVideo && (
            <>
              <View style={styles.dot} />
              <View accessible accessibilityLabel="Job video">
                <Icon name="video" size={spaceHalf['3.5']} tint={color.accentText} />
              </View>
            </>
          )}
          <View style={styles.grow} />
          {hasBeenLive && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Applicants for ${job.title}`}
              hitSlop={space.md}
              onPress={onApplicants}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={[text.uiXsSemi, styles.accent]}>Applicants</Text>
              <Icon name="chevR" size={spaceHalf['3.5']} tint={color.accent} />
            </Pressable>
          )}
        </View>

        {v === 'NOT_APPROVED' ? (
          <Button variant="outline" size="sm" label="Edit and resubmit" style={styles.start} onPress={onEdit} />
        ) : v === 'DRAFT' ? (
          <Button variant="outline" size="sm" label="Continue editing" style={styles.start} onPress={onEdit} />
        ) : null}
      </StudioCard>
    </Pressable>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  accent: { color: color.accent },
  warning: { color: color.warning },
  mono: { letterSpacing: trackingNative.eyebrow },
  tnum: { fontVariant: ['tabular-nums'] },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },

  post: { height: height['control-banner'], paddingHorizontal: spaceHalf['3.5'], marginRight: spaceHalf['2.5'], boxShadow: shadow.accent },
  chipsWrap: { marginHorizontal: -space.lg, marginBottom: spaceHalf['3.5'] },
  list: { paddingHorizontal: space.lg, paddingBottom: space['2xl'] },
  gap: { height: spaceHalf['2.5'] },

  card: { padding: spaceHalf['3.5'], gap: space.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'] },
  titleCol: { flex: 1, minWidth: 0, gap: space['2xs'] },
  title: { letterSpacing: trackingNative['snug-sm'] },
  tile: { flexDirection: 'row', gap: space.xs, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.tile, backgroundColor: color.surfaceMuted },
  cell: { flex: 1, minWidth: 0, gap: space['2xs'] },
  foot: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: color.textDisabled },
  link: { flexDirection: 'row', alignItems: 'center', gap: space['2xs'] },
  start: { alignSelf: 'flex-start' },

  // JobCounters (the job detail's row) — unchanged.
  counters: { flexDirection: 'row', gap: space.xs },
  counter: { flex: 1, gap: space['2xs'] },
})
