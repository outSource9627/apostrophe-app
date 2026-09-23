import React, { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { space } from '../../theme'
import { Banner, Body, Button, Card, Display, ErrorState, Eyebrow, Field, Input, Skeleton } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { useInterviewer } from '../../lib/interviewer/useInterviewer'
import { interviewerApi } from '../../lib/api/interviewer'

export function BankAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const { wallet, loading, error, refresh } = useInterviewer()

  const [accountHolder, setAccountHolder] = useState(
    wallet?.bankAccount?.beneficiaryName || wallet?.bankAccount?.accountHolder || '',
  )
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState(wallet?.bankAccount?.ifsc || '')
  const [bankName, setBankName] = useState(wallet?.bankAccount?.bankName || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!accountHolder.trim() || !accountNumber.trim() || !ifsc.trim() || !bankName.trim()) {
      Alert.alert('Missing Details', 'Please complete all bank account details.')
      return
    }

    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      Alert.alert('Mismatch', 'Account number and confirmation account number do not match.')
      return
    }

    const cleanIfsc = ifsc.trim().toUpperCase()
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      Alert.alert(
        'Invalid IFSC',
        'Please enter a valid 11-character Indian Financial System Code (e.g. HDFC0001234).',
      )
      return
    }

    setSaving(true)
    try {
      await interviewerApi.updateBankDetails({
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        ifsc: cleanIfsc,
        bankName: bankName.trim(),
      })
      await refresh()
      Alert.alert('Bank Account Linked', 'Your payout bank details have been saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Unable to update bank details.')
    } finally {
      setSaving(false)
    }
  }

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
          title="We could not load your bank account."
          body={error.message}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => refresh()} />}
        />
      </InterviewerShell>
    )
  }

  return (
    <InterviewerShell back={{ label: 'Wallet', onPress: () => navigation.goBack() }}>
      <View style={styles.header}>
        <Eyebrow>PAYOUT RECIPIENT</Eyebrow>
        <Display level="lg">Bank Account Details</Display>
        <Body size="sm" tone="muted">
          Payouts are transferred via IMPS / NEFT directly into this Indian bank account.
        </Body>
      </View>

      <Card style={styles.card}>
        <Field label="Account Holder Name (as per passbook/cheque) *">
          <Input
            value={accountHolder}
            onChangeText={setAccountHolder}
            placeholder="e.g. PRIYANSHU SHARMA"
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Bank Name *">
          <Input
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g. HDFC Bank, ICICI Bank, State Bank of India"
          />
        </Field>

        <Field label="Account Number *">
          <Input
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="Enter full account number"
            keyboardType="number-pad"
            secureTextEntry
          />
        </Field>

        <Field label="Confirm Account Number *">
          <Input
            value={confirmAccountNumber}
            onChangeText={setConfirmAccountNumber}
            placeholder="Re-enter account number"
            keyboardType="number-pad"
          />
        </Field>

        <Field label="IFSC Code (11 characters) *">
          <Input
            value={ifsc}
            onChangeText={(t) => setIfsc(t.toUpperCase())}
            placeholder="e.g. HDFC0001234"
            autoCapitalize="characters"
            maxLength={11}
          />
        </Field>

        <Banner tone="neutral">
          Account numbers are encrypted at rest. We never share your banking credentials with candidates or external
          third parties.
        </Banner>

        <Button
          label="Save Bank Account"
          variant="primary"
          busy={saving}
          onPress={handleSave}
        />
      </Card>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space['2xs'],
  },
  card: {
    padding: space.md,
    gap: space.md,
  },
})
