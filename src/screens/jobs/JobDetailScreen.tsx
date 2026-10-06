import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { swipeJob, type JobDetail } from '../../lib/api/jobs'
import { applicationMark, dateLine, deadlineLine, employmentLabel, experienceLine, locationLine, salaryRange } from '../../lib/jobs/format'
import { borderWidth, color, fontFamilyNative as FF, fontSize, opacity, radius } from '../../theme'
import { StatusPill } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { Btn, DetailHeader, FooterBar, Panel, Skel } from '../../components/tab/kit'
import { JobBullets, JobCompany, JobProse, JobSkills, JobVideo } from './jobParts'
import { Notice } from './jobKit'

const initialsOf = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const DAY = 86_400_000

/**
 * ST-36 — the full post, as option A of docs/student-job-detail-mockup.html
 * draws it: a violet-washed hero (logo, company, title, pay, deadline, tags)
 * over the sections, with a sticky bar below. One violet Apply is the only
 * primary; Save is secondary. A duplicate is refused outright, so "already
 * applied" is a calm resting state (status + date), never an error; a closed
 * post disables Apply.
 */
export function JobDetailScreen({ id, onBack, onApply, onApplications }: {
  id: string; onBack: () => void; onApply: (id: string) => void; onApplications: () => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['job', id], queryFn: () => api.get<JobDetail>(`/students/me/jobs/${id}`) })
  const save = useMutation({ mutationFn: () => swipeJob(id, 'RIGHT'), onSuccess: () => qc.invalidateQueries({ queryKey: ['job', id] }) })

  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}><DetailHeader title="Job" onBack={onBack} />{c}</View>
  if (q.isPending) {
    return frame(
      <View style={styles.skel}>
        <Skel w="80%" h={34} /><Skel w="45%" h={18} /><Skel w="100%" h={90} /><Skel w="100%" h={90} /><Skel w="100%" h={140} />
      </View>,
    )
  }
  if (q.isError) {
    const closed = q.error instanceof ApiClientError && q.error.code === 'CONFLICT'
    return frame(<View style={styles.errWrap}><Notice tone="warning">{closed ? 'Applications for this job have closed.' : 'This job is no longer available.'}</Notice></View>)
  }

  const job = q.data!
  const applied = job.application
  const salary = salaryRange(job.salary)
  const deadline = deadlineLine(job.applicationDeadline)
  const open = !deadline || deadline !== 'Closed'
  const closesAt = job.applicationDeadline ? new Date(job.applicationDeadline).getTime() : null
  const soon = open && closesAt != null && closesAt > Date.now() && closesAt - Date.now() <= 7 * DAY
  const companyLine = [job.company.industry, job.company.size ? `${job.company.size} people` : null, job.company.officeLocation].filter(Boolean).join(' · ')
  const dim = !open && !applied
  const chips = [locationLine(job.location, job.remote), employmentLabel(job.employmentType), experienceLine(job.experience)].filter(Boolean)

  const heart = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={job.saved ? 'Saved' : 'Save'}
      disabled={save.isPending || job.saved}
      onPress={() => save.mutate()}
      style={({ pressed }) => [styles.heart, job.saved && styles.heartOn, pressed && styles.pressed]}
    >
      <Icon name="heart" size={22} tint={job.saved ? color.accent : color.textMuted} fill={job.saved ? color.accent : undefined} />
    </Pressable>
  )

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <DetailHeader title="Job" onBack={onBack} right={heart} />
          <View style={styles.heroBody}>
            <View style={styles.coRow}>
              <View style={[styles.logo, dim && styles.logoDim]}><Text style={styles.logoText}>{initialsOf(job.company.name)}</Text></View>
              <View style={styles.grow}>
                <Text style={styles.coName}>{job.company.name}</Text>
                {!!companyLine && <Text style={styles.coLine}>{companyLine}</Text>}
              </View>
            </View>
            <Text style={styles.title}>{job.title}</Text>
            {(!!salary || !!deadline) && (
              <View style={styles.payRow}>
                <Text style={styles.pay}>{salary ?? ' '}</Text>
                {!!deadline && (
                  <View style={[styles.chip, soon && styles.chipSoon, deadline === 'Closed' && styles.chipClosed]}>
                    <Text style={[styles.chipText, soon && styles.chipTextSoon]}>{deadline}</Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.tags}>
              {chips.map((c) => <View key={c} style={styles.tag}><Text style={styles.tagText}>{c}</Text></View>)}
              {job.video?.url ? (
                <View style={styles.vtag}><Icon name="play" size={11} tint={color.accent} fill={color.accent} /><Text style={styles.vtagText}>Video</Text></View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.sections}>
          {applied ? (
            <Panel tone="muted" style={styles.appliedCard}>
              <View style={styles.appliedRow}>
                <StatusPill tone={applicationMark(applied.status).tone} label={applicationMark(applied.status).label} />
                <Text style={styles.appliedAt}>Applied {dateLine(applied.appliedAt)}</Text>
              </View>
              <Btn variant="quiet" label="Track it" onPress={onApplications} style={styles.trackBtn} />
            </Panel>
          ) : null}
          {job.video?.url ? <JobVideo url={job.video.url} /> : null}
          <JobProse title="The role" body={job.description} />
          <JobBullets title="What you’ll do" items={job.responsibilities} />
          <JobBullets title="What they’re looking for" items={job.requirements} />
          <JobBullets title="What you get" items={job.benefits} />
          <JobSkills skills={job.skills} />
          <JobCompany company={job.company} />
        </View>
      </ScrollView>

      {!applied && (
        <FooterBar>
          {open ? (
            <View style={styles.footRow}>
              <Btn variant="outline" label={job.saved ? 'Saved' : 'Save'} disabled={save.isPending || job.saved} onPress={() => save.mutate()} style={styles.saveBtn} />
              <Btn variant="primary" label="Apply with video resume" onPress={() => onApply(job.id)} style={styles.grow} />
            </View>
          ) : (
            <>
              <Btn variant="primary" disabled label="Apply" />
              <Text style={styles.closedNote}>Applications for this job have closed.</Text>
            </>
          )}
        </FooterBar>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  pressed: { opacity: opacity.pressed },
  grow: { flex: 1, minWidth: 0 },
  skel: { paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  errWrap: { paddingHorizontal: 20, paddingVertical: 12 },
  scroll: { paddingBottom: 24 },
  hero: { backgroundColor: color.accentWash, borderBottomWidth: borderWidth.thin, borderBottomColor: color.accentEdge, paddingBottom: 20 },
  heroBody: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  heart: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  heartOn: { backgroundColor: color.accentSoft, borderColor: color.accentEdge },
  coRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accent },
  logoDim: { backgroundColor: color.textSubtle },
  logoText: { fontFamily: FF.bodyBold, fontSize: 19, color: color.textInverse },
  coName: { paddingTop: 2, fontFamily: FF.bodySemiBold, fontSize: 15, color: color.textSecondary },
  coLine: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 19, color: color.textMuted },
  title: { fontFamily: FF.bodyBold, fontSize: 28, lineHeight: 30, letterSpacing: -1.12, color: color.text },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pay: { flex: 1, fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.4, color: color.text },
  chip: { backgroundColor: color.surfaceMuted, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  chipSoon: { backgroundColor: color.warningSoft },
  chipClosed: { backgroundColor: color.surfaceSunken },
  chipText: { fontFamily: FF.bodySemiBold, fontSize: 13, color: color.textMuted },
  chipTextSoon: { color: color.warning },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11 },
  tagText: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.textSecondary },
  vtag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11 },
  vtagText: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.accent },
  sections: { padding: 20, gap: 22 },
  appliedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: 'transparent', borderRadius: 20, gap: 12 },
  appliedRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  appliedAt: { fontFamily: FF.body, fontSize: 13.5, color: color.textMuted },
  trackBtn: { height: 36, paddingHorizontal: 4 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saveBtn: { width: '30%' },
  closedNote: { fontFamily: FF.body, fontSize: 13, lineHeight: 18, color: color.textMuted, textAlign: 'center' },
})
