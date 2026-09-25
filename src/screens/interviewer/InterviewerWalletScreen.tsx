import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvAction, IvCard, IvGlow, IvLabel, IvStat } from '../../components/interviewer/iv'
import { EmError } from '../../components/employer/em'
import { getBank, getLedger, getWallet, LEDGER_KIND_LABELS, type BankDto, type LedgerRowDto, type WalletDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { istStamp } from '../../lib/interviewer/state'
import { withdrawBlockedText } from '../../lib/interviewer/wallet'
import { useAppConfig, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/**
 * Wallet (no artboard — the drawn screens' language). The server's four
 * balances (available, locked in a withdrawal, pending on scorecards, lifetime),
 * Withdraw — or the server's reason it is unavailable — the saved payout account,
 * an open request, the latest ledger rows, and the ledger and statements.
 */
export function InterviewerWalletScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const config = useAppConfig()
  const { suspended } = useInterviewerMe()
  const [wallet, setWallet] = useState<WalletDto | null>(null)
  const [bank, setBank] = useState<BankDto | null | undefined>(undefined)
  const [recent, setRecent] = useState<LedgerRowDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [w, b, l] = await Promise.all([getWallet(), getBank().catch(() => undefined), getLedger({ perPage: 5 }).catch(() => null)])
      setWallet(w)
      setBank(b)
      setRecent(l?.rows ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your wallet.')
    }
  }, [])
  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  if (!wallet) {
    return (
      <InterviewerShell title="Wallet">
        {error ? <EmError title="Couldn’t load your wallet." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /> : <ActivityIndicator color={color.textSubtle} style={styles.loading} />}
      </InterviewerShell>
    )
  }

  const blocked = withdrawBlockedText(wallet, config, suspended)
  const windowH = config?.interviewer?.scorecardWindowHours

  return (
    <InterviewerShell title="Wallet" sub="YOUR EARNINGS · INR">
      <View style={styles.hero}>
        <IvGlow />
        <IvLabel tone="accent">AVAILABLE TO WITHDRAW</IvLabel>
        <Text style={[text.metaFigure, styles.fig]}>{formatPaise(wallet.availablePaise)}</Text>
        <IvAction label="Withdraw" tone={blocked ? 'off' : 'accent'} onPress={blocked ? undefined : () => navigation.navigate('InterviewerWithdraw')} />
        {!!blocked && <Text style={[text.uiXs, styles.muted]}>{blocked}</Text>}
      </View>

      <View style={styles.row}>
        <IvStat k="PENDING" v={formatPaise(wallet.pendingPaise)} />
        <IvStat k="IN WITHDRAWAL" v={formatPaise(wallet.lockedPaise)} />
      </View>
      <IvStat k="LIFETIME EARNED" v={formatPaise(wallet.lifetimePaise)} />
      {wallet.pendingPaise > 0 && (
        <Text style={[text.uiXs, styles.muted]}>
          {`Pending fees release when you submit each scorecard${windowH ? ` within ${windowH} hours` : ' on time'}.`}
        </Text>
      )}

      {!!wallet.openRequest && (
        <IvCard tone="accent">
          <IvLabel tone="accent">WITHDRAWAL IN PROGRESS</IvLabel>
          <Text style={text.uiMdSemi}>{`${formatPaise(wallet.openRequest.amountPaise)} requested ${istStamp(wallet.openRequest.requestedAt)}`}</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerWithdraw')}><Text style={[text.uiSmSemi, styles.accent]}>See its status</Text></Pressable>
        </IvCard>
      )}

      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerBankAccount')} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <View style={styles.linkIcon}><Icon name="building" size={space.lg + 2} tint={color.textSecondary} /></View>
        <View style={styles.grow}>
          <Text style={text.uiMdSemi}>Payout account</Text>
          <Text style={[text.uiXs, styles.muted]}>{bank ? `${bank.accountHolder} · •••• ${bank.accountNumberLast4} · ${bank.ifsc}` : bank === null ? 'Not added yet' : 'Could not load'}</Text>
        </View>
        <Icon name="chevR" size={space.lg} tint={color.textSubtle} />
      </Pressable>

      <View style={styles.headRow}>
        <IvLabel>RECENT</IvLabel>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerLedger')} hitSlop={space.sm}><Text style={[text.uiSmSemi, styles.accent]}>Full ledger</Text></Pressable>
      </View>
      {recent === null ? (
        <Text style={[text.uiSm, styles.muted]}>The ledger could not be read.</Text>
      ) : recent.length === 0 ? (
        <Text style={[text.uiSm, styles.muted]}>No transactions yet.</Text>
      ) : (
        <IvCard style={styles.list}>
          {recent.map((r, i) => <LedgerLine key={r.id} r={r} last={i === recent.length - 1} />)}
        </IvCard>
      )}

      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerStatements')} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <View style={styles.linkIcon}><Icon name="file" size={space.lg + 2} tint={color.textSecondary} /></View>
        <View style={styles.grow}>
          <Text style={text.uiMdSemi}>Earnings statements</Text>
          <Text style={[text.uiXs, styles.muted]}>Request a statement for a date range</Text>
        </View>
        <Icon name="chevR" size={space.lg} tint={color.textSubtle} />
      </Pressable>
    </InterviewerShell>
  )
}

/** One ledger row: the platform's label for the kind, who it was for, when, and the signed amount in mono. */
export function LedgerLine({ r, last }: { r: LedgerRowDto; last?: boolean }) {
  const credit = r.sign > 0
  return (
    <View style={[styles.line, !last && styles.lineRule]}>
      <View style={styles.grow}>
        <Text style={text.uiMdSemi}>{LEDGER_KIND_LABELS[r.kind] ?? r.kind}</Text>
        <Text style={[text.uiXs, styles.muted]} numberOfLines={2}>
          {[r.interview ? `${r.interview.studentName} · ${r.interview.tier}` : null, r.note, istStamp(r.at)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={[text.metaXl, { color: credit ? color.success : color.text }]}>{`${credit ? '+' : '−'}${formatPaise(r.amountPaise)}`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  accent: { color: color.accent },
  fig: { letterSpacing: 0 },
  loading: { paddingVertical: space['3xl'] },
  hero: { borderRadius: radius['card-lg'], backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, padding: spaceHalf['4.5'], gap: space.md, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'] },
  linkIcon: { width: height.avatar, height: height.avatar, borderRadius: radius.tile, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs },
  list: { paddingVertical: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  lineRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
})
