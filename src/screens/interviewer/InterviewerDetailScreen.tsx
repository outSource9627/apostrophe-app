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
import { Button, Card, Eyebrow, StatusPill } from '../../components/ui'
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

  if (loading || !session) {
    return (
      <InterviewerShell back={{ label: 'Interviews', onPress: () => navigation.goBack() }}>
        <Text style={styles.loadingText}>Loading session details...</Text>
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
        <View style={{ flex: 1 }}>
          <Eyebrow>{session.tier.replace('_', ' ')} INTERVIEW</Eyebrow>
          <Text style={styles.title}>{session.student?.name || 'Candidate'}</Text>
          <Text style={styles.subtitle}>
            Fee: {formatPaise(fee)} · Status: {session.status}
          </Text>
        </View>
        <StatusPill
          tone={canJoin ? 'success' : 'info'}
          label={canJoin ? 'READY TO JOIN' : 'BOOKED'}
        />
      </View>

      {/* Scorecard countdown alert if completed */}
      {isOwed && (
        <View style={[styles.owedClockRow, overdue && styles.owedClockOverdue]}>
          <Text style={styles.clockIcon}>⏱️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.clockTitle, overdue && styles.clockTextOverdue]}>
              {overdue ? 'Scorecard Overdue (Forfeited)' : 'Scorecard Window Open'}
            </Text>
            <Text style={[styles.clockSub, overdue && styles.clockTextOverdue]}>
              {formatScorecardCountdown(session.slotEnd)}
            </Text>
          </View>
          <Button
            label="Submit Now"
            variant="primary"
            size="sm"
            onPress={() => navigation.navigate('ScorecardDraft', { id: session.id })}
          />
        </View>
      )}

      {/* Candidate Profile Summary */}
      <Card style={styles.profileCard}>
        <Text style={styles.cardHeading}>Candidate Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoVal}>{session.student?.city || 'Not specified'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Education:</Text>
          <Text style={styles.infoVal}>{session.student?.education || 'Degree in Engineering / CS'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Experience:</Text>
          <Text style={styles.infoVal}>{session.student?.headline || 'Standard candidate'}</Text>
        </View>
      </Card>

      {/* 4-Area Standard Script */}
      <View style={styles.scriptSection}>
        <Eyebrow>STRUCTURED EVALUATION SCRIPT</Eyebrow>
        <Text style={styles.scriptTitle}>20-Minute Protocol</Text>

        <View style={styles.areaTabs}>
          {SCRIPT_AREAS.map((area, idx) => (
            <Pressable
              key={area.n}
              onPress={() => setActiveArea(idx)}
              style={[styles.areaTab, activeArea === idx && styles.areaTabActive]}
            >
              <Text style={[styles.areaTabNum, activeArea === idx && styles.areaTabNumActive]}>
                {area.n}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card style={styles.areaContentCard}>
          <Text style={styles.areaHeading}>{SCRIPT_AREAS[activeArea].title}</Text>
          {SCRIPT_AREAS[activeArea].questions.map((q, i) => (
            <View key={i} style={styles.questionItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.questionText}>{q}</Text>
            </View>
          ))}
        </Card>
      </View>

      {/* Private Notes Scratchpad */}
      <Card style={styles.notesCard}>
        <View style={styles.notesHeader}>
          <View>
            <Text style={styles.cardHeading}>Private Prep Notes</Text>
            <Text style={styles.notesSub}>Only visible to you, never shared with the candidate.</Text>
          </View>
          <Pressable onPress={handleSaveNotes}>
            <Text style={styles.saveNotesLink}>
              {savingNotes ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.notesInput}
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
            <Text style={styles.declineToggleText}>
              {showDeclineModal ? '▲ Hide Decline Option' : '▼ Cannot conduct this session? Decline'}
            </Text>
          </Pressable>

          {showDeclineModal && (
            <Card style={styles.declineCard}>
              <Text style={styles.declineTitle}>Decline Scheduled Session</Text>
              <Text style={styles.declineWarning}>
                Declining less than 2 hours before the start time affects your reliability metrics.
              </Text>
              <TextInput
                style={styles.declineInput}
                value={declineReason}
                onChangeText={setDeclineReason}
                placeholder="Reason for declining (e.g., sudden emergency, domain mismatch)..."
                multiline
                numberOfLines={3}
              />
              <Button
                label={declining ? 'Declining...' : 'Confirm Decline'}
                variant="primary"
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
  loadingText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: space['2xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  title: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 22,
    fontWeight: '700',
    color: color.text,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    color: color.textMuted,
    marginTop: 2,
  },
  owedClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#fffbeb',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: '#fde68a',
  },
  owedClockOverdue: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  clockIcon: {
    fontSize: 20,
  },
  clockTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  clockSub: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
    marginTop: 2,
  },
  clockTextOverdue: {
    color: color.accent,
  },
  profileCard: {
    padding: space.md,
    gap: space.xs,
  },
  cardHeading: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
    marginBottom: space['2xs'],
  },
  infoRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  infoLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.textMuted,
    width: 80,
  },
  infoVal: {
    flex: 1,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.text,
  },
  scriptSection: {
    gap: space.xs,
  },
  scriptTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  areaTabs: {
    flexDirection: 'row',
    gap: space.xs,
    marginVertical: space['2xs'],
  },
  areaTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs,
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  areaTabActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  areaTabNum: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 13,
    fontWeight: '700',
    color: color.textMuted,
  },
  areaTabNumActive: {
    color: color.surface,
  },
  areaContentCard: {
    padding: space.md,
    gap: space.sm,
  },
  areaHeading: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  questionItem: {
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'flex-start',
  },
  bullet: {
    color: color.accent,
    fontSize: 14,
    lineHeight: 18,
  },
  questionText: {
    flex: 1,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.text,
    lineHeight: 18,
  },
  notesCard: {
    padding: space.md,
    gap: space.xs,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notesSub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
  },
  saveNotesLink: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '700',
    color: color.accent,
  },
  notesInput: {
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.sm,
    padding: space.sm,
    minHeight: 80,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.text,
    backgroundColor: color.surfaceSubtle,
  },
  declineSection: {
    gap: space.xs,
  },
  declineToggle: {
    paddingVertical: space.xs,
    alignItems: 'center',
  },
  declineToggleText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.accent,
  },
  declineCard: {
    padding: space.md,
    gap: space.sm,
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  declineTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: '#9f1239',
  },
  declineWarning: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#be123c',
    lineHeight: 16,
  },
  declineInput: {
    borderWidth: borderWidth.thin,
    borderColor: '#fecdd3',
    borderRadius: radius.sm,
    padding: space.sm,
    backgroundColor: color.surface,
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    minHeight: 60,
  },
})
