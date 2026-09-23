import React from 'react'
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, radius, space } from '../../theme'
import {
  Banner,
  Body,
  Button,
  Card,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Figure,
  Meta,
  ObjectRow,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'
import { formatScorecardCountdown, isScorecardOverdue, canJoinInterviewRoom } from '../../lib/interviewer/state'

export function InterviewerDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { profile, upcomingInterviews, owedScorecards, wallet, loading, error, refresh } = useInterviewer()

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

  if (loading && !profile) {
    return (
      <InterviewerShell navTab="home">
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (error && !profile) {
    return (
      <InterviewerShell navTab="home">
        <ErrorState
          title="We could not load your dashboard."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell navTab="home">
      {/* Welcome header */}
      <View style={styles.header}>
        <View>
          <Eyebrow>INTERVIEWER DASHBOARD</Eyebrow>
          <Display level="sm" style={styles.greeting}>
            Welcome, {profile?.name || 'Interviewer'}
          </Display>
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
        <Banner
          tone="warning"
          title={`${owedScorecards.length} Scorecard${owedScorecards.length > 1 ? 's' : ''} Awaiting Submission`}
          actionLabel={owedScorecards.length > 2 ? `View all ${owedScorecards.length} pending scorecards` : undefined}
          onAction={owedScorecards.length > 2 ? () => navigation.navigate('PendingScorecards') : undefined}
        >
          <Body size="xs" tone="muted">
            Scorecards must be submitted within 24 hours of session end. Failure to submit leads to fee forfeiture.
          </Body>

          <View style={styles.owedList}>
            {owedScorecards.slice(0, 2).map((sc) => {
              const overdue = isScorecardOverdue(sc.slotEnd)
              return (
                <View key={sc.id} style={styles.owedRow}>
                  <View style={styles.grow}>
                    <Body size="sm" weight="semibold">
                      {sc.student?.name || 'Candidate'}
                    </Body>
                    <Meta style={overdue ? styles.owedClockOverdue : styles.owedClock}>
                      {formatScorecardCountdown(sc.slotEnd)}
                    </Meta>
                  </View>
                  <Button
                    size="sm"
                    variant="secondary"
                    label="Draft Scorecard"
                    onPress={() => navigation.navigate('ScorecardDraft', { id: sc.id })}
                  />
                </View>
              )
            })}
          </View>
        </Banner>
      )}

      {/* Next Interview Card */}
      {nextInterview ? (
        <Card style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <View>
              <Eyebrow>NEXT INTERVIEW</Eyebrow>
              <Display level="xs" style={styles.nextTime}>
                {formatSlotDate(nextInterview.slotStart)} at {formatSlotTime(nextInterview.slotStart)}
              </Display>
            </View>
            <StatusPill tone="info" label={nextInterview.tier.replace('_', ' ')} />
          </View>

          <ObjectRow
            last
            thumb={
              <View style={styles.candidateAvatar}>
                <Body weight="semibold">
                  {(nextInterview.student?.name || 'C').slice(0, 1).toUpperCase()}
                </Body>
              </View>
            }
            title={nextInterview.student?.name || 'Candidate'}
            meta={nextInterview.student?.education || 'Computer Science / Engineering'}
          />

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
        <Card>
          <EmptyState
            title="No upcoming interviews today"
            body="Make sure your recurring availability is updated to receive student bookings."
            action={
              <Button
                label="Edit Availability"
                variant="secondary"
                onPress={() => navigation.navigate('InterviewerAvailability')}
              />
            }
          />
        </Card>
      )}

      {/* Quick Metrics & Actions */}
      <View style={styles.metricsGrid}>
        <Pressable style={styles.metricWrap} onPress={() => navigation.navigate('InterviewerWallet')}>
          <Card style={styles.metricCard}>
            <Body size="xs" tone="muted">
              Available Balance
            </Body>
            <Figure value={formatPaise(wallet?.balancePaise ?? 0)} />
            <Body size="xs" tone="muted">
              Tap to withdraw →
            </Body>
          </Card>
        </Pressable>

        <Pressable style={styles.metricWrap} onPress={() => navigation.navigate('InterviewerInterviews')}>
          <Card style={styles.metricCard}>
            <Body size="xs" tone="muted">
              Upcoming Sessions
            </Body>
            <Figure value={upcomingInterviews.length} />
            <Body size="xs" tone="muted">
              View schedule →
            </Body>
          </Card>
        </Pressable>
      </View>

      {/* Quality & Permitted Tiers Summary */}
      <Card style={styles.qualityCard}>
        <View style={styles.qualityHeader}>
          <Body size="sm" weight="semibold">
            Interviewer Standing
          </Body>
          <Meta>{`Score: ${profile?.qualityScore ? profile.qualityScore.toFixed(1) : '5.0'} / 5.0`}</Meta>
        </View>
        <Body size="xs" tone="muted">
          {`Permitted Tiers: ${profile?.permittedTiers?.map((t) => t.replace('_', ' ')).join(', ') || 'TIER 1'}`}
        </Body>
        <Body size="xs" tone="muted">
          {`Total Completed: ${profile?.totalInterviews ?? 0} sessions conducted`}
        </Body>
      </Card>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: space.xs,
  },
  greeting: {
    marginTop: space['2xs'],
  },
  owedList: {
    gap: space.sm,
    marginTop: space['2xs'],
  },
  owedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  owedClock: {
    color: color.textMuted,
    marginTop: space['2xs'],
  },
  owedClockOverdue: {
    color: color.danger,
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
    marginTop: space['2xs'],
  },
  candidateAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSubtle,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextActions: {
    gap: space.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: space.md,
  },
  metricWrap: {
    flex: 1,
  },
  metricCard: {
    padding: space.md,
    gap: 2,
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
})
