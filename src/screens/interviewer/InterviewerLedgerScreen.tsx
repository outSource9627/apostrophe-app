import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, space } from '../../theme'
import {
  Body,
  Button,
  Card,
  Chip,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Meta,
  ObjectRow,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'

type LedgerFilter = 'ALL' | 'FEE_CREDIT' | 'WITHDRAWAL' | 'FORFEIT'

export function InterviewerLedgerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { wallet, loading, error, refresh } = useInterviewer()
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

  if (loading && !wallet) {
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
          title="We could not load your ledger."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>TRANSACTION HISTORY</Eyebrow>
        <Display level="lg" accessibilityRole="header">
          Itemised Ledger
        </Display>
        <Body size="sm" tone="muted">
          Every fee credited, withdrawal disbursed, and forfeiture recorded with full audit trail.
        </Body>
      </View>

      {/* Filter Tabs — a scrolling chip row, same as the status filter on Interviews. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        <Chip label="All" selected={filter === 'ALL'} onPress={() => setFilter('ALL')} />
        <Chip label="Credits" selected={filter === 'FEE_CREDIT'} onPress={() => setFilter('FEE_CREDIT')} />
        <Chip label="Withdrawals" selected={filter === 'WITHDRAWAL'} onPress={() => setFilter('WITHDRAWAL')} />
        <Chip label="Forfeits" selected={filter === 'FORFEIT'} onPress={() => setFilter('FORFEIT')} />
      </ScrollView>

      {/* Ledger List */}
      {filteredEntries.length === 0 ? (
        <Card>
          <EmptyState title="No transactions found" body="No records match the selected filter criteria." />
        </Card>
      ) : (
        <View style={styles.list}>
          {filteredEntries.map((item) => {
            const isCredit = item.type === 'FEE_CREDIT'
            const isForfeit = item.type === 'FORFEIT'

            return (
              <Card key={item.id} style={styles.txCard}>
                <ObjectRow
                  last
                  title={item.description || item.type}
                  meta={formatTxDate(item.createdAt)}
                  status={
                    <Body
                      size="sm"
                      weight="semibold"
                      style={[styles.txAmount, isCredit && styles.txCredit, isForfeit && styles.txForfeit]}
                    >
                      {isCredit ? '+' : '−'}
                      {formatPaise(Math.abs(item.amountPaise))}
                    </Body>
                  }
                />

                <View style={styles.txFooter}>
                  <Meta>{`ID: ${item.id.slice(0, 12)}`}</Meta>
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
  tabRow: {
    gap: space.sm,
    paddingVertical: space['2xs'],
  },
  list: {
    gap: space.sm,
  },
  txCard: {
    padding: space.md,
    gap: space.xs,
  },
  txAmount: {
    fontFamily: fontFamilyNative.mono,
  },
  txCredit: {
    color: color.success,
  },
  txForfeit: {
    color: color.danger,
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.xs,
  },
})
