import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { getCapacity, rescheduleInterview, type CapacitySlot, type StudentInterview } from '../../lib/api/interviews'
import { bookingWindow, fmtShortDate, fmtStamp, fmtTime, groupByDay, weekdayLong, type DaySlots } from '../../lib/interviews/slots'
import { color, space, borderWidth, height } from '../../theme'
import { AppBar, Banner, Body, Button, Card, Display, ErrorState, Eyebrow, Meta, StatusPill } from '../../components/ui'
import { SlotPicker } from './SlotPicker'

/**
 * ST-27 — the one free move, or the refusal that explains itself. `canReschedule`
 * (BOOKED ∧ ≥12h ∧ never-moved) decides; when false, more than twelve hours out
 * means the free move is spent and inside twelve hours means it is too late to
 * self-serve — and both route to a human, never a dead picker.
 */
export function RescheduleScreen({
  id, onBack, onMoved, onSupport,
}: { id: string; onBack: () => void; onMoved: (newId: string) => void; onSupport: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => api.get<StudentInterview>(`/interviews/${id}`) })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Interview" onBack={onBack} />{child}</View>
  )
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(
    <View style={styles.centre}>
      <ErrorState
        title="Could not load this interview."
        body="Check your connection and try again."
        action={
          <Button
            variant="outline"
            size="sm"
            label="Try again"
            // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
            hitSlop={(height.tap - height['control-xs']) / 2}
            onPress={() => q.refetch()}
          />
        }
      />
    </View>,
  )

  const iv = q.data!
  if (iv.status === 'BOOKED' && iv.canReschedule) {
    return <Eligible id={id} iv={iv} insets={insets} onBack={onBack} onMoved={onMoved} />
  }

  const hoursToSlot = (new Date(iv.slotStart).getTime() - Date.now()) / 3_600_000
  const inside = iv.status === 'BOOKED' && hoursToSlot < 12
  const copy = inside
    ? {
        label: 'Inside twelve hours', title: 'It is too late to move it yourself.',
        lines: [`Your interview starts at ${fmtTime(iv.slotStart)} today. Free moves close twelve hours before.`, 'Your interviewer has held this slot since you booked it.'],
        note: 'If something has genuinely come up, an admin can still move it. Cancelling now would not refund you.',
      }
    : {
        label: 'Free move used', title: 'You have already moved this one.',
        lines: ['The free move is once per interview.', 'Another move is still possible, but a person has to approve it.'],
        note: 'Tell them why. Admins move interviews by hand and will say yes or no on the same day.',
      }

  return frame(
    <ScrollView contentContainerStyle={styles.body}>
      <Card style={styles.refusedCard}>
        <Eyebrow>{copy.label}</Eyebrow>
        <Display level="sm">{copy.title}</Display>
        {copy.lines.map((l) => <Body key={l} size="sm" tone="muted">{l}</Body>)}
      </Card>
      <Card>
        <View style={styles.rowBetween}>
          <View style={{ gap: space.xs }}>
            <Eyebrow>Still booked</Eyebrow>
            <Body weight="semibold" size="lg">{fmtShortDate(iv.slotStart)} · {fmtTime(iv.slotStart)}</Body>
          </View>
          <StatusPill tone="neutral" label={iv.tier} />
        </View>
      </Card>
      <View style={{ marginTop: 'auto', gap: space.md, paddingBottom: insets.bottom }}>
        <Button variant="primary" size="lg" full label="Ask admin to move it" onPress={onSupport} />
        <Body size="xs" tone="subtle">{copy.note}</Body>
      </View>
    </ScrollView>,
  )
}

