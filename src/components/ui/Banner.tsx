import React, { type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { color, radius, space, fontSize, fontFamilyNative, trackingNative, leadingNative, fontWeight } from '../../theme'

export type BannerTone = 'danger' | 'warning' | 'info' | 'neutral' | 'success'

interface Props {
  tone?: BannerTone
  title?: string
  actionLabel?: string
  onAction?: () => void
  reference?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

const TONE_STYLES = {
  danger: { bg: color.dangerSoft, fg: color.danger },
  warning: { bg: color.warningSoft, fg: color.warning },
  info: { bg: color.infoSoft, fg: color.info },
  neutral: { bg: color.surfaceMuted, fg: color.text },
  success: { bg: color.successSoft, fg: color.success },
}

export function Banner({
  tone = 'info',
  title,
  actionLabel,
  onAction,
  reference,
  style,
  children,
}: Props) {
  const t = TONE_STYLES[tone]

  return (
    <View style={[styles.container, { backgroundColor: t.bg }, style]}>
      <View style={styles.topRow}>
        <View style={styles.iconSlot}>
          {tone === 'danger' && (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.fg} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 7.5v5" />
              <Path d="M12 16.2h.01" />
            </Svg>
          )}
          {tone === 'warning' && (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.fg} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 7.2v5.1l3.2 1.9" />
            </Svg>
          )}
          {tone === 'info' && (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.fg} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="m5.64 5.64 12.72 12.72" />
            </Svg>
          )}
          {tone === 'success' && (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.fg} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m20 6-11 11-5-5" />
            </Svg>
          )}
        </View>

        <View style={styles.content}>
          {!!title && <Text style={[styles.title, { color: t.fg }]}>{title}</Text>}
          {typeof children === 'string' ? (
            <Text style={[styles.body, { color: t.fg }]}>{children}</Text>
          ) : (
            children
          )}
        </View>
      </View>

      {(!!actionLabel || !!reference) && (
        <View style={styles.bottomRow}>
          {!!actionLabel && (
            <Pressable onPress={onAction} hitSlop={8}>
              <Text style={[styles.action, { color: t.fg }]}>{actionLabel}</Text>
            </Pressable>
          )}
          {!!reference && (
            <Text style={[styles.reference, { color: t.fg }]}>{reference}</Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  iconSlot: {
    marginTop: space['2xs'],
    width: space.lg,
    height: space.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: space['2xs'],
  },
  title: {
    fontSize: fontSize['ui-sm'],
    fontWeight: fontWeight.semibold,
    lineHeight: leadingNative['ui-xs'],
  },
  body: {
    fontSize: fontSize['ui-xs'],
    lineHeight: leadingNative['ui-xs'],
  },
  bottomRow: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  action: {
    fontSize: fontSize['ui-sm'],
    fontWeight: fontWeight.medium,
    textDecorationLine: 'underline',
  },
  reference: {
    fontSize: fontSize['meta-md'],
    fontFamily: fontFamilyNative.mono,
    letterSpacing: trackingNative['meta-wide'],
    textTransform: 'uppercase',
  },
})
