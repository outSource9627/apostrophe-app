import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { color, fontFamilyNative as FF } from '../../theme'
import { OutBtn, PageFrame, PBtn, WBadge, WCard, WChip, WField, WInput, ErrBlock, k } from './walletKit'
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
      <PageFrame onBack={() => navigation.goBack()} title="Withdraw">
        {error ? <ErrBlock title="Couldn’t load your wallet." body={error} onRetry={() => { load() }} /> : <ActivityIndicator color={color.textSubtle} style={s.loading} />}
      </PageFrame>
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

  const err = tooLow && min != null ? `The minimum is ${formatPaise(min)}.` : tooHigh ? 'That is more than is available.' : undefined

  return (
    <PageFrame
      onBack={() => navigation.goBack()}
      title="Withdraw"
      sub={`${formatPaise(wallet.availablePaise)} available`}
      footer={<PBtn on={ok && !busy} label={busy ? 'Requesting…' : ok ? `Withdraw ${formatPaise(paise)}` : 'Withdraw'} onPress={ok && !busy ? () => { submit() } : undefined} />}
    >
      {!!blocked && <WCard tone="danger" padding={14}><Text style={s.blocked}>{blocked}</Text></WCard>}
      <WField label="Amount" error={err} hint={min != null ? `Minimum ${formatPaise(min)}` : undefined}>
        <WInput lead="₹" bad={!!err} dis={!!blocked} value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" />
      </WField>
      <View style={s.chips}>
        {min != null && min <= wallet.availablePaise && <WChip sm label="Minimum" on={paise === min} onPress={() => setAmount(String(min / 100))} />}
        {wallet.availablePaise > 0 && <WChip sm label="All" on={paise === wallet.availablePaise} onPress={() => setAmount(String(wallet.availablePaise / 100))} />}
      </View>
      <WCard gap={4}>
        <Text style={s.lbl}>Paid to</Text>
        <Text style={k.nmx}>{bank ? `${bank.accountHolder} · •••• ${bank.accountNumberLast4}` : 'No payout account yet'}</Text>
        {!!bank && <Text style={k.sub}>{`IFSC ${bank.ifsc}`}</Text>}
        <OutBtn sm label={bank ? 'Change account' : 'Add an account'} onPress={() => navigation.navigate('InterviewerBankAccount')} style={s.start} />
      </WCard>
      {!!notice && <Text style={s.notice}>{notice}</Text>}

      {!!history?.length && (
        <>
          <Text accessibilityRole="header" style={s.section}>Requests</Text>
          {history.map((w) => {
            const st = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, tone: 'violet' as const }
            return (
              <WCard key={w.id} gap={4}>
                <View style={s.top}>
                  <Text style={s.fig}>{formatPaise(w.amountPaise)}</Text>
                  <WBadge label={st.label} tone={st.tone} />
                </View>
                <Text style={k.sub}>{`Requested ${istStamp(w.requestedAt)}${w.payment?.reference ? ` · Ref ${w.payment.reference}` : ''}`}</Text>
                {w.status === 'REJECTED' && !!w.rejectionReason && <Text style={[k.sub, { color: color.danger }]}>{w.rejectionReason}</Text>}
              </WCard>
            )
          })}
        </>
      )}
    </PageFrame>
  )
}

const s = StyleSheet.create({
  loading: { paddingVertical: 48 },
  blocked: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 20, color: color.danger },
  chips: { flexDirection: 'row', gap: 8 },
  lbl: { fontFamily: FF.bodyMedium, fontSize: 14, color: color.textMuted },
  start: { marginTop: 4 },
  notice: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 20, color: color.textSecondary },
  section: { fontFamily: FF.bodyBold, fontSize: 19, letterSpacing: -0.57, color: color.text, paddingTop: 2, paddingHorizontal: 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fig: { fontFamily: FF.bodyMedium, fontSize: 17, fontVariant: ['tabular-nums'], color: color.text },
})
