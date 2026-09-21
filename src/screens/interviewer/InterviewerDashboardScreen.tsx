import React from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Button, Card, Eyebrow, StatusPill } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'
import { formatScorecardCountdown, isScorecardOverdue, canJoinInterviewRoom } from '../../lib/interviewer/state'

export function InterviewerDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { profile, upcomingInterviews, owedScorecards, wallet } = useInterviewer()

  const nextInterview = upcomingInterviews[0]
  const canJoinNext = nextInterview ? canJoinInterviewRoom(nextInterview.slotStart) : false

  const formatSlotTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  const formatSlotDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <InterviewerShell navTab="home">
      {/* Welcome header */}
      <View style={styles.header}>
        <View>
          <Eyebrow>INTERVIEWER DASHBOARD</Eyebrow>
          <Text style={styles.greeting}>Welcome, {profile?.name || 'Interviewer'}</Text>
        </View>
        {profile?.status === 'ACTIVE' ? (
          <StatusPill tone="success" label="ACTIVE" />
        ) : profile?.status === 'SUSPENDED' ? (
          <StatusPill tone="danger" label="SUSPENDED" />
        ) : (
          <StatusPill tone="neutral" label={profile?.status || 'PENDING'} />
        )}
      </View>

      {/* Owed Scorecard Banner (Settled Decision D3: 24h deadline) */}
      {owedScorecards.length > 0 && (
        <View style={styles.owedBanner}>
          <View style={styles.owedHeader}>
            <Text style={styles.owedIcon}>⚠️</Text>
            <Text style={styles.owedTitle}>
              {owedScorecards.length} Scorecard{owedScorecards.length > 1 ? 's' : ''} Awaiting Submission
            </Text>
          </View>
          <Text style={styles.owedDesc}>
            Scorecards must be submitted within 24 hours of session end. Failure to submit leads to fee forfeiture.
          </Text>

          {owedScorecards.slice(0, 2).map((sc) => {
            const overdue = isScorecardOverdue(sc.slotEnd)
            return (
              <View key={sc.id} style={styles.owedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.owedStudent}>{sc.student?.name || 'Candidate'}</Text>
                  <Text style={[styles.owedClock, overdue && styles.owedClockOverdue]}>
                    {formatScorecardCountdown(sc.slotEnd)}
                  </Text>
                </View>
                <Pressable
                  style={styles.scorecardBtn}
                  onPress={() => navigation.navigate('ScorecardDraft', { id: sc.id })}
                >
                  <Text style={styles.scorecardBtnText}>Draft Scorecard</Text>
                </Pressable>
              </View>
            )
          })}

          {owedScorecards.length > 2 && (
            <Pressable onPress={() => navigation.navigate('PendingScorecards')}>
              <Text style={styles.viewAllOwed}>
                View all {owedScorecards.length} pending scorecards →
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Next Interview Card */}
      {nextInterview ? (
        <Card style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <View>
              <Eyebrow>NEXT INTERVIEW</Eyebrow>
              <Text style={styles.nextTime}>
                {formatSlotDate(nextInterview.slotStart)} at {formatSlotTime(nextInterview.slotStart)}
              </Text>
            </View>
            <StatusPill tone="info" label={nextInterview.tier.replace('_', ' ')} />
          </View>

          <View style={styles.candidateRow}>
            <View style={styles.candidateAvatar}>
              <Text style={styles.avatarText}>
                {(nextInterview.student?.name || 'C').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.candidateName}>{nextInterview.student?.name || 'Candidate'}</Text>
              <Text style={styles.candidateSub}>
                {nextInterview.student?.education || 'Computer Science / Engineering'}
              </Text>
            </View>
          </View>

          <View style={styles.nextActions}>
            <Button
              label="Candidate Prep & Script"
              variant="secondary"
              onPress={() => navigation.navigate('InterviewerDetail', { id: nextInterview.id })}
            />
            <Button
              label={canJoinNext ? 'Enter Interview Room' : 'Opens 10 min prior'}
              variant="primary"
              disabled={!canJoinNext}
              onPress={() => navigation.navigate('InterviewerDetail', { id: nextInterview.id, autoJoin: true })}
            />
          </View>
        </Card>
      ) : (
        <Card style={styles.noInterviewCard}>
          <Text style={styles.noInterviewIcon}>📅</Text>
          <Text style={styles.noInterviewTitle}>No upcoming interviews today</Text>
          <Text style={styles.noInterviewDesc}>
            Make sure your recurring availability is updated to receive student bookings.
          </Text>
          <Button
            label="Edit Availability"
            variant="secondary"
            onPress={() => navigation.navigate('InterviewerAvailability')}
          />
        </Card>
      )}

      {/* Quick Metrics & Actions */}
      <View style={styles.metricsGrid}>
        <Pressable
          style={styles.metricCard}
          onPress={() => navigation.navigate('InterviewerWallet')}
        >
          <Text style={styles.metricLabel}>Available Balance</Text>
          <Text style={styles.metricValue}>{formatPaise(wallet?.balancePaise ?? 0)}</Text>
          <Text style={styles.metricSub}>Tap to withdraw →</Text>
        </Pressable>

        <Pressable
          style={styles.metricCard}
          onPress={() => navigation.navigate('InterviewerInterviews')}
        >
          <Text style={styles.metricLabel}>Upcoming Sessions</Text>
          <Text style={styles.metricValue}>{upcomingInterviews.length}</Text>
          <Text style={styles.metricSub}>View schedule →</Text>
        </Pressable>
      </View>

      {/* Quality & Permitted Tiers Summary */}
      <Card style={styles.qualityCard}>
        <View style={styles.qualityHeader}>
          <Text style={styles.qualityTitle}>Interviewer Standing</Text>
          <Text style={styles.qualityScore}>
            Score: {profile?.qualityScore ? profile.qualityScore.toFixed(1) : '5.0'} / 5.0
          </Text>
        </View>
        <Text style={styles.qualityDesc}>
          Permitted Tiers: {profile?.permittedTiers?.map((t) => t.replace('_', ' ')).join(', ') || 'TIER 1'}
        </Text>
        <Text style={styles.qualityDesc}>
          Total Completed: {profile?.totalInterviews ?? 0} sessions conducted
        </Text>
      </Card>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: space.xs,
  },
  greeting: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 22,
    fontWeight: '700',
    color: color.text,
    marginTop: space['2xs'],
  },
  owedBanner: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  owedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  owedIcon: {
    fontSize: 16,
  },
  owedTitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  owedDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: '#b45309',
    lineHeight: 16,
  },
  owedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surface,
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: '#fde68a',
    marginTop: space['2xs'],
  },
  owedStudent: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  owedClock: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 11,
    color: color.accent,
    marginTop: 2,
  },
  owedClockOverdue: {
    color: color.accent,
    fontWeight: '700',
  },
  scorecardBtn: {
    backgroundColor: color.accent,
    paddingHorizontal: space.sm,
    paddingVertical: space['2xs'],
    borderRadius: radius.sm,
  },
  scorecardBtnText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.surface,
  },
  viewAllOwed: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.accent,
    marginTop: space['2xs'],
  },
  nextCard: {
    padding: space.md,
    gap: space.md,
  },
  nextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nextTime: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
    marginTop: space['2xs'],
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space['2xs'],
  },
  candidateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.surfaceSubtle,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  candidateName: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  candidateSub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  nextActions: {
    gap: space.xs,
  },
  noInterviewCard: {
    padding: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  noInterviewIcon: {
    fontSize: 32,
  },
  noInterviewTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  noInterviewDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: space.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: space.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
  },
  metricLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  metricValue: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 18,
    fontWeight: '700',
    color: color.text,
    marginVertical: 2,
  },
  metricSub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.accent,
    fontWeight: '500',
  },
  qualityCard: {
    padding: space.md,
    gap: space['2xs'],
    backgroundColor: color.surfaceSubtle,
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityTitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  qualityScore: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 13,
    fontWeight: '700',
    color: color.accent,
  },
  qualityDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
})
