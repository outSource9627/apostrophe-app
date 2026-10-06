import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, fontFamilyNative as FF, opacity } from '../../theme'
import { Icon, type IconName } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { Skel, StateBlock } from '../../components/tab/kit'
import { EmDateField, EmSelect, todayIst, type Ymd } from '../../components/employer/form'
import { ApiClientError } from '../../lib/api'
import {
  getAvailability, getAvailabilityOverview, saveAvailability,
  type AvailabilityOverrideDto, type AvailabilityOverviewDto, type AvailabilityPayload,
} from '../../lib/api/interviewer'
import {
  bookedFromOverview, changedCount, hourRange, hoursOf, parseKey, rulesToSlotSet, slotKey, slotSetToRules, timeOfDay,
} from '../../lib/interviewer/availability'
import {
  addDays, dayOfKey, istDateKey, istStamp, monthOfKey, monthShort, weekdayLong, weekdayOfKey, weekdayShort,
} from '../../lib/interviewer/state'
import { INTERVIEWER_KEY, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import { useNow } from '../../lib/employer/useNow'
import { RemoveOverrideDialog } from './OverridesScreen'

/**
 * M2 · Availability (Interviewer App Android), docs/interviewer-availability-mockup.html.
 * One screen, three views behind a segmented control:
 *
 *   Weekly hours   a row per weekday (a 14-segment bar over the page's hours); a
 *                  tap opens "Every Friday": the day switch and the hour tiles.
 *                  Each tile is one hour holding `60 / slotMinutes` bookable slots.
 *                  Edits stay here until Publish, which saves the whole pattern
 *                  with the overrides untouched. Booked hours (this week's
 *                  overview) show the candidate and are locked.
 *   Next N days    `horizon` of the overview, in weekly groups; N is the server's
 *                  horizon (never fixed here). A tap opens the date sheet: weekly
 *                  hours, a day off, or the date's own hours. Unpublished weekly
 *                  edits show in the bars.
 *   Overrides      the dated exceptions, each saved on its own (the weekly rules
 *                  last published go with it, so nothing unpublished is sent). The
 *                  server never refuses a booked slot: it moves the interview to
 *                  another interviewer, so the sheet warns first. Removing one
 *                  (the list's trash, the sheet's Back to weekly) asks first.
 */

type Seg = 'w' | 'n' | 'e'
type Kind = 'weekly' | 'off' | 'hours'
interface OvForm { date: string; kind: Kind; from: string; to: string; locked: boolean }
interface Tile { h: number; on: number; per: number; changed: boolean; name?: string }
type Booking = { name: string; id: string }

const WKORD = [1, 2, 3, 4, 5, 6, 0]
const pad = (n: number) => String(n).padStart(2, '0')
const keyOfYmd = (v: Ymd) => `${v.y}-${pad(v.m + 1)}-${pad(v.d)}`
const ymdOfKey = (k: string): Ymd => ({ y: Number(k.slice(0, 4)), m: Number(k.slice(5, 7)) - 1, d: Number(k.slice(8, 10)) })
const dateLabel = (k: string) => `${weekdayShort(weekdayOfKey(k))} ${dayOfKey(k)} ${monthShort(monthOfKey(k))}`
const isOff = (o: AvailabilityOverrideDto) => !o.available || o.blocks.length === 0
const describe = (o: AvailabilityOverrideDto) =>
  isOff(o) ? 'Whole day off' : o.blocks.map((b) => `${timeOfDay(b.startMin)}–${timeOfDay(b.endMin)}`).join(', ')

function rangeLabel(a: string, b: string) {
  const [da, db] = [dayOfKey(a), dayOfKey(b)]
  const [ma, mb] = [monthShort(monthOfKey(a)), monthShort(monthOfKey(b))]
  return ma === mb ? `${da}–${db} ${mb}` : `${da} ${ma}–${db} ${mb}`
}

// ── pieces ───────────────────────────────────────────────────────────────────

/** A pulsing block clipped to a radius (the kit's Skel is fixed at 10). */
function SkelBox({ h, r }: { h: number; r: number }) {
  return <View style={{ height: h, borderRadius: r, overflow: 'hidden' }}><Skel w="100%" h={h} /></View>
}

function Bd({ tone, label }: { tone: 'green' | 'violet' | 'red'; label: string }) {
  const c = { green: [color.successSoft, color.success], violet: [color.accentSoft, color.accentHover], red: [color.dangerSoft, color.danger] }[tone]
  return <View style={[st.bd, { backgroundColor: c[0] }]}><Text style={[st.bdText, { color: c[1] }]}>{label}</Text></View>
}

function StatTile({ icon, tone, label, children, ok }: { icon: IconName; tone: 'acc' | 'ok'; label: string; children: React.ReactNode; ok?: boolean }) {
  const c = tone === 'ok' ? [color.successSoft, color.success] : [color.accentSoft, color.accent]
  return (
    <View style={st.stat}>
      <View style={st.statTop}>
        <View style={[st.chip, { backgroundColor: c[0] }]}><Icon name={icon} size={13} tint={c[1]} weight={1.9} /></View>
        <Text style={st.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[st.fig, ok && { color: color.successFill }]} numberOfLines={1}>{children}</Text>
    </View>
  )
}

function Segmented({ items, value, onChange }: { items: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <View accessibilityRole="tablist" style={st.seg}>
      {items.map((it) => {
        const on = it.key === value
        return (
          <Pressable key={it.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(it.key)} style={[st.segBtn, on && st.segOn]}>
            <Text style={[st.segText, on && { color: color.text }]} numberOfLines={1}>{it.label}</Text>
            {!!it.count && <View style={st.segCt}><Text style={st.segCtText}>{it.count}</Text></View>}
          </Pressable>
        )
      })}
    </View>
  )
}

/** The kind picker inside a sheet: the same control, radio semantics. */
function KindSeg({ items, value, onChange }: { items: { key: Kind; label: string }[]; value: Kind; onChange: (k: Kind) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={st.seg}>
      {items.map((it) => {
        const on = it.key === value
        return (
          <Pressable key={it.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(it.key)} style={[st.segBtn, on && st.segOn]}>
            <Text style={[st.segText, on && { color: color.text }]} numberOfLines={1}>{it.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Switch({ on, disabled, label, onPress }: { on: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[st.track, on ? st.trackOn : st.trackOff, disabled && { opacity: 0.5 }]}
    >
      <View style={[st.knob, on ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
    </Pressable>
  )
}

/** The 48 pill: accent when live, the sunken fill when not, green once published. */
function Pbtn({ label, tone, onPress, busy, icon }: { label: string; tone: 'on' | 'off' | 'ok'; onPress?: () => void; busy?: boolean; icon?: IconName }) {
  const bg = { on: color.accent, off: color.surfaceSunken, ok: color.successFill }[tone]
  const fg = tone === 'off' ? color.textMuted : color.textInverse
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: tone === 'off', busy: !!busy }}
      disabled={tone === 'off' || !onPress}
      onPress={onPress}
      style={({ pressed }) => [st.pbtn, { backgroundColor: bg }, pressed && st.pressed]}
    >
      {busy && <ActivityIndicator size="small" color={color.textMuted} />}
      {!!icon && <Icon name={icon} size={18} tint={fg} weight={1.9} />}
      <Text style={[st.pbtnText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

/** One hour: open ("2 slots"), part ("1 of 2"), closed, or booked (the candidate, a lock). */
function HourTile({ t, onPress, disabled, ro }: { t: Tile; onPress?: () => void; disabled?: boolean; ro?: boolean }) {
  const time = timeOfDay(t.h * 60)
  if (t.name) {
    return (
      <View accessibilityLabel={`${time}, booked, ${t.name}, can’t be changed`} style={[st.hcell, st.hBk]}>
        <Text style={[st.hTime, { color: color.accentDeep }]}>{time}</Text>
        <Text style={[st.hSmall, { color: color.accentDeep, flexShrink: 1 }]} numberOfLines={1}>{t.name}</Text>
        <Icon name="lock" size={15} tint={color.accentDeep} weight={1.9} />
      </View>
    )
  }
  const all = t.per > 0 && t.on === t.per
  const part = t.on > 0 && !all
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: all, disabled: !!disabled }}
      accessibilityLabel={`${time}, ${all ? 'open' : part ? 'partly open' : 'closed'}`}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [st.hcell, all && st.hOn, part && st.hPart, t.changed && st.hChg, ro && { opacity: 0.85 }, disabled && !ro && { opacity: 0.55 }, pressed && st.pressed]}
    >
      {part && <View pointerEvents="none" style={st.hHalf} />}
      <Text style={[st.hTime, t.on > 0 && { color: color.success }]}>{time}</Text>
      {t.on > 0 && <Text style={[st.hSmall, { color: color.success }]} numberOfLines={1}>{all ? `${t.per} ${t.per === 1 ? 'slot' : 'slots'}` : `${t.on} of ${t.per}`}</Text>}
    </Pressable>
  )
}

type SegKind = 'on' | 'part' | 'bk' | ''
function Bar({ segs, off }: { segs: { k: SegKind; chg: boolean }[]; off?: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={st.rbar}>
      {segs.map((s, i) => (
        <View
          key={i}
          style={[st.rseg, off && { backgroundColor: color.dangerSoft }, !off && s.k === 'on' && { backgroundColor: color.successFill }, !off && s.k === 'bk' && { backgroundColor: color.accent }, s.chg && st.rsegChg]}
        >
          {!off && s.k === 'part' && <View style={st.rsegHalf} />}
        </View>
      ))}
    </View>
  )
}

function Ticks({ hrs }: { hrs: number[] }) {
  const a = hrs[0] ?? 8
  const z = (hrs[hrs.length - 1] ?? 21) + 1
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={st.trow}>
      <View style={{ width: 38 }} />
      <View style={st.tk}>
        <Text style={st.tkText}>{timeOfDay(a * 60)}</Text>
        <Text style={st.tkText}>{timeOfDay((a + Math.floor((z - a) / 2)) * 60)}</Text>
        <Text style={st.tkText}>{timeOfDay(z * 60)}</Text>
      </View>
      <View style={{ width: 18 }} />
    </View>
  )
}

function Key({ items }: { items: ('on' | 'part' | 'bk' | 'chg' | 'off' | 'own')[] }) {
  const L = { on: 'Open', part: 'Part of an hour', bk: 'Booked', chg: 'Edited', off: '', own: '' }
  return (
    <View style={st.key}>
      {items.map((k) => (
        <View key={k} style={st.keyItem}>
          {k === 'off' ? <Bd tone="red" label="Day off" /> : k === 'own' ? <Bd tone="green" label="Own hours" /> : (
            <>
              <View style={[st.keyBox, k === 'on' && { backgroundColor: color.successFill, borderColor: color.successFill }, k === 'bk' && { backgroundColor: color.accent, borderColor: color.accent }, k === 'chg' && st.keyChg]}>
                {k === 'part' && <View style={st.keyHalf} />}
              </View>
              <Text style={st.keyText}>{L[k]}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  )
}

/** The bottom sheet of the mockup: grab handle, a title row with a 44 close, a body and a white foot. */
function AvSheet({ open, onClose, title, badge, sub, foot, children }: { open: boolean; onClose: () => void; title: string; badge?: string; sub?: string; foot?: React.ReactNode; children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.sheetWrap}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={st.scrim} />
        <View style={st.sheet} accessibilityViewIsModal>
          <View style={st.grab} />
          <View style={st.sh}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={st.shTitleRow}>
                <Text accessibilityRole="header" style={st.shTitle} numberOfLines={1}>{title}</Text>
                {!!badge && <View style={st.todayB}><Text style={st.todayBText}>{badge}</Text></View>}
              </View>
              {!!sub && <Text style={st.shSub}>{sub}</Text>}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [st.x, pressed && st.pressed]}>
              <Icon name="x" size={22} tint={color.text} weight={1.9} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={st.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
          {!!foot && <View style={[st.foot, { paddingBottom: 10 + Math.max(12, insets.bottom) }]}>{foot}</View>}
        </View>
      </View>
    </Modal>
  )
}

// ── screen ───────────────────────────────────────────────────────────────────

export function AvailabilityScreen() {
  const focused = useIsFocused()
  const qc = useQueryClient()
  const { me, suspended } = useInterviewerMe()
  const now = useNow() || Date.now()
  const todayKey = istDateKey(now)

  const [payload, setPayload] = useState<AvailabilityPayload | null>(null)
  const [overview, setOverview] = useState<AvailabilityOverviewDto | null>(null)
  const [base, setBase] = useState<Set<string>>(new Set())
  const [slots, setSlots] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [published, setPublished] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [seg, setSeg] = useState<Seg>('w')
  const [wkSheet, setWkSheet] = useState<number | null>(null)
  const [form, setForm] = useState<OvForm | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  /** The override date waiting on the remove confirmation. */
  const [removing, setRemoving] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [p, o] = await Promise.all([getAvailability(), getAvailabilityOverview().catch(() => null)])
      const set = rulesToSlotSet(p.rules, p.slotMinutes)
      setPayload(p)
      setOverview(o)
      setBase(set)
      setSlots(new Set(set))
      setPublished(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your availability.')
    }
  }, [])

  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  if (!payload) {
    return (
      <InterviewerShell bar="brand">
        <View style={st.head}><Text accessibilityRole="header" style={st.title}>Availability</Text></View>
        {error ? (
          <StateBlock icon="alert" title="Couldn’t load your availability." body={error} action="Try again" onAction={() => { load() }} />
        ) : (
          <View style={st.stack} accessibilityLabel="Loading your availability">
            <SkelBox h={92} r={18} />
            <SkelBox h={300} r={20} />
            <SkelBox h={120} r={20} />
          </View>
        )}
      </InterviewerShell>
    )
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const slotMinutes = payload.slotMinutes || overview?.slotMinutes || 30
  const per = Math.max(1, Math.round(60 / slotMinutes))
  const booked = bookedFromOverview(overview)
  const changes = changedCount(slots, base)
  const upcoming = [...payload.overrides].filter((o) => o.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date))
  const ovOf = (date: string) => payload.overrides.find((o) => o.date === date)

  const horizonDays = overview?.horizon?.days ?? payload.horizonDays
  const bookingsOf = new Map<string, Map<number, Booking>>()
  for (const d of overview?.horizon?.dates ?? []) {
    const m = new Map<number, Booking>()
    for (const c of d.cells) if (c.status === 'BOOKED') m.set(c.startMin, { name: c.interview?.candidateShortName ?? 'Booked', id: c.interview?.id ?? '' })
    bookingsOf.set(d.date, m)
  }
  const dates: string[] = overview?.horizon?.dates?.length
    ? overview.horizon.dates.map((d) => d.date)
    : Array.from({ length: payload.horizonDays }, (_, i) => addDays(todayKey, i))
  const dateBooked = (date: string) => bookingsOf.get(date) ?? new Map<number, Booking>()

  /** The slot starts open on one date: its override's blocks, else the weekday's (possibly unpublished) hours. */
  function slotsOnDate(date: string): Set<number> {
    const out = new Set<number>()
    const o = ovOf(date)
    if (o) {
      if (o.available) for (const b of o.blocks) for (let m = b.startMin; m < b.endMin; m += slotMinutes) out.add(m)
      return out
    }
    const wd = weekdayOfKey(date)
    for (const k of slots) {
      const p = parseKey(k)
      if (p.weekday === wd) out.add(p.startMin)
    }
    return out
  }
  const dateOpen = (date: string) => {
    const bk = dateBooked(date)
    return [...slotsOnDate(date)].filter((m) => !bk.has(m)).length
  }

  const rangeKeys = new Set(slots)
  const rangeBooked = new Map(booked)
  for (const date of dates) {
    for (const m of slotsOnDate(date)) rangeKeys.add(slotKey(0, m))
    for (const m of dateBooked(date).keys()) rangeBooked.set(slotKey(0, m), '')
  }
  const hrs = hourRange(rangeKeys, rangeBooked)

  const totalOpen = dates.reduce((n, d) => n + dateOpen(d), 0)
  const totalBooked = dates.reduce((n, d) => n + dateBooked(d).size, 0)

  const slotKeysOfHour = (wd: number, h: number) => Array.from({ length: per }, (_, i) => slotKey(wd, h * 60 + i * slotMinutes))
  const weeklyTile = (wd: number, h: number): Tile => {
    const keys = slotKeysOfHour(wd, h)
    const bk = keys.find((k) => booked.has(k))
    return { h, per, on: keys.filter((k) => slots.has(k)).length, changed: keys.some((k) => slots.has(k) !== base.has(k)), name: bk ? booked.get(bk) : undefined }
  }
  const dayInfo = (wd: number) => {
    const mine = [...slots].filter((k) => k.startsWith(`${wd}-`))
    const bk = [...booked.keys()].filter((k) => k.startsWith(`${wd}-`)).length
    const open = mine.filter((k) => !booked.has(k)).length
    return { any: mine.length > 0, bk, open, off: mine.length === 0 && bk === 0 }
  }
  const weekdayEdited = (wd: number) => hrs.some((h) => weeklyTile(wd, h).changed)

  // ── weekly edits (unchanged logic, the weekday passed in) ───────────────────
  const edit = (next: Set<string>) => {
    setSlots(next)
    setPublished(false)
    setSaveError(null)
  }
  const toggleHour = (wd: number, h: number) => {
    const keys = slotKeysOfHour(wd, h).filter((k) => !booked.has(k))
    const allOn = keys.every((k) => slots.has(k))
    const next = new Set(slots)
    keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)))
    edit(next)
  }
  const toggleDay = (wd: number) => {
    const next = new Set(slots)
    if (dayInfo(wd).any) {
      for (const k of [...next]) if (k.startsWith(`${wd}-`) && !booked.has(k)) next.delete(k)
    } else {
      for (const k of base) if (k.startsWith(`${wd}-`)) next.add(k)
    }
    edit(next)
  }

  async function publish() {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAvailability({ rules: slotSetToRules(slots, slotMinutes), overrides: payload!.overrides })
      setBase(new Set(slots))
      setPayload((p) => (p ? { ...p, rules: slotSetToRules(slots, slotMinutes) } : p))
      setPublished(true)
      getAvailabilityOverview().then(setOverview).catch(() => {})
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
    } catch (e) {
      setSaveError(e instanceof ApiClientError ? e.message : 'Not published. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  /** Overrides save on their own; the weekly rules last published go with them, so no unpublished edit is sent. */
  async function saveOverrides(next: AvailabilityOverrideDto[], done: string): Promise<boolean> {
    setBusy(true)
    setNotice(null)
    setFormErr(null)
    try {
      await saveAvailability({ rules: payload!.rules, overrides: next })
      setPayload((p) => (p ? { ...p, overrides: next } : p))
      setNotice(done)
      getAvailabilityOverview().then(setOverview).catch(() => {})
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
      return true
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Not saved. Check your connection and try again.'
      setNotice(msg)
      setFormErr(msg)
      return false
    } finally {
      setBusy(false)
    }
  }

  // ── date sheet ─────────────────────────────────────────────────────────────
  function openDate(date: string | null) {
    setFormErr(null)
    const o = date ? ovOf(date) : undefined
    if (!date) return setForm({ date: '', kind: 'off', from: '', to: '', locked: false })
    if (!o) return setForm({ date, kind: 'weekly', from: '', to: '', locked: true })
    const off = isOff(o)
    setForm({ date, kind: off ? 'off' : 'hours', from: off ? '' : String(o.blocks[0].startMin), to: off ? '' : String(o.blocks[o.blocks.length - 1].endMin), locked: true })
  }
  const closeForm = () => { setForm(null); setFormErr(null); setRemoving(null) }
  const askRemove = (date: string) => { setFormErr(null); setRemoving(date) }

  const times = Array.from({ length: Math.floor((24 * 60) / slotMinutes) + 1 }, (_, i) => i * slotMinutes).map((m) => ({ value: String(m), label: m === 24 * 60 ? '12 AM (midnight)' : timeOfDay(m) }))
  const fromN = Number(form?.from)
  const toN = Number(form?.to)
  const hoursBad = !!form && form.kind === 'hours' && form.from !== '' && form.to !== '' && toN <= fromN
  const formOk = !!form && form.date !== '' && (form.kind === 'off' || (form.from !== '' && form.to !== '' && toN > fromN))

  /** Interviews booked on the date that the choice would leave outside its hours (the server moves them, SC-15). */
  function moved(f: OvForm): number {
    if (!f.date || f.kind === 'weekly') return 0
    const ids = new Set<string>()
    for (const [m, b] of dateBooked(f.date)) {
      const inside = f.kind === 'hours' && f.from !== '' && f.to !== '' && m >= Number(f.from) && m + slotMinutes <= Number(f.to)
      if (!inside) ids.add(b.id || `m${m}`)
    }
    return ids.size
  }

  async function saveForm() {
    if (!form || !formOk) return
    const entry: AvailabilityOverrideDto = form.kind === 'off'
      ? { date: form.date, available: false, blocks: [] }
      : { date: form.date, available: true, blocks: [{ startMin: fromN, endMin: toN }] }
    if (await saveOverrides([...payload!.overrides.filter((o) => o.date !== entry.date), entry], 'Override saved.')) closeForm()
  }
  async function removeOverride(date: string) {
    if (await saveOverrides(payload!.overrides.filter((o) => o.date !== date), 'Override removed.')) closeForm()
  }

  // ── header, strip ──────────────────────────────────────────────────────────
  const first = dates[0] ?? todayKey
  const last = dates[dates.length - 1] ?? todayKey
  const headSub = `${rangeLabel(first, last)} · Next ${horizonDays} days`
  const synced = me?.availability?.lastMaterialisedAt
  const horizonNote = `Students can book you up to ${dayOfKey(last)} ${monthShort(monthOfKey(last))} (the next ${horizonDays} days).${synced ? ` Hours last synced ${istStamp(synced)}.` : ''}`
  const weeklySlots = slots.size
  const hrsTxt = (n: number) => hoursOf(n, slotMinutes)

  const strip = (
    <View style={st.strip}>
      <StatTile icon="clock" tone="ok" label="Open" ok={totalOpen > 0}>{hrsTxt(totalOpen)}<Text style={st.figSmall}>h</Text></StatTile>
      <StatTile icon="user" tone="acc" label="Booked">{String(totalBooked)}</StatTile>
      <StatTile icon="cal" tone="acc" label="Weekly">{hrsTxt(weeklySlots)}<Text style={st.figSmall}>h</Text></StatTile>
    </View>
  )
  const segControl = (
    <Segmented
      value={seg}
      onChange={(k) => { setSeg(k as Seg); setNotice(null) }}
      items={[{ key: 'w', label: 'Weekly hours' }, { key: 'n', label: `Next ${horizonDays} days` }, { key: 'e', label: 'Overrides', count: upcoming.length }]}
    />
  )
  const emptyHint = weeklySlots === 0 && (
    <View style={st.hint}>
      <Text style={st.hintB}>No hours yet.</Text>
      <Text style={st.hintP}>Publish hours so students can book you. Open a weekday and tap an hour to open it.</Text>
    </View>
  )

  // ── the three views ────────────────────────────────────────────────────────
  const hourSeg = (k: SegKind, chg: boolean) => ({ k, chg })
  const weeklyRows = WKORD.map((wd, i) => {
    const di = dayInfo(wd)
    const bar = hrs.map((h) => {
      const t = weeklyTile(wd, h)
      return hourSeg(t.name ? 'bk' : t.on === per ? 'on' : t.on ? 'part' : '', t.changed)
    })
    const edited = weekdayEdited(wd)
    return (
      <Pressable
        key={wd}
        accessibilityRole="button"
        accessibilityLabel={`Every ${weekdayLong(wd)}, ${di.off ? 'no hours' : `${hrsTxt(di.open)}h open`}; open`}
        onPress={() => setWkSheet(wd)}
        style={({ pressed }) => [st.rrow, i < WKORD.length - 1 && st.rrowRule, pressed && st.pressed]}
      >
        <View style={st.dn}><Text style={[st.dnB, st.dnWk]}>{weekdayShort(wd)}</Text></View>
        <View style={st.grow}>
          <Bar segs={bar} />
          <View style={st.sl}>
            {edited && <Bd tone="violet" label="Edited" />}
            <Text style={st.slText}>{di.off ? 'Day off' : `${hrsTxt(di.open)}h open${di.bk ? ` · ${di.bk} booked` : ''}`}</Text>
          </View>
        </View>
        <Icon name="chevR" size={18} tint={color.textSubtle} />
      </Pressable>
    )
  })

  const dateRow = (date: string, isLast: boolean) => {
    const wd = weekdayOfKey(date)
    const o = ovOf(date)
    const ds = slotsOnDate(date)
    const bk = dateBooked(date)
    const open = dateOpen(date)
    const off = (o ? isOff(o) : false) || (!o && ds.size === 0 && bk.size === 0)
    const bar = hrs.map((h) => {
      const ms = Array.from({ length: per }, (_, i) => h * 60 + i * slotMinutes)
      const hb = ms.some((m) => bk.has(m))
      const on = ms.filter((m) => ds.has(m)).length
      const chg = !o && weeklyTile(wd, h).changed
      return hourSeg(hb ? 'bk' : on === per ? 'on' : on ? 'part' : '', chg)
    })
    const isToday = date === todayKey
    let line = ''
    if (o) line = isOff(o) ? '' : describe(o)
    else line = ds.size ? `${hrsTxt(open)}h open` : 'No hours'
    if (bk.size) line += `${line ? ' · ' : ''}${bk.size} booked`
    const plain = o ? (isOff(o) ? `Day off${bk.size ? ` · ${bk.size} booked` : ''}` : line) : line
    return (
      <Pressable
        key={date}
        accessibilityRole="button"
        accessibilityLabel={`${dateLabel(date)}${isToday ? ', today' : ''}, ${plain}${o ? ', override' : ''}; open`}
        onPress={() => openDate(date)}
        style={({ pressed }) => [st.rrow, !isLast && st.rrowRule, pressed && st.pressed]}
      >
        <View style={st.dn}>
          <Text style={st.dnMono}>{weekdayShort(wd)}</Text>
          <Text style={[st.dnB, isToday && { color: color.accent }]}>{dayOfKey(date)}</Text>
        </View>
        <View style={st.grow}>
          <Bar segs={bar} off={off} />
          <View style={st.sl}>
            {isToday && <Bd tone="violet" label="Today" />}
            {!!o && <Bd tone={isOff(o) ? 'red' : 'green'} label={isOff(o) ? 'Day off' : 'Own hours'} />}
            {!!line && <Text style={st.slText}>{line}</Text>}
          </View>
        </View>
        <Icon name="chevR" size={18} tint={color.textSubtle} />
      </Pressable>
    )
  }

  const weeks: string[][] = []
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7))

  const overridesList = upcoming.length === 0 ? (
    <View style={[st.hint, st.hintPlain]}>
      <Text style={st.hintB}>No overrides.</Text>
      <Text style={st.hintP}>Take a whole day off, or set different hours for one date. Your weekly hours stay as they are.</Text>
    </View>
  ) : (
    <View style={st.ow}>
      {upcoming.map((o, i) => {
        const off = isOff(o)
        const bk = dateBooked(o.date).size
        const c = off ? [color.dangerSoft, color.dangerBorder, color.danger] : [color.successSoft, color.successEdge, color.success]
        return (
          <View key={o.date} style={[st.orow, i < upcoming.length - 1 && st.rrowRule]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit the override on ${dateLabel(o.date)}`} onPress={() => openDate(o.date)} style={({ pressed }) => [st.orowMain, pressed && st.pressed]}>
              <View style={[st.dtile, { backgroundColor: c[0], borderColor: c[1] }]}>
                <Text style={[st.dtileM, { color: c[2] }]}>{monthShort(monthOfKey(o.date))}</Text>
                <Text style={[st.dtileB, { color: c[2] }]}>{dayOfKey(o.date)}</Text>
              </View>
              <View style={st.grow}>
                <Text style={st.nmx} numberOfLines={1}>{`${weekdayShort(weekdayOfKey(o.date))} · ${off ? 'Day off' : 'Own hours'}`}</Text>
                <Text style={st.sub} numberOfLines={1}>{`${describe(o)}${bk ? ` · ${bk} booked` : ''}`}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove the override on ${dateLabel(o.date)}`}
              disabled={busy || suspended}
              onPress={() => askRemove(o.date)}
              style={({ pressed }) => [st.ib, (busy || suspended) && { opacity: 0.45 }, pressed && st.pressed]}
            >
              <Icon name="trash" size={22} tint={color.danger} weight={1.9} />
            </Pressable>
          </View>
        )
      })}
    </View>
  )

  let body: React.ReactNode
  if (seg === 'e') {
    body = (
      <>
        {strip}
        {segControl}
        <Text style={st.sub2}>{`Exceptions to your weekly hours · next ${horizonDays} days`}</Text>
        {!!notice && <Text accessibilityLiveRegion="polite" style={st.notice}>{notice}</Text>}
        {overridesList}
      </>
    )
  } else if (seg === 'n') {
    body = (
      <>
        {strip}
        {segControl}
        {emptyHint}
        <Text style={st.note}>{horizonNote}</Text>
        {changes > 0 && <Text style={st.note}>{`${changes} unpublished weekly change${changes > 1 ? 's' : ''} show here and go out with Publish.`}</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite" style={st.notice}>{notice}</Text>}
        <View style={st.oh}>
          <Text accessibilityRole="header" style={st.ohTitle}>{`Next ${horizonDays} days`}</Text>
          <Text style={st.sub}>{`${upcoming.length} override${upcoming.length === 1 ? '' : 's'}`}</Text>
        </View>
        {weeks.map((w, i) => (
          <View key={w[0]} style={{ gap: 10 }}>
            <View style={st.oh}>
              <Text accessibilityRole="header" style={st.grpTitle}>{i < 3 ? ['This week', 'Next week', 'Week 3'][i] : `Week ${i + 1}`}</Text>
              <Text style={st.sub}>{rangeLabel(w[0], w[w.length - 1])}</Text>
            </View>
            <View style={st.ow}>
              <Ticks hrs={hrs} />
              {w.map((d, j) => dateRow(d, j === w.length - 1))}
            </View>
          </View>
        ))}
        <Key items={['on', 'part', 'bk', 'chg', 'off', 'own']} />
      </>
    )
  } else {
    body = (
      <>
        {strip}
        {segControl}
        {emptyHint}
        <Text style={st.note}>{horizonNote}</Text>
        <View style={st.oh}>
          <Text accessibilityRole="header" style={st.ohTitle}>Every week</Text>
          <Text style={st.sub}>{`${weeklySlots} slots · ${hrsTxt(weeklySlots)}h`}</Text>
        </View>
        <View style={st.ow}>
          <Ticks hrs={hrs} />
          {weeklyRows}
        </View>
        <Key items={['on', 'part', 'bk', 'chg']} />
        <Text style={st.note}>Tap a weekday to open its hours. Weekly hours repeat every week; an hour that is booked this week is locked.</Text>
      </>
    )
  }

  // ── sticky bar ─────────────────────────────────────────────────────────────
  let bar: React.ReactNode
  if (seg === 'e') {
    bar = <View style={{ alignSelf: 'stretch' }}><Pbtn icon="plus" label="Add an override" tone={suspended ? 'off' : 'on'} onPress={suspended ? undefined : () => openDate(null)} /></View>
  } else {
    bar = (
      <View style={{ gap: 8, alignSelf: 'stretch' }}>
        {!!saveError && <Text accessibilityRole="alert" style={st.errtxt}>{saveError}</Text>}
        {suspended ? (
          <Pbtn label="Publishing is paused while suspended" tone="off" />
        ) : (
          <Pbtn
            label={published ? '✓ Published to students' : saving ? 'Publishing…' : changes ? `Publish ${changes} change${changes > 1 ? 's' : ''}` : 'No unsaved changes'}
            tone={published ? 'ok' : changes && !saving ? 'on' : 'off'}
            busy={saving}
            onPress={changes && !saving ? () => { publish() } : undefined}
          />
        )}
      </View>
    )
  }

  // ── sheets ─────────────────────────────────────────────────────────────────
  const wd = wkSheet
  const wdi = wd != null ? dayInfo(wd) : null
  const weekSheet = (
    <AvSheet
      open={wd != null}
      onClose={() => setWkSheet(null)}
      title={wd != null ? `Every ${weekdayLong(wd)}` : ''}
      sub={wdi ? (wdi.off ? 'Day off · students can’t book' : `${hrsTxt(wdi.open)}h open · ${wdi.bk} booked`) : undefined}
      foot={<Pbtn label="Done" tone="on" onPress={() => setWkSheet(null)} />}
    >
      {wd != null && wdi && (
        <>
          <View style={st.shead2}>
            <View style={st.grow}>
              <Text style={st.nmx}>{`${weekdayLong(wd)} open`}</Text>
              <Text style={st.sub}>Repeats every week · goes out with Publish</Text>
            </View>
            <Switch on={wdi.any} disabled={suspended} label={`${weekdayLong(wd)} open`} onPress={() => toggleDay(wd)} />
          </View>
          <View style={st.hgrid}>
            {hrs.map((h) => (
              <View key={h} style={st.hcol}><HourTile t={weeklyTile(wd, h)} disabled={suspended} onPress={() => toggleHour(wd, h)} /></View>
            ))}
          </View>
        </>
      )}
    </AvSheet>
  )

  const f = form
  const fDate = f && f.date ? f.date : null
  const fWd = fDate ? weekdayOfKey(fDate) : 0
  const fO = fDate ? ovOf(fDate) : undefined
  const orph = f && fDate && !hoursBad ? moved(f) : 0
  const locked = !!f?.locked
  const dateTile = (h: number): Tile => {
    const bk = dateBooked(fDate!)
    const ms = Array.from({ length: per }, (_, i) => h * 60 + i * slotMinutes)
    const hit = ms.find((m) => bk.has(m))
    if (hit != null) return { h, per, on: 0, changed: false, name: bk.get(hit)!.name }
    if (fO) { const ds = slotsOnDate(fDate!); return { h, per, on: ms.filter((m) => ds.has(m)).length, changed: false } }
    return weeklyTile(fWd, h)
  }
  const sheetTitle = !f ? '' : locked && fDate ? `${weekdayLong(fWd)} ${dayOfKey(fDate)} ${monthShort(monthOfKey(fDate))}` : 'Add an override'
  const plainLine = (date: string) => {
    const o = ovOf(date)
    const bk = dateBooked(date).size
    const b = bk ? ` · ${bk} booked` : ''
    if (o) return (isOff(o) ? 'Day off' : describe(o)) + b
    const ds = slotsOnDate(date)
    return ds.size === 0 ? `No hours${b}` : `${hrsTxt(dateOpen(date))}h open${b}`
  }
  const lbl = (t: string) => <Text style={st.lbl}>{t}</Text>
  const dateSheet = (
    <AvSheet
      open={!!f}
      onClose={closeForm}
      title={sheetTitle}
      badge={locked && fDate === todayKey ? 'Today' : undefined}
      sub={!f ? undefined : locked && fDate ? `${plainLine(fDate)}${fO ? ' · override' : ' · weekly hours'}` : 'For one date only.'}
      foot={
        !f ? undefined : locked && f.kind === 'weekly' ? (
          <Pbtn label={fO ? 'Back to weekly' : 'Already on weekly hours'} tone={fO && !suspended && !busy ? 'on' : 'off'} onPress={fO && !suspended && !busy ? () => askRemove(f.date) : undefined} />
        ) : (
          <Pbtn label="Save override" tone={formOk && !suspended && !busy ? 'on' : 'off'} busy={busy} onPress={formOk && !suspended && !busy ? () => { saveForm() } : undefined} />
        )
      }
    >
      {f && (
        <>
          {!locked && (
            <View style={st.fld}>
              {lbl('Date')}
              <EmDateField
                title="Date"
                value={f.date ? ymdOfKey(f.date) : null}
                onChange={(v) => { setForm({ ...f, date: v ? keyOfYmd(v) : '' }); setFormErr(null) }}
                min={todayIst()}
                max={ymdOfKey(addDays(istDateKey(Date.now()), horizonDays))}
                placeholder="Choose a date"
                clearable={false}
              />
            </View>
          )}
          <View style={st.fld}>
            {lbl(locked ? 'This date' : 'On that date')}
            <KindSeg
              value={f.kind}
              onChange={(k) => { setForm({ ...f, kind: k }); setFormErr(null) }}
              items={locked
                ? [{ key: 'weekly', label: 'Weekly' }, { key: 'off', label: 'Day off' }, { key: 'hours', label: 'Own hours' }]
                : [{ key: 'off', label: 'Whole day off' }, { key: 'hours', label: 'Own hours' }]}
            />
          </View>
          {f.kind === 'hours' && (
            <View style={st.two}>
              <View style={[st.fld, st.half]}>
                {lbl('From')}
                <EmSelect title="From" value={f.from} options={times.slice(0, -1)} onChange={(v) => setForm({ ...f, from: v })} />
              </View>
              <View style={[st.fld, st.half]}>
                {lbl('To')}
                <EmSelect title="To" value={f.to} options={times.slice(1)} onChange={(v) => setForm({ ...f, to: v })} />
                {hoursBad && <Text style={st.ferr}>Ends before it starts.</Text>}
              </View>
            </View>
          )}
          {orph > 0 && (
            <View accessibilityLiveRegion="polite" style={st.warnbox}>
              <Text style={st.warnText}>{`${f.kind === 'off' ? '' : 'Outside these hours: '}${orph} booked interview${orph > 1 ? 's' : ''} on this date would move to another interviewer.`}</Text>
            </View>
          )}
          {!locked && !!fDate && !!fO && <Text style={st.note}>This date already has an override; saving replaces it.</Text>}
          {!!formErr && <Text accessibilityRole="alert" style={st.ferr}>{formErr}</Text>}
          {locked && !!fDate && (
            <View style={st.fld}>
              {lbl(fO ? (isOff(fO) ? 'Day off · hours that day' : `Own hours · ${describe(fO)}`) : `Weekly hours on ${weekdayLong(fWd)} · ${weeklyBlocksText(slots, fWd, slotMinutes)}`)}
              <View style={st.hgrid}>
                {hrs.map((h) => {
                  const t = dateTile(h)
                  return (
                    <View key={h} style={st.hcol}>
                      <HourTile t={t} ro={!!fO} disabled={!!fO || suspended} onPress={() => toggleHour(fWd, h)} />
                    </View>
                  )
                })}
              </View>
              <Text style={st.note}>{fO ? 'The override hours, read only. The weekly hours stay as they are.' : `Tap an hour to change every ${weekdayLong(fWd)} (goes out with Publish). Booked hours stay locked.`}</Text>
            </View>
          )}
          {locked && !!fDate && (
            <Pressable accessibilityRole="button" onPress={() => { closeForm(); setWkSheet(fWd) }} style={({ pressed }) => [st.btnOut, pressed && st.pressed]}>
              <Text style={st.btnOutText}>{`Edit every ${weekdayShort(fWd)} instead`}</Text>
            </Pressable>
          )}
          <Text style={st.note}>{`${f.kind === 'weekly' ? 'Removes the override: this date follows your weekly hours again. ' : ''}Overrides save on their own; your weekly hours stay as they are.`}</Text>
        </>
      )}
      {/* Back to weekly's confirmation: among the sheet's children, so it draws over the sheet. */}
      <RemoveOverrideDialog date={f ? removing : null} busy={busy} error={formErr} onClose={() => setRemoving(null)} onConfirm={() => { if (removing) removeOverride(removing) }} />
    </AvSheet>
  )

  return (
    <InterviewerShell bar="brand" bodyStyle={{ paddingHorizontal: 20 }} footer={bar} footerStack>
      <View style={st.head}>
        <Text accessibilityRole="header" style={st.title}>Availability</Text>
        <Text style={st.headSub}>{headSub}</Text>
      </View>
      <View style={st.stack}>{body}</View>
      {weekSheet}
      {dateSheet}
      <RemoveOverrideDialog date={f ? null : removing} busy={busy} error={formErr} onClose={() => setRemoving(null)} onConfirm={() => { if (removing) removeOverride(removing) }} />
    </InterviewerShell>
  )
}

/** '6 PM–8 PM, 9 PM–10 PM' for a weekday's weekly hours, or 'No hours'. */
function weeklyBlocksText(slots: Set<string>, wd: number, slotMinutes: number): string {
  const rule = slotSetToRules(new Set([...slots].filter((k) => k.startsWith(`${wd}-`))), slotMinutes)[0]
  return rule ? rule.blocks.map((b) => `${timeOfDay(b.startMin)}–${timeOfDay(b.endMin)}`).join(', ') : 'No hours'
}

const st = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  grow: { flex: 1, minWidth: 0 },
  stack: { gap: 10 },
  head: { paddingTop: 6, paddingBottom: 14 },
  title: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 33, letterSpacing: -1.2, color: color.text },
  headSub: { fontFamily: FF.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'], color: color.textMuted, marginTop: 7 },

  strip: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 16, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, gap: 4, justifyContent: 'center' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  chip: { width: 20, height: 20, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  statLabel: { flexShrink: 1, fontFamily: FF.bodyMedium, fontSize: 13, lineHeight: 16, letterSpacing: -0.065, color: color.textMuted },
  fig: { fontFamily: FF.bodyBold, fontSize: 25, lineHeight: 25, letterSpacing: -0.875, fontVariant: ['tabular-nums'], color: color.text },
  figSmall: { fontFamily: FF.bodySemiBold, fontSize: 15, letterSpacing: -0.3, color: color.textMuted },

  seg: { flexDirection: 'row', backgroundColor: color.surfaceMuted, borderRadius: 14, padding: 3, gap: 2 },
  segBtn: { flex: 1, minWidth: 0, height: 38, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, borderWidth: borderWidth.thin, borderColor: 'transparent' },
  segOn: { backgroundColor: color.surface, borderColor: color.border },
  segText: { fontFamily: FF.bodySemiBold, fontSize: 13.5, color: color.textMuted },
  segCt: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  segCtText: { fontFamily: FF.bodySemiBold, fontSize: 11, color: color.accentHover },

  bd: { borderRadius: 99, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'flex-start' },
  bdText: { fontFamily: FF.bodySemiBold, fontSize: 11.5, lineHeight: 15 },
  oh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4, paddingHorizontal: 2 },
  ohTitle: { fontFamily: FF.bodyBold, fontSize: 16, letterSpacing: -0.32, color: color.text },
  grpTitle: { fontFamily: FF.bodyBold, fontSize: 15, letterSpacing: -0.3, color: color.text },
  ow: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 16, overflow: 'hidden' },
  sub: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted },
  sub2: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted, paddingHorizontal: 2 },
  note: { fontFamily: FF.body, fontSize: 12, lineHeight: 17, color: color.textMuted, paddingHorizontal: 4 },
  notice: { fontFamily: FF.body, fontSize: 12.5, color: color.textSecondary, paddingHorizontal: 2 },
  nmx: { fontFamily: FF.bodySemiBold, fontSize: 15, lineHeight: 19, letterSpacing: -0.225, color: color.text },
  errtxt: { fontFamily: FF.bodyMedium, fontSize: 12.5, color: color.danger, textAlign: 'center', paddingHorizontal: 4 },
  lbl: { fontFamily: FF.bodyMedium, fontSize: 13, color: color.textMuted, paddingLeft: 2 },
  ferr: { fontFamily: FF.body, fontSize: 12, color: color.danger, paddingLeft: 2 },

  hint: { borderRadius: 16, backgroundColor: color.accentWash, borderWidth: borderWidth.thin, borderStyle: 'dashed', borderColor: color.accentMuted, paddingVertical: 12, paddingHorizontal: 14, gap: 3 },
  hintPlain: { backgroundColor: color.surface, borderStyle: 'solid', borderColor: color.border },
  hintB: { fontFamily: FF.bodySemiBold, fontSize: 15, letterSpacing: -0.3, color: color.text },
  hintP: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.textMuted },
  warnbox: { borderRadius: 12, backgroundColor: color.warningSoft, borderWidth: borderWidth.thin, borderColor: color.warningEdge, paddingVertical: 9, paddingHorizontal: 12 },
  warnText: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.warning },

  rrow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12 },
  rrowRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  dn: { width: 38, gap: 1 },
  dnMono: { fontFamily: FF.bodyMedium, fontSize: 12.5, color: color.textMuted },
  dnB: { fontFamily: FF.bodyBold, fontSize: 17, lineHeight: 17, letterSpacing: -0.51, color: color.text },
  dnWk: { fontFamily: FF.bodySemiBold, fontSize: 15, lineHeight: 15, letterSpacing: -0.45 },
  rbar: { flexDirection: 'row', gap: 2, height: 12, marginBottom: 5 },
  rseg: { flex: 1, borderRadius: 3, backgroundColor: color.surfaceSunken, overflow: 'hidden' },
  rsegHalf: { width: '50%', height: '100%', backgroundColor: color.successFill },
  rsegChg: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.accent },
  sl: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 3 },
  slText: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17, color: color.textMuted },
  trow: { flexDirection: 'row', gap: 10, paddingTop: 7, paddingBottom: 5, paddingHorizontal: 12, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border, backgroundColor: color.background },
  tk: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  tkText: { fontFamily: FF.bodyMedium, fontSize: 11, fontVariant: ['tabular-nums'], color: color.textMuted },
  key: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, paddingHorizontal: 4 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyBox: { width: 12, height: 12, borderRadius: 5, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surfaceSunken, overflow: 'hidden' },
  keyHalf: { width: '50%', height: '100%', backgroundColor: color.successFill },
  keyChg: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.accent, backgroundColor: color.surface },
  keyText: { fontFamily: FF.body, fontSize: 12, color: color.textMuted },

  orow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  orowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  dtile: { width: 42, height: 46, borderRadius: 12, borderWidth: borderWidth.thin, alignItems: 'center', justifyContent: 'center' },
  dtileM: { fontFamily: FF.bodyMedium, fontSize: 12 },
  dtileB: { fontFamily: FF.bodyBold, fontSize: 17, lineHeight: 17, letterSpacing: -0.34 },
  ib: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  pbtn: { height: 48, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pbtnText: { fontFamily: FF.bodySemiBold, fontSize: 15 },

  track: { width: 52, height: 32, borderRadius: 99, paddingHorizontal: 4, justifyContent: 'center' },
  trackOn: { backgroundColor: color.successFill },
  trackOff: { backgroundColor: color.borderStrong },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: color.surface },

  hgrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  hcol: { width: '50%', paddingHorizontal: 3, paddingBottom: 6 },
  hcell: { height: 44, borderRadius: 12, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, overflow: 'hidden' },
  hTime: { fontFamily: FF.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'], color: color.textMuted },
  hSmall: { fontFamily: FF.bodySemiBold, fontSize: 11.5, minWidth: 0 },
  hOn: { backgroundColor: color.successSoft, borderColor: color.successEdge },
  hPart: { borderColor: color.successEdge },
  hHalf: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', backgroundColor: color.successSoft },
  hBk: { backgroundColor: color.accentSoft, borderColor: color.accentMuted },
  hChg: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.accent },

  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  sheet: { maxHeight: '92%', backgroundColor: color.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  grab: { width: 40, height: 4, borderRadius: 4, backgroundColor: color.borderStrong, marginTop: 10, alignSelf: 'center' },
  sh: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 6 },
  shTitleRow: { flexDirection: 'row', alignItems: 'center' },
  shTitle: { flexShrink: 1, fontFamily: FF.bodyBold, fontSize: 18, letterSpacing: -0.45, color: color.text },
  shSub: { fontFamily: FF.body, fontSize: 12.5, color: color.textMuted },
  todayB: { marginLeft: 8, borderRadius: 99, paddingVertical: 2, paddingHorizontal: 9, backgroundColor: color.accentSoft },
  todayBText: { fontFamily: FF.bodySemiBold, fontSize: 11, color: color.accentHover },
  x: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceMuted },
  sheetBody: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  foot: { paddingTop: 10, paddingHorizontal: 16, backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border, gap: 8 },
  shead2: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  fld: { gap: 6 },
  two: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  btnOut: { alignSelf: 'flex-start', height: 40, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.borderStrong },
  btnOutText: { fontFamily: FF.bodySemiBold, fontSize: 13.5, color: color.text },
})
