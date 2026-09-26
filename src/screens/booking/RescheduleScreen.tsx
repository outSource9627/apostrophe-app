import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { getCapacity, rescheduleInterview, type CapacitySlot, type StudentInterview } from '../../lib/api/interviews'
import { bookingWindow, fmtShortDate, fmtStamp, fmtTime, groupByDay, weekdayLong, type DaySlots } from '../../lib/interviews/slots'
import { color, space, height, trackingNative } from '../../theme'
import { AppBar, Banner, Button, Card, ErrorState, Eyebrow, InkCard, InkPill, Skeleton, StatusPill, StickyFooter, text } from '../../components/ui'
import { SlotPicker } from './SlotPicker'
import { hoursPhrase, nextDaysPhrase, useBookingRules, type BookingRules } from '../../lib/interviews/rules'

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
  const booking = useBookingRules()

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Reschedule" onBack={onBack} />{child}</View>
  )
  if (q.isPending || booking.pending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError || !booking.rules) return frame(
    <View style={styles.centre}>
      <ErrorState
        title="Could not load this interview."
        body={booking.error ?? 'Check your connection and try again.'}
        action={
          <Button
            variant="outline"
            size="sm"
            label="Try again"
            // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
            hitSlop={(height.tap - height['control-xs']) / 2}
            onPress={() => { void q.refetch(); booking.retry() }}
          />
        }
      />
    </View>,
  )

  const iv = q.data!
  const rules = booking.rules
  const cutoff = hoursPhrase(rules.rescheduleCutoffHours)
  if (iv.status === 'BOOKED' && iv.canReschedule) {
    return <Eligible id={id} iv={iv} insets={insets} rules={rules} onBack={onBack} onMoved={onMoved} />
  }

  const hoursToSlot = (new Date(iv.slotStart).getTime() - Date.now()) / 3_600_000
  const inside = iv.status === 'BOOKED' && hoursToSlot < rules.rescheduleCutoffHours
  const copy = inside
    ? {
        label: `Inside ${cutoff}`, title: 'It is too late to move it yourself.',
        lines: [`Your interview starts at ${fmtTime(iv.slotStart)} today. Free moves close ${cutoff} before.`, 'Your interviewer has held this slot since you booked it.'],
        note: 'If something has genuinely come up, an admin can still move it. Cancelling now would not refund you.',
      }
    : {
        label: 'Free move used', title: 'You have already moved this one.',
        lines: ['The free move is once per interview.', 'Another move is still possible, but a person has to approve it.'],
        note: 'Tell them why. Admins move interviews by hand and will say yes or no on the same day.',
      }

  return frame(
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Eyebrow tone="accent">{copy.label}</Eyebrow>
          <Text style={text.displayLead}>{copy.title}</Text>
          {copy.lines.map((l) => <Text key={l} style={[text.uiBase, styles.muted]}>{l}</Text>)}
        </View>
        <Card style={styles.booked}>
          <View style={styles.bookedText}>
            <Text style={[text.metaSm, styles.eyebrowMuted]}>STILL BOOKED</Text>
            <Text style={text.uiBaseSemi}>{fmtShortDate(iv.slotStart)} · {fmtTime(iv.slotStart)}</Text>
          </View>
          <StatusPill tone="neutral" label={iv.tier} />
        </Card>
      </ScrollView>
      <StickyFooter inset={false}>
        <Button variant="primary" size="lg" full label="Ask admin to move it" onPress={onSupport} />
        <Text style={[text.uiXs, styles.muted]}>{copy.note}</Text>
      </StickyFooter>
    </>,
  )
}

function Eligible({
  id, iv, insets, rules, onBack, onMoved,
}: {
  id: string; iv: StudentInterview; insets: { top: number; bottom: number }; rules: BookingRules
  onBack: () => void; onMoved: (newId: string) => void
}) {
  const [dayKey, setDayKey] = useState<string | null>(null)
  const [slotIso, setSlotIso] = useState<string | null>(null)
  const [goneIso, setGoneIso] = useState<string | null>(null)
  const [nearestIso, setNearestIso] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const win = useMemo(() => bookingWindow(rules), [rules])
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

  const cutoffIso = new Date(new Date(iv.slotStart).getTime() - rules.rescheduleCutoffHours * 3600000).toISOString()

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Reschedule" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <InkCard>
          <InkPill label="Your one free move" />
          <Text style={[text.displaySm, styles.onInk]}>You can move this once, free.</Text>
          <Text style={[text.uiSm, styles.onInkMuted]}>
            Free up to {hoursPhrase(rules.rescheduleCutoffHours)} before it starts — that is {fmtTime(cutoffIso)} on {weekdayLong(cutoffIso)}. After that an admin has to do it for you.
          </Text>
        </InkCard>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <SlotPicker
          days={days} windowLabel={nextDaysPhrase(rules.windowMaxDays)}
          selectedDayKey={dayKey} onSelectDay={selectDay}
          selectedSlotIso={slotIso} onSelectSlot={(iso) => { setSlotIso(iso); setNote(null) }}
          goneIso={goneIso} nearestIso={nearestIso} note={note ?? undefined}
          nextAvailableIso={nextAvailableIso}
          onJumpToNext={() => { const a = days.find((d) => d.slots.length > 0); if (a) selectDay(a.key) }}
          loading={loading}
        />
      </ScrollView>
      <StickyFooter inset={false}>
        <View style={styles.rowBetween}>
          <Text style={[text.uiSm, styles.muted]}>Selected</Text>
          <Text style={text.uiSmSemi}>{slotIso ? fmtStamp(slotIso) : 'Pick a time'}</Text>
        </View>
        <Text style={[text.uiXs, styles.muted]}>Moving from {fmtShortDate(iv.slotStart)}, {fmtTime(iv.slotStart)}. This uses your free move.</Text>
        <Button variant="primary" size="lg" full busy={busy} disabled={!slotIso || loading} label="Move to this slot" onPress={confirm} />
      </StickyFooter>
    </View>
  )
}

function nearestTo(goneIso: string, remaining: CapacitySlot[]): string | null {
  if (remaining.length === 0) return null
  const t = new Date(goneIso).getTime()
  return remaining.map((s) => ({ iso: s.slotStart, d: Math.abs(new Date(s.slotStart).getTime() - t) })).sort((a, b) => a.d - b.d)[0].iso
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md, paddingBottom: space.xl },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  head: { gap: space.sm, paddingHorizontal: space.xs },
  eyebrowMuted: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  booked: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  bookedText: { flex: 1, gap: space.xs },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
  muted: { color: color.textMuted },
})
