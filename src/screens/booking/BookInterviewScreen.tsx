import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import {
  bookInterview, getCapacity, type CapacitySlot,
} from '../../lib/api/interviews'
import { bookingWindow, fmtShortDate, fmtStamp, fmtTime, groupByDay, type DaySlots } from '../../lib/interviews/slots'
import { color, space, radius, borderWidth } from '../../theme'
import {
  AppBar, Banner, Button, Card, Display, Eyebrow, Figure, Meta, Body, ProgressBar, StatusPill,
} from '../../components/ui'
import { SlotPicker } from './SlotPicker'

interface Me { paid: boolean; qualification?: string; entitlements: { tier: string; status: string; durationMin: number }[]; unusedCount: number }
interface Completion { pct: number; canBook: boolean; steps: { key: string; label: string; weight: number; earned: number; optional: boolean; missing: string[] }[] }
interface Config { tiers: { tier: string; amountPaise: number; durationMin: number }[]; qualifications: { value: string; tier: string }[] }
const QUAL: Record<string, string> = { CLASS_12: 'Class 12', GRADUATION: 'Graduation', POST_GRADUATION: 'Post graduation', PHD: 'PhD' }

/**
 * ST-23 — the slot calendar, with its two gates. Which of the readings shows is
 * the server's answer: profile below 80% (blockedProfile) or no unused
 * entitlement (blockedCredit), else the picker.
 */
