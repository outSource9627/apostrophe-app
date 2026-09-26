import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { color, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvAction, IvCard, IvLabel } from '../../components/interviewer/iv'
import { EmBadge, EmChip, EmError } from '../../components/employer/em'
import { EmField } from '../../components/employer/form'
import { ApiClientError } from '../../lib/api'
import { getBank, getWallet, listWithdrawals, requestWithdrawal, type BankDto, type WalletDto, type WithdrawalDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { istStamp } from '../../lib/interviewer/state'
import { minWithdrawal, WITHDRAWAL_STATUS, withdrawBlockedText } from '../../lib/interviewer/wallet'
import { INTERVIEWER_KEY, useAppConfig, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/**
 * Withdraw (no artboard — the drawn screens' language). The amount in rupees
 * (Minimum and All fill it), the payout account it goes to, and the request.
 * The minimum is the server's; whether a withdrawal is allowed at all is the
 * server's decision, shown with its reason. Beneath, every request with the
 * server's status (Requested, Approved, Paid, Rejected with its reason).
 */
export function WithdrawScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const qc = useQueryClient()
  const config = useAppConfig()
  const { suspended } = useInterviewerMe()
  const [wallet, setWallet] = useState<WalletDto | null>(null)
  const [bank, setBank] = useState<BankDto | null>(null)
  const [history, setHistory] = useState<WithdrawalDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [w, b, h] = await Promise.all([getWallet(), getBank().catch(() => null), listWithdrawals().catch(() => null)])
      setWallet(w)
      setBank(b)
      setHistory(h?.rows ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your wallet.')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  if (!wallet) {
    return (
      <InterviewerShell back={() => navigation.goBack()} title="Withdraw">
        {error ? <EmError title="Couldn’t load your wallet." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /> : <ActivityIndicator color={color.textSubtle} style={styles.loading} />}
      </InterviewerShell>
    )
  }

  const min = minWithdrawal(wallet, config)
  const blocked = withdrawBlockedText(wallet, config, suspended)
  const paise = Math.round(Number(amount || '0') * 100)
  const tooLow = min != null && paise > 0 && paise < min
  const tooHigh = paise > wallet.availablePaise
  const ok = !blocked && paise > 0 && !tooLow && !tooHigh

  async function submit() {
    setBusy(true)
    setNotice(null)
    try {
      const r = await requestWithdrawal(paise)
      setNotice(`${formatPaise(r.amountPaise)} requested. You’ll see its status below.`)
      setAmount('')
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
      load()
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Not requested. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <InterviewerShell
      back={() => navigation.goBack()}
      title="Withdraw"
      sub={`${formatPaise(wallet.availablePaise)} available`}
      footer={<IvAction label={busy ? 'Requesting…' : ok ? `Withdraw ${formatPaise(paise)}` : 'Withdraw'} tone={ok && !busy ? 'accent' : 'off'} onPress={ok && !busy ? () => { submit() } : undefined} />}
    >
      {!!blocked && <IvCard tone="danger"><Text style={[text.uiSm, styles.danger]}>{blocked}</Text></IvCard>}
      <EmField
        label="Amount"
        note="₹"
        error={tooLow && min != null ? `The minimum is ${formatPaise(min)}.` : tooHigh ? 'That is more than is available.' : undefined}
        hint={min != null ? `Minimum ${formatPaise(min)}` : undefined}
      >
        <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" editable={!blocked} />
      </EmField>
      <View style={styles.chips}>
        {min != null && min <= wallet.availablePaise && <EmChip compact label="Minimum" on={paise === min} onPress={() => setAmount(String(min / 100))} />}
        {wallet.availablePaise > 0 && <EmChip compact label="All" on={paise === wallet.availablePaise} onPress={() => setAmount(String(wallet.availablePaise / 100))} />}
      </View>
      <IvCard>
        <IvLabel>PAID TO</IvLabel>
        <Text style={text.uiMdSemi}>{bank ? `${bank.accountHolder} · •••• ${bank.accountNumberLast4}` : 'No payout account yet'}</Text>
        {!!bank && <Text style={[text.uiXs, styles.muted]}>{`IFSC ${bank.ifsc}`}</Text>}
        <Button variant="outline" size="sm" label={bank ? 'Change account' : 'Add an account'} onPress={() => navigation.navigate('InterviewerBankAccount')} style={styles.start} />
      </IvCard>
      {!!notice && <Text style={[text.uiSm, styles.secondary]}>{notice}</Text>}

      {!!history?.length && (
        <>
          <IvLabel style={styles.section}>REQUESTS</IvLabel>
          {history.map((w) => {
            const st = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, tone: 'violet' as const }
            return (
              <IvCard key={w.id}>
                <View style={styles.top}>
                  <Text style={[text.metaXl, styles.fig]}>{formatPaise(w.amountPaise)}</Text>
                  <EmBadge label={st.label} tone={st.tone} small />
                </View>
                <Text style={[text.uiXs, styles.muted]}>{`Requested ${istStamp(w.requestedAt)}${w.payment?.reference ? ` · Ref ${w.payment.reference}` : ''}`}</Text>
                {w.status === 'REJECTED' && !!w.rejectionReason && <Text style={[text.uiXs, styles.danger]}>{w.rejectionReason}</Text>}
              </IvCard>
            )
          })}
        </>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },
  fig: { letterSpacing: trackingNative.meta },
  loading: { paddingVertical: space['3xl'] },
  chips: { flexDirection: 'row', gap: spaceHalf['1.5'] },
  start: { alignSelf: 'flex-start', paddingHorizontal: space.md, marginTop: space.xs },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { marginTop: space.sm },
})
