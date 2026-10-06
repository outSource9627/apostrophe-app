import React, { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { borderWidth, color, height, opacity, radius, space } from '../../theme'
import { Body, Display, Eyebrow } from './Type'
import { Button } from './Button'
import { text } from './typography'
import { Icon, type IconName } from './Icon'

/** Foundations §09 — navigation, sheets, modals. */

/**
 * Sheets carry confirmations and short forms.
 *
 * Grab handle, 24pt top radius, scrim at ink 40%. A destructive confirmation
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
}: { title?: string; onBack?: () => void; status?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.appBar}>
      {!!onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
          <Svg viewBox="0 0 24 24" width={height.glyph - 2} height={height.glyph - 2} fill="none">
            <Path d="M19 12H5M11 6l-6 6 6 6" stroke={color.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      )}
      {title ? (
        <Text style={[text.displayXs, styles.grow]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.grow} />
      )}
      {status}
      {action}
    </View>
  )
}

export type TabItem = {
  key: string; label: string; glyph?: React.ReactNode; badge?: number
  /** Not usable yet (an unverified employer): dimmed, a padlock on the icon, and the press does nothing. */
  locked?: boolean
  /** A small accent dot for unread, without a number. */
  dot?: boolean
}

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
  items, current, onSelect, floating = false, dark = false,
}: {
  items: readonly TabItem[]; current: string; onSelect?: (key: string) => void; floating?: boolean
  /** Drawn on ink, under the black video feed (docs/tinder-feed-mockups.html). The glyphs are the caller's to tint. */
  dark?: boolean
}) {
  const insets = useSafeAreaInsets()
  const android = Platform.OS === 'android'
  const onLabel = dark ? color.accentMuted : color.accentText
  // The student app's bar: a white pill floating over the page, the active tab lit in violet.
  if (floating) {
    return (
      <View style={[styles.floatWrap, dark && styles.floatWrapDark, { paddingBottom: Math.max(insets.bottom, space.sm) + space.xs }]}>
        <View style={[styles.floatBar, dark && styles.floatBarDark]}>
          {items.map((it) => {
            const active = it.key === current
            return (
              <Pressable
                key={it.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect?.(it.key)}
                style={({ pressed }) => [styles.floatTab, active && (dark ? styles.floatTabOnDark : styles.floatTabOn), pressed && { opacity: opacity.pressed }]}
              >
                {it.glyph}
                <Text style={[text.uiXsSemi, { color: active ? onLabel : dark ? color.textOnInkSubtle : color.textSubtle }]}>{it.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }
  const offLabel = dark ? color.textOnInkSubtle : android ? color.textMuted : color.textSubtle
  return (
    <View style={[styles.tabBar, dark ? styles.tabBarDark : android ? styles.tabBarAndroid : styles.tabBarIos, { paddingBottom: insets.bottom }]}>
      {items.map((it) => {
        const active = it.key === current
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: it.locked }}
            accessibilityHint={it.locked ? 'Opens once your company is verified' : undefined}
            disabled={it.locked}
            onPress={() => onSelect?.(it.key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: opacity.pressed }]}
          >
            <View style={android && active ? [styles.tabIndicator, dark && styles.tabIndicatorDark] : styles.tabIndicatorOff}>
              {it.glyph ? it.glyph : <View style={[styles.glyph, active ? styles.glyphOn : styles.glyphOff]} />}
              {it.locked && (
                <View style={styles.lock}><Icon name="lock" size={space.md - 1} tint={color.textDisabled} weight={borderWidth.accent + 0.2} /></View>
              )}
              {it.dot && !it.locked && <View style={styles.dot} />}
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
                active ? text.uiXsSemi : text.uiXsMedium,
                { color: active ? onLabel : it.locked ? (dark ? color.textOnInkSubtle : color.textDisabled) : offLabel },
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

/** Where a popover opens from, in window coordinates: a measured view, or a touch point (zero size). */
export type MenuAnchor = { x: number; y: number; width: number; height: number }
export type PopoverItem = { key: string; label: string; icon?: IconName; danger?: boolean; onPress: () => void }

/** Measures a view for `PopoverMenu`. Resolves null when the view has gone. */
export function measureAnchor(node: React.ComponentRef<typeof View> | null): Promise<MenuAnchor | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null)
    node.measureInWindow((x, y, width, h) => resolve({ x, y, width, height: h }))
  })
}

/**
 * A small menu that opens beside what was tapped — a row's ⋯, or a long-pressed
 * row — rather than a sheet from the bottom. Its right edge lines up with the
 * anchor's, it drops below unless there is no room, and it stays on screen.
 * Sized to its rows, so it carries no width of its own. Any tap outside, or
 * Android back, closes it; choosing a row closes it first, then acts.
 */
export function PopoverMenu({ anchor, items, onClose }: { anchor: MenuAnchor | null; items: readonly PopoverItem[]; onClose: () => void }) {
  const win = useWindowDimensions()
  // Measured per anchor, so a menu reopened somewhere else never draws at the last one's size.
  const [measured, setMeasured] = useState<{ w: number; h: number; at: MenuAnchor } | null>(null)
  if (!anchor) return null
  const box = measured?.at === anchor ? measured : null
  const edge = space.md
  const left = box ? Math.min(Math.max(anchor.x + anchor.width - box.w, edge), win.width - box.w - edge) : 0
  const below = anchor.y + anchor.height + space.xs
  const top = box && below + box.h > win.height - space['2xl'] ? Math.max(space['2xl'], anchor.y - box.h - space.xs) : below
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close menu" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View
        accessibilityRole="menu"
        onLayout={(e) => { const { width: w, height: h } = e.nativeEvent.layout; if (!box || box.w !== w || box.h !== h) setMeasured({ w, h, at: anchor }) }}
        style={[styles.popover, { left, top, opacity: box ? 1 : 0 }]}
      >
        {items.map((it, i) => (
          <Pressable
            key={it.key}
            accessibilityRole="menuitem"
            onPress={() => { onClose(); it.onPress() }}
            style={({ pressed }) => [styles.popRow, i > 0 && styles.popRule, pressed && styles.popPressed]}
          >
            {!!it.icon && <Icon name={it.icon} size={space.lg} tint={it.danger ? color.danger : color.text} />}
            <Text style={[text.uiBaseMedium, { color: it.danger ? color.danger : color.text }]}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
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
    borderTopLeftRadius: radius.frame,
    borderTopRightRadius: radius.frame,
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

  // The design's drill-in header: no fill, no rule, a bare 48 back target (Android M2/M3/M5).
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: height['screen-header'],
    paddingHorizontal: space.md,
  },
  back: {
    width: height.control,
    height: height.control,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingTop: space.sm,
  },
  floatWrap: { backgroundColor: color.background, paddingHorizontal: 14, paddingTop: space.sm },
  floatBar: {
    height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 24, paddingHorizontal: space.xs,
  },
  floatTab: { alignItems: 'center', gap: space['2xs'], paddingVertical: 7, paddingHorizontal: space.sm, borderRadius: 14, minWidth: 60 },
  floatTabOn: { backgroundColor: color.accentSoft },
  floatWrapDark: { backgroundColor: color.inkDeep },
  floatBarDark: { backgroundColor: color.inkRaised, borderColor: color.onInkHairline },
  floatTabOnDark: { backgroundColor: color.accentOnInkSoft },
  tabBarIos: { backgroundColor: color.surfaceMuted },
  tabBarAndroid: { backgroundColor: color.surface },
  tabBarDark: { backgroundColor: color.inkDeep, borderTopWidth: 0 },
  tab: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  tabIndicator: {
    width: height['tab-pill-w'],
    height: height['tab-pill-h'],
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicatorDark: { backgroundColor: color.accentOnInkSoft },
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
  lock: { position: 'absolute', top: 0, right: space.xs },
  dot: { position: 'absolute', top: space['2xs'], right: space.md, width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.accent, borderWidth: borderWidth.accent, borderColor: color.surface },

  popover: {
    position: 'absolute',
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.panel,
    paddingVertical: space.xs,
    overflow: 'hidden',
    shadowColor: color.ink,
    shadowOpacity: 0.12,
    shadowRadius: radius.lg,
    shadowOffset: { width: 0, height: space.md },
    elevation: 8,
  },
  popRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: height.control, paddingLeft: space.lg, paddingRight: space['2xl'] },
  popRule: { borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },
  popPressed: { backgroundColor: color.surfaceMuted },

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
