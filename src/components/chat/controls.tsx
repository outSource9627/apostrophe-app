import React, { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { borderWidth, color, fontFamilyNative as FF, fontSize, height, opacity, radius, space, spaceHalf } from '../../theme'
import { Icon, type IconName } from '../ui/Icon'

/** The 40 back circle of a chat screen: a chevron, no ring (A · `.back`). */
export function BackButton({ onPress, label = 'Back' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={space.xs} onPress={onPress} style={({ pressed }) => [s.round, pressed && s.pressed]}>
      <Svg width={height.glyph - 2} height={height.glyph - 2} viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="m15 18-6-6 6-6" />
      </Svg>
    </Pressable>
  )
}

/** A 40 round icon button in a chat header: ⋯, or the bordered résumé button. */
export function RoundButton({ icon, label, onPress, bordered, disabled, iconSize = height.glyph - 2, ref }: {
  icon: IconName; label: string; onPress: () => void; bordered?: boolean; disabled?: boolean; iconSize?: number
  ref?: React.Ref<React.ComponentRef<typeof View>>
}) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={space.xs}
      onPress={onPress}
      style={({ pressed }) => [s.round, bordered && s.bordered, (pressed || disabled) && s.pressed]}
    >
      <Icon name={icon} size={iconSize} tint={color.text} />
    </Pressable>
  )
}

/** Wait this long before saying we are offline, so a socket that is still connecting (or blips) never flashes the strip. */
const SHOW_AFTER_MS = 1500
/** The dot's slow pulse: down to 30% and back, 0.6 s each way. */
const PULSE_LOW = 0.3
const PULSE_MS = 600

/**
 * ONE reconnecting strip for the lists and the threads: nothing is lost, and a
 * message sent now goes out over REST and reaches the other side on their next
 * refresh.
 */
export function ReconnectingStrip({ visible }: { visible: boolean }) {
  const [shown, setShown] = useState(false)
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!visible) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [visible])

  useEffect(() => {
    if (!shown) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: PULSE_LOW, duration: PULSE_MS, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [shown, pulse])

  if (!shown) return null
  return (
    <View accessibilityRole="alert" style={s.strip}>
      <Animated.View style={[s.stripDot, { opacity: pulse }]} />
      <Text style={s.stripText}>Reconnecting · a sent message will go out when you are back</Text>
    </View>
  )
}

const s = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  round: { width: height['control-xs'], height: height['control-xs'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  bordered: { borderWidth: borderWidth.thin, borderColor: color.border },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.xl,
    backgroundColor: color.warningSoft, borderBottomWidth: borderWidth.thin, borderBottomColor: color.warningEdge,
  },
  stripDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.warningFill },
  stripText: { flex: 1, fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.warning },
})
