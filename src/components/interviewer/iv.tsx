import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { text } from '../ui'

/**
 * The Interviewer App Android pieces the four drawn screens share. Numbers
 * that change (timers, fees, scores) are always set in Geist Mono, as the
 * design's brief says.
 */

/** A mono caps label (10, tracked). */
export function IvLabel({ children, tone = 'muted', style }: { children: React.ReactNode; tone?: 'muted' | 'accent' | 'subtle'; style?: object }) {
  const c = { muted: color.textMuted, accent: color.accentText, subtle: color.textSubtle }[tone]
  return <Text style={[text.metaSm, styles.mono, { color: c }, style]}>{children}</Text>
}

/** M1's small stat tile: the mono key over a mono 22 figure. */
export function IvStat({ k, v, tone = 'ink' }: { k: string; v: string; tone?: 'ink' | 'success' }) {
  return (
    <View style={styles.stat}>
      <IvLabel>{k}</IvLabel>
      <Text style={[text.metaTile, styles.figure, { color: tone === 'success' ? color.successFill : color.text }]} numberOfLines={1}>{v}</Text>
    </View>
  )
}

/** The violet bloom in a card's top-right corner (M1's next-session card). */
export function IvGlow() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="ivGlow" cx="100%" cy="0%" rx="70%" ry="60%" fx="100%" fy="0%">
          <Stop offset="0" stopColor={color.accent} stopOpacity={0.1} />
          <Stop offset="0.7" stopColor={color.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#ivGlow)" />
    </Svg>
  )
}

/** The pill action that closes a card or a screen (50 tall): accent when live, the sunken fill when not. */
export function IvAction({
  label, onPress, tone = 'accent', disabled,
}: { label: string; onPress?: () => void; tone?: 'accent' | 'off' | 'success' | 'danger'; disabled?: boolean }) {
  const bg = { accent: color.accent, off: color.surfaceSunken, success: color.successFill, danger: color.dangerFill }[tone]
  const fg = tone === 'off' ? color.textMuted : color.textInverse
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || tone === 'off' }}
      disabled={disabled || tone === 'off' || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: bg }, pressed && styles.pressed]}
    >
      <Text style={[text.uiBaseSemi, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

/** M1's owed-scorecard row: the candidate, what submitting releases, and the mono clock. */
export function IvOwedRow({
  name, line, clock, urgent, onPress,
}: { name: string; line: string; clock: string; urgent?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.owed, urgent && styles.owedUrgent, pressed && styles.pressed]}>
      <View style={styles.grow}>
        <Text style={text.uiMdSemi} numberOfLines={1}>{name}</Text>
        <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{line}</Text>
      </View>
      <Text style={[text.metaXl, styles.clock, { color: urgent ? color.danger : color.text }]}>{clock}</Text>
    </Pressable>
  )
}

/** A card of the interviewer screens (radius 14, hairline). */
export function IvCard({ children, style, tone }: { children: React.ReactNode; style?: object; tone?: 'danger' | 'accent' }) {
  return <View style={[styles.card, tone === 'danger' && styles.cardDanger, tone === 'accent' && styles.cardAccent, style]}>{children}</View>
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  mono: { letterSpacing: trackingNative.eyebrow },
  figure: { letterSpacing: 0 },
  clock: { letterSpacing: 0 },
  stat: { flex: 1, minWidth: 0, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], gap: space['2xs'] },
  action: { height: height['control-cta'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  owed: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'] },
  owedUrgent: { borderColor: color.dangerBorder },
  card: { borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  cardDanger: { borderColor: color.dangerBorder },
  cardAccent: { borderColor: color.accentMuted, backgroundColor: color.accentWash },
})
