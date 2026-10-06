import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmChip, EmError, EmIconButton, EmLabel, EmSheet } from '../../components/employer/em'
import { ChipRow, Face, StudioCard, StudioChip, StudioState } from '../../components/employer/studio'
import {
  EMPLOYER_APPLICATION_STATUS_LABEL, fetchEmployerJobDetail, fetchJobApplications, updateApplicationStatus,
  type ApplicationRow, type ApplicationStatus, type EmployerJobDetail, type JobApplicationsResponse,
} from '../../lib/api/employerJobs'
import { JOB_VIEW_LABEL, deadlinePassed, istDay, jobView, useJobConfig } from '../../lib/employer/jobs'
import { useCandidateDocument } from '../../lib/employer/useCandidateDocument'
import { employmentLabel } from '../../lib/jobs/format'
import type { RootStackParamList } from '../../../App'

/** The design's chip order (J2). */
const ORDER: ApplicationStatus[] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'CONNECTED', 'REJECTED']
const PER_PAGE = 100

/** The applicant screen's reasons (ApplicantDetailScreen): one tap fills the field, and it stays editable. */
const REASONS = [
  'The role has been filled',
  'We need more experience for this role',
  'Location doesn’t work for this role',
  'Skills don’t match this role',
]

const IST_MS = 330 * 60_000
const DAY_MS = 86_400_000
const istDayIndex = (t: number) => Math.floor((t + IST_MS) / DAY_MS)

/** 'today', 'yesterday', else '21 Sep' — in India time. */
function appliedWhen(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = istDayIndex(Date.now()) - istDayIndex(t)
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : istDay(iso)
}

/** '6 mo', '1 yr', '2.5 yrs', 'Fresher' — the card's short form of the server's years (one decimal). */
function experienceShort(years: number | null | undefined): string | null {
  if (years == null) return null
  if (years <= 0) return 'Fresher'
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} mo`
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`
}

/** The server's per-status counts; a tally of the rows when an older server sends none. */
function countsOf(res: Pick<JobApplicationsResponse, 'counts'> | null, rows: ApplicationRow[]): Record<ApplicationStatus, number> {
  const c: Record<ApplicationStatus, number> = { APPLIED: 0, VIEWED: 0, SHORTLISTED: 0, CONNECTED: 0, REJECTED: 0 }
  if (res?.counts && Object.keys(res.counts).length) {
    for (const k of ORDER) c[k] = res.counts[k] ?? 0
  } else {
    for (const r of rows) if (r.status in c) c[r.status] += 1
  }
  return c
}

/**
 * J2 · the applicants to one post (Employer Android, the Studio direction):
 * the post's where · type · state, its title, applications · views · deadline,
 * status chips with the server's counts (ink when on), and a card per applicant
 * — face, name, city · experience · when, the video résumé mark, their note,
 * the verified interview date, and Reject / Shortlist on the card — plus CV
 * when they have a résumé file (ST-35), which opens it without leaving the list.
 *
 * The server's rules, as on the applicant screen: opening an applicant marks
 * an Applied one Viewed (its GET does it); the employer moves an application to
 * Shortlisted or Rejected only — Connected happens through the student — and a
 * rejection needs a reason, which the student sees.
 *
 * The applications response names only the post's id and title, so the post's
 * own facts (where, type, state, views, deadline) are read from its detail.
 */
