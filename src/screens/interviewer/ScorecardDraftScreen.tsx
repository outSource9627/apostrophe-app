import React, { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Button, Card, Eyebrow, Field, StatusPill } from '../../components/ui'
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
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading || !session) {
    return (
      <InterviewerShell back={{ label: 'Interviews', onPress: () => navigation.goBack() }}>
        <Text style={styles.loadingText}>Loading scorecard...</Text>
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
        <Eyebrow>OFFICIAL EVALUATION</Eyebrow>
        <Text style={styles.title}>Candidate Scorecard</Text>
        <Text style={styles.subtitle}>
          Candidate: {session.student?.name || 'Student'} · {session.tier.replace('_', ' ')}
        </Text>
      </View>

      {/* Countdown Clock / Forfeiture Warning */}
      <View style={[styles.clockCard, overdue && styles.clockCardOverdue]}>
        <Text style={styles.clockIcon}>{overdue ? '❌' : '⏱️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.clockTitle, overdue && styles.clockTitleOverdue]}>
            {overdue ? 'Scorecard Window Forfeited (IV-13b)' : '24-Hour Submission Window'}
          </Text>
          <Text style={[styles.clockBody, overdue && styles.clockBodyOverdue]}>
            {overdue
              ? `The 24-hour evaluation deadline has passed. Session fee of ${formatPaise(fee)} is permanently forfeited per platform governance terms.`
              : `Submit within ${formatScorecardCountdown(session.slotEnd)} to unlock immediate fee credit to your balance.`}
          </Text>
        </View>
      </View>

      {overdue ? (
        <Card style={styles.overdueNoticeCard}>
          <Text style={styles.overdueHeading}>Submission Closed</Text>
          <Text style={styles.overdueDesc}>
            To maintain high trust with candidates and partner employers, scorecards cannot be submitted after the 24-hour window expires. If you encountered an extenuating technical glitch, contact support.
          </Text>
          <Button
            label="Return to Interviews"
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
        </Card>
      ) : (
        <>
          {/* Rating Scales */}
          <Card style={styles.ratingsCard}>
            <Text style={styles.sectionHeading}>Quantitative Evaluation (1 to 5)</Text>

            {CRITERIA.map((crit) => {
              const currentVal = scores[crit.key] ?? 3

              return (
                <View key={crit.key} style={styles.criteriaRow}>
                  <Text style={styles.criteriaLabel}>{crit.label}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable
                        key={star}
                        onPress={() => handleScoreSelect(crit.key, star)}
                        style={[
                          styles.starBtn,
                          currentVal >= star && styles.starBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.starText,
                            currentVal >= star && styles.starTextActive,
                          ]}
                        >
                          {star}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )
            })}
          </Card>

          {/* Qualitative Written Feedback */}
          <Card style={styles.feedbackCard}>
            <Text style={styles.sectionHeading}>Qualitative Candidate Feedback</Text>

            <Field label="Key Strengths (Shared with candidate & employers) *">
              <TextInput
                style={styles.textArea}
                value={strengths}
                onChangeText={setStrengths}
                placeholder="Specific technical depth, clear communication, robust problem decomposition..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>

            <Field label="Areas for Growth & Improvement *">
              <TextInput
                style={styles.textArea}
                value={areasForImprovement}
                onChangeText={setAreasForImprovement}
                placeholder="Topics to study deeper, edge cases overlooked, architectural trade-offs..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>

            <Field label="Internal Confidential Notes (Platform staff only)">
              <TextInput
                style={styles.textArea}
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
  loadingText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: space['2xl'],
  },
  header: {
    gap: space['2xs'],
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 24,
    fontWeight: '700',
    color: color.text,
  },
  subtitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
  },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: '#fffbeb',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: '#fde68a',
  },
  clockCardOverdue: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  clockIcon: {
    fontSize: 20,
  },
  clockTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  clockTitleOverdue: {
    color: '#991b1b',
  },
  clockBody: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#b45309',
    lineHeight: 16,
    marginTop: 2,
  },
  clockBodyOverdue: {
    color: '#b91c1c',
  },
  overdueNoticeCard: {
    padding: space.lg,
    gap: space.sm,
  },
  overdueHeading: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  overdueDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
  },
  ratingsCard: {
    padding: space.md,
    gap: space.md,
  },
  sectionHeading: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  criteriaRow: {
    gap: space['2xs'],
  },
  criteriaLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  starsRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  starBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  starBtnActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  starText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 14,
    fontWeight: '700',
    color: color.textMuted,
  },
  starTextActive: {
    color: color.surface,
  },
  feedbackCard: {
    padding: space.md,
    gap: space.md,
  },
  textArea: {
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.sm,
    padding: space.sm,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.text,
    backgroundColor: color.surfaceSubtle,
    minHeight: 70,
  },
})
