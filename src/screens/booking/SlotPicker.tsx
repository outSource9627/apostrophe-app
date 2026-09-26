import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { color, space, spaceHalf, radius, borderWidth, height, opacity, trackingNative } from '../../theme'
import { Body, Button, ErrorState, text } from '../../components/ui'
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
  /** The capacity fetch itself failed — replaces the strip and grid with the shared error state. */
  error?: boolean
  onRetry?: () => void
}) {
  if (error) {
    return (
      <ErrorState
        title="Could not load open slots."
        body="Check your connection and try again."
        action={
          onRetry ? (
            <Button
              variant="outline"
              size="sm"
              label="Try again"
              // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
              hitSlop={(height.tap - height['control-xs']) / 2}
              onPress={onRetry}
            />
          ) : undefined
        }
      />
    )
  }

  const selected = days.find((d) => d.key === selectedDayKey)
  const headingIso = selected?.anchorIso ?? nextAvailableIso ?? days[0]?.anchorIso ?? null
  const groups = selected ? PARTS.map((part) => ({ ...part, slots: selected.slots.filter((s) => part.test(istHour(s.slotStart))) })).filter((g) => g.slots.length > 0) : []

  return (
    <View style={styles.wrap}>
      {/* Day strip */}
      <View style={styles.dayBlock}>
        <Text style={[text.metaMd, styles.eyebrow]}>{windowLabel.toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
          {days.map((d) => {
            const { dow, num } = dayChip(d.anchorIso)
            const on = d.key === selectedDayKey
            return (
              <Pressable
                key={d.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onSelectDay(d.key)}
                style={({ pressed }) => [styles.day, on ? styles.dayOn : styles.dayOff, pressed && { opacity: opacity.pressed }]}
              >
                <Text style={[text.ui2xs, styles.dayDow, on && styles.onInk]}>{dow}</Text>
                <Text style={[text.displayCard, on && styles.onInk]}>{num}</Text>
                <Text style={[text.metaPill, styles.dayCount, on && styles.onInk]}>{d.slots.length} FREE</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      <View style={styles.slots}>
        <View style={styles.gridHead}>
          <Text style={text.uiMdSemi}>{headingIso ? `${fmtLongDate(headingIso)}` : 'Choose a day'}</Text>
          <Text style={[text.metaMd, styles.subtle]}>IST</Text>
        </View>

        {note ? <Body size="xs" tone="muted">{note}</Body> : null}

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
                <Text style={text.uiMdSemi}>{g.name}</Text>
                <Text style={[text.metaMd, styles.subtle]}>{g.range}</Text>
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
            <Text style={text.displayXs}>Nobody is free on {headingIso ? weekdayLong(headingIso) : 'that day'}.</Text>
            <Body size="sm" tone="muted">
              Every interviewer who matches your tier, your language and your field is already booked
              {headingIso ? ' that day' : ' in range'}.
            </Body>
            {nextAvailableIso ? (
              <View style={styles.next}>
                <Text style={[text.metaMd, styles.subtle]}>NEXT AVAILABLE</Text>
                <Text style={text.uiMdSemi}>{fmtShortDate(nextAvailableIso)} · {fmtTime(nextAvailableIso)} IST</Text>
              </View>
            ) : null}
            {nextAvailableIso && onJumpToNext ? (
              <Button variant="outline" size="block" full label={`Show ${fmtLongDate(nextAvailableIso)}`} onPress={onJumpToNext} />
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}

/** Morning, afternoon, evening — the design's three groups, decided by the slot's IST hour. */
const PARTS = [
  { name: 'Morning', range: 'BEFORE 12 PM', test: (h: number) => h < 12 },
  { name: 'Afternoon', range: '12 – 5 PM', test: (h: number) => h >= 12 && h < 17 },
  { name: 'Evening', range: 'FROM 5 PM', test: (h: number) => h >= 17 },
]

function SlotBlock({
  iso, state, onPress,
}: {
  iso: string; state: 'open' | 'selected' | 'gone' | 'nearest'; onPress: () => void
}) {
  if (state === 'gone') {
    return (
      <View style={[styles.slot, styles.slotGone]}>
        <Text style={[text.uiMd, styles.timeGone]}>{fmtTime(iso)}</Text>
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
      <Text style={[on ? text.uiMdSemi : text.uiMd, { color: on ? color.accentText : color.text }]}>{fmtTime(iso)}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  dayBlock: { gap: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  dayStrip: { gap: space.sm },
  day: { width: height['day-card'], borderRadius: radius.panel, padding: spaceHalf['2.5'], gap: space['2xs'] },
  dayOn: { backgroundColor: color.ink, borderWidth: borderWidth.medium, borderColor: color.ink },
  dayOff: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  dayDow: { color: color.textMuted },
  dayCount: { color: color.textSubtle },
  onInk: { color: color.textInverse },
  slots: { gap: spaceHalf['3.5'] },
  gridHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  subtle: { color: color.textSubtle },
  group: { gap: spaceHalf['2.5'] },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: { width: '31.5%', flexGrow: 1, height: height.control, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  slotOpen: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  slotOn: { backgroundColor: color.accentSoft, borderWidth: borderWidth.medium, borderColor: color.accent },
  slotNear: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  slotGone: { borderWidth: borderWidth.thin, borderColor: color.border, borderStyle: 'dashed' },
  slotSkeleton: { backgroundColor: color.surfaceSunken },
  timeGone: { color: color.textDisabled, textDecorationLine: 'line-through' },
  next: { gap: space.xs },
  emptyDay: {
    borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border,
    backgroundColor: color.surface, padding: space.xl, gap: space.md,
  },
})
