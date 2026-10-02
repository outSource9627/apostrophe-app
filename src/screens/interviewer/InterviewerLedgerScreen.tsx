import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, fontFamilyNative as FF } from '../../theme'
import { getLedger, type LedgerKind, type LedgerRowDto } from '../../lib/api/interviewer'
import { EmptyBlock, ErrBlock, k, LedgerRow, OutBtn, PageFrame, SkelRows, WChip } from './walletKit'
import type { RootStackParamList } from '../../../App'

type Tab = 'all' | 'fees' | 'withdrawals' | 'adjustments'
const GROUP: Record<Exclude<Tab, 'all'>, LedgerKind[]> = {
  fees: ['CREDIT_INTERVIEW'],
  withdrawals: ['LOCK_WITHDRAWAL', 'UNLOCK_WITHDRAWAL', 'DEBIT_PAID'],
  adjustments: ['ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT'],
}
const PER_PAGE = 50

/**
 * The ledger (no artboard — the drawn screens' language): every row the
 * server keeps, newest first, with its own kind label, the interview it was
 * for, and the signed amount. The pills group the six kinds; "Load more" pages.
 */
export function InterviewerLedgerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<LedgerRowDto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [tab, setTab] = useState<Tab>('all')

  const load = useCallback(async (p: number) => {
    setError(null)
    setMore(true)
    try {
      const r = await getLedger({ page: p, perPage: PER_PAGE })
      setRows((prev) => (p === 1 ? r.rows : [...(prev ?? []), ...r.rows]))
      setTotal(r.total)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the ledger.')
    } finally {
      setMore(false)
    }
  }, [])
  useEffect(() => {
    load(1)
  }, [load])

  const shown = tab === 'all' ? rows ?? [] : (rows ?? []).filter((r) => GROUP[tab].includes(r.kind))
  const hasBal = (rows ?? []).some((r) => typeof r.balanceAfterPaise === 'number')

  return (
    <PageFrame onBack={() => navigation.goBack()} title="Ledger" sub={rows ? `${total} ${total === 1 ? 'entry' : 'entries'}` : undefined}>
      {rows === null && !error ? (
        <SkelRows count={6} />
      ) : error && !rows ? (
        <ErrBlock title="Couldn’t load the ledger." body={error} onRetry={() => { load(1) }} />
      ) : (rows ?? []).length === 0 ? (
        <EmptyBlock title="No transactions yet." body="Interview fees land here once each scorecard is in." />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsWrap} contentContainerStyle={s.chips}>
            {FILTERS.map((f) => <WChip key={f.key} label={f.label} on={tab === f.key} onPress={() => setTab(f.key)} />)}
          </ScrollView>
          {hasBal && <Text style={k.sub}>Balance after each entry, newest first</Text>}
          {shown.length === 0 ? (
            <Text style={s.none}>Nothing here yet.</Text>
          ) : (
            <View style={k.ow}>{shown.map((r, i) => <LedgerRow key={r.id} r={r} last={i === shown.length - 1} />)}</View>
          )}
          {(rows?.length ?? 0) < total && <OutBtn label={more ? 'Loading…' : 'Load more'} disabled={more} onPress={() => { load(page + 1) }} style={s.more} />}
        </>
      )}
    </PageFrame>
  )
}

const FILTERS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fees', label: 'Interview fees' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'adjustments', label: 'Adjustments' },
]

const s = StyleSheet.create({
  chipsWrap: { marginHorizontal: -20, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  none: { fontFamily: FF.body, fontSize: 16, color: color.textMuted, textAlign: 'center', paddingVertical: 24 },
  more: { alignSelf: 'center' },
})
