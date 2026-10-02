import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import {
  bookInterview, getCapacity, type CapacitySlot,
} from '../../lib/api/interviews'
import { bookingWindow, fmtShortDate, fmtStamp, fmtTime, groupByDay, type DaySlots } from '../../lib/interviews/slots'
import { borderWidth, color, fontFamilyNative as FF, radius } from '../../theme'
import { Banner } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { Btn, Panel, Skel, StateBlock } from '../../components/tab/kit'
import { Eyebrow, FlowFooter, FlowHeader, Lead, Sub } from '../../components/tab/flow'
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
      <FlowHeader title="Book an interview" onBack={onBack} />
      {child}
    </View>
  )

  if (pending) return frame(<View style={styles.body}><Skel w="60%" h={14} /><Skel w="100%" h={28} /><Skel w="100%" h={90} /><Skel w="100%" h={60} /></View>)
  if (me.isError || config.isError || profile.isError || !booking.rules) {
    return frame(
      <StateBlock
        icon="alert"
        title="Could not open the calendar."
        body={booking.error ?? 'Nothing was booked. Check your connection and try again.'}
        action="Try again"
        onAction={() => { void me.refetch(); void profile.refetch(); booking.retry() }}
      />,
    )
  }
  const rules = booking.rules

  const m = me.data!, cfg = config.data!, comp = profile.data!.completion
  if (!m.paid) {
    return frame(
      <View style={styles.centre}>
        <Text style={styles.centreTitle}>Buy an interview to open the calendar.</Text>
        <Sub style={styles.centreBody}>The calendar opens the moment your payment is confirmed.</Sub>
        <Btn label="See pricing" onPress={onBuy} style={styles.centreBtn} />
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
            <Lead>{short.length === 1 ? 'One section to go.' : `${short.length} sections to go.`}</Lead>
            <Sub>{`Interviewers are matched on what your profile says. Below ${gate}% there is not enough of it to match on.`}</Sub>
          </View>

          <Panel style={styles.gateCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.pct}>{`${comp.pct}%`}</Text>
              <Text style={styles.small}>{`book at ${gate}% · ${toGo}% to go`}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, comp.pct))}%` }]} />
              <View style={[styles.gateMark, { left: `${Math.max(0, Math.min(100, gate))}%` }]} />
            </View>
          </Panel>

          {short.map((st) => (
            <Panel key={st.key} style={styles.stepCard}>
              <View style={styles.grow}>
                <Text style={styles.t15s}>{st.label}</Text>
                <Text style={styles.xs}>{st.missing.join(' · ')}</Text>
              </View>
              <View style={styles.gain}><Text style={styles.gainText}>{`+${Math.round(st.weight - st.earned)}%`}</Text></View>
            </Panel>
          ))}
        </ScrollView>
        <FlowFooter>
          <Btn label="Finish your profile" onPress={onFinishProfile} />
        </FlowFooter>
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
            <Lead>You have no interview left.</Lead>
            <Sub>The one you bought has been used. Buy another and this calendar opens again straight away.</Sub>
          </View>

          <View style={styles.tierRow}>
            <View style={styles.tierText}>
              <View style={styles.tierTitle}>
                <Text style={styles.t15s}>{[tier, m.qualification ? QUAL[m.qualification] ?? m.qualification : null].filter(Boolean).join(' · ')}</Text>
                <View style={styles.yours}><Text style={styles.yoursText}>YOURS</Text></View>
              </View>
              {!!minutes && <Text style={styles.xs}>{minutes}-minute interview · one-time</Text>}
            </View>
            {rupees ? <Text style={styles.big}>{rupees}</Text> : null}
          </View>

          <View style={styles.included}>
            <Eyebrow>WHAT YOU GET</Eyebrow>
            {included.map((line) => (
              <View key={line} style={styles.bullet}>
                <Text style={[styles.bulletText, styles.dash]}>—</Text>
                <Text style={[styles.bulletText, styles.grow]}>{line}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <FlowFooter>
          {rupees ? (
            <View style={styles.rowBetween}>
              <Text style={styles.t15s}>Total</Text>
              <Text style={styles.big}>{rupees}</Text>
            </View>
          ) : null}
          <Btn label={rupees ? `Buy an interview · ${rupees}` : 'Buy an interview'} onPress={onBuy} />
          <Text style={styles.secured}>Secured by Razorpay · UPI, cards, netbanking</Text>
        </FlowFooter>
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
      <FlowHeader title={`Pick a ${durationMin}-min slot`} subtitle="IST · Asia/Kolkata" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.pickBody} showsVerticalScrollIndicator={false}>
        <Panel style={styles.match}>
          <View style={styles.matchTick}><Icon name="check" size={18} tint={color.successFill} weight={2.6} /></View>
          <View style={styles.matchText}>
            <Text style={styles.matchTitle}>{durationMin}-minute interview</Text>
            <Text style={styles.xs}>{`${tier}${qualLabel ? ` · ${qualLabel}` : ''} · spends the one interview you have`}</Text>
          </View>
        </Panel>

        <Text style={styles.xs}>
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

      <FlowFooter>
        <View style={styles.rowBetween}>
          <Text style={styles.small}>Selected</Text>
          <Text style={styles.selected}>{slotIso ? fmtStamp(slotIso) : 'Pick a time'}</Text>
        </View>
        <Btn busy={busy} disabled={!slotIso || loading} label="Confirm · uses 1 credit" onPress={confirm} />
      </FlowFooter>
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
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  centreTitle: { fontFamily: FF.bodyBold, fontSize: 22, letterSpacing: -0.66, color: color.text, textAlign: 'center' },
  centreBody: { textAlign: 'center', marginTop: 8 },
  centreBtn: { marginTop: 18, paddingHorizontal: 22 },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 16, paddingBottom: 28 },
  pickBody: { paddingHorizontal: 20, paddingTop: 2, gap: 14, paddingBottom: 20 },
  grow: { flex: 1, gap: 2 },
  gateCard: { padding: 16, gap: 10 },
  pct: { fontFamily: FF.monoMedium, fontSize: 40, letterSpacing: -1.6, color: color.accent },
  small: { fontFamily: FF.body, fontSize: 13, lineHeight: 19, color: color.textMuted },
  xs: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.textMuted },
  t15s: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  track: { height: 8, borderRadius: 8, backgroundColor: color.surfaceSunken },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8, backgroundColor: color.accent },
  gateMark: { position: 'absolute', top: -4, bottom: -4, width: 2, backgroundColor: color.text },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  gain: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: color.accentSoft },
  gainText: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 0.88, color: color.accentText },
  head: { gap: 8 },
  tierRow: {
    minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 15, paddingVertical: 11, borderRadius: 18,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.accent,
  },
  tierText: { flex: 1, gap: 2 },
  tierTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  yours: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: color.accentSoft },
  yoursText: { fontFamily: FF.monoMedium, fontSize: 10, letterSpacing: 1, color: color.accentText },
  big: { fontFamily: FF.bodySemiBold, fontSize: 22, letterSpacing: -0.33, color: color.text },
  included: { gap: 10, paddingHorizontal: 4 },
  bullet: { flexDirection: 'row', gap: 10 },
  bulletText: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.text },
  dash: { color: color.accent },
  secured: { fontFamily: FF.body, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  selected: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.text },
  match: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18 },
  matchTick: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center' },
  matchText: { flex: 1, gap: 2 },
  matchTitle: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.text },
})
