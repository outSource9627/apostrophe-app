import React from 'react'
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
import { Button, Card, Eyebrow, StatusPill } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'
import { MIN_WITHDRAWAL_PAISE } from '../../lib/interviewer/state'

export function InterviewerWalletScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { profile, wallet, owedScorecards } = useInterviewer()

  const isSuspended = profile?.status === 'SUSPENDED'
  const balancePaise = wallet?.balancePaise ?? 0
  const lockedPaise = wallet?.lockedPaise ?? 0
  const lifetimePaise = wallet?.lifetimePaise ?? 0
  const canWithdraw = !isSuspended && balancePaise >= MIN_WITHDRAWAL_PAISE

  const formatTxDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <InterviewerShell navTab="wallet">
      <View style={styles.header}>
        <Eyebrow>COMPENSATION & LEDGER</Eyebrow>
        <Text style={styles.title}>Interviewer Wallet</Text>
      </View>

      {/* Balances Hero Card */}
      <Card style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroLabel}>Available for Withdrawal</Text>
          <Text style={styles.heroAmount}>{formatPaise(balancePaise)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Locked (Owed)</Text>
            <Text style={styles.statVal}>{formatPaise(lockedPaise)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Lifetime Earned</Text>
            <Text style={styles.statVal}>{formatPaise(lifetimePaise)}</Text>
          </View>
        </View>

        <View style={styles.withdrawAction}>
          <Button
            label={
              isSuspended
                ? 'Withdrawals Locked (Suspended)'
                : balancePaise < MIN_WITHDRAWAL_PAISE
                ? `Min ${formatPaise(MIN_WITHDRAWAL_PAISE)} to withdraw`
                : 'Request Withdrawal'
            }
            variant="primary"
            disabled={!canWithdraw}
            onPress={() => navigation.navigate('InterviewerWithdraw')}
          />
        </View>
      </Card>

      {/* Bank Account Status */}
      <Card style={styles.bankCard}>
        <View style={styles.bankHeader}>
          <Text style={styles.bankIcon}>🏦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bankTitle}>Payout Bank Account</Text>
            <Text style={styles.bankSub}>
              {wallet?.bankAccount
                ? `${wallet.bankAccount.bankName || 'Bank'} · Ending in ${wallet.bankAccount.accountNumberLast4 || wallet.bankAccount.accountNumber?.slice(-4) || '****'}`
                : 'No bank account linked yet.'}
            </Text>
          </View>
          <Button
            label={wallet?.bankAccount ? 'Edit' : 'Link'}
            variant="secondary"
            size="sm"
            onPress={() => navigation.navigate('InterviewerBankAccount')}
          />
        </View>
      </Card>

      {/* Quick Navigation Links */}
      <View style={styles.linksRow}>
        <Pressable
          style={styles.linkCard}
          onPress={() => navigation.navigate('InterviewerLedger')}
        >
          <Text style={styles.linkIcon}>📜</Text>
          <Text style={styles.linkTitle}>Itemised Ledger</Text>
          <Text style={styles.linkSub}>Every credit, fee & forfeit →</Text>
        </Pressable>

        <Pressable
          style={styles.linkCard}
          onPress={() => navigation.navigate('InterviewerStatements')}
        >
          <Text style={styles.linkIcon}>📊</Text>
          <Text style={styles.linkTitle}>Tax & Statements</Text>
          <Text style={styles.linkSub}>Monthly 1% TDS summary →</Text>
        </Pressable>
      </View>

      {/* Recent Ledger Entries */}
      <View style={styles.ledgerSection}>
        <View style={styles.ledgerHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Pressable onPress={() => navigation.navigate('InterviewerLedger')}>
            <Text style={styles.viewAllLink}>View All</Text>
          </Pressable>
        </View>

        {!wallet?.ledger || wallet.ledger.length === 0 ? (
          <Card style={styles.emptyLedger}>
            <Text style={styles.emptyText}>No transactions yet.</Text>
            <Text style={styles.emptySub}>
              Conduct sessions and submit scorecards to earn fees.
            </Text>
          </Card>
        ) : (
          <Card style={styles.ledgerList}>
            {wallet.ledger.slice(0, 5).map((entry) => {
              const isCredit = entry.type === 'FEE_CREDIT'
              const isForfeit = entry.type === 'FORFEIT'

              return (
                <View key={entry.id} style={styles.txRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txDesc}>{entry.description || entry.type}</Text>
                    <Text style={styles.txDate}>{formatTxDate(entry.createdAt)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      isCredit && styles.txCredit,
                      isForfeit && styles.txForfeit,
                    ]}
                  >
                    {isCredit ? '+' : '−'}
                    {formatPaise(Math.abs(entry.amountPaise))}
                  </Text>
                </View>
              )
            })}
          </Card>
        )}
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
  heroCard: {
    padding: space.lg,
    gap: space.md,
  },
  heroHeader: {
    gap: space['2xs'],
  },
  heroLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
  },
  heroAmount: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 32,
    fontWeight: '700',
    color: color.text,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.md,
    padding: space.md,
  },
  statBox: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
  },
  statVal: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: color.border,
    marginHorizontal: space.sm,
  },
  withdrawAction: {
    marginTop: space['2xs'],
  },
  bankCard: {
    padding: space.md,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  bankIcon: {
    fontSize: 24,
  },
  bankTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  bankSub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
    marginTop: 2,
  },
  linksRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  linkCard: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: space['2xs'],
  },
  linkIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  linkTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  linkSub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
    marginTop: 2,
  },
  ledgerSection: {
    gap: space.xs,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
  },
  viewAllLink: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.accent,
  },
  emptyLedger: {
    padding: space.lg,
    alignItems: 'center',
    gap: space['2xs'],
  },
  emptyText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
    color: color.text,
  },
  emptySub: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  ledgerList: {
    padding: space.xs,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  txDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '600',
    color: color.text,
  },
  txDate: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
    marginTop: 2,
  },
  txAmount: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  txCredit: {
    color: '#059669',
  },
  txForfeit: {
    color: color.accent,
  },
})
