import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { swipeJob, type JobDetail } from '../../lib/api/jobs'
import { applicationMark, dateLine, deadlineLine, salaryRange } from '../../lib/jobs/format'
import { color, space, spaceHalf, radius } from '../../theme'
import { Banner, Button, Card, Skeleton, ScreenHeader, StatusPill, StickyFooter, text } from '../../components/ui'
import { JobBullets, JobCompany, JobFacts, JobProse, JobSkills, JobVideo } from './jobParts'

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

  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}><ScreenHeader title="Job" onBack={onBack} />{c}</View>
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={4} /></View>)
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
      <ScreenHeader title="Job" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={text.displayHeading}>{job.title}</Text>
          <Text style={[text.uiBase, styles.muted]}>{job.company.name}</Text>
          {salary ? <Text style={text.displaySm}>{salary}</Text> : null}
        </View>
        {job.video?.url ? <JobVideo url={job.video.url} /> : null}
        <JobFacts job={job} />

        {applied ? (
          <Card style={styles.appliedCard}>
            <View style={styles.appliedRow}>
              <StatusPill tone={applicationMark(applied.status).tone} label={applicationMark(applied.status).label} />
              <Text style={[text.uiXs, styles.muted]}>Applied {dateLine(applied.appliedAt)}</Text>
            </View>
            <Button variant="text" size="md" label="Track it" onPress={onApplications} />
          </Card>
        ) : null}

        <JobProse title="The role" body={job.description} />
        <JobBullets title="What you’ll do" items={job.responsibilities} />
        <JobBullets title="What they’re looking for" items={job.requirements} />
        <JobBullets title="What you get" items={job.benefits} />
        <JobSkills skills={job.skills} />
        <JobCompany company={job.company} />
      </ScrollView>

      {!applied && (
        <StickyFooter>
          {open ? (
            <View style={styles.footRow}>
              <View style={styles.saveBtn}>
                <Button variant="outline" size="lg" full label={job.saved ? 'Saved' : 'Save'} disabled={save.isPending || job.saved} onPress={() => save.mutate()} />
              </View>
              <View style={styles.grow}>
                <Button variant="primary" size="lg" full label="Apply with video resume" onPress={() => onApply(job.id)} />
              </View>
            </View>
          ) : (
            <>
              <Button variant="primary" size="lg" full disabled label="Apply" />
              <Text style={[text.uiXs, styles.muted]}>Applications for this job have closed.</Text>
            </>
          )}
        </StickyFooter>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.lg, paddingBottom: space.xl },
  head: { gap: space.xs },
  muted: { color: color.textMuted },
  grow: { flex: 1 },
  appliedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0, borderRadius: radius.tile, backgroundColor: color.surfaceMuted, padding: space.md },
  appliedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footRow: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  saveBtn: { width: '30%' },
})
