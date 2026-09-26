import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, EmDialog, EmError, EmIconButton, EmMono, EmSheet, EmSteps, EmWell, type StepState } from '../../components/employer/em'
import {
  deleteEmployerJob, fetchEmployerJobDetail, setEmployerJobStatus, submitEmployerJob, type EmployerJobDetail,
} from '../../lib/api/employerJobs'
import { salaryLine } from '../../lib/employer/candidateFormat'
import {
  JOB_VIEW_LABEL, JOB_VIEW_TONE, hoursPhrase, istDayYear, istStamp, jobMeta, jobView, useJobConfig,
} from '../../lib/employer/jobs'
import { label } from '../../lib/profile/labels'
import { JobCounters } from './EmployerJobsScreen'
import type { RootStackParamList } from '../../../App'

/** What the moderation card can honestly say from the timestamps the API sends. */
function timeline(job: EmployerJobDetail, hours?: number): { title: string; sub?: string; state: StepState }[] {
  const v = jobView(job)
  const m = job.moderation
  const steps: { title: string; sub?: string; state: StepState }[] = []
  if (m.submittedAt) steps.push({ title: 'Submitted', sub: istStamp(m.submittedAt), state: 'done' })
  if (v === 'IN_REVIEW') steps.push({ title: 'In review', sub: hours ? `Usually within ${hoursPhrase(hours)}` : 'A moderator is looking at it.', state: 'now' })
  else if (v === 'NOT_APPROVED') steps.push({ title: 'Not approved', sub: m.decidedAt ? istStamp(m.decidedAt) : undefined, state: 'bad' })
  else if (m.decidedAt) steps.push({ title: v === 'LIVE' ? 'Approved · live' : 'Approved', sub: istStamp(m.decidedAt), state: 'done' })
  if (v === 'PAUSED') steps.push({ title: 'Paused', sub: 'Not taking applications', state: 'done' })
  if (v === 'CLOSED') steps.push({ title: 'Closed', sub: 'No longer taking applications', state: 'done' })
  if (v === 'DRAFT' && !m.submittedAt) steps.push({ title: 'Not submitted yet', sub: 'Submit it when it is ready.', state: 'todo' })
  return steps
}

/**
 * EM-19 · a job post (Employer Android): its state and meta, the live counters
 * with View applicants, the status controls (Edit, Pause or Resume, Close), the
 * moderation timeline, and the details. EM-19b is the delete confirmation,
 * from the ⋯ menu — with "Close the post instead" where closing still works.
 * Close itself has no confirmation, as on the web, though it is final.
 */
