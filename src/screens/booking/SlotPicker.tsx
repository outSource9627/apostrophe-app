import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { color, borderWidth, fontFamilyNative as FF, fontSize, opacity } from '../../theme'
import { Btn, StateBlock } from '../../components/tab/kit'
import { Eyebrow } from '../../components/tab/flow'
import {
  type DaySlots,
  dayChip,
  istHour,
  fmtLongDate,
  fmtShortDate,
  fmtTime,
  weekdayLong,
} from '../../lib/interviews/slots'

/**
 * THE PICKER IS ONE COMPONENT — Book and Reschedule mount it identically, the
 * same rule the web draws. Capacity is advisory and never coloured (a heatmap
 * would spend the accent budget and steal Join's urgency); an empty day is a
 * real empty state with the next available date, not a grid of greyed cells.
 */
export function SlotPicker({
  days,
  windowLabel,
  selectedDayKey,
  onSelectDay,
  selectedSlotIso,
  onSelectSlot,
  goneIso,
  nearestIso,
  note,
  nextAvailableIso,
  onJumpToNext,
  loading = false,
  bleed = 20,
  error = false,
  onRetry,
}: {
  days: DaySlots[]
  windowLabel: string
  selectedDayKey: string | null
  onSelectDay: (key: string) => void
  selectedSlotIso: string | null
  onSelectSlot: (iso: string) => void
  goneIso?: string | null
  nearestIso?: string | null
  note?: string
  nextAvailableIso?: string | null
  onJumpToNext?: () => void
  loading?: boolean
  /** The screen's side padding, so the day strip can run to the screen edges. */
  bleed?: number
  /** The capacity fetch itself failed — replaces the strip and grid with the shared error state. */
  error?: boolean
  onRetry?: () => void
}) {
  if (error) {
    return (
      <StateBlock
        icon="alert"
        title="Could not load open slots."
        body="Check your connection and try again."
        action={onRetry ? 'Try again' : undefined}
        onAction={onRetry}
      />
    )
  }

  const selected = days.find((d) => d.key === selectedDayKey)
  const headingIso = selected?.anchorIso ?? nextAvailableIso ?? days[0]?.anchorIso ?? null
  const groups = selected ? PARTS.map((part) => ({ ...part, slots: selected.slots.filter((s) => part.test(istHour(s.slotStart))) })).filter((g) => g.slots.length > 0) : []

  return (
    <View style={styles.wrap}>
      {/* Day strip */}
      <View style={[styles.dayBlock, { marginHorizontal: -bleed }]}>
        <Eyebrow style={{ paddingHorizontal: bleed }}>{windowLabel}</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.dayStrip, { paddingHorizontal: bleed }]} style={styles.dayScroll}>
          {days.map((d) => {
            const { dow, num } = dayChip(d.anchorIso)
            const on = d.key === selectedDayKey
            return (
              <Pressable
                key={d.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onSelectDay(d.key)}
                style={({ pressed }) => [styles.day, on ? styles.dayOn : styles.dayOff, !on && d.slots.length === 0 && styles.dayZero, pressed && { opacity: opacity.pressed }]}
              >
                <Text style={[styles.dayDow, on && styles.onInk]}>{dow}</Text>
                <Text style={[styles.dayNum, on && styles.onInk]}>{num}</Text>
                <Text style={[styles.dayCount, on && styles.onInk]}>{loading ? '…' : `${d.slots.length} free`}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      <View style={styles.slots}>
        <View style={styles.gridHead}>
          <Text style={styles.gridTitle}>{headingIso ? `${fmtLongDate(headingIso)}` : 'Choose a day'}</Text>
          <Text style={styles.mono}>IST</Text>
        </View>

        {note ? <Text style={styles.xs}>{note}</Text> : null}

        {loading ? (
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.slot, styles.slotSkeleton]} />
            ))}
          </View>
        ) : groups.length > 0 ? (
          groups.map((g) => (
            <View key={g.name} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupName}>{g.name}</Text>
                <Text style={styles.monoSm}>{g.range}</Text>
              </View>
              <View style={styles.grid}>
                {g.slots.map((s) => {
                  const state =
                    s.slotStart === goneIso ? 'gone'
                    : s.slotStart === selectedSlotIso ? 'selected'
                    : s.slotStart === nearestIso ? 'nearest'
                    : 'open'
                  return <SlotBlock key={s.slotStart} iso={s.slotStart} state={state} onPress={() => onSelectSlot(s.slotStart)} />
                })}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyDay}>
            <Text style={styles.emptyTitle}>Nobody is free on {headingIso ? weekdayLong(headingIso) : 'that day'}.</Text>
            <Text style={styles.emptyBody}>
              Every interviewer who matches your tier, your language and your field is already booked
              {headingIso ? ' that day' : ' in range'}.
            </Text>
            {nextAvailableIso ? (
              <View style={styles.next}>
                <Eyebrow>Next available</Eyebrow>
                <Text style={styles.nextText}>{fmtShortDate(nextAvailableIso)} · {fmtTime(nextAvailableIso)} IST</Text>
              </View>
            ) : null}
            {nextAvailableIso && onJumpToNext ? (
              <Btn variant="outline" label={`Show ${fmtLongDate(nextAvailableIso)}`} onPress={onJumpToNext} />
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}

/** Morning, afternoon, evening — the design's three groups, decided by the slot's IST hour. */
const PARTS = [
  { name: 'Morning', range: 'Before 12 PM', test: (h: number) => h < 12 },
  { name: 'Afternoon', range: '12 – 5 PM', test: (h: number) => h >= 12 && h < 17 },
  { name: 'Evening', range: 'From 5 PM', test: (h: number) => h >= 17 },
]

function SlotBlock({
  iso, state, onPress,
}: {
  iso: string; state: 'open' | 'selected' | 'gone' | 'nearest'; onPress: () => void
}) {
  if (state === 'gone') {
    return (
      <View style={[styles.slot, styles.slotGone]}>
        <Text style={styles.timeGone}>{fmtTime(iso)}</Text>
      </View>
    )
  }
  const on = state === 'selected'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, on ? styles.slotOn : state === 'nearest' ? styles.slotNear : styles.slotOpen, pressed && { opacity: opacity.pressed }]}
    >
      <Text style={on ? styles.timeOn : styles.time}>{fmtTime(iso)}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  dayBlock: { gap: 8 },
  dayScroll: { flexGrow: 0 },
  dayStrip: { gap: 8, paddingBottom: 2 },
  day: { width: 72, borderRadius: 18, padding: 10, gap: 2 },
  dayOn: { backgroundColor: color.ink, borderWidth: borderWidth.medium, borderColor: color.ink, padding: 9 },
  dayOff: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  dayZero: { opacity: 0.55 },
  dayDow: { fontFamily: FF.body, fontSize: 11, color: color.textMuted },
  dayNum: { fontFamily: FF.bodySemiBold, fontSize: 20, lineHeight: 25, color: color.text },
  dayCount: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-xs'], fontVariant: ['tabular-nums'], color: color.textSubtle },
  onInk: { color: color.textInverse },
  slots: { gap: 14 },
  gridHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  gridTitle: { fontFamily: FF.bodySemiBold, fontSize: 16, letterSpacing: -0.16, color: color.text },
  mono: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.textMuted },
  monoSm: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.textMuted },
  xs: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.textMuted },
  group: { gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  groupName: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31.5%', flexGrow: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  slotOpen: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  slotOn: { backgroundColor: color.accentSoft, borderWidth: borderWidth.medium, borderColor: color.accent },
  slotNear: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  slotGone: { borderWidth: borderWidth.thin, borderColor: color.borderStrong, borderStyle: 'dashed' },
  slotSkeleton: { backgroundColor: color.surfaceMuted },
  time: { fontFamily: FF.body, fontSize: 15, color: color.text },
  timeOn: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.accentText },
  timeGone: { fontFamily: FF.body, fontSize: 15, color: color.textDisabled, textDecorationLine: 'line-through' },
  emptyDay: { gap: 10, paddingVertical: 6 },
  emptyTitle: { fontFamily: FF.bodySemiBold, fontSize: 20, lineHeight: 25, color: color.text },
  emptyBody: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
  next: { backgroundColor: color.surfaceMuted, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  nextText: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
})
