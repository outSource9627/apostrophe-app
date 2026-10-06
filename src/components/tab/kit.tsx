import React, { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon, type IconName } from '../ui/Icon'
import { Sheet } from '../ui/overlay'
import { Body } from '../ui/Type'
import { Banner } from '../ui/Banner'
import { borderWidth, color, fontFamilyNative as FF, fontSize, opacity, radius } from '../../theme'

/**
 * The shared pieces of the three tab screens — My interviews, Account and
 * Chats (docs/interviews-profile-chat-final.html): a large title that collapses
 * into a compact bar, the skeleton, the empty block and the error block. Sizes
 * are the mockup's; colours and faces come from the theme. No shadows.
 */

/** Scroll position for a large title: wire `onScroll` to the list, draw `<CompactBar opacity={...} />`. */
export function useCollapsingTitle(onScrollJs?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void) {
  const y = useRef(new Animated.Value(0)).current
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true, listener: onScrollJs })
  const barOpacity = y.interpolate({ inputRange: [40, 80], outputRange: [0, 1], extrapolate: 'clamp' })
  return { onScroll, barOpacity }
}

export function CompactBar({ title, opacity: o }: { title: string; opacity: Animated.AnimatedInterpolation<number> }) {
  const insets = useSafeAreaInsets()
  return (
    <Animated.View pointerEvents="none" style={[s.compact, { paddingTop: insets.top, height: insets.top + 52, opacity: o }]}>
      <Text style={s.compactText}>{title}</Text>
    </Animated.View>
  )
}

export function LargeTitle({ title, right, children }: { title: string; /** A text action on the title's right edge. */ right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <View style={s.head}>
      {right ? (
        <View style={s.titleRow}>
          <Text accessibilityRole="header" style={[s.title, s.titleGrow]}>{title}</Text>
          {right}
        </View>
      ) : (
        <Text accessibilityRole="header" style={s.title}>{title}</Text>
      )}
      {children}
    </View>
  )
}

/** The Jobs section's header: a large "Jobs" title over For you / Saved / Applied, with counts where known. */
export function JobsTabs({
  active, counts, onFeed, onSaved, onApplied,
}: {
  active: 'For you' | 'Saved' | 'Applied'
  counts?: { Saved?: number; Applied?: number }
  onFeed?: () => void
  onSaved?: () => void
  onApplied?: () => void
}) {
  const go = { 'For you': onFeed, Saved: onSaved, Applied: onApplied }
  return (
    <View>
      <LargeTitle title="Jobs" />
      <View style={s.jobsSeg}>
        {(['For you', 'Saved', 'Applied'] as const).map((t) => {
          const on = t === active
          const n = t === 'Saved' ? counts?.Saved : t === 'Applied' ? counts?.Applied : undefined
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={on ? undefined : go[t]}
              style={[s.jobsSegBtn, on && s.jobsSegOn]}
            >
              <Text style={[s.jobsSegText, on && s.jobsSegTextOn]}>{t}</Text>
              {n != null && <Text style={[s.jobsSegCount, on && s.jobsSegTextOn]}>{n}</Text>}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/** A violet text action: "Connections", "Chats". */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress} style={s.linkWrap}>
      <Text style={s.linkText}>{label}</Text>
    </Pressable>
  )
}

/** A group label: Geist medium, sentence case. */
export function GroupLabel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={style}><Text style={s.group}>{children}</Text></View>
}

/** A pulsing placeholder. */
export function Skel({ w, h, round }: { w: number | `${number}%`; h: number; round?: boolean }) {
  const v = useRef(new Animated.Value(0.55)).current
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.55, duration: 650, useNativeDriver: true }),
    ]))
    a.start()
    return () => a.stop()
  }, [v])
  return <Animated.View style={{ width: w, height: h, borderRadius: round ? h / 2 : 10, backgroundColor: color.surfaceMuted, opacity: v }} />
}

/** Rows of avatar + three lines, for the chat list. */
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={s.skelRow}>
          <Skel w={48} h={48} round />
          <View style={s.skelText}><Skel w="55%" h={15} /><Skel w="75%" h={11} /><Skel w="90%" h={13} /></View>
        </View>
      ))}
    </View>
  )
}

export function StateBlock({
  icon, title, body, action, onAction,
}: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.block}>
      <View style={s.blockIcon}><Icon name={icon} size={30} tint={color.accent} /></View>
      <Text style={s.blockTitle}>{title}</Text>
      {!!body && <Text style={s.blockBody}>{body}</Text>}
      {!!action && (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [s.blockBtn, pressed && s.pressed]}>
          <Text style={s.blockBtnText}>{action}</Text>
        </Pressable>
      )}
    </View>
  )
}

/** Extended while idle, a round "+" once the list is scrolled down. */
export function BookFab({ label, compact, onPress, bottom = 16 }: { label: string; compact: boolean; onPress: () => void; bottom?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.fab, { bottom }, compact && s.fabCompact, pressed && s.pressed]}
    >
      <Icon name="plus" size={22} tint={color.textInverse} weight={2.2} />
      {!compact && <Text style={s.fabText}>{label}</Text>}
    </Pressable>
  )
}

/** The scroll direction as a boolean: true once the user is scrolling down past the title. */
export function useScrollingDown() {
  const last = useRef(0)
  const [down, setDown] = useState(false)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const next = y > last.current && y > 40
    if (next !== down && Math.abs(y - last.current) > 4) setDown(next)
    last.current = y
  }
  return { down, onScroll }
}

/** The back circle and screen title of a pushed screen (interview detail, thread). */
export function DetailHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.dHead}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={({ pressed }) => [s.dBack, pressed && s.pressed]}>
        <Icon name="arrowL" size={22} tint={color.text} />
      </Pressable>
      <Text style={[s.dTitle, s.titleGrow]}>{title}</Text>
      {right}
    </View>
  )
}

