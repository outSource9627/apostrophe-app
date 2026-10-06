import React from 'react'
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../ui/Icon'
import { borderWidth, color, fontFamilyNative as FF, fontSize, opacity } from '../../theme'
import { FooterBar } from './kit'

/**
 * Small presentation pieces shared by the student booking / payment / room /
 * scorecard screens (docs/student-booking-interview-mockup.html, option A).
 * Sizes are the mockup's; colours and faces come from the theme. No shadows.
 * Presentation only: nothing here fetches, navigates or decides anything.
 */

/** The back circle, a title and an optional grey sub-line (e.g. "IST · Asia/Kolkata"). `onClose` swaps the arrow for a cross. */
export function FlowHeader({
  title, subtitle, onBack, onClose, tone = 'light',
}: { title?: string; subtitle?: string; onBack?: () => void; onClose?: () => void; tone?: 'light' | 'dark' }) {
  const act = onBack ?? onClose
  const dark = tone === 'dark'
  return (
    <View style={s.head}>
      {act ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onBack ? 'Back' : 'Close'}
          hitSlop={8}
          onPress={act}
          style={({ pressed }) => [s.back, dark && s.backDark, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name={onBack ? 'arrowL' : 'x'} size={22} tint={dark ? color.textOnInk : color.text} />
        </Pressable>
      ) : (
        <View style={s.backGap} />
      )}
      <View style={s.headText}>
        {!!title && <Text accessibilityRole="header" style={[s.title, dark && { color: color.textOnInk }]}>{title}</Text>}
        {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  )
}

type EyebrowTone = 'muted' | 'accent' | 'ok' | 'danger' | 'warn'
const EYEBROW: Record<EyebrowTone, string> = {
  muted: color.textMuted, accent: color.accent, ok: color.success, danger: color.danger, warn: color.warning,
}
/** An eyebrow in one of the mockup's tones: Geist medium, sentence case. */
export function Eyebrow({ children, tone = 'muted', style }: { children: React.ReactNode; tone?: EyebrowTone; style?: TextStyle }) {
  return <Text style={[s.eyebrow, { color: EYEBROW[tone] }, style]}>{children}</Text>
}

/** The 28px screen headline. */
export function Lead({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text accessibilityRole="header" style={[s.lead, style]}>{children}</Text>
}

/** 15px secondary copy. */
export function Sub({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.sub, style]}>{children}</Text>
}

/** The 56px result disc: a tick, an exclamation or a spinner sits in it. */
export function Disc({ tone, children }: { tone: 'ok' | 'warn' | 'accent' | 'danger'; children: React.ReactNode }) {
  const bg = tone === 'ok' ? color.successSoft : tone === 'warn' ? color.warningSoft : tone === 'danger' ? color.dangerSoft : color.accentSoft
  return <View style={[s.disc, { backgroundColor: bg }]}>{children}</View>
}

/** A label on the left, a value on the right. */
export function KV({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <View style={s.kv}>
      <Text style={big ? s.kvKeyStrong : s.kvKey}>{k}</Text>
      <Text style={big ? s.big : s.kvVal}>{v}</Text>
    </View>
  )
}

/** A hairline. */
export function Rule({ style }: { style?: ViewStyle }) {
  return <View style={[s.rule, style]} />
}

/** The 22px figure used for prices. */
export function Big({ children }: { children: React.ReactNode }) {
  return <Text style={s.big}>{children}</Text>
}

/** A 12px fine-print line: Geist medium, sentence case. */
export function Fine({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.fine, style]}>{children}</Text>
}

/** The footer band, kept clear of the system gesture bar. */
export function FlowFooter({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ backgroundColor: color.surface, paddingBottom: insets.bottom }}>
      <FooterBar>{children}</FooterBar>
    </View>
  )
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, minHeight: 60 },
  back: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  backDark: { backgroundColor: color.onInkGround, borderColor: color.onInkEdge },
  backGap: { width: 6 },
  headText: { flex: 1 },
  title: { fontFamily: FF.bodyBold, fontSize: 18, letterSpacing: -0.36, color: color.text },
  subtitle: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.textMuted, marginTop: 2 },
  eyebrow: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'] },
  lead: { fontFamily: FF.bodySemiBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.56, color: color.text },
  sub: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.textMuted },
  disc: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  kv: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 },
  kvKey: { fontFamily: FF.body, fontSize: 15, color: color.textMuted },
  kvKeyStrong: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  kvVal: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  big: { fontFamily: FF.bodySemiBold, fontSize: 22, letterSpacing: -0.33, color: color.text },
  rule: { height: borderWidth.thin, backgroundColor: color.border },
  fine: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], color: color.textSubtle },
})
