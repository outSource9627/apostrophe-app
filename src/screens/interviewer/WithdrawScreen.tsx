import React, { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space } from '../../theme'
import { Body, Button, Card, Chip, Display, ErrorState, Eyebrow, Field, Figure, Input, ObjectRow, Skeleton } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { MIN_WITHDRAWAL_PAISE } from '../../lib/interviewer/state'

export function WithdrawScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { wallet, loading, error, refresh, profile } = useInterviewer()

  const balancePaise = wallet?.balancePaise ?? 0
  const maxRupees = Math.floor(balancePaise / 100)
  const isSuspended = profile?.status === 'SUSPENDED'

  const [rupees, setRupees] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleQuickSelect = (amt: number) => {
    setRupees(amt.toString())
  }

  const handleWithdraw = async () => {
    if (isSuspended) {
      Alert.alert('Account Suspended', 'Withdrawals are locked while account is under suspension.')
      return
    }

    const amtNum = parseInt(rupees, 10)
    if (isNaN(amtNum) || amtNum < 500) {
      Alert.alert('Minimum Amount', `Minimum withdrawal is ${formatPaise(MIN_WITHDRAWAL_PAISE)} (₹500).`)
      return
    }

    const requestedPaise = amtNum * 100
    if (requestedPaise > balancePaise) {
      Alert.alert('Insufficient Balance', 'Requested withdrawal amount exceeds your available balance.')
      return
    }

    if (!wallet?.bankAccount?.accountNumber && !wallet?.bankAccount?.accountNumberLast4) {
      Alert.alert('Bank Account Missing', 'Please link your payout bank account before requesting a withdrawal.', [
        { text: 'Link Bank Account', onPress: () => navigation.navigate('InterviewerBankAccount') },
      ])
      return
    }

    setSubmitting(true)
    try {
      await interviewerApi.requestWithdrawal(requestedPaise)
      await refresh()
      Alert.alert(
        'Withdrawal Requested',
        `A payout request for ${formatPaise(requestedPaise)} has been placed. Funds will be transferred to your registered bank account within 1–2 business days.`,
        [{ text: 'OK', onPress: () => navigation.replace('InterviewerWallet') }],
      )
    } catch (err: any) {
      Alert.alert('Request Failed', err?.message || 'Unable to process withdrawal request.')
    } finally {
      setSubmitting(false)
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
          title="We could not load your wallet."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => refresh()} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>PAYOUT DISBURSEMENT</Eyebrow>
        <Display level="lg">Withdraw Funds</Display>
        <Body size="sm" tone="muted">
          Transfer your earned interviewer fees directly to your verified bank account via IMPS / NEFT.
        </Body>
      </View>

      {/* Available Balance */}
      <Card style={styles.balanceCard}>
        <Body size="xs" tone="muted">
          Available Balance
        </Body>
        <Figure value={formatPaise(balancePaise)} />
        <Body size="2xs" tone="subtle">
          Minimum withdrawal: {formatPaise(MIN_WITHDRAWAL_PAISE)} · No processing fees
        </Body>
      </Card>

      {/* Amount Input */}
      <Card style={styles.formCard}>
        <Field label="Withdrawal Amount (in INR ₹)">
          <Input
            value={rupees}
            onChangeText={setRupees}
            placeholder="e.g. 1500"
            keyboardType="number-pad"
          />
        </Field>

        {/* Quick Amount Chips */}
        <View style={styles.chipsRow}>
          {[500, 1000, 2500].map((amt) => (
            <Chip
              key={amt}
              label={`₹${amt}`}
              selected={rupees === String(amt)}
              onPress={() => handleQuickSelect(amt)}
            />
          ))}
          {maxRupees >= 500 && (
            <Chip
              label="Full Balance"
              selected={rupees === String(maxRupees)}
              onPress={() => handleQuickSelect(maxRupees)}
            />
          )}
        </View>

        {/* Bank Account Destination */}
        <ObjectRow
          last
          title="Destination Account"
          meta={
            wallet?.bankAccount
              ? `${wallet.bankAccount.bankName || 'Verified Bank'} · Ending in ${wallet.bankAccount.accountNumberLast4 || wallet.bankAccount.accountNumber?.slice(-4) || '****'} · ${wallet.bankAccount.ifsc}`
              : 'No bank account linked.'
          }
          status={
            !wallet?.bankAccount ? (
              <Button
                label="+ Link"
                variant="secondary"
                size="sm"
                onPress={() => navigation.navigate('InterviewerBankAccount')}
              />
            ) : undefined
          }
        />

        <Button
          label={submitting ? 'Processing Request...' : 'Confirm Withdrawal'}
          variant="primary"
          busy={submitting}
          disabled={submitting || balancePaise < MIN_WITHDRAWAL_PAISE || isSuspended}
          onPress={handleWithdraw}
        />
      </Card>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  balanceCard: {
    padding: space.md,
    gap: space['2xs'],
    backgroundColor: color.surfaceSubtle,
  },
  formCard: {
    padding: space.md,
    gap: space.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
})