/** A bordered 18-radius panel. */
export function Panel({ children, style, tone = 'plain' }: { children: React.ReactNode; style?: ViewStyle; tone?: 'plain' | 'danger' | 'muted' }) {
  return <View style={[s.panel, tone === 'danger' && s.panelDanger, tone === 'muted' && s.panelMuted, style]}>{children}</View>
}

/** A 46-high button in the screens' own measurements: primary, outline, or dimmed. */
export function Btn({
  label, variant = 'primary', onPress, disabled, busy, style, accessibilityLabel,
}: { label: string; accessibilityLabel?: string; variant?: 'primary' | 'ink' | 'outline' | 'destructive' | 'quiet'; onPress?: () => void; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const off = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' && s.btnPrimary,
        variant === 'ink' && s.btnInk,
        variant === 'outline' && s.btnOutline,
        variant === 'destructive' && s.btnDestructive,
        disabled && s.btnDisabled,
        (pressed || busy) && s.pressed,
        style,
      ]}
    >
      <Text style={[s.btnText, (variant === 'primary' || variant === 'ink' || variant === 'destructive') && !disabled && s.btnTextOn, variant === 'quiet' && s.btnTextQuiet, disabled && s.btnTextOff]}>{label}</Text>
    </Pressable>
  )
}

/**
 * "Are you sure?" for the student app — the same sheet and button pair as the
 * Remove-video and Block sheets: the action on top (solid red when it takes
 * something away, ink when it only changes something), the way out under it in
 * quiet text. While the call runs the sheet cannot be dismissed; an error stays
 * in the sheet so the person can try again or back out.
 */
export function ConfirmSheet({
  open, title, body, confirmLabel, cancelLabel = 'Cancel', destructive, busy, error, onConfirm, onClose, children,
}: {
  open: boolean; title: string; body?: string; confirmLabel: string; cancelLabel?: string
  destructive?: boolean; busy?: boolean; error?: string | null
  onConfirm: () => void; onClose: () => void; children?: React.ReactNode
}) {
  return (
    <Sheet open={open} onClose={() => { if (!busy) onClose() }} title={title}>
      {!!body && <Body size="sm" tone="muted">{body}</Body>}
      {children}
      {!!error && <Banner tone="danger">{error}</Banner>}
      <View style={s.confirmButtons}>
        <Btn variant={destructive ? 'destructive' : 'ink'} busy={busy} label={confirmLabel} onPress={onConfirm} />
        <Btn variant="quiet" label={cancelLabel} disabled={busy} onPress={onClose} />
      </View>
    </Sheet>
  )
}

/** The bottom bar of a pushed screen: a stack of buttons on a white band. */
export function FooterBar({ children }: { children: React.ReactNode }) {
  return <View style={s.footer}>{children}</View>
}

const s = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  confirmButtons: { marginTop: 8, gap: 8 },
  dHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
  dBack: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border,
  },
  dTitle: { fontFamily: FF.bodyBold, fontSize: 18, letterSpacing: -0.36, color: color.text },
  panel: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, padding: 16, gap: 8 },
  panelDanger: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder },
  panelMuted: { backgroundColor: color.surfaceMuted },
  jobsSeg: { flexDirection: 'row', backgroundColor: color.surfaceMuted, borderRadius: 14, padding: 4, marginHorizontal: 20 },
  jobsSegBtn: { flex: 1, height: 40, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  jobsSegOn: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  jobsSegText: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.textMuted },
  jobsSegTextOn: { color: color.accent },
  jobsSegCount: { fontFamily: FF.bodyMedium, fontSize: 11, fontVariant: ['tabular-nums'], color: color.textMuted, opacity: 0.75 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleGrow: { flex: 1 },
  linkWrap: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.accent },
  btn: { height: 46, minWidth: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: color.accent },
  btnInk: { backgroundColor: color.ink },
  btnOutline: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  btnDestructive: { backgroundColor: color.dangerFill },
  btnDisabled: { backgroundColor: color.surfaceMuted, borderColor: color.surfaceMuted },
  btnText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.text },
  btnTextOn: { color: color.textInverse },
  btnTextQuiet: { color: color.textSecondary },
  btnTextOff: { color: color.textSubtle },
  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 8, backgroundColor: color.surface,
    borderTopWidth: borderWidth.thin, borderTopColor: color.border,
  },
  compact: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 20, justifyContent: 'center',
    backgroundColor: color.background, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border,
  },
  compactText: { fontFamily: FF.bodyBold, fontSize: 18, letterSpacing: -0.36, color: color.text, marginTop: 8 },
  head: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  title: { fontFamily: FF.bodyBold, fontSize: 30, lineHeight: 32, letterSpacing: -1.2, color: color.text },
  group: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.textMuted },

  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, minHeight: 88 },
  skelText: { flex: 1, gap: 9 },

  block: { alignItems: 'center', paddingHorizontal: 36, paddingTop: 60 },
  blockIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  blockTitle: { fontFamily: FF.bodyBold, fontSize: 22, letterSpacing: -0.66, color: color.text, textAlign: 'center' },
  blockBody: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.textMuted, textAlign: 'center', marginTop: 8 },
  blockBtn: {
    marginTop: 18, height: 46, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong,
  },
  blockBtnText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.text },

  fab: {
    position: 'absolute', right: 16, height: 52, borderRadius: radius.pill, backgroundColor: color.accent,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 20,
  },
  fabCompact: { paddingHorizontal: 15, gap: 0 },
  fabText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.textInverse },
})
