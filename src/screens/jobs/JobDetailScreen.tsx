import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { swipeJob, type JobDetail } from '../../lib/api/jobs'
import { applicationMark, dateLine, deadlineLine, employmentLabel, experienceLine, locationLine, salaryRange } from '../../lib/jobs/format'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Banner, Body, Button, Display, Eyebrow, Figure, Meta, StatusPill } from '../../components/ui'

/**
 * ST-36 — the full post. One crimson Apply is the only primary; Save is
 * secondary. A duplicate is refused outright, so "already applied" is a calm
 * resting state (status + date), never an error; a closed post disables Apply.
 */
export function JobDetailScreen({ id, onBack, onApply, onApplications }: {
  id: string; onBack: () => void; onApply: (id: string) => void; onApplications: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['job', id], queryFn: () => api.get<JobDetail>(`/students/me/jobs/${id}`) })
  const save = useMutation({ mutationFn: () => swipeJob(id, 'RIGHT'), onSuccess: () => qc.invalidateQueries({ queryKey: ['job', id] }) })

  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Jobs" onBack={onBack} />{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) {
    const closed = q.error instanceof ApiClientError && q.error.code === 'CONFLICT'
    return frame(<View style={{ padding: space.xl }}><Banner tone={closed ? 'warning' : 'danger'}>{closed ? 'Applications for this job have closed.' : 'This job is no longer available.'}</Banner></View>)
  }

  const job = q.data!
  const applied = job.application
  const salary = salaryRange(job.salary)
  const deadline = deadlineLine(job.applicationDeadline)
  const open = !deadline || deadline !== 'Closed'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Jobs" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        {job.video?.url ? <View style={styles.video} /> : null}
        <View style={{ gap: space.xs }}>
          <Display level="lg">{job.title}</Display>
          <Display level="sm" style={{ color: color.textMuted }}>{job.company.name}</Display>
        </View>
        {salary ? <Figure value={salary} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          <KV k="Location" v={locationLine(job.location, job.remote)} />
          <KV k="Type" v={employmentLabel(job.employmentType)} />
          <KV k="Experience" v={experienceLine(job.experience)} />
          {deadline ? <KV k="Deadline" v={deadline} /> : null}
        </View>

        {applied ? (
          <View style={styles.appliedCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <StatusPill tone={applicationMark(applied.status).tone} label={applicationMark(applied.status).label} />
              <Meta style={{ color: color.textSubtle }}>Applied {dateLine(applied.appliedAt)}</Meta>
            </View>
            <Button variant="text" size="md" label="Track it" onPress={onApplications} />
          </View>
        ) : null}

        <Prose title="About the role" body={job.description} />
        <Bullets title="What you will do" items={job.responsibilities} />
        <Bullets title="What we are looking for" items={job.requirements} />
        <Bullets title="What you get" items={job.benefits} />
        {job.skills.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Eyebrow>Skills</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{job.skills.map((s) => <View key={s} style={styles.skill}><Body size="xs" tone="muted">{s}</Body></View>)}</View>
          </View>
        )}
      </ScrollView>

      {!applied && (
        <View style={[styles.foot, { paddingBottom: insets.bottom + space.lg }]}>
          {open ? (
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button variant="outline" size="block" full label={job.saved ? 'Saved' : 'Save'} disabled={save.isPending || job.saved} onPress={() => save.mutate()} />
              <Button variant="primary" size="block" full label="Apply" onPress={() => onApply(job.id)} />
            </View>
          ) : (
            <>
              <Button variant="primary" size="block" full disabled label="Apply" />
              <Meta style={{ color: color.textSubtle, marginTop: space.sm }}>Applications for this job have closed.</Meta>
            </>
          )}
        </View>
      )}
    </View>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <View style={{ gap: 2 }}><Eyebrow>{k}</Eyebrow><Body size="sm">{v}</Body></View>
}
function Prose({ title, body }: { title: string; body?: string }) {
  if (!body) return null
  return <View style={{ gap: space.sm }}><Eyebrow>{title}</Eyebrow><Body size="sm" tone="muted">{body}</Body></View>
}
function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <View style={{ gap: space.sm }}>
      <Eyebrow>{title}</Eyebrow>
      {items.map((it) => (
        <View key={it} style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={styles.dot} /><Body size="sm" style={{ flex: 1 }}>{it}</Body>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.lg, paddingBottom: space['4xl'] },
  video: { aspectRatio: 9 / 16, maxHeight: 340, borderRadius: radius.md, backgroundColor: color.ink },
  appliedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: color.surfaceMuted, padding: space.md },
  skill: { borderRadius: radius.sm, backgroundColor: color.surfaceMuted, paddingHorizontal: space.sm, paddingVertical: space.xs },
  dot: { width: 4, height: 4, borderRadius: 999, backgroundColor: color.borderStrong, marginTop: 8 },
  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingHorizontal: space.xl, paddingTop: space.md },
})
