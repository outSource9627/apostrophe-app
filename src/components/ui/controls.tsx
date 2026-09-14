import React from 'react'
import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native'
import { borderWidth, color, height, opacity, radius, space } from '../../theme'
import { Body } from './Type'
import { text } from './typography'

/** Foundations §05 — chips, toggles, steppers. */

/**
 * A filter, a skill, a preference. `add` is the dashed "+ Add" affordance —
 * dashed for the same reason the self-uploaded video frame is: in this system a
 * dashed edge consistently means "not filled in yet".
 */
export function Chip({
  label, selected = false, add = false, onPress, style,
}: { label: string; selected?: boolean; add?: boolean; onPress?: () => void; style?: ViewProps['style'] }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: add ? undefined : selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        add ? styles.chipAdd : selected ? styles.chipOn : styles.chipOff,
        pressed && { opacity: opacity.pressed },
        style as object,
      ]}
    >
      <Body size="sm" weight="medium" tone={add ? 'subtle' : selected ? 'inverse' : 'default'}>
        {label}
      </Body>
    </Pressable>
  )
}

/** A read-only tag — a skill on a card. Mono, so it cannot be mistaken for a chip you can press. */
export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={[text.metaMd, styles.tagText]}>{label}</Text>
    </View>
  )
}

/**
 * The track is two knob-widths plus the gap, and the knob inset is whatever is
 * left over — written as that relationship rather than as 46 and 3, so the
 * switch stays correct if the knob token ever moves.
 */
const TRACK_W = height['toggle-knob'] * 2 + space['2xs']
const KNOB_INSET = (height.toggle - height['toggle-knob']) / 2

export function Toggle({
  on, onChange, label, disabled = false,
}: { on: boolean; onChange?: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange?.(!on)}
      style={[
        styles.track,
        { width: TRACK_W },
        disabled ? styles.trackOff : on ? styles.trackOn : styles.trackIdle,
      ]}
    >
      <View
        style={[
          styles.knob,
          { top: KNOB_INSET },
          on ? { right: KNOB_INSET } : { left: KNOB_INSET },
        ]}
      />
    </Pressable>
  )
}

/**
 * Caps at three panes, deliberately. A fourth truncates its own labels at the
 * 390pt baseline device — past three this becomes a scrolling chip row instead.
 */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: readonly T[]; value: T; onChange?: (next: T) => void }) {
  return (
    <View style={styles.segTrack}>
      {options.slice(0, 3).map((o) => {
        const on = o === value
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange?.(o)}
            style={[styles.segPane, on && styles.segPaneOn]}
          >
            <Body size="sm" weight={on ? 'semibold' : 'medium'} tone={on ? 'default' : 'muted'}>
              {o}
            </Body>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    height: height.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
  },
  chipOn: { backgroundColor: color.text },
  chipOff: { borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface },
  chipAdd: { borderWidth: borderWidth.thin, borderColor: color.borderStrong, borderStyle: 'dashed' },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  tagText: { color: color.textMuted, textTransform: 'none' },

  track: { height: height.toggle, borderRadius: radius.pill },
  trackOn: { backgroundColor: color.accent },
  trackIdle: { backgroundColor: color.border },
  trackOff: { backgroundColor: color.surfaceSunken },
  knob: {
    position: 'absolute',
    width: height['toggle-knob'],
    height: height['toggle-knob'],
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },

  segTrack: {
    flexDirection: 'row',
    backgroundColor: color.surfaceSunken,
    borderRadius: radius.pill,
    padding: space['2xs'],
  },
  segPane: {
    flex: 1,
    height: height.segment,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  segPaneOn: {
    backgroundColor: color.surface,
    shadowColor: color.ink,
    shadowOpacity: 0.08,
    shadowRadius: space['2xs'],
    shadowOffset: { width: 0, height: borderWidth.thin },
    elevation: 1,
  },
})
