import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  ProgressRing,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import {
  computeScorecardClock,
  formatScorecardCountdown,
  isScorecardOverdue,
  SCORECARD_WINDOW_HOURS,
  TIER_FEES_PAISE,
} from '../../lib/interviewer/state'
import { formatPaise } from '../../lib/format/money'

const SCORECARD_WINDOW_MS = SCORECARD_WINDOW_HOURS * 60 * 60 * 1000

export function PendingScorecardsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { owedScorecards, loading, error, refresh } = useInterviewer()

  if (loading) {
    return (
      <InterviewerShell back={{ label: 'Home', onPress: () => navigation.goBack() }}>
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (error && owedScorecards.length === 0) {
    return (
      <InterviewerShell back={{ label: 'Home', onPress: () => navigation.goBack() }}>
        <ErrorState
          title="We could not load your scorecards."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell back={{ label: 'Home', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>ACTION REQUIRED</Eyebrow>
        <Display level="lg" accessibilityRole="header">
          Pending Scorecards
        </Display>
        <Body size="sm" tone="muted">
          All scorecards must be submitted within 24 hours of session end. Failure to submit leads to fee forfeiture.
        </Body>
      </View>

      {owedScorecards.length === 0 ? (
        <Card>
          <EmptyState
            title="All caught up"
            body="You have no pending scorecards awaiting submission. All completed session fees have been credited."
            action={<Button label="Back to Dashboard" variant="secondary" onPress={() => navigation.goBack()} />}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {owedScorecards.map((sc) => {
            const overdue = isScorecardOverdue(sc.slotEnd)
            const fee = TIER_FEES_PAISE[sc.tier as keyof typeof TIER_FEES_PAISE] ?? 4000
            const clock = computeScorecardClock(sc)
            const pct = Math.max(0, Math.min(100, Math.round((clock.remainingMs / SCORECARD_WINDOW_MS) * 100)))

            return (
              <Card key={sc.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.grow}>
                    <Body weight="semibold">{sc.student?.name || 'Candidate'}</Body>
                    <Meta style={styles.sessionMeta}>
                      {`${sc.tier.replace('_', ' ')} · Fee: ${formatPaise(fee)}`}
                    </Meta>
                  </View>
                  <StatusPill tone={overdue ? 'danger' : 'warning'} label={overdue ? 'FORFEITED' : 'OWED'} />
                </View>

                {/* Countdown — a ProgressRing readout, never the accent: an
                    owed/forfeited state is a passive clock, not one of red's
                    four sanctioned jobs. */}
                <View style={styles.clockRow}>
                  <ProgressRing
                    value={formatScorecardCountdown(sc.slotEnd)}
                    pct={pct}
                    tone={overdue ? 'danger' : 'warning'}
                    size="sm"
                  />
                  <Body size="xs" tone="muted" style={styles.grow}>
                    {overdue
                      ? '24-hour evaluation window has expired.'
                      : 'Submit now to unlock fee credit.'}
                  </Body>
                </View>

                {/* Secondary only — a list of rows never carries the screen's
                    one accent action, same rule as the Interviews list. */}
                <Button
                  label={overdue ? 'View Details' : 'Complete Scorecard'}
                  variant="secondary"
                  onPress={() => navigation.navigate('ScorecardDraft', { id: sc.id })}
                />
              </Card>
            )
          })}
        </View>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  list: {
    gap: space.md,
  },
  card: {
    padding: space.md,
    gap: space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  grow: {
    flex: 1,
  },
  sessionMeta: {
    marginTop: space['2xs'],
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
})
