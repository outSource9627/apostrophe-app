import React, { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { color, space } from '../../theme'
import { Input, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvAction, IvCard, IvLabel } from '../../components/interviewer/iv'
import { EmField } from '../../components/employer/form'
import { ApiClientError } from '../../lib/api'
import { getBank, saveBank, type BankDto } from '../../lib/api/interviewer'
import { INTERVIEWER_KEY } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/** The platform's own shapes (contracts/wallet.ts bankAccountInput). */
const ACCOUNT = /^\d{9,18}$/
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/

/**
 * Payout account (no artboard — the drawn screens' language). The platform
 * never returns the full account number or the PAN, so both are asked for on
 * every save (the old screen sent a made-up PAN when only four digits were
 * held). What is saved now shows at the top.
 */
export function BankAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const qc = useQueryClient()
  const [current, setCurrent] = useState<BankDto | null>(null)
  const [holder, setHolder] = useState('')
  const [account, setAccount] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [pan, setPan] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    getBank().then((b) => {
      setCurrent(b)
      if (b) {
        setHolder(b.accountHolder)
        setIfsc(b.ifsc)
      }
    }).catch(() => {})
  }, [])

  const errs = {
    holder: holder.trim().length < 2 ? 'Enter the name on the account.' : undefined,
    account: !ACCOUNT.test(account) ? 'Enter 9 to 18 digits.' : undefined,
    confirm: confirm !== account ? 'The two numbers don’t match.' : undefined,
    ifsc: !IFSC.test(ifsc) ? 'An IFSC is 11 characters, like HDFC0001234.' : undefined,
    pan: !PAN.test(pan) ? 'A PAN is 10 characters, like ABCDE1234F.' : undefined,
  }
  const ok = !Object.values(errs).some(Boolean)

  async function save() {
    setTried(true)
    if (!ok) return
    setBusy(true)
    setNotice(null)
    try {
      const b = await saveBank({ accountHolder: holder.trim(), accountNumber: account, ifsc, pan })
      setCurrent(b)
      setAccount('')
      setConfirm('')
      setPan('')
      setTried(false)
      setNotice('Payout account saved.')
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Not saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const err = (k: keyof typeof errs) => (tried ? errs[k] : undefined)

  return (
    <InterviewerShell back={() => navigation.goBack()} title="Payout account" sub="Where withdrawals are paid" contentGap="lg" footer={<IvAction label={busy ? 'Saving…' : current ? 'Replace account' : 'Save account'} tone={busy ? 'off' : 'accent'} onPress={busy ? undefined : () => { save() }} />}>
      {!!current && (
        <IvCard>
          <IvLabel>SAVED NOW</IvLabel>
          <Text style={text.uiMdSemi}>{`${current.accountHolder} · •••• ${current.accountNumberLast4}`}</Text>
          <Text style={[text.uiXs, styles.muted]}>{`IFSC ${current.ifsc}${current.panLast4 ? ` · PAN •••• ${current.panLast4}` : ''}`}</Text>
        </IvCard>
      )}
      {!!notice && <Text style={[text.uiSm, styles.secondary]}>{notice}</Text>}
      <EmField label="Name on the account" error={err('holder')}>
        <Input value={holder} onChangeText={setHolder} autoCapitalize="words" invalid={!!err('holder')} />
      </EmField>
      <EmField label="Account number" error={err('account')}>
        <Input value={account} onChangeText={(v) => setAccount(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry invalid={!!err('account')} />
      </EmField>
      <EmField label="Confirm the account number" error={err('confirm')}>
        <Input value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, ''))} keyboardType="number-pad" invalid={!!err('confirm')} />
      </EmField>
      <EmField label="IFSC" error={err('ifsc')}>
        <Input value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={11} invalid={!!err('ifsc')} />
      </EmField>
      <EmField label="PAN" hint="Asked every time: the platform stores it encrypted and never shows it back." error={err('pan')}>
        <Input value={pan} onChangeText={(v) => setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={10} invalid={!!err('pan')} />
      </EmField>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary, marginTop: space['2xs'] },
})
