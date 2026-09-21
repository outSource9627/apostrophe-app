import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, radius, space } from '../../theme'
import { Button, Card, Eyebrow, Field, Input } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { MIN_WITHDRAWAL_PAISE } from '../../lib/interviewer/state'

export function WithdrawScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { wallet, refresh, profile } = useInterviewer()

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

  return (
    <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>PAYOUT DISBURSEMENT</Eyebrow>
        <Text style={styles.title}>Withdraw Funds</Text>
        <Text style={styles.subtitle}>
          Transfer your earned interviewer fees directly to your verified bank account via IMPS / NEFT.
        </Text>
      </View>

      {/* Available Balance Box */}
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>{formatPaise(balancePaise)}</Text>
        <Text style={styles.minNotice}>
          Minimum withdrawal: {formatPaise(MIN_WITHDRAWAL_PAISE)} · No processing fees
        </Text>
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
            <Pressable
              key={amt}
              onPress={() => handleQuickSelect(amt)}
              style={styles.chip}
            >
              <Text style={styles.chipText}>₹{amt}</Text>
            </Pressable>
          ))}
          {maxRupees >= 500 && (
            <Pressable
              onPress={() => handleQuickSelect(maxRupees)}
              style={[styles.chip, styles.chipFull]}
            >
              <Text style={[styles.chipText, styles.chipFullText]}>Full Balance</Text>
            </Pressable>
          )}
        </View>

        {/* Bank Account Destination */}
        <View style={styles.bankBox}>
          <Text style={styles.bankLabel}>Destination Account:</Text>
          {wallet?.bankAccount ? (
            <View style={styles.bankInfo}>
              <Text style={styles.bankName}>{wallet.bankAccount.bankName || 'Verified Bank'}</Text>
              <Text style={styles.bankAccountNum}>
                Account ending in {wallet.bankAccount.accountNumberLast4 || wallet.bankAccount.accountNumber?.slice(-4) || '****'} · {wallet.bankAccount.ifsc}
              </Text>
            </View>
          ) : (
            <View style={styles.noBankBox}>
              <Text style={styles.noBankText}>No bank account linked.</Text>
              <Pressable onPress={() => navigation.navigate('InterviewerBankAccount')}>
                <Text style={styles.linkBankBtn}>+ Link Bank Account</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Button
          label={submitting ? 'Processing Request...' : 'Confirm Withdrawal'}
          variant="primary"
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
  balanceCard: {
    padding: space.md,
    gap: space['2xs'],
    backgroundColor: color.surfaceSubtle,
  },
  balanceLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    color: color.textMuted,
  },
  balanceValue: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 26,
    fontWeight: '700',
    color: color.text,
  },
  minNotice: {
    fontFamily: fontFamilyNative.body,
    fontSize: 11,
    color: color.textSubtle,
    marginTop: 2,
  },
  formCard: {
    padding: space.md,
    gap: space.md,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: -space.xs,
  },
  chip: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    backgroundColor: color.surfaceSubtle,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  chipFull: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  chipText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    fontWeight: '600',
    color: color.text,
  },
  chipFullText: {
    color: color.accent,
  },
  bankBox: {
    backgroundColor: color.surfaceSubtle,
    padding: space.md,
    borderRadius: radius.sm,
    gap: space['2xs'],
  },
  bankLabel: {
    fontFamily: fontFamilyNative.body,
    fontSize: 12,
    fontWeight: '600',
    color: color.textMuted,
  },
  bankInfo: {
    gap: 2,
  },
  bankName: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '700',
    color: color.text,
  },
  bankAccountNum: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 12,
    color: color.textSubtle,
  },
  noBankBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space['2xs'],
  },
  noBankText: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.accent,
  },
  linkBankBtn: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    fontWeight: '700',
    color: color.accent,
  },
})
