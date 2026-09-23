import React, { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { height, space } from '../../theme'
import {
  Banner,
  Body,
  Button,
  Card,
  Chip,
  Display,
  ErrorState,
  Eyebrow,
  Field,
  Input,
  ListRow,
  Meta,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { interviewerApi, type InterviewSessionDto } from '../../lib/api/interviewer'
import { canJoinInterviewRoom, formatScorecardCountdown, isScorecardOverdue, TIER_FEES_PAISE } from '../../lib/interviewer/state'
import { formatPaise } from '../../lib/format/money'

const SCRIPT_AREAS = [
  {
    n: '01',
    title: 'Introduction & Ground Rules (3 min)',
    questions: [
      'Welcome candidate, confirm audio/video clarity, state that the session is recorded for employer shortlisting.',
      'Ask the candidate to summarize their background and primary technical stack in 90 seconds.',
    ],
  },
  {
    n: '02',
    title: 'Technical Depth & Projects (10 min)',
    questions: [
      'Walk through a complex project on their profile. Why did you choose this architecture over alternatives?',
      'How do you handle error states, database migrations, or latency spikes in that system?',
      'Explain a bug that took you hours or days to diagnose. What was the root cause?',
    ],
  },
  {
    n: '03',
    title: 'Problem Solving & Trade-offs (5 min)',
    questions: [
      'How would you design an idempotent payment webhook receiver?',
      'Candidate is given a trade-off scenario: fast delivery vs robust caching. Ask them to defend their decision.',
    ],
  },
  {
    n: '04',
    title: 'Candidate Q&A & Wrap-up (2 min)',
    questions: [
      'Invite 1–2 questions from the candidate about industry practices or working as a software engineer.',
      'Thank them for their time and explain that verified feedback will be reviewed within 24 hours.',
    ],
  },
]

export function InterviewerDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const route = useRoute<any>()
  const id = route.params?.id

  const [session, setSession] = useState<InterviewSessionDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [activeArea, setActiveArea] = useState(0)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declining, setDeclining] = useState(false)

  useEffect(() => {
    if (!id) return
    interviewerApi
      .getInterview(id)
      .then((data) => {
        setSession(data)
        setNotes(data.privateNotes || '')
      })
      .catch((err) => {
        Alert.alert('Error', err?.message || 'Unable to load interview details.')
        setLoadError(err instanceof Error ? err : new Error(err?.message || 'Unable to load interview details.'))
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSaveNotes = async () => {
    if (!id) return
    setSavingNotes(true)
    try {
      await interviewerApi.savePrivateNotes(id, notes)
      Alert.alert('Saved', 'Your private prep notes have been saved.')
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to save notes.')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleDecline = async () => {
    if (!id || !declineReason.trim()) {
      Alert.alert('Reason Required', 'Please explain why you need to decline this session.')
      return
    }

    setDeclining(true)
    try {
      await interviewerApi.declineSession(id, declineReason.trim())
      Alert.alert('Session Declined', 'The session has been unassigned and candidate notified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } catch (err: any) {
      Alert.alert('Decline Failed', err?.message || 'Unable to decline session.')
    } finally {
      setDeclining(false)
    }
  }

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
          title="We could not load this session."
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

  const canJoin = canJoinInterviewRoom(session.slotStart)
  const fee = TIER_FEES_PAISE[session.tier as keyof typeof TIER_FEES_PAISE] ?? 4000
  const isOwed = session.status === 'COMPLETED' && !session.scorecardSubmittedAt
  const overdue = isOwed ? isScorecardOverdue(session.slotEnd) : false

  return (
    <InterviewerShell
      back={{ label: 'Interviews', onPress: () => navigation.goBack() }}
      footer={
        isOwed ? (
          <Button
            label="Draft Scorecard"
            variant="primary"
            onPress={() => navigation.navigate('ScorecardDraft', { id: session.id })}
          />
        ) : canJoin ? (
          <Button
            label="Join Video Interview Room"
            variant="primary"
            onPress={() => navigation.navigate('Room', { id: session.id })}
          />
        ) : (
          <Button
            label="Join Room (Opens 10m before)"
            variant="secondary"
            disabled
          />
        )
      }
    >
      {/* Session Header */}
      <View style={styles.header}>
        <View style={styles.grow}>
          <Eyebrow>{session.tier.replace('_', ' ')} INTERVIEW</Eyebrow>
          <Display level="sm" style={styles.title}>{session.student?.name || 'Candidate'}</Display>
          <Meta style={styles.subtitle}>{`Fee: ${formatPaise(fee)} · Status: ${session.status}`}</Meta>
        </View>
        <StatusPill
          tone={canJoin ? 'success' : 'info'}
          label={canJoin ? 'READY TO JOIN' : 'BOOKED'}
        />
      </View>

      {/* Scorecard countdown alert if completed */}
      {isOwed && (
        <Banner
          tone={overdue ? 'danger' : 'warning'}
          title={overdue ? 'Scorecard Overdue (Forfeited)' : 'Scorecard Window Open'}
          actionLabel="Submit Now"
          onAction={() => navigation.navigate('ScorecardDraft', { id: session.id })}
        >
          {formatScorecardCountdown(session.slotEnd)}
        </Banner>
      )}

      {/* Candidate Profile Summary */}
      <Card style={styles.profileCard}>
        <Eyebrow>Candidate Information</Eyebrow>
        <ListRow label="Location" value={session.student?.city || 'Not specified'} />
        <ListRow label="Education" value={session.student?.education || 'Degree in Engineering / CS'} />
        <ListRow label="Experience" value={session.student?.headline || 'Standard candidate'} style={styles.rowLast} />
      </Card>

      {/* 4-Area Standard Script */}
      <View style={styles.scriptSection}>
        <Eyebrow>STRUCTURED EVALUATION SCRIPT</Eyebrow>
        <Body size="lg">20-Minute Protocol</Body>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaTabs}>
          {SCRIPT_AREAS.map((area, idx) => (
            <Chip
              key={area.n}
              label={area.n}
              selected={activeArea === idx}
              onPress={() => setActiveArea(idx)}
            />
          ))}
        </ScrollView>

        <Card style={styles.areaContentCard}>
          <Body size="md" weight="semibold">{SCRIPT_AREAS[activeArea].title}</Body>
          {SCRIPT_AREAS[activeArea].questions.map((q, i) => (
            <View key={i} style={styles.questionItem}>
              <Body size="sm" tone="subtle">•</Body>
              <Body size="sm" style={styles.grow}>{q}</Body>
            </View>
          ))}
        </Card>
      </View>

      {/* Private Notes Scratchpad */}
      <Card style={styles.notesCard}>
        <View style={styles.notesHeader}>
          <View style={styles.grow}>
            <Eyebrow>Private Prep Notes</Eyebrow>
            <Body size="xs" tone="subtle">Only visible to you, never shared with the candidate.</Body>
          </View>
          <Pressable onPress={handleSaveNotes}>
            <Body size="sm" weight="semibold">
              {savingNotes ? 'Saving...' : 'Save'}
            </Body>
          </Pressable>
        </View>
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Jot down notes during or before the session..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </Card>

      {/* Decline Option */}
      {(session.status === 'BOOKED' || (session.status as string) === 'SCHEDULED') && (
        <View style={styles.declineSection}>
          <Pressable
            onPress={() => setShowDeclineModal(!showDeclineModal)}
            style={styles.declineToggle}
          >
            <Body size="xs" weight="semibold" tone="muted">
              {showDeclineModal ? '▲ Hide Decline Option' : '▼ Cannot conduct this session? Decline'}
            </Body>
          </Pressable>

          {showDeclineModal && (
            <Card style={styles.declineCard}>
              <Eyebrow tone="danger">Decline Scheduled Session</Eyebrow>
              <Banner tone="warning">
                Declining less than 2 hours before the start time affects your reliability metrics.
              </Banner>
              <Field label="Reason for declining">
                <Input
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  placeholder="e.g., sudden emergency, domain mismatch"
                  multiline
                  numberOfLines={3}
                />
              </Field>
              <Button
                label={declining ? 'Declining...' : 'Confirm Decline'}
                variant="destructive"
                disabled={declining}
                onPress={handleDecline}
              />
            </Card>
          )}
        </View>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  title: { marginTop: space['2xs'] },
  subtitle: { marginTop: space['2xs'] },
  profileCard: { padding: space.md, gap: space.xs },
  rowLast: { borderBottomWidth: 0 },
  scriptSection: { gap: space.xs },
  areaTabs: { gap: space.sm, paddingVertical: space['2xs'] },
  areaContentCard: { padding: space.md, gap: space.sm },
  questionItem: { flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' },
  notesCard: { padding: space.md, gap: space.xs },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  declineSection: { gap: space.xs },
  declineToggle: { paddingVertical: space.xs, alignItems: 'center' },
  declineCard: { padding: space.md, gap: space.sm },
})
