import React, { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, radius, space } from '../../theme'
import {
  Banner,
  Body,
  Button,
  Card,
  Display,
  ErrorState,
  Eyebrow,
  Field,
  Input,
  Meta,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { interviewerApi, type InterviewSessionDto } from '../../lib/api/interviewer'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatScorecardCountdown, isScorecardOverdue, TIER_FEES_PAISE } from '../../lib/interviewer/state'
import { formatPaise } from '../../lib/format/money'

const CRITERIA = [
  { key: 'technicalDepth', label: 'Technical Depth & Architecture' },
  { key: 'problemSolving', label: 'Problem Solving & Edge Cases' },
  { key: 'communication', label: 'Communication & Articulation' },
  { key: 'cultureFit', label: 'Professionalism & Mindset' },
  { key: 'overall', label: 'Overall Hire Recommendation' },
]

export function ScorecardDraftScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const route = useRoute<any>()
  const id = route.params?.id
  const { refresh } = useInterviewer()

  const [session, setSession] = useState<InterviewSessionDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Scores 1 to 5
  const [scores, setScores] = useState<Record<string, number>>({
    technicalDepth: 4,
    problemSolving: 4,
    communication: 4,
    cultureFit: 4,
    overall: 4,
  })

  // Qualitative feedback
  const [strengths, setStrengths] = useState('')
  const [areasForImprovement, setAreasForImprovement] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  useEffect(() => {
    if (!id) return
    interviewerApi
      .getInterview(id)
      .then((data) => {
        setSession(data)
      })
      .catch((err) => {
        Alert.alert('Error', err?.message || 'Unable to load scorecard session.')
        setLoadError(err instanceof Error ? err : new Error(err?.message || 'Unable to load scorecard session.'))
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <InterviewerShell back={{ label: 'Interviews', onPress: () => navigation.goBack() }}>
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (!session) {
    return (
      <InterviewerShell back={{ label: 'Interviews', onPress: () => navigation.goBack() }}>
        <ErrorState
          title="We could not load this scorecard."
          body={loadError?.message}
          action={
            <Button
              variant="outline"
              size="sm"
              label="Go back"
              // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
              hitSlop={(height.tap - height['control-xs']) / 2}
              onPress={() => navigation.goBack()}
            />
          }
        />
      </InterviewerShell>
    )
  }

  const overdue = isScorecardOverdue(session.slotEnd)
  const fee = TIER_FEES_PAISE[session.tier as keyof typeof TIER_FEES_PAISE] ?? 4000

  const handleScoreSelect = (key: string, val: number) => {
    setScores((prev) => ({ ...prev, [key]: val }))
  }

  const handleSubmit = async () => {
    if (!strengths.trim() || !areasForImprovement.trim()) {
      Alert.alert(
        'Incomplete Feedback',
        'Please provide written notes for candidate strengths and growth areas before submitting.',
      )
      return
    }

    setSubmitting(true)
    try {
      await interviewerApi.submitScorecard(id, {
        scores: {
          technicalDepth: scores.technicalDepth,
          problemSolving: scores.problemSolving,
          communication: scores.communication,
          cultureFit: scores.cultureFit,
          overall: scores.overall,
        },
        strengths: strengths.trim(),
        areasForImprovement: areasForImprovement.trim(),
        internalNotes: internalNotes.trim() || undefined,
      })

      await refresh()
      Alert.alert(
        'Scorecard Submitted!',
        `Fee of ${formatPaise(fee)} has been credited to your interviewer wallet balance.`,
        [{ text: 'Great', onPress: () => navigation.replace('InterviewerInterviews') }],
      )
    } catch (err: any) {
      Alert.alert('Submission Error', err?.message || 'Unable to submit scorecard.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <InterviewerShell
      back={{ label: 'Interviews', onPress: () => navigation.goBack() }}
      footer={
        !overdue ? (
          <Button
            label={submitting ? 'Submitting Scorecard...' : `Submit Scorecard & Claim ${formatPaise(fee)}`}
            variant="primary"
            disabled={submitting}
            onPress={handleSubmit}
          />
        ) : null
      }
    >
      <View style={styles.header}>
        <View style={styles.grow}>
          <Eyebrow>OFFICIAL EVALUATION</Eyebrow>
          <Display level="sm" style={styles.title}>
            Candidate Scorecard
          </Display>
          <Meta style={styles.subtitle}>
            {`${session.student?.name || 'Student'} · ${session.tier.replace('_', ' ')}`}
          </Meta>
        </View>
        <StatusPill tone={overdue ? 'danger' : 'warning'} label={overdue ? 'FORFEITED' : 'SCORECARD OWED'} />
      </View>

      {/* Countdown / forfeiture notice */}
      <Banner
        tone={overdue ? 'danger' : 'warning'}
        title={overdue ? 'Scorecard Window Forfeited (IV-13b)' : '24-Hour Submission Window'}
      >
        {overdue
          ? `The 24-hour evaluation deadline has passed. Session fee of ${formatPaise(fee)} is permanently forfeited per platform governance terms.`
          : `Submit within ${formatScorecardCountdown(session.slotEnd)} to unlock immediate fee credit to your balance.`}
      </Banner>

      {overdue ? (
        <Card style={styles.overdueNoticeCard}>
          <Display level="xs">Submission Closed</Display>
          <Body size="sm" tone="muted">
            To maintain high trust with candidates and partner employers, scorecards cannot be submitted after the
            24-hour window expires. If you encountered an extenuating technical glitch, contact support.
          </Body>
          <Button label="Return to Interviews" variant="secondary" onPress={() => navigation.goBack()} />
        </Card>
      ) : (
        <>
          {/* Rating Scales */}
          <Card style={styles.ratingsCard}>
            <Eyebrow>Quantitative Evaluation (1 to 5)</Eyebrow>

            {CRITERIA.map((crit) => {
              const currentVal = scores[crit.key] ?? 3

              return (
                <View key={crit.key} style={styles.criteriaRow}>
                  <Body size="sm" weight="medium">
                    {crit.label}
                  </Body>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = currentVal >= star
                      return (
                        <Pressable
                          key={star}
                          onPress={() => handleScoreSelect(crit.key, star)}
                          style={[styles.starBtn, active && styles.starBtnActive]}
                        >
                          <Meta style={active ? styles.starTextActive : styles.starText}>{star}</Meta>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </Card>

          {/* Qualitative Written Feedback */}
          <Card style={styles.feedbackCard}>
            <Eyebrow>Qualitative Candidate Feedback</Eyebrow>

            <Field label="Key Strengths (Shared with candidate & employers) *">
              <Input
                value={strengths}
                onChangeText={setStrengths}
                placeholder="Specific technical depth, clear communication, robust problem decomposition..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>

            <Field label="Areas for Growth & Improvement *">
              <Input
                value={areasForImprovement}
                onChangeText={setAreasForImprovement}
                placeholder="Topics to study deeper, edge cases overlooked, architectural trade-offs..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>

            <Field label="Internal Confidential Notes (Platform staff only)">
              <Input
                value={internalNotes}
                onChangeText={setInternalNotes}
                placeholder="Any cheating suspicion, identity discrepancy, or video audio quality flags..."
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </Field>
          </Card>
        </>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  grow: {
    flex: 1,
  },
  title: {
    marginTop: space['2xs'],
  },
  subtitle: {
    marginTop: space['2xs'],
  },
  overdueNoticeCard: {
    padding: space.lg,
    gap: space.sm,
  },
  ratingsCard: {
    padding: space.md,
    gap: space.md,
  },
  criteriaRow: {
    gap: space['2xs'],
  },
  starsRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  starBtn: {
    flex: 1,
    height: height.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  starBtnActive: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  starText: {
    color: color.textMuted,
  },
  starTextActive: {
    color: color.textInverse,
  },
  feedbackCard: {
    padding: space.md,
    gap: space.md,
  },
})
