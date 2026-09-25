import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvAction } from '../../components/interviewer/iv'
import { EmError } from '../../components/employer/em'
import { ApiClientError } from '../../lib/api'
import {
  getAvailability, getAvailabilityOverview, saveAvailability, type AvailabilityOverviewDto, type AvailabilityPayload,
} from '../../lib/api/interviewer'
import {
  bookedFromOverview, changedCount, hourRange, hoursOf, rulesToSlotSet, slotKey, slotSetToRules, thisWeek, timeOfDay, weekRange,
} from '../../lib/interviewer/availability'
import { dayOfKey, istDateKey, monthOfKey, monthShort, weekdayLong, weekdayShort } from '../../lib/interviewer/state'
import { INTERVIEWER_KEY, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import { useNow } from '../../lib/employer/useNow'
import type { RootStackParamList } from '../../../App'

/**
 * M2 · Availability (Interviewer App Android): the weekly pattern, one day at a
 * time. The day strip is this IST week (a dot for booked, green for open hours);
 * the day card switches a weekday off or back on; each tile is one hour holding
 * `60 / slotMinutes` bookable slots (the server's slot length). Edits stay here
 * until Publish, which saves the whole pattern with the overrides untouched.
 *
 *   Booked hours (from the week's overview) show the candidate and are not
 *   tappable. Turning a day off clears its open hours; turning it back on
 *   restores the hours last published for that weekday.
 *   Override chips are the upcoming dated exceptions; a tap opens Date overrides.
 */
export function AvailabilityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const qc = useQueryClient()
  const { suspended } = useInterviewerMe()
  const now = useNow() || Date.now()
  const week = useMemo(() => thisWeek(now), [Math.floor(now / 3_600_000)]) // eslint-disable-line react-hooks/exhaustive-deps

  const [payload, setPayload] = useState<AvailabilityPayload | null>(null)
  const [overview, setOverview] = useState<AvailabilityOverviewDto | null>(null)
  const [base, setBase] = useState<Set<string>>(new Set())
  const [slots, setSlots] = useState<Set<string>>(new Set())
  const [day, setDay] = useState(() => Math.max(0, week.findIndex((w) => w.dateKey === istDateKey(now))))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [published, setPublished] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const slotMinutes = payload?.slotMinutes ?? overview?.slotMinutes ?? 0
  const perHour = slotMinutes ? Math.max(1, Math.round(60 / slotMinutes)) : 0
  const booked = useMemo(() => bookedFromOverview(overview), [overview])
  const hours = useMemo(() => hourRange(slots, booked), [slots, booked])
  const changes = changedCount(slots, base)
  const openSlots = [...slots].filter((k) => !booked.has(k)).length
  const openHrs = slotMinutes ? hoursOf(openSlots, slotMinutes) : '0'

  if (!payload) {
    return (
      <InterviewerShell title="Availability">
        {error ? (
          <EmError title="Couldn’t load your availability." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </InterviewerShell>
    )
  }

  const d = week[day]
  const wd = d.weekday
  const slotsOfHour = (h: number) => Array.from({ length: perHour }, (_, i) => slotKey(wd, h * 60 + i * slotMinutes))
  const dayOpen = hours.some((h) => slotsOfHour(h).some((k) => slots.has(k)))
  const dayBooked = [...booked.keys()].filter((k) => k.startsWith(`${wd}-`)).length
  const dayOpenSlots = [...slots].filter((k) => k.startsWith(`${wd}-`)).length
  const dayOff = !dayOpen && dayBooked === 0

  const edit = (next: Set<string>) => {
    setSlots(next)
    setPublished(false)
    setSaveError(null)
  }
  const toggleHour = (h: number) => {
    const keys = slotsOfHour(h).filter((k) => !booked.has(k))
    const allOn = keys.every((k) => slots.has(k))
    const next = new Set(slots)
    keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)))
    edit(next)
  }
  const toggleDay = () => {
    const next = new Set(slots)
    if (dayOpen) {
      for (const k of [...next]) if (k.startsWith(`${wd}-`) && !booked.has(k)) next.delete(k)
    } else {
      for (const k of base) if (k.startsWith(`${wd}-`)) next.add(k)
    }
    edit(next)
  }

  async function publish() {
    if (!payload) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveAvailability({ rules: slotSetToRules(slots, slotMinutes), overrides: payload.overrides })
      setBase(new Set(slots))
      setPublished(true)
      getAvailabilityOverview().then(setOverview).catch(() => {})
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
    } catch (e) {
      setSaveError(e instanceof ApiClientError ? e.message : 'Not published. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const todayKey = istDateKey(now)
  const upcoming = [...payload.overrides].filter((o) => o.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)

  return (
    <InterviewerShell
      title="Availability"
      sub={`${weekRange(week)} · REPEATS WEEKLY`}
      right={<Text style={[text.metaBase, styles.open]}>{`${openHrs}H OPEN`}</Text>}
      scroll={false}
      footer={
        <View style={styles.foot}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {upcoming.map((o) => {
              const off = !o.available || o.blocks.length === 0
              return (
                <Pressable key={o.date} accessibilityRole="button" onPress={() => navigation.navigate('InterviewerOverrides')} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                  <Text style={[text.metaBase, { color: off ? color.danger : color.success }]}>{`${dayOfKey(o.date)} ${monthShort(monthOfKey(o.date)).toUpperCase()}`}</Text>
                  <Text style={text.uiXs}>{off ? 'Day off' : 'Own hours'}</Text>
                </Pressable>
              )
            })}
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InterviewerOverrides')} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={[text.uiXsSemi, styles.accent]}>{upcoming.length ? 'All overrides' : '+ Date override'}</Text>
            </Pressable>
          </ScrollView>
          {!!saveError && <Text style={[text.uiXs, styles.danger]}>{saveError}</Text>}
          {suspended ? (
            <IvAction label="Publishing is paused while suspended" tone="off" />
          ) : (
            <IvAction
              label={published ? '✓ Published to students' : saving ? 'Publishing…' : changes ? `Publish ${changes} change${changes > 1 ? 's' : ''}` : 'No unsaved changes'}
              tone={published ? 'success' : changes && !saving ? 'accent' : 'off'}
              onPress={changes && !saving ? () => { publish() } : undefined}
            />
          )}
        </View>
      }
    >
      <View style={styles.days}>
        {week.map((w, i) => {
          const on = i === day
          const hasBooked = [...booked.keys()].some((k) => k.startsWith(`${w.weekday}-`))
          const hasOpen = [...slots].some((k) => k.startsWith(`${w.weekday}-`))
          const dot = hasBooked ? (on ? color.textInverse : color.accent) : hasOpen ? (on ? color.accentMuted : color.successFill) : 'transparent'
          return (
            <Pressable
              key={w.dateKey}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${weekdayLong(w.weekday)} ${w.day}`}
              onPress={() => setDay(i)}
              style={[styles.day, on ? styles.dayOn : styles.dayOff, !hasOpen && !hasBooked && !on && styles.dim]}
            >
              <Text style={[text.metaXs, styles.mono, { color: on ? color.textInverse : color.text }]}>{weekdayShort(w.weekday).toUpperCase()}</Text>
              <Text style={[text.uiLgSemi, { color: on ? color.textInverse : color.text }]}>{w.day}</Text>
              <View style={[styles.dot, { backgroundColor: dot }]} />
            </Pressable>
          )
        })}
      </View>

      <View style={styles.dayCard}>
        <View style={styles.grow}>
          <Text style={text.uiMdSemi}>{`${weekdayLong(wd)} ${d.day} ${monthShort(d.month)}`}</Text>
          <Text style={[text.uiXs, styles.muted]}>
            {dayOff ? 'Day off · students can’t book' : `${slotMinutes ? hoursOf(dayOpenSlots, slotMinutes) : 0}h open · ${dayBooked} booked`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`${weekdayLong(wd)} open`}
          accessibilityState={{ checked: dayOpen }}
          disabled={suspended}
          onPress={toggleDay}
          style={[styles.track, dayOpen ? styles.trackOn : styles.trackOff]}
        >
          <View style={[styles.knob, dayOpen ? styles.knobOn : styles.knobOff]} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.hours}>
        {hours.map((h) => {
          const keys = slotsOfHour(h)
          const bookedKey = keys.find((k) => booked.has(k))
          const onCount = keys.filter((k) => slots.has(k)).length
          const changed = keys.some((k) => slots.has(k) !== base.has(k))
          if (bookedKey) {
            return (
              <View key={h} style={[styles.hour, styles.hourBooked]}>
                <Text style={[text.metaLg, styles.accentText]}>{timeOfDay(h * 60)}</Text>
                <Text style={[text.uiXsSemi, styles.accentText, styles.tag]} numberOfLines={1}>{booked.get(bookedKey)}</Text>
              </View>
            )
          }
          const all = onCount === perHour && perHour > 0
          const some = onCount > 0 && !all
          return (
            <Pressable
              key={h}
              accessibilityRole="button"
              accessibilityState={{ selected: all }}
              accessibilityLabel={`${timeOfDay(h * 60)}, ${all ? 'open' : some ? 'partly open' : 'closed'}`}
              disabled={suspended}
              onPress={() => toggleHour(h)}
              style={({ pressed }) => [styles.hour, onCount ? styles.hourOn : styles.hourOffTile, changed && styles.hourChanged, pressed && styles.pressed]}
            >
              <Text style={[text.metaLg, { color: onCount ? color.success : color.textMuted }]}>{timeOfDay(h * 60)}</Text>
              {!!onCount && (
                <Text style={[text.uiXsSemi, styles.tag, { color: color.success }]} numberOfLines={1}>
                  {all ? `${perHour} ${perHour === 1 ? 'slot' : 'slots'}` : `${onCount} of ${perHour}`}
                </Text>
              )}
            </Pressable>
          )
        })}
      </ScrollView>
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled - 0.05 },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
  accent: { color: color.accent },
  accentText: { color: color.accentText },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space['3xl'] },
  open: { color: color.accentText },
  days: { flexDirection: 'row', gap: spaceHalf['1.5'], paddingHorizontal: spaceHalf['3.5'], paddingTop: space.xs, paddingBottom: space.md },
  day: { flex: 1, height: height.fab + space.sm, borderRadius: radius.panel, borderWidth: borderWidth.thin, alignItems: 'center', justifyContent: 'center', gap: space['2xs'] },
  dayOn: { backgroundColor: color.accent, borderColor: color.accent },
  dayOff: { backgroundColor: color.surface, borderColor: color.border },
  dot: { width: space.xs + 1, height: space.xs + 1, borderRadius: radius.pill },
  dayCard: { marginHorizontal: spaceHalf['3.5'], marginBottom: spaceHalf['2.5'], borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { width: height.tap + space.sm, height: height.chip, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: space.xs },
  trackOn: { backgroundColor: color.successFill },
  trackOff: { backgroundColor: color.borderStrong },
  knob: { width: space.xl + space.xs, height: space.xl + space.xs, borderRadius: radius.pill, backgroundColor: color.surface },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'], paddingHorizontal: spaceHalf['3.5'], paddingBottom: space.lg },
  hour: { width: '48.5%', flexGrow: 1, height: height.control, borderRadius: radius.tile, borderWidth: borderWidth.thin, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  hourOn: { backgroundColor: color.successSoft, borderColor: color.successEdge },
  hourOffTile: { backgroundColor: color.surface, borderColor: color.border },
  hourBooked: { backgroundColor: color.accentSoft, borderColor: color.accentMuted },
  hourChanged: { borderWidth: borderWidth.medium, borderStyle: 'dashed', borderColor: color.accent },
  tag: { flexShrink: 1 },
  foot: { flex: 1, gap: space.sm },
  chips: { gap: space.sm },
  chip: { height: height['chip-sm'] + space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
})
