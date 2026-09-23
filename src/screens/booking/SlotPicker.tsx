import React from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { color, space, radius, borderWidth, height, fontFamilyNative, fontSize } from '../../theme'
import { Eyebrow, Display, Body, Meta, Button, Card, Chip, ErrorState } from '../../components/ui'
import {
  type DaySlots,
  dayChip,
  fmtCapacity,
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

  return (
    <View style={{ gap: space.xl }}>
      {/* Day strip */}
      <View style={{ gap: space.sm }}>
        <Eyebrow>{windowLabel}</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {days.map((d) => {
            const { dow, num } = dayChip(d.anchorIso)
            return (
              <Chip
                key={d.key}
                label={`${dow} · ${num}`}
                selected={d.key === selectedDayKey}
                onPress={() => onSelectDay(d.key)}
              />
            )
          })}
        </ScrollView>
      </View>

      {/* Grid, or empty-day */}
      <View style={{ gap: space.md }}>
        <View style={styles.gridHead}>
          <Eyebrow tone="muted">{headingIso ? `${fmtLongDate(headingIso)} · IST` : 'Choose a day'}</Eyebrow>
          {selected && !loading && (
            <Meta style={{ color: color.textSubtle }}>
              {selected.slots.length} {selected.slots.length === 1 ? 'block' : 'blocks'} open
            </Meta>
          )}
        </View>

        {note ? <Body size="xs" tone="muted">{note}</Body> : null}

        {loading ? (
          <View style={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} style={[styles.block, styles.blockSkeleton]}>
                <View style={styles.skelLine} />
                <View style={styles.skelLineSm} />
              </Card>
            ))}
          </View>
        ) : selected && selected.slots.length > 0 ? (
          <View style={styles.grid}>
            {selected.slots.map((s) => {
              const state =
                s.slotStart === goneIso ? 'gone'
                : s.slotStart === selectedSlotIso ? 'selected'
                : s.slotStart === nearestIso ? 'nearest'
                : 'open'
              return <SlotBlock key={s.slotStart} iso={s.slotStart} capacity={s.capacity} state={state} onPress={() => onSelectSlot(s.slotStart)} />
            })}
          </View>
        ) : (
          <View style={styles.emptyDay}>
            <Display level="sm">Nobody is free on {headingIso ? weekdayLong(headingIso) : 'that day'}.</Display>
            <Body size="sm" tone="muted">
              Every interviewer who matches your tier, your language and your field is already booked
              {headingIso ? ' that day' : ' in range'}.
            </Body>
            {nextAvailableIso ? (
              <View style={{ gap: space.xs }}>
                <Eyebrow>Next available</Eyebrow>
                <Meta style={{ color: color.text }}>{fmtShortDate(nextAvailableIso)} · {fmtTime(nextAvailableIso)} IST</Meta>
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

function SlotBlock({
  iso, capacity, state, onPress,
}: {
  iso: string; capacity: number; state: 'open' | 'selected' | 'gone' | 'nearest'; onPress: () => void
}) {
  if (state === 'gone') {
    return (
      <Card style={[styles.block, styles.blockGone]}>
        <Meta style={styles.timeGone}>{fmtTime(iso)}</Meta>
        <Meta style={{ color: color.textSubtle }}>Taken</Meta>
      </Card>
    )
  }
  const on = state === 'selected'
  const near = state === 'nearest'
  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.block, on && styles.blockOn, near && styles.blockNear]}>
        <Meta style={[styles.time, { color: on ? color.textInverse : color.text }]}>{fmtTime(iso)}</Meta>
        <Meta style={{ color: on ? color.textInverse : near ? color.text : color.textSubtle, opacity: on ? 0.7 : 1 }}>
          {near ? 'Nearest · ' : ''}{fmtCapacity(capacity)}
        </Meta>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  gridHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  block: {
    width: '48%', minWidth: 0, flexGrow: 1, height: 62, justifyContent: 'center', paddingHorizontal: space.md, gap: space.xs,
  },
  blockOn: { borderColor: color.ink, backgroundColor: color.ink },
  blockNear: { borderColor: color.borderStrong },
  blockGone: { backgroundColor: color.surfaceMuted },
  blockSkeleton: { gap: space.sm },
  time: { fontFamily: fontFamilyNative.monoMedium, fontSize: fontSize['ui-sm'], letterSpacing: 0.5 },
  timeGone: { fontFamily: fontFamilyNative.monoMedium, fontSize: fontSize['ui-sm'], color: color.textSubtle, textDecorationLine: 'line-through' },
  skelLine: { width: 62, height: 11, borderRadius: radius.sm, backgroundColor: color.surfaceSunken },
  skelLineSm: { width: 40, height: 8, borderRadius: radius.sm, backgroundColor: color.surfaceMuted },
  emptyDay: {
    borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border,
    backgroundColor: color.surfaceMuted, padding: space.xl, gap: space.md,
  },
})
