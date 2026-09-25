import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvCard } from '../../components/interviewer/iv'
import { EmBadge, EmEmpty, EmError, EmSheet } from '../../components/employer/em'
import { EmDateField, EmField, todayIst, type Ymd } from '../../components/employer/form'
import { ApiClientError } from '../../lib/api'
import { listStatements, requestStatement, type StatementDto } from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { istDay, istStamp } from '../../lib/interviewer/state'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
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
    <InterviewerShell
      back={() => navigation.goBack()}
      title="Earnings statements"
      sub="Interview fees and payouts, for a date range"
      footer={<Button variant="primary" size="lg" full icon="plus" label="Request a statement" onPress={() => setOpen(true)} />}
    >
      {rows === null && !error ? (
        <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : error && !rows ? (
        <EmError title="Couldn’t load your statements." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      ) : (rows ?? []).length === 0 ? (
        <EmEmpty icon="file" title="No statements yet." body="Request one for any range; it is prepared in the background." />
      ) : (
        (rows ?? []).map((s) => (
          <IvCard key={s.id}>
            <View style={styles.top}>
              <Text style={text.uiMdSemi}>{`${istDay(`${s.from}T00:00:00+05:30`)} – ${istDay(`${s.to}T00:00:00+05:30`)}`}</Text>
              <EmBadge label={STATUS[s.status].label} tone={STATUS[s.status].tone} small />
            </View>
            {s.status === 'READY' && (
              <Text style={[text.uiXs, styles.muted]}>{`${s.rowCount} entries · ${formatPaise(s.creditedPaise)} credited · ${formatPaise(s.paidOutPaise)} paid out`}</Text>
            )}
            {s.status === 'FAILED' && !!s.error && <Text style={[text.uiXs, styles.danger]}>{s.error}</Text>}
            <Text style={[text.uiXs, styles.subtle]}>{`Requested ${istStamp(s.requestedAt)}`}</Text>
            {s.status === 'READY' && !!s.url && <Button variant="outline" size="sm" icon="download" label="Open" onPress={() => Linking.openURL(s.url!).catch(() => {})} style={styles.start} />}
          </IvCard>
        ))
      )}

      <EmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Request a statement"
        sub={maxDays ? `Up to ${maxDays} days at a time.` : undefined}
        foot={
          <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
            {!!notice && <Text style={[text.uiSm, styles.danger]}>{notice}</Text>}
            <Button variant="primary" size="lg" full label="Request" busy={busy} disabled={busy || !from || !to || !!rangeError} onPress={() => { request() }} />
          </View>
        }
      >
        <EmField label="From">
          <EmDateField title="From" value={from} onChange={setFrom} min={{ y: today.y - 5, m: 0, d: 1 }} max={today} placeholder="Choose a date" clearable={false} />
        </EmField>
        <EmField label="To" error={rangeError}>
          <EmDateField title="To" value={to} onChange={setTo} min={from ?? { y: today.y - 5, m: 0, d: 1 }} max={today} placeholder="Choose a date" clearable={false} />
        </EmField>
      </EmSheet>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  loading: { paddingVertical: space['3xl'] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  start: { alignSelf: 'flex-start', paddingHorizontal: space.md },
  foot: { paddingHorizontal: space.lg, paddingTop: space.md, gap: spaceHalf['1.5'], borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
})
