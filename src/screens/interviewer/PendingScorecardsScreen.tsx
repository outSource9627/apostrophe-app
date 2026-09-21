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
import { Button, Card, Eyebrow } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatScorecardCountdown, isScorecardOverdue, TIER_FEES_PAISE } from '../../lib/interviewer/state'
import { formatPaise } from '../../lib/format/money'

export function PendingScorecardsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { owedScorecards } = useInterviewer()

  return (
    <InterviewerShell back={{ label: 'Home', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>ACTION REQUIRED</Eyebrow>
        <Text style={styles.title}>Pending Scorecards</Text>
        <Text style={styles.subtitle}>
          All scorecards must be submitted within 24 hours of session end. Failure to submit leads to fee forfeiture.
        </Text>
      </View>

      {owedScorecards.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptyDesc}>
            You have no pending scorecards awaiting submission. All completed session fees have been credited.
          </Text>
          <Button
            label="Back to Dashboard"
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {owedScorecards.map((sc) => {
            const overdue = isScorecardOverdue(sc.slotEnd)
            const fee = TIER_FEES_PAISE[sc.tier as keyof typeof TIER_FEES_PAISE] ?? 4000

            return (
              <Card key={sc.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.candidateName}>{sc.student?.name || 'Candidate'}</Text>
                    <Text style={styles.sessionMeta}>
                      {sc.tier.replace('_', ' ')} · Fee: {formatPaise(fee)}
                    </Text>
                  </View>
                  <View style={[styles.badge, overdue && styles.badgeOverdue]}>
                    <Text style={[styles.badgeText, overdue && styles.badgeTextOverdue]}>
                      {overdue ? 'FORFEITED' : 'OWED'}
                    </Text>
                  </View>
                </View>

                {/* Countdown */}
                <View style={[styles.clockRow, overdue && styles.clockRowOverdue]}>
                  <Text style={styles.clockIcon}>⏱️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clockText, overdue && styles.clockTextOverdue]}>
                      {formatScorecardCountdown(sc.slotEnd)}
                    </Text>
                    <Text style={styles.clockDesc}>
                      {overdue
                        ? '24-hour evaluation window has expired.'
                        : 'Submit now to unlock fee credit.'}
                    </Text>
                  </View>
                </View>

                <Button
                  label={overdue ? 'View Details' : 'Complete Scorecard'}
                  variant={overdue ? 'secondary' : 'primary'}
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
    lineHeight: 18,
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
  },
  candidateName: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  sessionMeta: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeOverdue: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  badgeTextOverdue: {
    color: color.accent,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#fffbeb',
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: '#fde68a',
  },
  clockRowOverdue: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  clockIcon: {
    fontSize: 18,
  },
  clockText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  clockTextOverdue: {
    color: color.accent,
  },
  clockDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: '#b45309',
    marginTop: 1,
  },
  emptyCard: {
    padding: space['2xl'],
    alignItems: 'center',
    gap: space.xs,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 18,
    fontWeight: '700',
    color: color.text,
  },
  emptyDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: space.sm,
  },
})
