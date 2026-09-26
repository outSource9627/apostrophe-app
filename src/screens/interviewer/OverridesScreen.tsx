import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvCard } from '../../components/interviewer/iv'
import { EmEmpty, EmError, EmIconButton, EmSheet } from '../../components/employer/em'
import { EmDateField, EmField, EmSeg, EmSelect, todayIst, type Ymd } from '../../components/employer/form'
import { ApiClientError } from '../../lib/api'
import { getAvailability, saveAvailability, type AvailabilityOverrideDto, type AvailabilityPayload } from '../../lib/api/interviewer'
import { timeOfDay } from '../../lib/interviewer/availability'
import { dayOfKey, monthOfKey, monthShort, weekdayOfKey, weekdayShort } from '../../lib/interviewer/state'
import { INTERVIEWER_KEY, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (v: Ymd) => `${v.y}-${pad(v.m + 1)}-${pad(v.d)}`
const addDaysYmd = (v: Ymd, n: number): Ymd => {
  const t = new Date(Date.UTC(v.y, v.m, v.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }
}

/**
 * Date overrides (no artboard — the drawn screens' language). The dated
 * exceptions to the weekly pattern: a whole day off, or that day's own hours.
 * Nothing is saved until the availability has loaded, so a save can never wipe
 * the overrides it did not read; each save sends the weekly pattern unchanged
 * with the edited list. Dates run to the server's `horizonDays`; hours step by
 * its `slotMinutes`. The server's refusal (a booked slot, a past date) is shown
 * as it arrives.
 */
export function OverridesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const { suspended } = useInterviewerMe()
  const [payload, setPayload] = useState<AvailabilityPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState<Ymd | null>(null)
  const [kind, setKind] = useState<'off' | 'hours'>('off')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      setPayload(await getAvailability())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your overrides.')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function save(next: AvailabilityOverrideDto[], done: string) {
    if (!payload) return
    setBusy(true)
    setNotice(null)
    try {
      await saveAvailability({ rules: payload.rules, overrides: next })
      setPayload({ ...payload, overrides: next })
      setNotice(done)
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
      return true
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Not saved. Check your connection and try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!payload) {
    return (
      <InterviewerShell back={() => navigation.goBack()} title="Date overrides">
        {error ? <EmError title="Couldn’t load your overrides." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /> : <ActivityIndicator color={color.textSubtle} style={styles.loading} />}
      </InterviewerShell>
    )
  }

  const today = todayIst()
  const todayKey = keyOf(today)
  const upcoming = payload.overrides.filter((o) => o.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date))
  const step = payload.slotMinutes
  const times = Array.from({ length: Math.floor((24 * 60) / step) + 1 }, (_, i) => i * step).map((m) => ({ value: String(m), label: m === 24 * 60 ? '12 AM (midnight)' : timeOfDay(m) }))
  const fromN = Number(from)
  const toN = Number(to)
  const hoursOk = kind === 'off' || (from !== '' && to !== '' && toN > fromN)
  const describe = (o: AvailabilityOverrideDto) =>
    !o.available || o.blocks.length === 0 ? 'Whole day off' : o.blocks.map((b) => `${timeOfDay(b.startMin)}–${timeOfDay(b.endMin)}`).join(', ')

  async function add() {
    if (!date || !hoursOk) return
    const entry: AvailabilityOverrideDto = kind === 'off'
      ? { date: keyOf(date), available: false, blocks: [] }
      : { date: keyOf(date), available: true, blocks: [{ startMin: fromN, endMin: toN }] }
    const next = [...(payload?.overrides ?? []).filter((o) => o.date !== entry.date), entry]
    if (await save(next, 'Override saved.')) {
      setAdding(false)
      setDate(null)
      setFrom('')
      setTo('')
    }
  }

  return (
    <InterviewerShell
      back={() => navigation.goBack()}
      title="Date overrides"
      sub={`Exceptions to your weekly hours · next ${payload.horizonDays} days`}
      footer={<Button variant="primary" size="lg" full icon="plus" label="Add an override" disabled={suspended} onPress={() => setAdding(true)} />}
    >
      {!!notice && <Text style={[text.uiSm, styles.secondary]}>{notice}</Text>}
      {upcoming.length === 0 ? (
        <EmEmpty icon="cal" title="No overrides." body="Take a whole day off, or set different hours for one date. Your weekly hours stay as they are." />
      ) : (
        upcoming.map((o) => {
          const off = !o.available || o.blocks.length === 0
          return (
            <IvCard key={o.date} style={styles.row}>
              <View style={[styles.tile, off ? styles.tileOff : styles.tileOn]}>
                <Text style={[text.metaSm, styles.mono, { color: off ? color.danger : color.success }]}>{monthShort(monthOfKey(o.date)).toUpperCase()}</Text>
                <Text style={[text.uiLgSemi, { color: off ? color.danger : color.success }]}>{dayOfKey(o.date)}</Text>
              </View>
              <View style={styles.grow}>
                <Text style={text.uiMdSemi}>{`${weekdayShort(weekdayOfKey(o.date))} · ${off ? 'Day off' : 'Own hours'}`}</Text>
                <Text style={[text.uiXs, styles.muted]}>{describe(o)}</Text>
              </View>
              <EmIconButton name="trash" label={`Remove the override on ${o.date}`} tint={color.danger} disabled={busy || suspended} onPress={() => { save(payload.overrides.filter((x) => x.date !== o.date), 'Override removed.') }} />
            </IvCard>
          )
        })
      )}

      <EmSheet
        open={adding}
        onClose={() => setAdding(false)}
        tall
        title="Add an override"
        sub="For one date only."
        foot={
          <View style={[styles.sheetFoot, { paddingBottom: space.md + insets.bottom }]}>
            <Button variant="primary" size="lg" full label="Save override" busy={busy} disabled={busy || !date || !hoursOk} onPress={() => { add() }} />
          </View>
        }
      >
        <EmField label="Date">
          <EmDateField title="Date" value={date} onChange={setDate} min={today} max={addDaysYmd(today, payload.horizonDays)} placeholder="Choose a date" clearable={false} />
        </EmField>
        <EmField label="On that date">
          <EmSeg label="On that date" options={[{ value: 'off', label: 'Whole day off' }, { value: 'hours', label: 'Own hours' }]} value={kind} onChange={setKind} />
        </EmField>
        {kind === 'hours' && (
          <View style={styles.two}>
            <View style={styles.half}>
              <EmField label="From"><EmSelect title="From" value={from} options={times.slice(0, -1)} onChange={setFrom} /></EmField>
            </View>
            <View style={styles.half}>
              <EmField label="To" error={from !== '' && to !== '' && toN <= fromN ? 'Ends before it starts.' : undefined}>
                <EmSelect title="To" value={to} options={times.slice(1)} onChange={setTo} />
              </EmField>
            </View>
          </View>
        )}
      </EmSheet>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space['3xl'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tile: { width: height.control, height: height.control + space.xs, borderRadius: radius.tile, borderWidth: borderWidth.thin, alignItems: 'center', justifyContent: 'center' },
  tileOff: { backgroundColor: color.dangerWash, borderColor: color.dangerBorder },
  tileOn: { backgroundColor: color.successWash, borderColor: color.successEdge },
  two: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  half: { flex: 1, minWidth: 0 },
  sheetFoot: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
})
