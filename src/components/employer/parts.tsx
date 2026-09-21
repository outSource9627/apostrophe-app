import React from 'react'
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { borderWidth, color, fontFamilyNative, height, opacity, radius, space } from '../../theme'
import { text } from '../ui'

/**
 * The small pieces every employer screen shares — the glyph set the boards
 * draw with, the underlined text action and the company monogram.
 *
 * Nothing here adds a value: stroke weights are borderWidth steps, sizes are
 * space and height steps, and the glyph paths are the canvas's own
 * (docs/design/canvas/employer-onboarding/lib.mjs → G, admin-shell → I), on
 * the same 24 grid, so a board and a phone draw the same mark.
 */

export type GlyphName =
  | 'shield'
  | 'shieldCheck'
  | 'clock'
  | 'filePlus'
  | 'xCircle'
  | 'file'
  | 'check'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'globe'
  | 'arrowLeft'
  | 'arrowRight'
  | 'play'
  | 'bookmark'
  | 'wifiOff'

const PATHS: Record<GlyphName, React.ReactNode> = {
  shield: <Path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z" />,
  shieldCheck: (
    <>
      <Path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z" />
      <Path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  filePlus: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 3v5h5" />
      <Path d="M12 11v6M9 14h6" />
    </>
  ),
  xCircle: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
  file: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 3v5h5" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  chevronRight: <Path d="m9 18 6-6-6-6" />,
  chevronLeft: <Path d="m15 18-6-6 6-6" />,
  /** A picker's trailing mark (EM-02 industry). */
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  /** The website link on the public company card (EM-07). */
  globe: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3 12h18" />
      <Path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </>
  ),
  arrowLeft: (
    <>
      <Path d="M19 12H5" />
      <Path d="m11 18-6-6 6-6" />
    </>
  ),
  arrowRight: (
    <>
      <Path d="M5 12h14" />
      <Path d="m13 6 6 6-6 6" />
    </>
  ),
  play: <Path d="M8 5.5v13l10.5-6.5Z" />,
  bookmark: <Path d="M6 4h12v17l-6-4-6 4Z" />,
  wifiOff: (
    <>
      <Path d="m3 3 18 18" />
      <Path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <Path d="M5 12.9a10 10 0 0 1 5.2-2.7" />
      <Path d="M19 12.9a10 10 0 0 0-2.4-1.7" />
      <Path d="M12 20h.01" />
    </>
  ),
}

/** One stroke glyph. Decorative: the label beside it carries the meaning. */
export function Glyph({
  name, size = space.lg, tint = color.text, weight = borderWidth.medium,
}: { name: GlyphName; size?: number; tint?: string; weight?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tint}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS[name]}
    </Svg>
  )
}

/**
 * A text action: ink, 14 semibold, underlined, inside a 44 tap box. Never
 * crimson — the Button `text` variant is the accent, and a Resend or an Edit is
 * not the screen's one primary action.
 */
export function TextAction({
  label, tone = 'default', underline = true, style, ...rest
}: {
  label: string
  tone?: 'default' | 'muted' | 'subtle'
  underline?: boolean
} & Omit<PressableProps, 'children' | 'style'> & { style?: PressableProps['style'] }) {
  const tint = { default: color.text, muted: color.textMuted, subtle: color.textSubtle }[tone]
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, pressed && styles.pressed, style as object]}
      {...rest}
    >
      <Text style={[text.uiMdSemi, { color: rest.disabled ? color.textSubtle : tint }, underline && styles.underline]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** 'Copperleaf Logistics' → 'CL'. Two letters at most, from the first two words. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/**
 * A company, drawn as its initials. A square at radius 10 — a company is never
 * a circle, which is a person. Stands in for the logo the record has no field
 * for yet.
 */
export function CompanyMonogram({ name, size = height.avatar }: { name: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.monogram, { width: size, height: size }]}
    >
      <Text style={[text.metaMd, styles.monogramText]}>{initials(name)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    minWidth: height.tap,
    height: height.tap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: opacity.pressed },
  underline: {
    textDecorationLine: 'underline',
    textDecorationColor: color.borderStrong,
  },
  monogram: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  monogramText: { fontFamily: fontFamilyNative.monoMedium, color: color.textMuted },
})
