import React, { useState, useEffect } from 'react'
import { Alert, Image, StyleSheet, View } from 'react-native'
import Video from 'react-native-video'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { aspect, borderWidth, color, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Display,
  DisabledAction,
  Divider,
  EmptyState,
  Eyebrow,
  Meta,
  ObjectRow,
  Skeleton,
  Tag,
  VerifiedSeal,
} from '../../components/ui'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  fetchCandidateDetail,
  postSwipe,
  type CandidateDetail,
} from '../../lib/api/employerFeed'
import type { RootStackParamList } from '../../../App'

type ScreenRouteProp = RouteProp<RootStackParamList, 'CandidateProfile'>

export function CandidateProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<ScreenRouteProp>()
  const { id } = route.params

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [shortlisted, setShortlisted] = useState(false)

  useEffect(() => {
    let active = true
    fetchCandidateDetail(id)
      .then((data) => {
        if (active) {
          setCandidate(data)
          setShortlisted(data.shortlisted)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const toggleShortlist = async () => {
    if (!candidate) return
    const nextState = !shortlisted
    setShortlisted(nextState)
    try {
      await postSwipe(candidate.id, nextState ? 'RIGHT' : 'LEFT')
    } catch {
      setShortlisted(!nextState)
    }
  }

  if (loading) {
    return (
      <EmployerShell back={{ label: 'FEED', onPress: () => navigation.goBack() }}>
        <Skeleton lines={4} />
      </EmployerShell>
    )
  }

  if (!candidate) {
    return (
      <EmployerShell back={{ label: 'FEED', onPress: () => navigation.goBack() }}>
        <EmptyState title="Profile not found" />
      </EmployerShell>
    )
  }

  const interviewDateStr = candidate.verifiedInterview.at
    ? new Date(candidate.verifiedInterview.at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const salaryLakh =
    candidate.expectedSalary.minPaise || candidate.expectedSalary.maxPaise
      ? `${Math.round((candidate.expectedSalary.minPaise || 0) / 10000000)}–${Math.round(
          (candidate.expectedSalary.maxPaise || 0) / 10000000,
        )} Lakh`
      : 'Competitive'

  // Already-sent or already-accepted interest is real, already-fetched state
  // (`candidate.interest`) the screen previously ignored — the disabled state
  // below is what the sixth Foundations state exists for: the action is not
  // available, and the reason rides along with it rather than a dead button.
  const interestUnavailable = candidate.interest === 'SENT' || candidate.interest === 'ACCEPTED'

  const sendInterestAction = interestUnavailable ? (
    <DisabledAction
      tone="neutral"
      action={<Button variant="primary" size="lg" full disabled label="Send Interest" />}
      reason={
        candidate.interest === 'ACCEPTED'
          ? "You're already connected with this candidate."
          : 'Interest already sent to this candidate.'
      }
    />
  ) : (
    <Button
      variant="primary"
      size="lg"
      full
      label="Send Interest"
      onPress={() => Alert.alert('Send Interest', 'Send Interest sheet opens (EM-15 in Phase 2)')}
    />
  )

  const footActions = (
    <View style={styles.footRow}>
      <Button
        variant={shortlisted ? 'secondary' : 'outline'}
        size="lg"
        label={shortlisted ? '🔖 Shortlisted' : '🔖 Shortlist'}
        onPress={toggleShortlist}
        style={styles.grow}
      />
      <View style={styles.grow}>{sendInterestAction}</View>
    </View>
  )

  return (
    <EmployerShell
      back={{ label: 'FEED', onPress: () => navigation.goBack() }}
      footer={footActions}
    >
      {/* Top Video Preview & Verification */}
      <View style={styles.videoCard}>
        {candidate.streamUrl ? (
          <Video
            source={{ uri: candidate.streamUrl }}
            poster={candidate.posterUrl || candidate.photoUrl || undefined}
            paused={false}
            muted={false}
            repeat
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        ) : candidate.posterUrl || candidate.photoUrl ? (
          <Image
            source={{ uri: candidate.posterUrl || candidate.photoUrl || '' }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Display level="sm" style={styles.onInk}>
              {candidate.name}
            </Display>
            <Body size="xs" style={styles.onInkMuted}>
              Verified Video Resume
            </Body>
          </View>
        )}
        <VerifiedSeal date={interviewDateStr ?? undefined} label="Verified Interview" style={styles.heroBadge} />
      </View>

      {/* Heading */}
      <View style={styles.headingBlock}>
        <Display level="lg">{candidate.name}</Display>
        <Body tone="muted">
          {candidate.tier ? `Tier ${candidate.tier}` : 'Verified candidate'}
          {candidate.qualification ? ` · ${candidate.qualification}` : ''}
          {candidate.city ? ` · ${candidate.city}` : ''}
        </Body>
        {!!candidate.headline && <Body size="sm">{candidate.headline}</Body>}
      </View>

      {/* Full 16:9 Video Link */}
      <Card>
        <ObjectRow
          title="Complete 16:9 Interview Recording"
          meta="Watch the full unedited interview"
          status={
            <Body size="sm" weight="semibold">
              Play ▶
            </Body>
          }
          onPress={() => navigation.navigate('CandidateVideo', { id: candidate.id })}
          last
        />
      </Card>

      <Divider />

      {/* Key Metrics */}
      <Card style={styles.metricsCard}>
        <Metric label="Expected salary" value={salaryLakh} sub="Annual CTC" />
        <Metric label="Joining" value={candidate.availability || 'Immediate'} sub="Availability" />
      </Card>

      {/* Skills Section */}
      {candidate.skills && candidate.skills.length > 0 && (
        <View style={styles.section}>
          <Eyebrow>Key skills</Eyebrow>
          <View style={styles.tagsWrap}>
            {candidate.skills.map((s) => (
              <Tag key={s} label={s} />
            ))}
          </View>
        </View>
      )}

      {/* Experience Section */}
      {candidate.experience && candidate.experience.length > 0 && (
        <View style={styles.section}>
          <Eyebrow>Experience</Eyebrow>
          {candidate.experience.map((exp, idx) => (
            <View key={idx} style={styles.timelineItem}>
              <View style={styles.timelineHeader}>
                <Body weight="semibold" style={styles.grow}>
                  {exp.title}
                </Body>
                <Meta>
                  {exp.from} – {exp.to || 'Present'}
                </Meta>
              </View>
              <Body size="sm" tone="muted">
                {exp.company}
              </Body>
              {!!exp.description && (
                <Body size="sm" tone="muted" style={styles.timelineDesc}>
                  {exp.description}
                </Body>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Education Section */}
      {candidate.education && (
        <View style={styles.section}>
          <Eyebrow>Education</Eyebrow>
          <Card style={styles.eduCard}>
            <Body weight="semibold">
              {candidate.education.qualification || 'Degree'}
              {candidate.education.fieldOfStudy ? ` in ${candidate.education.fieldOfStudy}` : ''}
            </Body>
            {!!candidate.education.institution && (
              <Body size="sm" tone="muted">
                {candidate.education.institution}
              </Body>
            )}
            {!!candidate.education.score && (
              <Meta style={styles.eduScore}>
                Academic Claim: {candidate.education.score} {candidate.education.scoreType || '%'}
              </Meta>
            )}
          </Card>
        </View>
      )}
    </EmployerShell>
  )
}

/** One metric cell — the same Display-over-Eyebrow shape the sibling job detail
 *  screen gives its counters, with the extra caption line this grid's values need. */
function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.metricCell}>
      <Eyebrow>{label}</Eyebrow>
      <Display level="xs">{value}</Display>
      <Body size="xs" tone="subtle">
        {sub}
      </Body>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  videoCard: {
    width: '100%',
    aspectRatio: aspect.videoResume,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: color.ink,
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.xs,
  },
  onInk: { color: color.textOnInk, textAlign: 'center' },
  onInkMuted: { color: color.textOnInkMuted, textAlign: 'center' },
  heroBadge: { position: 'absolute', top: space.md, left: space.md },
  headingBlock: { gap: space['2xs'] },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: space.md,
  },
  metricCell: { alignItems: 'center', gap: space['2xs'] },
  section: { gap: space.sm },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  timelineItem: {
    gap: space['2xs'],
    borderLeftWidth: borderWidth.thin,
    borderLeftColor: color.border,
    paddingLeft: space.sm,
  },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
  timelineDesc: { marginTop: space['2xs'] },
  eduCard: { padding: space.lg, gap: space['2xs'], backgroundColor: color.surfaceMuted },
  eduScore: { marginTop: space['2xs'] },
  footRow: { flexDirection: 'row', gap: space.sm },
})
