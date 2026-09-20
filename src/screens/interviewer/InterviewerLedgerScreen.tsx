import React, { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Card, Eyebrow, StatusPill } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'
import type { LedgerEntryDto } from '../../lib/api/interviewer'

type LedgerFilter = 'ALL' | 'FEE_CREDIT' | 'WITHDRAWAL' | 'FORFEIT'

export function InterviewerLedgerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { wallet } = useInterviewer()
  const [filter, setFilter] = useState<LedgerFilter>('ALL')

  const ledger = wallet?.ledger || []

  const filteredEntries = ledger.filter((entry) => {
    if (filter === 'ALL') return true
    return entry.type === filter
  })

  const formatTxDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>TRANSACTION HISTORY</Eyebrow>
        <Text style={styles.title}>Itemised Ledger</Text>
        <Text style={styles.subtitle}>
          Every fee credited, withdrawal disbursed, and forfeiture recorded with full audit trail.
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['ALL', 'FEE_CREDIT', 'WITHDRAWAL', 'FORFEIT'] as LedgerFilter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL'
                ? 'All'
                : f === 'FEE_CREDIT'
                ? 'Credits'
                : f === 'WITHDRAWAL'
                ? 'Withdrawals'
                : 'Forfeits'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Ledger List */}
      {filteredEntries.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>No transactions found</Text>
          <Text style={styles.emptyDesc}>
            No records match the selected filter criteria.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {filteredEntries.map((item) => {
            const isCredit = item.type === 'FEE_CREDIT'
            const isForfeit = item.type === 'FORFEIT'

            return (
              <Card key={item.id} style={styles.txCard}>
                <View style={styles.txHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{item.description || item.type}</Text>
                    <Text style={styles.txTime}>{formatTxDate(item.createdAt)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      isCredit && styles.txCredit,
                      isForfeit && styles.txForfeit,
                    ]}
                  >
                    {isCredit ? '+' : '−'}
                    {formatPaise(Math.abs(item.amountPaise))}
                  </Text>
                </View>

                <View style={styles.txFooter}>
                  <Text style={styles.txId}>ID: {item.id.slice(0, 12)}</Text>
                  <StatusPill
                    tone={isCredit ? 'success' : isForfeit ? 'danger' : 'neutral'}
                    label={item.type.replace('_', ' ')}
                  />
                </View>
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
  filterRow: {
    flexDirection: 'row',
    gap: space['2xs'],
    backgroundColor: color.surfaceSubtle,
    padding: 3,
    borderRadius: radius.md,
  },
  filterTab: {
    flex: 1,
    paddingVertical: space.xs,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  filterTabActive: {
    backgroundColor: color.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  filterText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    fontWeight: '600',
    color: color.textMuted,
  },
  filterTextActive: {
    color: color.text,
    fontWeight: '700',
  },
  list: {
    gap: space.sm,
  },
  txCard: {
    padding: space.md,
    gap: space.xs,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txTitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  txTime: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
    marginTop: 2,
  },
  txAmount: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  txCredit: {
    color: '#059669',
  },
  txForfeit: {
    color: color.accent,
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.xs,
    marginTop: 2,
  },
  txId: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 10,
    color: color.textSubtle,
  },
  emptyCard: {
    padding: space['2xl'],
    alignItems: 'center',
    gap: space.xs,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  emptyDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    textAlign: 'center',
  },
})
