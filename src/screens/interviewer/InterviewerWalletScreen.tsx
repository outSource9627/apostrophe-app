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
import {
  Body,
  Button,
  Card,
  Display,
  EmptyState,
  ErrorState,
  Eyebrow,
  Figure,
  ObjectRow,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { formatPaise } from '../../lib/format/money'
import { MIN_WITHDRAWAL_PAISE } from '../../lib/interviewer/state'

export function InterviewerWalletScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { profile, wallet, loading, error, refresh } = useInterviewer()

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

  if (loading && !wallet) {
    return (
      <InterviewerShell navTab="wallet">
        <Skeleton lines={4} />
      </InterviewerShell>
    )
  }

  if (error && !wallet) {
    return (
      <InterviewerShell navTab="wallet">
        <ErrorState
          title="We could not load your wallet."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={refresh} />}
        />
      </InterviewerShell>
    )
  }

  const recentEntries = wallet?.ledger?.slice(0, 5) ?? []

  return (
    <InterviewerShell navTab="wallet">
      <View style={styles.header}>
        <View>
          <Eyebrow>COMPENSATION & LEDGER</Eyebrow>
          <Display level="lg" accessibilityRole="header">
            Interviewer Wallet
          </Display>
        </View>
        <StatusPill
          tone={isSuspended ? 'danger' : canWithdraw ? 'success' : 'neutral'}
          label={isSuspended ? 'SUSPENDED' : canWithdraw ? 'READY' : 'BELOW MINIMUM'}
        />
      </View>

      {/* Balances Hero Card */}
      <Card style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Body size="xs" tone="muted">
            Available for Withdrawal
          </Body>
          <Figure value={formatPaise(balancePaise)} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Eyebrow>Locked (Owed)</Eyebrow>
            <Display level="xs">{formatPaise(lockedPaise)}</Display>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Eyebrow>Lifetime Earned</Eyebrow>
            <Display level="xs">{formatPaise(lifetimePaise)}</Display>
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
      <Card>
        <ObjectRow
          last
          thumb={
            <View style={styles.bankAvatar}>
              <Text style={styles.bankIcon}>🏦</Text>
            </View>
          }
          title="Payout Bank Account"
          meta={
            wallet?.bankAccount
              ? `${wallet.bankAccount.bankName || 'Bank'} · Ending in ${wallet.bankAccount.accountNumberLast4 || wallet.bankAccount.accountNumber?.slice(-4) || '****'}`
              : 'No bank account linked yet.'
          }
          status={
            <Button
              label={wallet?.bankAccount ? 'Edit' : 'Link'}
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate('InterviewerBankAccount')}
            />
          }
        />
      </Card>

      {/* Quick Navigation Links */}
      <View style={styles.linksRow}>
        <Pressable style={styles.linkWrap} onPress={() => navigation.navigate('InterviewerLedger')}>
          <Card style={styles.linkCard}>
            <Text style={styles.linkIcon}>📜</Text>
            <Body size="md" weight="semibold">
              Itemised Ledger
            </Body>
            <Body size="2xs" tone="subtle">
              Every credit, fee & forfeit →
            </Body>
          </Card>
        </Pressable>

        <Pressable style={styles.linkWrap} onPress={() => navigation.navigate('InterviewerStatements')}>
          <Card style={styles.linkCard}>
            <Text style={styles.linkIcon}>📊</Text>
            <Body size="md" weight="semibold">
              Tax & Statements
            </Body>
            <Body size="2xs" tone="subtle">
              Monthly 1% TDS summary →
            </Body>
          </Card>
        </Pressable>
      </View>

      {/* Recent Ledger Entries */}
      <View style={styles.ledgerSection}>
        <View style={styles.ledgerHeader}>
          <Body size="sm" weight="semibold">
            Recent Transactions
          </Body>
          <Button
            variant="outline"
            size="sm"
            label="View All"
            onPress={() => navigation.navigate('InterviewerLedger')}
          />
        </View>

        {recentEntries.length === 0 ? (
          <Card>
            <EmptyState
              title="No transactions yet."
              body="Conduct sessions and submit scorecards to earn fees."
            />
          </Card>
        ) : (
          <Card>
            {recentEntries.map((entry, i) => {
              const isCredit = entry.type === 'FEE_CREDIT'
              const isForfeit = entry.type === 'FORFEIT'

              return (
                <ObjectRow
                  key={entry.id}
                  last={i === recentEntries.length - 1}
                  title={entry.description || entry.type}
                  meta={formatTxDate(entry.createdAt)}
                  status={
                    <Body
                      size="sm"
                      weight="semibold"
                      style={[styles.txAmount, isCredit && styles.txCredit, isForfeit && styles.txForfeit]}
                    >
                      {isCredit ? '+' : '−'}
                      {formatPaise(Math.abs(entry.amountPaise))}
                    </Body>
                  }
                />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  heroCard: {
    padding: space.lg,
    gap: space.md,
  },
  heroHeader: {
    gap: space['2xs'],
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
  divider: {
    width: borderWidth.thin,
    height: 30,
    backgroundColor: color.border,
    marginHorizontal: space.sm,
  },
  withdrawAction: {
    marginTop: space['2xs'],
  },
  bankAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSubtle,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankIcon: {
    fontSize: 20,
  },
  linksRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  linkWrap: {
    flex: 1,
  },
  linkCard: {
    padding: space.md,
    gap: space['2xs'],
  },
  linkIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  ledgerSection: {
    gap: space.xs,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
})