export function JobDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'EmployerJobDetail'>>()
  const focused = useIsFocused()
  const { id } = route.params
  const { moderationHours } = useJobConfig()

  const [job, setJob] = useState<EmployerJobDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setJob(await fetchEmployerJobDetail(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this post.')
    }
  }, [id])

  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  async function act(action: 'PAUSE' | 'RESUME' | 'CLOSE' | 'SUBMIT') {
    if (!job) return
    setBusy(action)
    setNotice(null)
    try {
      const updated = action === 'SUBMIT' ? await submitEmployerJob(job.id) : await setEmployerJobStatus(job.id, action)
      setJob((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update this post.')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!job) return
    setBusy('DELETE')
    setNotice(null)
    try {
      await deleteEmployerJob(job.id)
      setConfirmDelete(false)
      navigation.goBack()
    } catch (e) {
      setConfirmDelete(false)
      setNotice(e instanceof Error ? e.message : 'Could not delete this post.')
    } finally {
      setBusy(null)
    }
  }

  if (!job) {
    return (
      <EmployerShell back={() => navigation.goBack()} title="Job post">
        {error ? (
          <EmError title="This post didn’t load." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </EmployerShell>
    )
  }

  const v = jobView(job)
  const edit = () => navigation.navigate('JobEditor', { id: job.id })
  const hasBeenLive = v === 'LIVE' || v === 'PAUSED' || v === 'CLOSED'
  const meta = [jobMeta(job), job.vacancies ? `${job.vacancies} ${job.vacancies === 1 ? 'VACANCY' : 'VACANCIES'}` : null].filter(Boolean).join(' · ')
  const experience = job.experience.maxYears == null
    ? `${job.experience.minYears}+ years`
    : `${job.experience.minYears}–${job.experience.maxYears} years`
  const details: [string, string | null][] = [
    ['SALARY', salaryLine(job.salary)],
    ['EXPERIENCE', experience],
    ['QUALIFICATION', job.minQualification ? label(job.minQualification) : null],
    ['DEADLINE', job.applicationDeadline ? istDayYear(job.applicationDeadline) : 'None'],
  ]

  return (
    <EmployerShell
      back={() => navigation.goBack()}
      title={job.title}
      right={v !== 'CLOSED' || job.counters.applications === 0 ? <EmIconButton name="more" label="More actions" onPress={() => setMenu(true)} /> : undefined}
    >
      <View style={styles.head}>
        <EmBadge label={JOB_VIEW_LABEL[v]} tone={JOB_VIEW_TONE[v]} />
        {!!meta && <Text style={[text.metaSm, styles.muted, styles.mono, styles.grow]}>{meta}</Text>}
      </View>

      {v === 'NOT_APPROVED' && !!job.moderation.reason && (
        <EmWell label="Moderator" tone="red">{job.moderation.reason}</EmWell>
      )}

      {hasBeenLive && (
        <EmCard>
          <View style={styles.liveHead}>
            {v === 'LIVE' && <View style={styles.dot} />}
            <EmMono>{v === 'LIVE' ? 'LIVE COUNTERS' : 'COUNTERS'}</EmMono>
          </View>
          <JobCounters job={job} />
          <Button
            variant="secondary"
            size="md"
            label={`View applicants (${job.counters.applications})`}
            onPress={() => navigation.navigate('JobApplications', { id: job.id })}
          />
        </EmCard>
      )}

      {v !== 'CLOSED' && (
        <View style={styles.controls}>
          <Button variant="outline" size="md" icon="edit" label={v === 'NOT_APPROVED' ? 'Edit and resubmit' : 'Edit'} style={styles.ctl} onPress={edit} />
          {v === 'LIVE' && <Button variant="outline" size="md" icon="pause" label="Pause" busy={busy === 'PAUSE'} disabled={!!busy} style={styles.ctl} onPress={() => { act('PAUSE') }} />}
          {v === 'PAUSED' && <Button variant="outline" size="md" icon="tri" label="Resume" busy={busy === 'RESUME'} disabled={!!busy} style={styles.ctl} onPress={() => { act('RESUME') }} />}
          {v === 'DRAFT' && <Button variant="primary" size="md" label="Submit" busy={busy === 'SUBMIT'} disabled={!!busy} style={styles.ctl} onPress={() => { act('SUBMIT') }} />}
          {(v === 'LIVE' || v === 'PAUSED') && <Button variant="destructive" size="md" label="Close" busy={busy === 'CLOSE'} disabled={!!busy} style={styles.ctl} onPress={() => { act('CLOSE') }} />}
        </View>
      )}
      {!!notice && <Text style={[text.uiSm, styles.danger]}>{notice}</Text>}

      {timeline(job, moderationHours).length > 0 && (
        <EmCard>
          <EmMono>MODERATION</EmMono>
          <EmSteps steps={timeline(job, moderationHours)} />
        </EmCard>
      )}

      <EmCard>
        <EmMono>DETAILS</EmMono>
        <View style={styles.grid}>
          {details.map(([k, val]) => (
            <View key={k} style={styles.fact}>
              <Text style={[text.metaXs, styles.subtle, styles.mono]}>{k}</Text>
              <Text style={text.uiMd}>{val ?? '—'}</Text>
            </View>
          ))}
        </View>
        {!!job.description && <Text style={[text.uiMd, styles.secondary]}>{job.description}</Text>}
      </EmCard>

      <EmSheet open={menu} onClose={() => setMenu(false)} scroll={false}>
        <View style={styles.menu}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMenu(false)
              setConfirmDelete(true)
            }}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          >
            <Icon name="trash" size={space.lg + 2} tint={color.danger} />
            <Text style={[text.uiBaseSemi, styles.danger]}>Delete post</Text>
          </Pressable>
        </View>
      </EmSheet>

      <EmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this post?"
        body={`It leaves the student feed and your jobs list.${job.counters.applications > 0 ? ' Applicants keep their applications.' : ''} This can’t be undone.`}
        actions={
          <>
            {(v === 'LIVE' || v === 'PAUSED') && (
              <Button
                variant="ghost"
                size="md"
                label="Close instead"
                disabled={!!busy}
                onPress={() => {
                  setConfirmDelete(false)
                  act('CLOSE')
                }}
              />
            )}
            <Button variant="ghost" size="md" label="Cancel" disabled={!!busy} onPress={() => setConfirmDelete(false)} />
            <Button variant="dangerFill" size="md" label="Delete" busy={busy === 'DELETE'} disabled={!!busy} onPress={() => { remove() }} />
          </>
        }
      />
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space['3xl'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.successFill },
  controls: { flexDirection: 'row', gap: space.sm },
  ctl: { flex: 1, minWidth: 0, paddingHorizontal: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spaceHalf['2.5'], columnGap: spaceHalf['2.5'] },
  fact: { width: '47%', flexGrow: 1, gap: space['2xs'] },
  menu: { paddingHorizontal: space.lg, paddingBottom: space['2xl'] },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: height['control-lg'], paddingHorizontal: space.sm },
})
