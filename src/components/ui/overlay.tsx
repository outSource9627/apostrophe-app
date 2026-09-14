import React from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { borderWidth, color, height, opacity, radius, space } from '../../theme'
import { Body, Display, Eyebrow } from './Type'
import { Button } from './Button'
import { text } from './typography'

/** Foundations §09 — navigation, sheets, modals. */

/**
 * Sheets carry confirmations and short forms.
 *
 * Grab handle, 22pt top radius, scrim at ink 40%. A destructive confirmation
 * uses this same shell with a danger-outlined action rather than a different,
 * scarier component — the shape stays familiar so only the action reads as
 * dangerous.
 */
export function Sheet({
  open, onClose, title, children, primary, secondary,
}: {
  open: boolean
  onClose?: () => void
  title?: string
  children?: React.ReactNode
  primary?: React.ReactNode
  secondary?: React.ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetWrap}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={styles.handle} />
          {!!title && <Display level="sm">{title}</Display>}
          {children}
          {!!(primary || secondary) && (
            <View style={styles.sheetActions}>
              {secondary}
              {primary}
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

/**
 * A toast confirms something that already happened and offers to undo it. Ink
 * ground — one of the three places ink is allowed to be a background — so it
 * reads as a layer over the screen rather than part of it.
 */
export function Toast({
  message, tone = 'success', actionLabel, onAction,
}: { message: string; tone?: 'success' | 'danger' | 'neutral'; actionLabel?: string; onAction?: () => void }) {
  const dot = { success: color.success, danger: color.danger, neutral: color.borderStrong }[tone]
  return (
    <View accessibilityLiveRegion="polite" style={styles.toast}>
      <View style={[styles.toastDot, { backgroundColor: dot }]} />
      <Body size="sm" weight="medium" tone="inverse" style={styles.grow}>
        {message}
      </Body>
      {!!actionLabel && (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.toastAction}>
          <Body size="xs" weight="semibold" tone="inverse">
            {actionLabel}
          </Body>
        </Pressable>
      )}
    </View>
  )
}

/**
 * ST-13: non-dismissible, pinned beneath the app bar on every screen an unpaid
 * lead can reach. There is deliberately no close affordance — the only way past
 * it is to pay, and pretending otherwise wastes the person's time.
 */
export function PaywallBanner({
  title = 'Payment pending', body, actionLabel = 'Pay now', onAction,
}: { title?: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.paywall}>
      <View style={styles.grow}>
        <Body size="sm" weight="semibold">
          {title}
        </Body>
        <Body size="xs" tone="muted">
          {body}
        </Body>
      </View>
      <Button size="sm" label={actionLabel} onPress={onAction} />
    </View>
  )
}

/** The screen's top bar: back, title, and one status or action on the right. */
export function AppBar({
  title, onBack, status, action,
}: { title: string; onBack?: () => void; status?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.appBar}>
      {!!onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
          <Svg viewBox="0 0 16 16" width={space.lg} height={space.lg}>
            <Path d="M10 2 4 8l6 6" stroke={color.textMuted} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      )}
      <Body size="lg" numberOfLines={1} style={styles.grow}>
        {title}
      </Body>
      {status}
      {action}
    </View>
  )
}

export type TabItem = { key: string; label: string; glyph?: React.ReactNode; badge?: number }

/**
 * The five destinations after onboarding.
 *
 * iOS and Android carry the same information with native manners, which the
 * foundations document is explicit about: iOS gets a translucent bar and a dot
 * badge; Android gets an opaque bar and the pill-shaped active indicator that
 * Material 3 uses, with numeric badges. Shipping one of these on both platforms
 * is the single most common way an app reads as "not really native here".
 *
 * No icon set exists yet, so each tab carries a marked glyph slot at 24×24 —
 * pass `glyph` to swap it 1:1 when the set arrives.
 */
export function TabBar({
  items, current, onSelect,
}: { items: readonly TabItem[]; current: string; onSelect?: (key: string) => void }) {
  const insets = useSafeAreaInsets()
  const android = Platform.OS === 'android'
  return (
    <View style={[styles.tabBar, android ? styles.tabBarAndroid : styles.tabBarIos, { paddingBottom: insets.bottom }]}>
      {items.map((it) => {
        const active = it.key === current
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect?.(it.key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: opacity.pressed }]}
          >
            <View style={android && active ? styles.tabIndicator : styles.tabIndicatorOff}>
              <View style={[styles.glyph, active ? styles.glyphOn : styles.glyphOff]}>{it.glyph}</View>
              {!!it.badge && (
                <View style={styles.badge}>
                  {android ? (
                    <Text style={[text.metaXs, styles.badgeText]}>{it.badge}</Text>
                  ) : null}
                </View>
              )}
            </View>
            <Text
              style={[
                android ? text.metaSm : text.metaSm,
                styles.tabLabel,
                { color: active ? color.accent : android ? color.textMuted : color.textSubtle },
              ]}
            >
              {it.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** A labelled group heading inside a settings or detail list. */
export function ListSection({ label, children, style }: { label: string; children: React.ReactNode } & ViewProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Eyebrow>{label}</Eyebrow>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },

  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.md,
  },
  handle: {
    alignSelf: 'center',
    width: height.avatar,
    height: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.borderStrong,
    marginBottom: space.md,
  },
  sheetActions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.text,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  toastDot: { width: space.lg, height: space.lg, borderRadius: radius.pill },
  toastAction: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.textOnInkSubtle },

  paywall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.accentSoft,
    borderWidth: borderWidth.thin,
    borderColor: color.accentMuted,
    borderRadius: radius.md,
    padding: space.lg,
  },

  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: height['app-bar'],
    paddingHorizontal: space.lg,
    backgroundColor: color.surfaceMuted,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  back: {
    width: height.avatar,
    height: height.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.sm,
  },
  tabBarIos: { backgroundColor: color.surfaceMuted },
  tabBarAndroid: { backgroundColor: color.surface },
  tab: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  tabIndicator: {
    width: height['app-bar'],
    height: height['tab-indicator'],
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicatorOff: { alignItems: 'center', justifyContent: 'center' },
  glyph: {
    width: height.glyph,
    height: height.glyph,
    borderRadius: radius.sm,
    borderWidth: borderWidth.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphOn: { borderColor: color.accent, backgroundColor: color.accentSoft },
  glyphOff: { borderColor: color.borderStrong },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: space.lg,
    height: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['2xs'],
  },
  badgeText: { color: color.textInverse },
  tabLabel: { letterSpacing: 0 },

  section: { marginBottom: space.xl },
  sectionHead: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: color.surfaceMuted,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  sectionBody: {
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
})
