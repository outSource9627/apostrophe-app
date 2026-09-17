import React from 'react'
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { color, radius, height, fontSize, fontWeight, space, opacity, borderWidth } from '../../theme'

interface Props extends PressableProps {
  label?: string
  disabled?: boolean
}

export function GoogleButton({ label = 'Continue with Google', disabled = false, style, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style as object,
      ]}
      {...rest}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.textMuted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <Path d="M21 12h-8" />
      </Svg>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: height['control-sm'], // 44
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm, // 10
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
  },
  label: {
    fontSize: fontSize['ui-md'],
    fontWeight: fontWeight.semibold,
    color: color.text,
  },
  disabled: {
    backgroundColor: color.surfaceSunken,
    borderColor: color.border,
  },
  pressed: {
    opacity: opacity.pressed,
  },
})
