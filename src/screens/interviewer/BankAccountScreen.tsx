import React, { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { color, fontFamilyNative as FF } from '../../theme'
import { PageFrame, PBtn, WCard, WField, WInput, k } from './walletKit'
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

  const err = (key: keyof typeof errs) => (tried ? errs[key] : undefined)

  return (
    <PageFrame onBack={() => navigation.goBack()} title="Payout account" sub="Where withdrawals are paid" footer={<PBtn on={!busy} label={busy ? 'Saving…' : current ? 'Replace account' : 'Save account'} onPress={busy ? undefined : () => { save() }} />}>
      {!!current && (
        <WCard gap={4}>
          <Text style={s.lbl}>Saved now</Text>
          <Text style={k.nmx}>{`${current.accountHolder} · •••• ${current.accountNumberLast4}`}</Text>
          <Text style={k.sub}>{`IFSC ${current.ifsc}${current.panLast4 ? ` · PAN •••• ${current.panLast4}` : ''}`}</Text>
        </WCard>
      )}
      {!!notice && <Text style={s.notice}>{notice}</Text>}
      <WField label="Name on the account" error={err('holder')}>
        <WInput value={holder} onChangeText={setHolder} autoCapitalize="words" bad={!!err('holder')} />
      </WField>
      <WField label="Account number" error={err('account')}>
        <WInput value={account} onChangeText={(v) => setAccount(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry bad={!!err('account')} />
      </WField>
      <WField label="Confirm the account number" error={err('confirm')}>
        <WInput value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, ''))} keyboardType="number-pad" bad={!!err('confirm')} />
      </WField>
      <WField label="IFSC" error={err('ifsc')}>
        <WInput value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={11} bad={!!err('ifsc')} />
      </WField>
      <WField label="PAN" hint="Asked every time: the platform stores it encrypted and never shows it back." error={err('pan')}>
        <WInput value={pan} onChangeText={(v) => setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={10} bad={!!err('pan')} />
      </WField>
    </PageFrame>
  )
}

const s = StyleSheet.create({
  lbl: { fontFamily: FF.bodyMedium, fontSize: 14, color: color.textMuted },
  notice: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 20, color: color.textSecondary },
})
