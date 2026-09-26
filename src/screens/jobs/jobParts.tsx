import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Video from 'react-native-video'
import type { JobDetail } from '../../lib/api/jobs'
import { deadlineLine, employmentLabel, experienceLine, locationLine } from '../../lib/jobs/format'
import { color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Body, Tag, text } from '../../components/ui'

/**
 * The full post's sections (Android M11 details): the 2-up fact tiles, mono
 * section eyebrows, dash bullets in the accent. One set, drawn by the deck's
 * details sheet and the Job page alike, so the two can never drift.
 */

export function JobFacts({ job }: { job: Pick<JobDetail, 'location' | 'remote' | 'employmentType' | 'experience' | 'applicationDeadline'> }) {
  const deadline = deadlineLine(job.applicationDeadline)
  const facts: [string, string][] = [
    ['LOCATION', locationLine(job.location, job.remote)],
    ['TYPE', employmentLabel(job.employmentType)],
    ['EXPERIENCE', experienceLine(job.experience)],
    ...(deadline ? [['DEADLINE', deadline] as [string, string]] : []),
  ]
  return (
    <View style={styles.facts}>
      {facts.map(([k, v]) => (
        <View key={k} style={styles.fact}>
          <Text style={[text.metaSm, styles.factKey]}>{k}</Text>
          <Text style={text.uiMdMedium}>{v}</Text>
        </View>
      ))}
    </View>
  )
}

export function JobProse({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null
  return (
    <View style={styles.section}>
      <Text style={[text.metaMd, styles.eyebrow]}>{title.toUpperCase()}</Text>
      <Text style={[text.uiMd, styles.prose]}>{body}</Text>
    </View>
  )
}

export function JobBullets({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={[text.metaMd, styles.eyebrow]}>{title.toUpperCase()}</Text>
      {items.map((it) => (
        <View key={it} style={styles.bullet}>
          <Text style={[text.uiMd, styles.dash]}>—</Text>
          <Body size="md" style={styles.grow}>{it}</Body>
        </View>
      ))}
    </View>
  )
}

export function JobSkills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={[text.metaMd, styles.eyebrow]}>SKILLS</Text>
      <View style={styles.tags}>{skills.map((s) => <Tag key={s} label={s} />)}</View>
    </View>
  )
}

/** "About <company>" from what the employer's own record says — industry, size, office. Nothing when it says nothing. */
export function JobCompany({ company }: { company: JobDetail['company'] }) {
  const line = [company.industry, company.size ? `${company.size} people` : null, company.officeLocation].filter(Boolean).join(' · ')
  if (!line) return null
  return <JobProse title={`About ${company.name}`} body={line} />
}

/** The post's own 9:16 film, playable. Starts paused; the player's controls do the rest. */
export function JobVideo({ url }: { url: string }) {
  return (
    <View style={styles.video}>
      <Video source={{ uri: url }} controls paused resizeMode="cover" style={StyleSheet.absoluteFill} />
    </View>
  )
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['2.5'] },
  fact: { width: '48%', flexGrow: 1, borderRadius: radius.tile, backgroundColor: color.surfaceMuted, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, gap: space['2xs'] },
  factKey: { color: color.textMuted, letterSpacing: trackingNative.meta },
  section: { gap: spaceHalf['1.5'] },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  prose: { color: color.textSecondary },
  bullet: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  dash: { color: color.accent },
  grow: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  video: { alignSelf: 'center', aspectRatio: 9 / 16, height: height['job-video'], borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.ink },
})