export function JobApplicationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'JobApplications'>>()
  const focused = useIsFocused()
  const insets = useSafeAreaInsets()
  const { id } = route.params
  const { rejectMax } = useJobConfig()

  const [rows, setRows] = useState<ApplicationRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [paging, setPaging] = useState(false)
  const [jobTitle, setJobTitle] = useState('')
  const [job, setJob] = useState<EmployerJobDetail | null>(null)
  const [serverCounts, setServerCounts] = useState<JobApplicationsResponse['counts'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<ApplicationStatus>('APPLIED')
  /** The first read picks the first chip that has applicants in it; after that the chip is the employer's. */
  const picked = useRef(false)

  const [busy, setBusy] = useState<{ id: string; to: 'SHORTLISTED' | 'REJECTED' } | null>(null)
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null)
  const [rejecting, setRejecting] = useState<ApplicationRow | null>(null)
  const [reason, setReason] = useState('')
  const [menu, setMenu] = useState(false)
  const docs = useCandidateDocument()

  const load = useCallback(async () => {
    setError(null)
    const [apps, post] = await Promise.allSettled([fetchJobApplications(id, { perPage: PER_PAGE }), fetchEmployerJobDetail(id)])
    if (post.status === 'fulfilled') setJob(post.value)
    if (apps.status === 'rejected') {
      setError(apps.reason instanceof Error ? apps.reason.message : 'Could not load the applicants.')
      return
    }
    const res = apps.value
    setRows(res.rows)
    setTotal(res.total ?? res.rows.length)
    setPage(1)
    setJobTitle(res.job?.title ?? '')
    setServerCounts(res.counts ?? null)
    if (!picked.current) {
      picked.current = true
      const c = countsOf(res, res.rows)
      const first = ORDER.find((s) => c[s] > 0)
      if (first) setTab(first)
    }
  }, [id])

  // Every return reads again: a status changed on the applicant shows here.
  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  /** The next page, when a post has more applicants than one read returns. */
  const loadMore = useCallback(async () => {
    if (paging || !rows || rows.length >= total) return
    setPaging(true)
    try {
      const res = await fetchJobApplications(id, { perPage: PER_PAGE, page: page + 1 })
      setRows((prev) => {
        const seen = new Set((prev ?? []).map((r) => r.id))
        return [...(prev ?? []), ...res.rows.filter((r) => !seen.has(r.id))]
      })
      setPage(page + 1)
      setTotal(res.total ?? total)
      if (res.counts) setServerCounts(res.counts)
    } catch {
      // The next scroll to the end asks again.
    } finally {
      setPaging(false)
    }
  }, [paging, rows, total, id, page])

  async function move(row: ApplicationRow, to: 'SHORTLISTED' | 'REJECTED', rejectionReason?: string) {
    setBusy({ id: row.id, to })
    setNotice(null)
    try {
      await updateApplicationStatus(row.id, { status: to, rejectionReason })
      setRejecting(null)
      setReason('')
      await load()
    } catch (e) {
      setNotice({ id: row.id, text: e instanceof Error ? e.message : 'Could not update the application.' })
    } finally {
      setBusy(null)
    }
  }

  async function openResume(row: ApplicationRow) {
    const c = row.candidate
    if (!c?.resume) return
    setNotice(null)
    const failed = await docs.open(c.id, c.resume.id)
    if (failed) setNotice({ id: row.id, text: failed })
  }

  const counts = useMemo(() => countsOf(serverCounts ? { counts: serverCounts } : null, rows ?? []), [serverCounts, rows])
  const all = ORDER.reduce((n, s) => n + counts[s], 0)
  const shown = useMemo(() => (rows ?? []).filter((r) => r.status === tab), [rows, tab])

  const title = job?.title ?? jobTitle
  const v = job ? jobView(job) : null
  const meta = job
    ? [
        job.location,
        job.remote && !/remote/i.test(job.location ?? '') ? 'Remote' : null,
        job.employmentType ? employmentLabel(job.employmentType as Parameters<typeof employmentLabel>[0]) : null,
        v ? JOB_VIEW_LABEL[v] : null,
      ].filter(Boolean).join(' · ')
    : ''
  const closes = job
    ? job.applicationDeadline
      ? `${deadlinePassed(job.applicationDeadline) ? 'closed' : 'closes'} ${istDay(job.applicationDeadline)}`
      : 'no deadline'
    : null
  const views = job?.counters.views ?? null

  const openPost = () => {
    setMenu(false)
    // Came from the post itself: go back to it rather than stacking a second copy.
    const st = navigation.getState()
    const prev = st ? st.routes[st.index - 1] : undefined
    if (prev?.name === 'EmployerJobDetail' && (prev.params as { id?: string } | undefined)?.id === id) navigation.goBack()
    else navigation.navigate('EmployerJobDetail', { id })
  }

  const header = (
    <View>
      <View style={styles.head}>
        {!!meta && <Text style={[text.metaSm, styles.muted]} numberOfLines={1}>{meta}</Text>}
        {!!title && <Text style={text.displayHeading} accessibilityRole="header">{title}</Text>}
        <Text style={[text.uiSm, styles.muted]}>
          <Text style={[text.uiSmSemi, styles.ink]}>{all.toLocaleString('en-IN')}</Text>
          {` ${all === 1 ? 'application' : 'applications'}`}
          {views !== null ? ` · ${views.toLocaleString('en-IN')} ${views === 1 ? 'view' : 'views'}` : ''}
          {closes ? ` · ${closes}` : ''}
        </Text>
      </View>
      {all > 0 && (
        <View style={styles.chips}>
          <ChipRow>
            {ORDER.map((s) => (
              <StudioChip key={s} label={EMPLOYER_APPLICATION_STATUS_LABEL[s]} count={counts[s]} dark={tab === s} onPress={() => setTab(s)} />
            ))}
          </ChipRow>
        </View>
      )}
    </View>
  )

  let body: React.ReactNode
  if (rows === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !rows) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load the applicants." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else {
    body = (
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={styles.headerWrap}
        ListEmptyComponent={
          all === 0 && (rows ?? []).length === 0 ? (
            <View style={styles.empty}>
              <StudioState icon="users" title="No applications yet." body="Applications appear here as students apply to this post." />
            </View>
          ) : (
            <Text style={[text.uiMd, styles.muted, styles.none]}>Nothing here.</Text>
          )
        }
        ListFooterComponent={paging ? <ActivityIndicator color={color.textSubtle} style={styles.more} /> : undefined}
        onEndReached={() => { loadMore() }}
        onEndReachedThreshold={0.5}
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
          <ApplicantCard
            row={item}
            busy={busy}
            notice={notice?.id === item.id ? notice.text : null}
            opening={!!item.candidate?.resume && docs.opening === item.candidate.resume.id}
            onOpen={() => navigation.navigate('ApplicantDetail', { id: item.id })}
            onResume={() => { openResume(item) }}
            onShortlist={() => { move(item, 'SHORTLISTED') }}
            onReject={() => {
              setNotice(null)
              setReason('')
              setRejecting(item)
            }}
            onChat={() => navigation.navigate('EmployerChats')}
          />
        )}
      />
    )
  }

  const rejectingName = rejecting?.candidate?.name ?? ''
  const first = rejectingName.split(' ')[0] || 'The student'
  const rejectBusy = !!busy && busy.to === 'REJECTED'

  return (
    <EmployerShell
      back={() => navigation.goBack()}
      right={<EmIconButton name="more" label="More actions" onPress={() => setMenu(true)} />}
      scroll={false}
    >
      {body}

      <EmSheet open={menu} onClose={() => setMenu(false)} scroll={false}>
        <View style={styles.menu}>
          <Pressable accessibilityRole="button" onPress={openPost} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
            <Icon name="brief" size={spaceHalf['4.5']} tint={color.textSecondary} />
            <Text style={text.uiBaseSemi}>Job post</Text>
          </Pressable>
          {!!v && v !== 'CLOSED' && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenu(false)
                navigation.navigate('JobEditor', { id })
              }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            >
              <Icon name="edit" size={spaceHalf['4.5']} tint={color.textSecondary} />
              <Text style={text.uiBaseSemi}>{v === 'NOT_APPROVED' ? 'Edit and resubmit' : 'Edit'}</Text>
            </Pressable>
          )}
        </View>
      </EmSheet>

      <EmSheet
        open={!!rejecting}
        onClose={() => { if (!rejectBusy) setRejecting(null) }}
        title="Reject application?"
        sub={`${first} sees your reason with the status change.`}
        foot={
          <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
            {!!rejecting && notice?.id === rejecting.id && <Text style={[text.uiSm, styles.danger]}>{notice.text}</Text>}
            <Button
              variant="dangerFill"
              size="lg"
              full
              label="Reject application"
              busy={rejectBusy}
              disabled={rejectBusy || !reason.trim()}
              onPress={() => { if (rejecting) move(rejecting, 'REJECTED', reason.trim()) }}
            />
          </View>
        }
      >
        <View style={styles.reasons}>
          {REASONS.map((r) => <EmChip key={r} label={r} on={reason === r} onPress={() => setReason(r)} />)}
        </View>
        <View style={styles.field}>
          <EmLabel hint={rejectMax ? `${reason.length} / ${rejectMax}` : undefined}>Reason shared with the student</EmLabel>
          <Input value={reason} onChangeText={setReason} maxLength={rejectMax} multiline textAlignVertical="top" placeholder="Why this application didn’t go ahead." style={styles.area} />
        </View>
      </EmSheet>
    </EmployerShell>
  )
}

