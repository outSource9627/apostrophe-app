import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { getBank, getLedger, getWallet, listWithdrawals, LEDGER_KIND_LABELS, type BankDto, type LedgerRowDto, type WalletDto, type WithdrawalDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { istStamp } from '../../lib/interviewer/state'
import { withdrawBlockedText, WITHDRAWAL_STATUS } from '../../lib/interviewer/wallet'
import { useAppConfig, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import { ErrBlock, ledgerMeta, SkelBox, SkelRows, WBadge, k } from './walletKit'
import type { RootStackParamList } from '../../../App'

/**
 * Wallet (docs/interviewer-wallet-mockup.html). The ink card holds the server's
 * Available balance with Withdraw — or the server's reason it is unavailable —
 * and Pending / In withdrawal; beneath it Lifetime earned, the release note, the
 * latest withdrawal as a stepper, the five latest ledger rows, the saved payout
 * account and the statements. Every figure is the server's.
 */

/** The figure steps down for long values, as on Home. */
const stepSize = (s: string, sizes: [number, number, number, number]) => (s.length <= 6 ? sizes[0] : s.length === 7 ? sizes[1] : s.length === 8 ? sizes[2] : sizes[3])

function Chip({ icon, tone }: { icon: IconName; tone: 'ink' | 'ok' }) {
  return (
    <View style={[s.chipi, tone === 'ok' ? { backgroundColor: color.successSoft } : { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
      <Icon name={icon} size={13} tint={tone === 'ok' ? color.success : color.textOnInkMuted} weight={1.9} />
    </View>
  )
}

function InkTile({ icon, label, paise }: { icon: IconName; label: string; paise: number }) {
  const f = formatPaise(paise)
  return (
    <View style={s.itile}>
      <View style={s.li}><Chip icon={icon} tone="ink" /><Text style={s.inkLbl} numberOfLines={1}>{label}</Text></View>
      <Text style={[s.tileFig, { fontSize: stepSize(f, [24, 22, 20, 18]), letterSpacing: -0.045 * stepSize(f, [24, 22, 20, 18]) }, paise === 0 && { color: color.textMuted }]} numberOfLines={1}>{f}</Text>
    </View>
  )
}

/** The Requested, Approved/Rejected, Paid stepper for a withdrawal. */
function Stepper({ w, onOpen }: { w: WithdrawalDto; onOpen: () => void }) {
  const st = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, tone: 'violet' as const }
  const live = w.status === 'REQUESTED' || w.status === 'APPROVED'
  type Step = 'todo' | 'done' | 'cur' | 'ok' | 'bad'
  const steps: [Step, Step, Step] = ['todo', 'todo', 'todo']
  const small = ['', '', '']
  let l2 = 'Approved'
  const decided = w.decidedAt ? istStamp(w.decidedAt) : ''
  small[0] = istStamp(w.requestedAt)
  if (w.status === 'REQUESTED') steps[0] = 'cur'
  if (w.status === 'APPROVED') { steps[0] = 'done'; steps[1] = 'cur'; small[1] = decided }
  if (w.status === 'PAID') { steps[0] = 'done'; steps[1] = 'done'; steps[2] = 'ok'; small[1] = decided; small[2] = w.payment?.reference ? `Ref ${w.payment.reference}` : '' }
  if (w.status === 'REJECTED') { steps[0] = 'done'; steps[1] = 'bad'; l2 = 'Rejected'; small[1] = [decided, w.rejectionReason].filter(Boolean).join(' · ') }
  const label = ['Requested', l2, 'Paid']
  const bar = { todo: color.surfaceSunken, done: color.accent, cur: color.accentMuted, ok: color.successFill, bad: color.dangerFill }
  const fg = { todo: color.textSubtle, done: color.text, cur: color.accentHover, ok: color.success, bad: color.danger }
  return (
    <View style={[k.card, { gap: 10, padding: 16 }]}>
      <View style={s.rowJb}>
        <Text style={s.lbl}>{live ? 'Withdrawal in progress' : 'Last withdrawal'}</Text>
        <WBadge label={st.label} tone={st.tone} />
      </View>
      <Text style={s.stepAmt}>{formatPaise(w.amountPaise)}</Text>
      <View style={s.steps}>
        {steps.map((c, i) => (
          <View key={i} style={s.step}>
            <View style={[s.stepBar, { backgroundColor: bar[c] }]} />
            <Text style={[s.stepLabel, { color: fg[c] }]}>{label[i]}</Text>
            {!!small[i] && <Text style={s.stepSmall}>{small[i]}</Text>}
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [s.linkBtn, pressed && k.pressed]}><Text style={s.link}>See its status</Text></Pressable>
    </View>
  )
}

/** One timeline row of Recent: a dot on the rule, the kind, who/when, the signed amount. */
function TimelineRow({ r }: { r: LedgerRowDto }) {
  const credit = r.sign > 0
  return (
    <View style={s.ti}>
      <View style={[s.dot, credit && { borderColor: color.successFill, backgroundColor: color.successSoft }]} />
      <View style={k.grow}>
        <Text style={k.nmx} numberOfLines={1}>{LEDGER_KIND_LABELS[r.kind] ?? r.kind}</Text>
        <Text style={k.sub} numberOfLines={2}>{ledgerMeta(r)}</Text>
      </View>
      <Text style={[k.amt, { flexShrink: 0 }, credit && { color: color.success }]}>{`${credit ? '+' : '−'}${formatPaise(r.amountPaise)}`}</Text>
    </View>
  )
}

function RowBtn({ icon, title, sub, onPress, last }: { icon: IconName; title: string; sub: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.rowbtn, !last && k.rule, pressed && k.pressed]}>
      <View style={s.rowIc}><Icon name={icon} size={19} tint={color.textSecondary} weight={1.9} /></View>
      <View style={k.grow}>
        <Text style={k.nmx}>{title}</Text>
        <Text style={k.sub} numberOfLines={2}>{sub}</Text>
      </View>
      <Icon name="chevR" size={18} tint={color.textSubtle} weight={1.9} />
    </Pressable>
  )
}

export function InterviewerWalletScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const config = useAppConfig()
  const { suspended } = useInterviewerMe()
  const [wallet, setWallet] = useState<WalletDto | null>(null)
  const [bank, setBank] = useState<BankDto | null | undefined>(undefined)
  const [recent, setRecent] = useState<LedgerRowDto[] | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [w, b, l, h] = await Promise.all([
        getWallet(),
        getBank().catch(() => undefined),
        getLedger({ perPage: 5 }).catch(() => null),
        listWithdrawals().catch(() => null),
      ])
      setWallet(w)
      setBank(b)
      setRecent(l?.rows ?? null)
      setWithdrawals(h?.rows ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your wallet.')
    }
  }, [])
  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  const head = (
    <View style={s.head}>
      <Text accessibilityRole="header" style={s.title}>Wallet</Text>
      <Text style={s.headSub}>Your earnings · INR</Text>
    </View>
  )

  if (!wallet) {
    return (
      <InterviewerShell bar="brand" bodyStyle={s.body}>
        <View>
          {head}
          {error ? (
            <ErrBlock title="Couldn’t load your wallet." body={error} onRetry={() => { load() }} />
          ) : (
            <View style={s.stack} accessibilityLabel="Loading your wallet">
              <SkelBox h={190} r={24} />
              <SkelBox h={60} r={18} />
              <SkelRows count={4} />
            </View>
          )}
        </View>
      </InterviewerShell>
    )
  }

  const blocked = withdrawBlockedText(wallet, config, suspended)
  const windowH = config?.interviewer?.scorecardWindowHours
  const avail = formatPaise(wallet.availablePaise)
  const availSize = stepSize(avail, [33, 29, 26, 22])
  const life = formatPaise(wallet.lifetimePaise)
  const latest = withdrawals?.length ? [...withdrawals].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))[0] : null
  const goWithdraw = () => navigation.navigate('InterviewerWithdraw')

  return (
    <InterviewerShell bar="brand" bodyStyle={s.body}>
      <View>
        {head}
        <View style={s.stack}>
          <View style={s.ink}>
            <View style={s.rowJb}>
              <View style={s.li}><Chip icon="wallet" tone="ink" /><Text style={s.inkAcc}>Available to withdraw</Text></View>
              <Text style={s.inkAcct}>{bank ? `•••• ${bank.accountNumberLast4}` : 'No account'}</Text>
            </View>
            <View style={s.availRow}>
              <Text style={[s.fig, { fontSize: availSize, lineHeight: availSize, letterSpacing: -0.045 * availSize }, wallet.availablePaise === 0 && { color: color.textMuted }]} numberOfLines={1}>{avail}</Text>
              <View style={k.grow} />
              {blocked ? (
                <View style={[s.wbtn, s.wbtnOff]}><Text style={[s.wbtnText, { color: '#8E94A6' }]}>Withdraw</Text></View>
              ) : (
                <Pressable accessibilityRole="button" onPress={goWithdraw} style={({ pressed }) => [s.wbtn, { backgroundColor: color.surface }, pressed && k.pressed]}>
                  <Text style={[s.wbtnText, { color: color.ink }]}>Withdraw</Text>
                </Pressable>
              )}
            </View>
            {!!blocked && <Text style={s.inkNote}>{blocked}</Text>}
            <View style={s.grid2}>
              <InkTile icon="clock" label="Pending" paise={wallet.pendingPaise} />
              <InkTile icon="lock" label="In withdrawal" paise={wallet.lockedPaise} />
            </View>
          </View>

          <View style={s.tile}>
            <View style={s.rowJb}>
              <View style={s.li}><Chip icon="arrowUR" tone="ok" /><Text style={s.lbl}>Lifetime earned</Text></View>
              <Text style={[s.tileFig, { fontSize: 22, letterSpacing: -0.99, color: wallet.lifetimePaise === 0 ? color.textMuted : color.text }]} numberOfLines={1}>{life}</Text>
            </View>
          </View>

          {wallet.pendingPaise > 0 && (
            <Text style={s.note}>{`Pending fees release when you submit each scorecard${windowH ? ` within ${windowH} hours` : ' on time'}.`}</Text>
          )}

          {latest ? (
            <Stepper w={latest} onOpen={goWithdraw} />
          ) : !!wallet.openRequest && (
            <View style={[k.card, { gap: 10, padding: 16 }]}>
              <Text style={s.lbl}>Withdrawal in progress</Text>
              <Text style={s.stepAmt}>{formatPaise(wallet.openRequest.amountPaise)}</Text>
              <Text style={k.sub}>{`Requested ${istStamp(wallet.openRequest.requestedAt)}`}</Text>
              <Pressable accessibilityRole="button" onPress={goWithdraw} style={({ pressed }) => [s.linkBtn, pressed && k.pressed]}><Text style={s.link}>See its status</Text></Pressable>
            </View>
          )}

          <View style={s.oh}>
            <Text accessibilityRole="header" style={s.ohTitle}>Recent</Text>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerLedger')} hitSlop={8} style={s.lk}><Text style={s.link}>Full ledger</Text></Pressable>
          </View>
          {recent === null ? (
            <Text style={s.none}>The ledger could not be read.</Text>
          ) : recent.length === 0 ? (
            <Text style={s.none}>No transactions yet.</Text>
          ) : (
            <View style={[k.ow, s.tlWrap]}>
              <View style={s.tl}>
                <View style={s.tlLine} />
                {recent.map((r) => <TimelineRow key={r.id} r={r} />)}
              </View>
            </View>
          )}

          <View style={k.ow}>
            <RowBtn icon="building" title="Payout account" sub={bank ? `${bank.accountHolder} · •••• ${bank.accountNumberLast4} · ${bank.ifsc}` : bank === null ? 'Not added yet' : 'Could not load'} onPress={() => navigation.navigate('InterviewerBankAccount')} />
            <RowBtn icon="file" title="Earnings statements" sub="Request a statement for a date range" onPress={() => navigation.navigate('InterviewerStatements')} last />
          </View>
        </View>
      </View>
    </InterviewerShell>
  )
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  head: { paddingTop: 6, paddingBottom: 14, paddingHorizontal: 0 },
  title: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 32, letterSpacing: -1.2, color: color.text },
  headSub: { fontFamily: FF.body, fontSize: 14, lineHeight: 19, color: color.textMuted, marginTop: 6 },
  stack: { gap: 14 },
  rowJb: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0, flexShrink: 1 },
  lbl: { fontFamily: FF.bodyMedium, fontSize: 14, lineHeight: 17, color: color.textMuted },
  chipi: { width: 20, height: 20, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },

  ink: { backgroundColor: color.ink, borderRadius: 24, padding: 16, gap: 12 },
  inkAcc: { fontFamily: FF.bodyMedium, fontSize: 14, color: color.accentMuted },
  inkAcct: { fontFamily: FF.bodyMedium, fontSize: 12.5, fontVariant: ['tabular-nums'], color: color.textOnInkBody },
  inkLbl: { flexShrink: 1, fontFamily: FF.bodyMedium, fontSize: 14, lineHeight: 17, color: color.textOnInkBody },
  inkNote: { fontFamily: FF.body, fontSize: 14, lineHeight: 19.6, color: color.textOnInkMuted },
  availRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  fig: { flexShrink: 1, fontFamily: FF.bodyBold, color: color.textOnInk, fontVariant: ['tabular-nums'] },
  wbtn: { height: 46, minWidth: 44, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  wbtnOff: { backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  wbtnText: { fontFamily: FF.bodyBold, fontSize: 15 },
  grid2: { flexDirection: 'row', gap: 8 },
  itile: { flex: 1, minWidth: 0, backgroundColor: color.inkRaised, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 5 },
  tileFig: { fontFamily: FF.bodyBold, color: color.textOnInk, fontVariant: ['tabular-nums'] },

  tile: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  note: { fontFamily: FF.body, fontSize: 14, lineHeight: 19.6, color: color.textMuted, paddingHorizontal: 4 },

  stepAmt: { fontFamily: FF.bodyMedium, fontSize: 20, fontVariant: ['tabular-nums'], color: color.text },
  steps: { flexDirection: 'row', gap: 6, marginTop: 4 },
  step: { flex: 1, minWidth: 0, gap: 5 },
  stepBar: { height: 6, borderRadius: 6 },
  stepLabel: { fontFamily: FF.bodySemiBold, fontSize: 14 },
  stepSmall: { fontFamily: FF.body, fontSize: 13, lineHeight: 17, color: color.textMuted },
  linkBtn: { alignSelf: 'flex-start', paddingVertical: 2 },
  link: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.accent },

  oh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, paddingHorizontal: 2 },
  ohTitle: { fontFamily: FF.bodyBold, fontSize: 19, letterSpacing: -0.57, color: color.text },
  lk: { paddingVertical: 6, paddingHorizontal: 2 },
  none: { fontFamily: FF.body, fontSize: 16, lineHeight: 22, color: color.textMuted, paddingHorizontal: 4 },

  tlWrap: { paddingVertical: 4, paddingHorizontal: 16 },
  tl: { paddingLeft: 20 },
  tlLine: { position: 'absolute', left: 5, top: 12, bottom: 12, width: 2, backgroundColor: color.border },
  ti: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  dot: { position: 'absolute', left: -20, top: '50%', marginTop: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: color.surface, borderWidth: 2, borderColor: color.borderStrong },

  rowbtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  rowIc: { width: 34, height: 34, borderRadius: 11, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
})