function Eligible({
  id, iv, insets, onBack, onMoved,
}: {
  id: string; iv: StudentInterview; insets: { top: number; bottom: number }
  onBack: () => void; onMoved: (newId: string) => void
}) {
  const [dayKey, setDayKey] = useState<string | null>(null)
  const [slotIso, setSlotIso] = useState<string | null>(null)
  const [goneIso, setGoneIso] = useState<string | null>(null)
  const [nearestIso, setNearestIso] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const win = useMemo(() => bookingWindow(), [])
  const cap = useQuery({ queryKey: ['capacity', win.fromIso], queryFn: () => getCapacity(win.fromIso, win.untilIso) })
  const days = useMemo<DaySlots[]>(() => (cap.data ? groupByDay(cap.data.slots) : []), [cap.data])
  const loading = cap.isPending

  useEffect(() => {
    if (dayKey === null && days.length > 0) { setDayKey(days[0].key); setSlotIso(days[0].slots[0]?.slotStart ?? null) }
  }, [days, dayKey])

  const selectedDay = days.find((d) => d.key === dayKey)
  const nextAvailableIso = selectedDay && selectedDay.slots.length === 0
    ? days.find((d) => d.slots.length > 0)?.slots[0]?.slotStart ?? null : null

  function selectDay(key: string) {
    setDayKey(key); setNote(null); setGoneIso(null); setNearestIso(null)
    setSlotIso(days.find((d) => d.key === key)?.slots[0]?.slotStart ?? null)
  }
  async function confirm() {
    if (!slotIso) return
    setBusy(true); setError(null)
    try { const next = await rescheduleInterview(id, slotIso); onMoved(next.id) }
    catch (e) {
      setBusy(false)
      if (!(e instanceof ApiClientError)) { setError('Could not move it. Check your connection.'); return }
      if (e.code === 'CONFLICT' && selectedDay) {
        const remaining = selectedDay.slots.filter((s) => s.slotStart !== slotIso)
        const nearest = remaining.length ? nearestTo(slotIso, remaining) : null
        setGoneIso(slotIso); setNearestIso(nearest); setSlotIso(nearest)
        setNote(nearest ? `${fmtTime(slotIso)} was taken a moment ago. Your pick moved to ${fmtTime(nearest)}.` : `${fmtTime(slotIso)} was taken a moment ago. Pick another block or day.`)
        return
      }
      setError(e.message)
    }
  }

  const cutoffIso = new Date(new Date(iv.slotStart).getTime() - 12 * 3600000).toISOString()

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Interview" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Eyebrow tone="accent">Your one free move</Eyebrow>
          <Display level="sm" style={{ marginTop: space.sm }}>You can move this once, free.</Display>
          <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>
            Free up to twelve hours before it starts — that is {fmtTime(cutoffIso)} on {weekdayLong(cutoffIso)}. After that an admin has to do it for you.
          </Body>
        </Card>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <SlotPicker
          days={days} windowLabel="Next 21 days"
          selectedDayKey={dayKey} onSelectDay={selectDay}
          selectedSlotIso={slotIso} onSelectSlot={(iso) => { setSlotIso(iso); setNote(null) }}
          goneIso={goneIso} nearestIso={nearestIso} note={note ?? undefined}
          nextAvailableIso={nextAvailableIso}
          onJumpToNext={() => { const a = days.find((d) => d.slots.length > 0); if (a) selectDay(a.key) }}
          loading={loading}
        />
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + space.xl }]}>
        {slotIso ? (
          <View style={[styles.rowBetween, { marginBottom: space.sm }]}>
            <Meta style={{ color: color.text }}>{fmtStamp(slotIso)}</Meta>
            <Body size="sm" tone="muted">{iv.durationMin} minutes</Body>
          </View>
        ) : null}
        <Body size="xs" tone="muted" style={{ marginBottom: space.md }}>Moving from {fmtShortDate(iv.slotStart)}, {fmtTime(iv.slotStart)}. This uses your free move.</Body>
        <Button variant="primary" size="lg" full busy={busy} disabled={!slotIso || loading} label="Move to this slot" onPress={confirm} />
      </View>
    </View>
  )
}

function nearestTo(goneIso: string, remaining: CapacitySlot[]): string | null {
  if (remaining.length === 0) return null
  const t = new Date(goneIso).getTime()
  return remaining.map((s) => ({ iso: s.slotStart, d: Math.abs(new Date(s.slotStart).getTime() - t) })).sort((a, b) => a.d - b.d)[0].iso
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  refusedCard: { borderColor: color.borderStrong, backgroundColor: color.surfaceMuted, padding: space.lg, gap: space.sm },
  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingHorizontal: space.xl, paddingTop: space.lg },
})
