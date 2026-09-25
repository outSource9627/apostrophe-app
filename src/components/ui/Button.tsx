import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native'
import { borderWidth, color, height, opacity, radius, space } from '../../theme'
import { Body } from './Type'
import { text } from './typography'
import { Icon, type IconName } from './Icon'

/**
 * Foundations §05 — buttons and controls.
 *
 * Three rules are built in rather than left to each screen, because all three
 * erode quietly once they are only a convention:
 *
 *   One red button per screen, maximum. The accent marks THE action; a screen
 *   with two has told the person nothing.
 *
 *   Destructive is never red. Red is the brand and danger is its own colour —
 *   collapsing them makes "pay now" and "withdraw" look alike.
 *
 *   A disabled button carries its reason. `reason` renders beneath it, because
 *   a dead control with no explanation is how a product loses someone at the
 *   last step.
 */

type Variant = 'primary' | 'secondary' | 'outline' | 'quiet' | 'text' | 'destructive' | 'dangerFill' | 'ghost' | 'dangerText'
type Size = 'lg' | 'cta' | 'block' | 'pair' | 'md' | 'sm'

const SIZE_HEIGHT: Record<Size, number> = {
  lg: height['control-lg'],
  /** 50 — the full-width action that closes a phone card (Employer Android). */
  cta: height['control-cta'],
  block: height['control-block'],
  /** 46 — the dark action inside an employer card. */
  pair: height['control-md'],
  md: height['control-sm'],
  sm: height['control-xs'],
}

export function Button({
  variant = 'primary',
  size = 'md',
  busy = false,
  disabled = false,
  reason,
  full = false,
  label,
  icon,
  style,
  ...rest
}: {
  /** A leading glyph from the shared icon set, tinted like the label. */
  icon?: IconName
  variant?: Variant
  size?: Size
  /** In flight. Keeps its colour and blocks input — working, not unavailable. */
  busy?: boolean
  /** Why this is unavailable. Rendered beneath the control. */
  reason?: string
  full?: boolean
  label: string
} & Omit<PressableProps, 'children' | 'style'> & { style?: PressableProps['style'] }) {
  const off = disabled || busy
  const onDark = variant === 'primary' || variant === 'secondary' || variant === 'dangerFill'
  const tint = disabled
    ? color.textSubtle
    : { primary: color.textInverse, secondary: color.textInverse, outline: color.text, quiet: color.text, text: color.accent, destructive: color.danger, dangerFill: color.textInverse, ghost: color.textSecondary, dangerText: color.danger }[variant]

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        { height: SIZE_HEIGHT[size] },
        variantStyles[disabled ? 'disabled' : variant],
        full && styles.full,
        pressed && !off && { opacity: opacity.pressed },
        style as object,
      ]}
      {...rest}
    >
      {busy && <ActivityIndicator size="small" color={onDark ? color.textInverse : color.textMuted} />}
      {!!icon && !busy && <Icon name={icon} size={size === 'lg' ? space.lg + space.xs : space.lg + space['2xs']} tint={tint} />}
      {size === 'lg' ? (
        <Text style={[text.uiLeadSemi, { color: tint }]}>{label}</Text>
      ) : (
        <Body size={size === 'sm' ? 'sm' : 'md'} weight="semibold" style={{ color: tint }}>
          {label}
        </Body>
      )}
    </Pressable>
  )

  if (!reason) return button
  return (
    <View style={full ? styles.full : undefined}>
      {button}
      <Body size="xs" tone="muted" style={styles.reason}>
        {reason}
      </Body>
    </View>
  )
}

/**
 * A circular icon-only control — pass and save on the job feed, the overflow
 * beside a next-action block. Never smaller than the tap floor.
 */
export function IconButton({
  tone = 'outline', size = 'md', label, style, children, ...rest
}: {
  tone?: 'outline' | 'accent' | 'ink'
  size?: 'md' | 'lg'
  /** Required — an icon-only control is invisible to a screen reader without it. */
  label: string
  children?: React.ReactNode
} & Omit<PressableProps, 'children' | 'style'> & { style?: PressableProps['style'] }) {
  const box = size === 'lg' ? height['control-block'] + space.sm : height.tap
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.icon,
        { width: box, height: box },
        iconTones[tone],
        pressed && { opacity: opacity.pressed },
        style as object,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
  },
  full: { alignSelf: 'stretch' },
  reason: { marginTop: space.sm },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
})

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: color.accent },
  secondary: { backgroundColor: color.ink },
  outline: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  quiet: { backgroundColor: color.surfaceMuted },
  text: { backgroundColor: color.background },
  destructive: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.dangerBorder },
  dangerFill: { backgroundColor: color.dangerFill },
  ghost: { backgroundColor: 'transparent' },
  /** The design's red link (H.btn 'redlink'): Delete beside Apply. */
  dangerText: { backgroundColor: 'transparent', paddingHorizontal: space.xs },
  disabled: { backgroundColor: color.surfaceSunken },
})

const iconTones = StyleSheet.create({
  outline: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.borderStrong },
  /** The save action on the feed — the one coloured shadow in the system. */
  accent: {
    backgroundColor: color.accent,
    shadowColor: color.accent,
    shadowOpacity: 0.4,
    shadowRadius: radius.lg,
    shadowOffset: { width: 0, height: space.sm },
    elevation: 6,
  },
  ink: { backgroundColor: color.ink },
})

export { text }