/** One applicant: face, name, city · experience · when, the résumé mark, the note, then the interview and the two actions. */
function ApplicantCard({
  row, busy, notice, opening, onOpen, onResume, onShortlist, onReject, onChat,
}: {
  row: ApplicationRow
  busy: { id: string; to: 'SHORTLISTED' | 'REJECTED' } | null
  notice: string | null
  /** The résumé's link is being fetched. */
  opening: boolean
  onOpen: () => void
  onResume: () => void
  onShortlist: () => void
  onReject: () => void
  onChat: () => void
}) {
  const c = row.candidate
  const gone = !c || !c.available
  const name = gone ? 'Candidate left Apostrophe' : c.name
  const when = appliedWhen(row.appliedAt)
  const sub = gone
    ? (when ? `applied ${when}` : '')
    : [c.city, experienceShort(c.experienceYears), when ? `applied ${when}` : null].filter(Boolean).join(' · ')
  const interview = !gone && c.verifiedInterview.verified && c.verifiedInterview.at ? istDay(c.verifiedInterview.at) : null

  const status = row.status
  const chat = status === 'CONNECTED' || row.connected
  const canReject = status !== 'REJECTED' && status !== 'CONNECTED'
  const canShortlist = status === 'APPLIED' || status === 'VIEWED' || status === 'REJECTED'
  const mine = busy?.id === row.id
  const slop = { top: (height.tap - height.chip) / 2, bottom: (height.tap - height.chip) / 2 }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        name,
        EMPLOYER_APPLICATION_STATUS_LABEL[status],
        interview ? `Verified interview · ${interview}` : null,
        !gone && row.hasVideoResume ? 'Video résumé' : null,
      ].filter(Boolean).join(', ')}
      onPress={onOpen}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <StudioCard style={styles.card}>
        <View style={styles.top}>
          {gone ? (
            <View style={styles.goneFace}><Icon name="user" size={space.xl} tint={color.textSubtle} /></View>
          ) : (
            <Face name={c.name} photo={c.photoUrl} />
          )}
          <View style={styles.who}>
            <Text style={[text.uiBaseSemi, gone && styles.muted]} numberOfLines={1}>{name}</Text>
            {!!sub && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sub}</Text>}
          </View>
          {!gone && row.hasVideoResume && <EmBadge label="Résumé" tone="violet" icon="video" />}
        </View>

        {!gone && !!row.message && (
          <Text style={[text.uiSm, styles.secondary, styles.italic]} numberOfLines={2}>{`“${row.message}”`}</Text>
        )}

        {!gone && (
          <View style={styles.actions}>
            <View style={styles.interview}>
              {!!interview && (
                <>
                  <Icon name="check" size={space.md} tint={color.success} weight={2.5} />
                  <Text style={[text.uiXsSemi, styles.success]} numberOfLines={1}>{`Interview ${interview}`}</Text>
                </>
              )}
            </View>
            {!!c.resume && (
              <Button
                variant="outline"
                size="sm"
                icon="download"
                label="CV"
                accessibilityLabel={`Download ${name}’s résumé`}
                busy={opening}
                hitSlop={slop}
                onPress={onResume}
                style={styles.btn}
              />
            )}
            {canReject && (
              <Button
                variant="dangerText"
                size="sm"
                label="Reject"
                accessibilityLabel={`Reject ${name}`}
                disabled={!!busy}
                hitSlop={slop}
                onPress={onReject}
                style={[styles.btn, styles.reject]}
              />
            )}
            {chat ? (
              <Button variant="secondary" size="sm" icon="chat" label="Open chat" accessibilityLabel={`Open chat with ${name}`} hitSlop={slop} onPress={onChat} style={styles.btn} />
            ) : canShortlist ? (
              <Button
                variant="secondary"
                size="sm"
                icon="bookmark"
                label="Shortlist"
                accessibilityLabel={`Shortlist ${name}`}
                busy={mine && busy?.to === 'SHORTLISTED'}
                disabled={!!busy}
                hitSlop={slop}
                onPress={onShortlist}
                style={styles.btn}
              />
            ) : (
              <Button variant="quiet" size="sm" icon="bookmark" label="Shortlisted" disabled hitSlop={slop} style={styles.btn} />
            )}
          </View>
        )}

        {!!notice && <Text style={[text.uiXs, styles.danger]}>{notice}</Text>}
      </StudioCard>
    </Pressable>
  )
}

