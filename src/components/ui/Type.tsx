import React from 'react'
import { StyleSheet, Text, View, type TextProps, type ViewProps } from 'react-native'
import { color, space } from '../../theme'
import { text } from './typography'

/**
 * Foundations §03 as components. See `typography.ts` for why the face/size
 * binding has to be prepared rather than assembled at the call site on RN.
 */

/**
 * The small grey label above a field, a section, a group of stats: Geist
 * medium in sentence case, no extra tracking (it was Geist Mono in capitals
 * until 2026-10-06; see docs/label-font-mockups.html, option A).
 */
export function Eyebrow({
  tone = 'subtle', style, children, ...rest
}: { tone?: 'subtle' | 'accent' | 'muted' | 'danger' | 'success' } & TextProps) {
  // `danger` exists because an error/forfeit kicker must read in the danger
  // rose, never the brand crimson — accent is a verb, not a warning colour.
  const tint = { subtle: color.textSubtle, accent: color.accent, muted: color.textMuted, danger: color.danger, success: color.success }[tone]
  return (
    <Text style={[text.metaSm, { color: tint }, style]} {...rest}>
      {children}
    </Text>
  )
}

/** Content set in the serif — a screen title, a candidate's name, a moment. */
export function Display({
  level = 'md', style, children, ...rest
}: { level?: 'xs' | 'sm' | 'md' | 'lg' } & TextProps) {
  const step = { xs: text.displayXs, sm: text.displaySm, md: text.displayMd, lg: text.displayLg }[level]
  return (
    <Text style={[step, style]} {...rest}>
      {children}
    </Text>
  )
}

/** Interface copy. `weight` picks the bundled face, never a fontWeight property. */
export function Body({
  size = 'base', weight = 'regular', tone = 'default', style, children, ...rest
}: {
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'base' | 'lg'
  weight?: 'regular' | 'medium' | 'semibold'
  tone?: 'default' | 'muted' | 'subtle' | 'inverse' | 'accent' | 'danger'
} & TextProps) {
  // Every size honours every weight it has a style for. `sm` used to drop
  // semibold (so a small Button's label came out regular), `xs` dropped both,
  // and `md`/`base` dropped medium. 2xs and lg have one weight each.
  const byWeight = (regular: object, medium: object, semibold: object) =>
    weight === 'semibold' ? semibold : weight === 'medium' ? medium : regular
  const base = {
    '2xs': text.ui2xs,
    xs: byWeight(text.uiXs, text.uiXsMedium, text.uiXsSemi),
    sm: byWeight(text.uiSm, text.uiSmMedium, text.uiSmSemi),
    md: byWeight(text.uiMd, text.uiMdMedium, text.uiMdSemi),
    base: byWeight(text.uiBase, text.uiBaseMedium, text.uiBaseSemi),
    lg: text.uiLgSemi,
  }[size]
  const tint = {
    default: color.text,
    muted: color.textMuted,
    subtle: color.textSubtle,
    inverse: color.textInverse,
    accent: color.accent,
    danger: color.danger,
  }[tone]
  return (
    <Text style={[base, { color: tint }, style]} {...rest}>
      {children}
    </Text>
  )
}

/**
 * A number the product is actually about — salary, a score, a total. Serif and
 * large, because it is content the student paid for rather than chrome.
 */
export function Figure({
  value, unit, outOf, style,
}: { value: React.ReactNode; unit?: string; outOf?: React.ReactNode; style?: TextProps['style'] }) {
  return (
    <Text style={[text.displayNum, style]}>
      {value}
      {outOf != null && <Text style={{ color: color.borderStrong }}>/{outOf}</Text>}
      {!!unit && <Text style={[text.uiMd, styles.unit]}> {unit}</Text>}
    </Text>
  )
}

/** Transaction references, durations, requirement IDs — the fine print. */
export function Meta({ style, children, ...rest }: TextProps) {
  return (
    <Text style={[text.metaMd, style]} {...rest}>
      {children}
    </Text>
  )
}

/** A 1px rule. Its own component so no screen writes a hairline by hand. */
export function Divider({ style, ...rest }: ViewProps) {
  return <View style={[styles.divider, style]} {...rest} />
}

/** Vertical rhythm between blocks, from the space scale. */
export function Spacer({ size = 'lg' }: { size?: keyof typeof space }) {
  return <View style={{ height: space[size] }} />
}

const styles = StyleSheet.create({
  unit: { color: color.textSubtle },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.border },
})
