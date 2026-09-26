import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import {
  bookInterview, getCapacity, type CapacitySlot,
} from '../../lib/api/interviews'
import { bookingWindow, fmtShortDate, fmtStamp, fmtTime, groupByDay, type DaySlots } from '../../lib/interviews/slots'
import { color, space, spaceHalf, radius, borderWidth, height, trackingNative } from '../../theme'
import {
  Banner, Button, Card, EmptyState, ErrorState, Eyebrow, ProgressBar, ScreenHeader, Skeleton, StickyFooter, text,
} from '../../components/ui'
import { SlotPicker } from './SlotPicker'
import { hoursPhrase, nextDaysPhrase, useBookingRules, type BookingRules } from '../../lib/interviews/rules'

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

  const booking = useBookingRules()
  const pending = me.isPending || config.isPending || profile.isPending || booking.pending
  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader title="Book an interview" onBack={onBack} />
      {child}
    </View>
  )

  if (pending) return frame(<View style={styles.body}><Skeleton lines={4} /></View>)
  if (me.isError || config.isError || profile.isError || !booking.rules) {
    return frame(
      <View style={styles.centre}>
        <ErrorState
          title="Could not open the calendar."
          body={booking.error ?? 'Nothing was booked. Check your connection and try again.'}
          action={<Button variant="outline" size="sm" label="Try again" onPress={() => { void me.refetch(); void profile.refetch(); booking.retry() }} />}
        />
      </View>,
    )
  }
  const rules = booking.rules

  const m = me.data!, cfg = config.data!, comp = profile.data!.completion
  if (!m.paid) {
    return frame(
      <View style={styles.centre}>
        <EmptyState
          title="Buy an interview to open the calendar."
          body="The calendar opens the moment your payment is confirmed."
          action={<Button variant="primary" size="md" label="See pricing" onPress={onBuy} />}
        />
      </View>,
    )
  }

  if (!comp.canBook) {
    const gate = rules.minProfileCompletionPct
    const toGo = Math.max(0, gate - Math.floor(comp.pct))
    const short = comp.steps.filter((st) => !st.optional && st.missing.length > 0).slice(0, 3)
    return frame(
      <>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Eyebrow tone="accent">{`Booking opens at ${gate}%`}</Eyebrow>
            <Text style={text.displayLead}>{short.length === 1 ? 'One section to go.' : `${short.length} sections to go.`}</Text>
            <Text style={[text.uiBase, styles.muted]}>{`Interviewers are matched on what your profile says. Below ${gate}% there is not enough of it to match on.`}</Text>
          </View>

          <Card style={styles.gateCard}>
            <View style={styles.rowBetween}>
              <Text style={[text.meta2xl, styles.pct]}>{`${comp.pct}%`}</Text>
              <Text style={[text.uiSm, styles.muted]}>{`book at ${gate}% · ${toGo}% to go`}</Text>
            </View>
            <ProgressBar pct={comp.pct} gate={gate} tone="accent" />
          </Card>

          {short.map((st) => (
            <Card key={st.key} style={styles.stepCard}>
              <View style={styles.grow}>
                <Text style={text.uiBaseSemi}>{st.label}</Text>
                <Text style={[text.uiXs, styles.muted]}>{st.missing.join(' · ')}</Text>
              </View>
              <View style={styles.gain}><Text style={[text.metaSm, styles.gainText]}>{`+${Math.round(st.weight - st.earned)}%`}</Text></View>
            </Card>
          ))}
        </ScrollView>
        <StickyFooter>
          <Button variant="primary" size="lg" full label="Finish your profile" onPress={onFinishProfile} />
        </StickyFooter>
      </>,
    )
  }

  const unused = m.entitlements.find((e) => e.status === 'UNUSED')
  if (!unused) {
    const tier = cfg.qualifications.find((q) => q.value === m.qualification)?.tier
    const price = cfg.tiers.find((t) => t.tier === tier)
    const rupees = price ? `₹${Math.round(price.amountPaise / 100).toLocaleString('en-IN')}` : null
    const minutes = price?.durationMin
    const included = [
      minutes ? `A live ${minutes}-minute interview with a real interviewer` : 'A live interview with a real interviewer',
      'The edited film, as your video resume',
      'Written feedback and five scores',
    ]
    return frame(
      <>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Eyebrow tone="accent">Nothing to book with</Eyebrow>
            <Text style={text.displayLead}>You have no interview left.</Text>
            <Text style={[text.uiBase, styles.muted]}>The one you bought has been used. Buy another and this calendar opens again straight away.</Text>
          </View>

          <View style={styles.tierRow}>
            <View style={styles.tierText}>
              <View style={styles.tierTitle}>
                <Text style={text.uiBaseSemi}>{[tier, m.qualification ? QUAL[m.qualification] ?? m.qualification : null].filter(Boolean).join(' · ')}</Text>
                <View style={styles.yours}><Text style={[text.metaXs, styles.yoursText]}>YOURS</Text></View>
              </View>
              {!!minutes && <Text style={[text.uiXs, styles.muted]}>{minutes}-minute interview · one-time</Text>}
            </View>
            {rupees ? <Text style={text.displaySm}>{rupees}</Text> : null}
          </View>

          <View style={styles.included}>
            <Text style={[text.metaMd, styles.eyebrow]}>WHAT YOU GET</Text>
            {included.map((line) => (
              <View key={line} style={styles.bullet}>
                <Text style={[text.uiMd, styles.dash]}>—</Text>
                <Text style={[text.uiMd, styles.grow]}>{line}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <StickyFooter>
          {rupees ? (
            <View style={styles.rowBetween}>
              <Text style={text.uiMdSemi}>Total</Text>
              <Text style={text.displaySm}>{rupees}</Text>
            </View>
          ) : null}
          <Button variant="primary" size="lg" full label={rupees ? `Buy an interview · ${rupees}` : 'Buy an interview'} onPress={onBuy} />
          <Text style={[text.metaXs, styles.secured]}>Secured by Razorpay · UPI, cards, netbanking</Text>
        </StickyFooter>
      </>,
    )
  }

  return (
    <Picker
      insets={insets}
      tier={unused.tier}
      durationMin={unused.durationMin}
      qualLabel={m.qualification ? QUAL[m.qualification] ?? m.qualification : undefined}
      rules={rules}
      onBack={onBack}
      onBooked={onBooked}
    />
  )
}

function Picker({
  insets, tier, durationMin, qualLabel, rules, onBack, onBooked,
}: {
  insets: { top: number; bottom: number }
  tier: string; durationMin: number; qualLabel?: string; rules: BookingRules
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

  const win = useMemo(() => bookingWindow(rules), [rules])
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
      // SC-05 / SC-13 — two different 409s, two different sentences. SLOT_TAKEN:
      // somebody else got it while she deliberated. NO_ELIGIBLE_INTERVIEWER: no
      // interviewer can take that block for her at all (it is not "taken").
      // CONFLICT is what builds before the split sent for both.
      const noneAvailable = e.code === 'NO_ELIGIBLE_INTERVIEWER'
      if ((e.code === 'SLOT_TAKEN' || e.code === 'CONFLICT' || noneAvailable) && selectedDay) {
        const remaining = selectedDay.slots.filter((s) => s.slotStart !== slotIso)
        const nearest = nearestTo(slotIso, remaining)
        setGoneIso(slotIso); setNearestIso(nearest); setSlotIso(nearest)
        const lead = noneAvailable
          ? `No interviewer is available for ${istTime(slotIso)} any more.`
          : `${istTime(slotIso)} was taken a moment ago.`
        setNote(nearest
          ? `${lead} Your pick moved to ${istTime(nearest)}, the nearest block on this day.`
          : `${lead} Pick another block or day.`)
        return
      }
      setError(e.message)
    }
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader title={`Pick a ${durationMin}-min slot`} subtitle="IST · Asia/Kolkata" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.pickBody} showsVerticalScrollIndicator={false}>
        <Card style={styles.match}>
          <View style={styles.matchTick}><Text style={styles.matchTickText}>✓</Text></View>
          <View style={styles.matchText}>
            <Text style={text.uiSmSemi}>{durationMin}-minute interview</Text>
            <Text style={[text.uiXs, styles.muted]}>{`${tier}${qualLabel ? ` · ${qualLabel}` : ''} · spends the one interview you have`}</Text>
          </View>
        </Card>

        <Text style={[text.uiXs, styles.muted]}>
          It's {fmtStamp(now.toISOString())} right now. Earliest open slot is {fmtShortDate(win.fromIso)}, {fmtTime(win.fromIso)} — bookings need at least {hoursPhrase(rules.windowMinHours)}' notice.
        </Text>

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <SlotPicker
          days={days}
          windowLabel={nextDaysPhrase(rules.windowMaxDays)}
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

      <StickyFooter>
        <View style={styles.rowBetween}>
          <Text style={[text.uiSm, styles.muted]}>Selected</Text>
          <Text style={text.uiSmSemi}>{slotIso ? fmtStamp(slotIso) : 'Pick a time'}</Text>
        </View>
        <Button variant="primary" size="lg" full busy={busy} disabled={!slotIso || loading} label="Confirm · uses 1 credit" onPress={confirm} />
      </StickyFooter>
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
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  body: { paddingHorizontal: space.xl, paddingTop: space.xs, gap: space.xl, paddingBottom: space['4xl'] },
  pickBody: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: spaceHalf['3.5'], paddingBottom: space.xl },
  muted: { color: color.textMuted },
  grow: { flex: 1, gap: space['2xs'] },
  gateCard: { padding: space.lg, gap: spaceHalf['2.5'] },
  pct: { color: color.accent },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  gain: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.accentSoft },
  gainText: { color: color.accentText },
  head: { gap: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  tierRow: {
    minHeight: height['tier-row'], flexDirection: 'row', alignItems: 'center', gap: spaceHalf['3.5'],
    paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.panel,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.accent,
  },
  tierText: { flex: 1, gap: space['2xs'] },
  tierTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  yours: { paddingHorizontal: spaceHalf['1.5'], paddingVertical: space['2xs'], borderRadius: radius.pill, backgroundColor: color.accentSoft },
  yoursText: { color: color.accentText },
  included: { gap: space.sm, paddingHorizontal: space.xs },
  bullet: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  dash: { color: color.accent },
  secured: { color: color.textMuted, textAlign: 'center', textTransform: 'none' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  match: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: spaceHalf['3.5'], paddingVertical: space.md, borderRadius: radius.panel },
  matchTick: { width: height.avatar, height: height.avatar, borderRadius: radius.pill, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center' },
  matchTickText: { color: color.successFill },
  matchText: { flex: 1, gap: space['2xs'] },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
})
