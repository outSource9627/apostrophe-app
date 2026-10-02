import React, { useCallback, useEffect, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { EmSheet } from '../../components/employer/em'
import { EmDateField, todayIst, type Ymd } from '../../components/employer/form'
import { ApiClientError } from '../../lib/api'
import { listStatements, requestStatement, type StatementDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { istDay, istStamp } from '../../lib/interviewer/state'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
import { EmptyBlock, ErrBlock, k, OutBtn, PageFrame, PBtn, SkelBox, WBadge, WCard, WField } from './walletKit'
import type { RootStackParamList } from '../../../App'

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (v: Ymd) => `${v.y}-${pad(v.m + 1)}-${pad(v.d)}`
const daysBetween = (a: Ymd, b: Ymd) => Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86_400_000)
const STATUS: Record<StatementDto['status'], { label: string; tone: 'amber' | 'green' | 'red' }> = {
  PENDING: { label: 'Preparing', tone: 'amber' },
  READY: { label: 'Ready', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
}

/**
 * Earnings statements (no artboard — the drawn screens' language). The
 * platform's own statements: request one for a date range (up to the server's
 * `statementMaxDays`), watch it go from Preparing to Ready, and open the file.
 * The old screen's months, TDS and "Form 16A" were invented and are gone.
 */
export function StatementsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const insets = useSafeAreaInsets()
  const config = useAppConfig()
  const [rows, setRows] = useState<StatementDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState<Ymd | null>(null)
  const [to, setTo] = useState<Ymd | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listStatements())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your statements.')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // A statement being prepared is polled until it settles.
  useEffect(() => {
    if (!rows?.some((r) => r.status === 'PENDING')) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [rows, load])

  const maxDays = config?.interviewer?.statementMaxDays
  const today = todayIst()
  const span = from && to ? daysBetween(from, to) + 1 : 0
  const rangeError = from && to && daysBetween(from, to) < 0 ? 'The range ends before it starts.' : maxDays && span > maxDays ? `A statement covers up to ${maxDays} days.` : undefined

  async function request() {
    if (!from || !to || rangeError) return
    setBusy(true)
    setNotice(null)
    try {
      const s = await requestStatement(keyOf(from), keyOf(to))
      setRows((prev) => [s, ...(prev ?? [])])
      setOpen(false)
      setFrom(null)
      setTo(null)
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Not requested. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageFrame
      onBack={() => navigation.goBack()}
      title="Earnings statements"
      sub="Interview fees and payouts, for a date range"
      footer={<PBtn on icon="plus" label="Request a statement" onPress={() => setOpen(true)} />}
    >
      {rows === null && !error ? (
        <View style={s.stack} accessibilityLabel="Loading your statements">{[0, 1, 2].map((i) => <SkelBox key={i} h={96} r={20} />)}</View>
      ) : error && !rows ? (
        <ErrBlock title="Couldn’t load your statements." body={error} onRetry={() => { load() }} />
      ) : (rows ?? []).length === 0 ? (
        <EmptyBlock title="No statements yet." body="Request one for any range; it is prepared in the background." />
      ) : (
        (rows ?? []).map((st) => (
          <WCard key={st.id} gap={6}>
            <View style={s.top}>
              <Text style={[k.nmx, k.grow]}>{`${istDay(`${st.from}T00:00:00+05:30`)} – ${istDay(`${st.to}T00:00:00+05:30`)}`}</Text>
              <WBadge label={STATUS[st.status].label} tone={STATUS[st.status].tone} />
            </View>
            {st.status === 'READY' && (
              <Text style={k.sub}>{`${st.rowCount} entries · ${formatPaise(st.creditedPaise)} credited · ${formatPaise(st.paidOutPaise)} paid out`}</Text>
            )}
            {st.status === 'FAILED' && !!st.error && <Text style={[k.sub, { color: color.danger }]}>{st.error}</Text>}
            <Text style={[k.sub, { color: color.textSubtle }]}>{`Requested ${istStamp(st.requestedAt)}`}</Text>
            {st.status === 'READY' && !!st.url && <OutBtn sm icon="download" label="Open" onPress={() => Linking.openURL(st.url!).catch(() => {})} />}
          </WCard>
        ))
      )}

      <EmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Request a statement"
        sub={maxDays ? `Up to ${maxDays} days at a time.` : undefined}
        foot={
          <View style={[s.foot, { paddingBottom: 24 + insets.bottom }]}>
            {!!notice && <Text style={s.notice}>{notice}</Text>}
            <PBtn on={!busy && !!from && !!to && !rangeError} label={busy ? 'Requesting…' : 'Request'} onPress={() => { request() }} />
          </View>
        }
      >
        <WField label="From">
          <EmDateField title="From" value={from} onChange={setFrom} min={{ y: today.y - 5, m: 0, d: 1 }} max={today} placeholder="Choose a date" clearable={false} />
        </WField>
        <WField label="To" error={rangeError}>
          <EmDateField title="To" value={to} onChange={setTo} min={from ?? { y: today.y - 5, m: 0, d: 1 }} max={today} placeholder="Choose a date" clearable={false} invalid={!!rangeError} />
        </WField>
      </EmSheet>
    </PageFrame>
  )
}

const s = StyleSheet.create({
  stack: { gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  notice: { fontFamily: FF.body, fontSize: 14, color: color.danger },
  foot: { paddingHorizontal: 20, paddingTop: 12, gap: 8, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
})
