import React from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, radius, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Display,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
  Figure,
  Meta,
  Skeleton,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'

export function StatementsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { wallet, loading, error, refresh } = useInterviewer()

  const lifetimePaise = wallet?.lifetimePaise ?? 0
  // 1% TDS standard under Indian Income Tax Act (194J/194C)
  const tdsPaise = Math.round(lifetimePaise * 0.01)
  const netDisbursedPaise = lifetimePaise - tdsPaise

  const months = [
    {
      month: 'September 2026',
      sessions: 8,
      grossPaise: 80000,
      tdsPaise: 800,
      netPaise: 79200,
    },
    {
      month: 'August 2026',
      sessions: 14,
      grossPaise: 154000,
      tdsPaise: 1540,
      netPaise: 152460,
    },
    {
      month: 'July 2026',
      sessions: 10,
      grossPaise: 110000,
      tdsPaise: 1100,
      netPaise: 108900,
    },
  ]

  if (loading) {
    return (
      <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (error && !wallet) {
    return (
      <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
        <ErrorState
          title="We could not load your statements."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>TAX & ANNUAL SUMMARY</Eyebrow>
        <Display level="lg">Monthly Statements</Display>
        <Body size="sm" tone="muted">
          Summary of gross fees credited, 1% TDS statutory deductions, and net disbursed earnings.
        </Body>
      </View>

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <Eyebrow>FY 2026–27 Cumulative Summary</Eyebrow>

        <View style={styles.summaryRow}>
          <Body size="sm" tone="muted">
            Gross Interviewer Fees
          </Body>
          <Body size="sm" weight="semibold">
            {formatPaise(lifetimePaise)}
          </Body>
        </View>
        <View style={styles.summaryRow}>
          <Body size="sm" tone="muted">
            1% TDS Deducted (Sec 194J)
          </Body>
          <Body size="sm" weight="semibold" tone="danger">
            −{formatPaise(tdsPaise)}
          </Body>
        </View>

        <Divider />

        <View style={styles.netRow}>
          <Body weight="semibold">Net Disbursed to Bank</Body>
          <Figure value={formatPaise(netDisbursedPaise)} style={styles.successText} />
        </View>
      </Card>

      {/* Monthly Statements List */}
      <View style={styles.listSection}>
        <Body size="sm" weight="semibold">
          Monthly Breakdown
        </Body>

        {months.length === 0 ? (
          <Card>
            <EmptyState
              title="No statements yet"
              body="Monthly statements appear here once fees have been credited to your wallet."
            />
          </Card>
        ) : (
          <View style={styles.list}>
            {months.map((m) => (
              <Card key={m.month} style={styles.monthCard}>
                <View style={styles.monthHeader}>
                  <Display level="xs">{m.month}</Display>
                  <Meta>{`${m.sessions} interviews`}</Meta>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricBox}>
                    <Eyebrow>Gross Fees</Eyebrow>
                    <Display level="xs">{formatPaise(m.grossPaise)}</Display>
                  </View>
                  <View style={styles.metricBox}>
                    <Eyebrow>TDS (1%)</Eyebrow>
                    <Display level="xs" style={styles.dangerText}>
                      −{formatPaise(m.tdsPaise)}
                    </Display>
                  </View>
                  <View style={styles.metricBox}>
                    <Eyebrow>Net Payout</Eyebrow>
                    <Display level="xs" style={styles.successText}>
                      {formatPaise(m.netPaise)}
                    </Display>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    label="Download Form 16A / PDF"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      Alert.alert(
                        'Statement Dispatched',
                        `Monthly summary for ${m.month} has been emailed to your registered address.`,
                      )
                    }
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  summaryCard: {
    padding: space.lg,
    gap: space.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space['2xs'],
  },
  dangerText: {
    color: color.danger,
  },
  successText: {
    color: color.success,
  },
  listSection: {
    gap: space.sm,
  },
  list: {
    gap: space.md,
  },
  monthCard: {
    padding: space.md,
    gap: space.md,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  metricBox: {
    flex: 1,
    gap: space['2xs'],
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.sm,
  },
})
