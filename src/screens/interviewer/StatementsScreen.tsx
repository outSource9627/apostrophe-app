import React, { useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
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
import { formatPaise } from '../../lib/format/money'

export function StatementsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { wallet } = useInterviewer()

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

  return (
    <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>TAX & ANNUAL SUMMARY</Eyebrow>
        <Text style={styles.title}>Monthly Statements</Text>
        <Text style={styles.subtitle}>
          Summary of gross fees credited, 1% TDS statutory deductions, and net disbursed earnings.
        </Text>
      </View>

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>FY 2026–27 Cumulative Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Gross Interviewer Fees</Text>
          <Text style={styles.summaryVal}>{formatPaise(lifetimePaise)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>1% TDS Deducted (Sec 194J)</Text>
          <Text style={[styles.summaryVal, styles.tdsVal]}>
            −{formatPaise(tdsPaise)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.netRow]}>
          <Text style={styles.netLabel}>Net Disbursed to Bank</Text>
          <Text style={styles.netVal}>{formatPaise(netDisbursedPaise)}</Text>
        </View>
      </Card>

      {/* Monthly Statements List */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
        <View style={styles.list}>
          {months.map((m) => (
            <Card key={m.month} style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthName}>{m.month}</Text>
                <Text style={styles.sessionCount}>{m.sessions} interviews</Text>
              </View>

              <View style={styles.metricGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Gross Fees</Text>
                  <Text style={styles.metricVal}>{formatPaise(m.grossPaise)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>TDS (1%)</Text>
                  <Text style={[styles.metricVal, styles.tdsVal]}>
                    −{formatPaise(m.tdsPaise)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Net Payout</Text>
                  <Text style={[styles.metricVal, styles.netMetricVal]}>
                    {formatPaise(m.netPaise)}
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.downloadBtn}
                onPress={() => Alert.alert('Statement Dispatched', `Monthly summary for ${m.month} has been emailed to your registered address.`)}
              >
                <Text style={styles.downloadText}>Download Form 16A / PDF →</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      </View>
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
  summaryCard: {
    padding: space.md,
    gap: space.xs,
    backgroundColor: color.surfaceSubtle,
  },
  summaryTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
    marginBottom: space['2xs'],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
  },
  summaryVal: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
  },
  tdsVal: {
    color: color.accent,
  },
  netRow: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.xs,
    marginTop: space['2xs'],
  },
  netLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  netVal: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  listSection: {
    gap: space.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  list: {
    gap: space.sm,
  },
  monthCard: {
    padding: space.md,
    gap: space.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthName: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  sessionCount: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  metricItem: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    color: color.textSubtle,
  },
  metricVal: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  netMetricVal: {
    color: '#059669',
    fontWeight: '700',
  },
  downloadBtn: {
    paddingTop: space['2xs'],
  },
  downloadText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.accent,
  },
})