const Gap = () => <View style={styles.gap} />

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  ink: { color: color.text },
  success: { color: color.success },
  danger: { color: color.danger },
  italic: { fontStyle: 'italic' },
  pad: { flex: 1, paddingHorizontal: space.lg },
  loading: { paddingVertical: space['3xl'] },
  more: { paddingVertical: space.lg },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  empty: { paddingTop: space['2xl'] },

  headerWrap: { marginHorizontal: -space.lg, marginBottom: space.md },
  head: { paddingHorizontal: space.xl, gap: space.xs, marginTop: -spaceHalf['1.5'] },
  chips: { paddingTop: spaceHalf['3.5'] },
  list: { paddingHorizontal: space.lg, paddingBottom: space['2xl'] },
  gap: { height: spaceHalf['2.5'] },

  card: { padding: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  who: { flex: 1, minWidth: 0, gap: space['2xs'] },
  goneFace: { width: height.tap, height: height.tap, borderRadius: radius.pill, backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  interview: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  btn: { height: height.chip, paddingHorizontal: spaceHalf['3.5'] },
  reject: { backgroundColor: color.surfaceMuted },

  menu: { paddingHorizontal: space.lg, paddingBottom: space['2xl'] },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: height['control-lg'], paddingHorizontal: space.sm },

  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  field: { gap: spaceHalf['1.5'] },
  area: { height: height['note-field'] + spaceHalf['4.5'], paddingTop: space.md },
  foot: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
})