export function BookInterviewScreen({
  onBack, onBooked, onFinishProfile, onBuy,
}: {
  onBack: () => void
  onBooked: (id: string) => void
  onFinishProfile: () => void
  onBuy: () => void
}) {
  const insets = useSafeAreaInsets()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/students/me') })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.get<{ completion: Completion }>('/students/me/profile') })

  const pending = me.isPending || config.isPending || profile.isPending
  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Home" onBack={onBack} />
      {child}
    </View>
  )

  if (pending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>OPENING THE CALENDAR…</Meta></View>)
  if (me.isError || config.isError || profile.isError) {
    return frame(<View style={{ padding: space.xl }}><Banner tone="danger">Could not open the calendar.</Banner></View>)
  }

  const m = me.data!, cfg = config.data!, comp = profile.data!.completion
  if (!m.paid) return frame(<View style={{ padding: space.xl }}><Banner tone="warning">Buy an interview to open the calendar.</Banner></View>)

  if (!comp.canBook) {
    const toGo = Math.max(0, 80 - Math.floor(comp.pct))
    const short = comp.steps.filter((s) => !s.optional && s.missing.length > 0).slice(0, 3)
    return frame(
      <>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={{ gap: space.sm }}>
            <Eyebrow>Booking opens at 80%</Eyebrow>
            <Display level="lg">{short.length || 'Two'} sections to go.</Display>
          </View>
          <Body tone="muted">Interviewers are matched on what your profile says. Below 80% there is not enough of it to match on.</Body>
          <View style={{ gap: space.md }}>
            <View style={styles.rowBetween}><Eyebrow>Your profile</Eyebrow><Figure value={`${comp.pct}%`} /></View>
            <ProgressBar pct={comp.pct} gate={80} />
            <Meta style={{ color: color.textSubtle }}>book at 80% · {toGo}% to go</Meta>
          </View>
          <View>
            {short.map((s) => (
              <View key={s.key} style={styles.stepRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body weight="medium">{s.label}</Body>
                  <Body size="xs" tone="subtle">{s.missing.join(' · ')}</Body>
                </View>
                <Meta style={{ color: color.text }}>+{Math.round(s.weight - s.earned)}%</Meta>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={[styles.foot, { paddingBottom: insets.bottom + space.xl }]}>
          <Button variant="primary" size="lg" full label="Finish your profile" onPress={onFinishProfile} />
        </View>
      </>,
    )
  }

  const unused = m.entitlements.find((e) => e.status === 'UNUSED')
  if (!unused) {
    const tier = cfg.qualifications.find((q) => q.value === m.qualification)?.tier
    const price = cfg.tiers.find((t) => t.tier === tier)
    const rupees = price ? `₹${Math.round(price.amountPaise / 100).toLocaleString('en-IN')}` : null
    return frame(
      <>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={{ gap: space.sm }}>
            <Eyebrow>Nothing to book with</Eyebrow>
            <Display level="lg">You have no interview left.</Display>
          </View>
          <Body tone="muted">The one you bought has been used. Buy another and this calendar opens again straight away.</Body>
          <Card>
            <Eyebrow>{tier}{m.qualification ? ` · ${QUAL[m.qualification] ?? m.qualification}` : ''}</Eyebrow>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm }}>
              {rupees ? <Figure value={rupees} /> : null}
              <Body size="sm" tone="muted">one-time</Body>
            </View>
            <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>
              A live {price?.durationMin ?? 20}-minute interview, the edited film as your video resume, and written feedback.
            </Body>
          </Card>
        </ScrollView>
        <View style={[styles.foot, { paddingBottom: insets.bottom + space.xl }]}>
          <Button variant="primary" size="lg" full label={rupees ? `Buy an interview · ${rupees}` : 'Buy an interview'} onPress={onBuy} />
        </View>
      </>,
    )
  }

  return (
    <Picker
      insets={insets}
      tier={unused.tier}
      durationMin={unused.durationMin}
      qualLabel={m.qualification ? QUAL[m.qualification] ?? m.qualification : undefined}
      onBack={onBack}
      onBooked={onBooked}
    />
  )
}

function Picker({
  insets, tier, durationMin, qualLabel, onBack, onBooked,
}: {
  insets: { top: number; bottom: number }
  tier: string; durationMin: number; qualLabel?: string
  onBack: () => void; onBooked: (id: string) => void
}) {
  const [dayKey, setDayKey] = useState<string | null>(null)
  const [slotIso, setSlotIso] = useState<string | null>(null)
  const [goneIso, setGoneIso] = useState<string | null>(null)
  const [nearestIso, setNearestIso] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  // Ticks every minute so the "right now" line stays honest on a screen left open.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const win = useMemo(() => bookingWindow(), [])
  const cap = useQuery({
    queryKey: ['capacity', win.fromIso],
    queryFn: () => getCapacity(win.fromIso, win.untilIso),
  })

  const days = useMemo<DaySlots[]>(() => (cap.data ? groupByDay(cap.data.slots) : []), [cap.data])
  const loading = cap.isPending

  // Default-select the first day and its first slot once capacity lands.
  useEffect(() => {
    if (dayKey === null && days.length > 0) {
      setDayKey(days[0].key)
      setSlotIso(days[0].slots[0]?.slotStart ?? null)
    }
  }, [days, dayKey])

  const selectedDay = days.find((d) => d.key === dayKey)
  const nextAvailableIso = selectedDay && selectedDay.slots.length === 0
    ? days.find((d) => d.slots.length > 0)?.slots[0]?.slotStart ?? null
    : null

  function selectDay(key: string) {
    setDayKey(key); setNote(null); setGoneIso(null); setNearestIso(null)
    const day = days.find((d) => d.key === key)
    setSlotIso(day?.slots[0]?.slotStart ?? null)
  }

  async function confirm() {
    if (!slotIso) return
    setBusy(true); setError(null)
    try {
      const iv = await bookInterview(slotIso)
      onBooked(iv.id)
    } catch (e) {
      setBusy(false)
      if (!(e instanceof ApiClientError)) { setError('Could not book that slot. Check your connection.'); return }
      if (e.code === 'CONFLICT' && selectedDay) {
        const remaining = selectedDay.slots.filter((s) => s.slotStart !== slotIso)
        const nearest = nearestTo(slotIso, remaining)
        setGoneIso(slotIso); setNearestIso(nearest); setSlotIso(nearest)
        setNote(nearest
          ? `${istTime(slotIso)} was taken a moment ago. Your pick moved to ${istTime(nearest)}, the nearest block on this day.`
          : `${istTime(slotIso)} was taken a moment ago. Pick another block or day.`)
        return
      }
      setError(e.message)
    }
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="Home" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>Step 1 of 1 · Asia/Kolkata</Eyebrow>
          <Display level="lg">Book your interview.</Display>
          <Meta style={{ color: color.textSubtle }}>
            It's {fmtStamp(now.toISOString())} right now. Earliest open slot is {fmtShortDate(win.fromIso)}, {fmtTime(win.fromIso)} — bookings need at least 12 hours' notice.
          </Meta>
        </View>

        <View style={styles.tierWell}>
          <View style={styles.rowBetween}>
            <Body weight="semibold" size="lg">{durationMin}-minute interview</Body>
            <StatusPill tone="neutral" label={`${tier}${qualLabel ? ` · ${qualLabel}` : ''}`} />
          </View>
          <Body size="xs" tone="muted" style={{ marginTop: space.xs }}>Held in a 30-minute block. Spends the one interview you have.</Body>
        </View>

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <SlotPicker
          days={days}
          windowLabel="Next 21 days"
          selectedDayKey={dayKey}
          onSelectDay={selectDay}
          selectedSlotIso={slotIso}
          onSelectSlot={(iso) => { setSlotIso(iso); setNote(null) }}
          goneIso={goneIso}
          nearestIso={nearestIso}
          note={note ?? undefined}
          nextAvailableIso={nextAvailableIso}
          onJumpToNext={() => { const a = days.find((d) => d.slots.length > 0); if (a) selectDay(a.key) }}
          loading={loading}
        />
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + space.xl }]}>
        {slotIso ? (
          <View style={[styles.rowBetween, { marginBottom: space.md }]}>
            <Meta style={{ color: color.text }}>{fmtStamp(slotIso)}</Meta>
            <Body size="sm" tone="muted">{durationMin} minutes</Body>
          </View>
        ) : null}
        <Button variant="primary" size="lg" full busy={busy} disabled={!slotIso || loading} label="Confirm this slot" onPress={confirm} />
      </View>
    </View>
  )
}

function nearestTo(goneIso: string, remaining: CapacitySlot[]): string | null {
  if (remaining.length === 0) return null
  const t = new Date(goneIso).getTime()
  return remaining
    .map((s) => ({ iso: s.slotStart, d: Math.abs(new Date(s.slotStart).getTime() - t) }))
    .sort((a, b) => a.d - b.d)[0].iso
}
const istTime = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + (5 * 60 + 30) * 60000)
  const h = d.getUTCHours(); const m = d.getUTCMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  tierWell: { borderRadius: radius.md, backgroundColor: color.surfaceMuted, padding: space.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface, paddingHorizontal: space.xl, paddingTop: space.lg },
})
