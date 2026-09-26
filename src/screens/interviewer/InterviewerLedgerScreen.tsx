import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, space } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvCard } from '../../components/interviewer/iv'
import { EmEmpty, EmError, EmPills } from '../../components/employer/em'
import { getLedger, type LedgerKind, type LedgerRowDto } from '../../lib/api/interviewer'
import { LedgerLine } from './InterviewerWalletScreen'
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

  return (
    <InterviewerShell back={() => navigation.goBack()} title="Ledger" sub={rows ? `${total} ${total === 1 ? 'entry' : 'entries'}` : undefined} scroll={false}>
      {rows === null && !error ? (
        <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : error && !rows ? (
        <View style={styles.pad}><EmError title="Couldn’t load the ledger." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load(1) }} />} /></View>
      ) : (rows ?? []).length === 0 ? (
        <View style={[styles.pad, styles.center]}><EmEmpty icon="file" title="No transactions yet." body="Interview fees land here once each scorecard is in." /></View>
      ) : (
        <FlatList
          data={[0]}
          keyExtractor={() => 'ledger'}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <EmPills<Tab>
              items={[{ key: 'all', label: 'All' }, { key: 'fees', label: 'Interview fees' }, { key: 'withdrawals', label: 'Withdrawals' }, { key: 'adjustments', label: 'Adjustments' }]}
              value={tab}
              onChange={setTab}
            />
          }
          ListHeaderComponentStyle={styles.pillsWrap}
          renderItem={() =>
            shown.length === 0 ? (
              <Text style={[text.uiMd, styles.muted, styles.none]}>Nothing here yet.</Text>
            ) : (
              <IvCard style={styles.card}>{shown.map((r, i) => <LedgerLine key={r.id} r={r} last={i === shown.length - 1} />)}</IvCard>
            )
          }
          ListFooterComponent={(rows?.length ?? 0) < total ? <Button variant="outline" size="md" label="Load more" busy={more} onPress={() => { load(page + 1) }} style={styles.more} /> : undefined}
        />
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  muted: { color: color.textMuted },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  pillsWrap: { marginHorizontal: -space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  card: { paddingVertical: 0 },
  more: { alignSelf: 'center' },
})
