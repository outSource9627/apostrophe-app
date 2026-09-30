import React from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type ViewProps } from 'react-native'
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { LogoMark } from '../Logo'
import { Body } from './Type'
import { Input } from './fields'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { text } from './typography'

/**
 * The Student app's shell pieces — the ones the Android design draws on every
 * screen rather than on one: the top bar, the credit chip, the avatar, the ink
 * feature card and the floating action.
 *
 * Nothing here holds a raw value. A re-brand or a re-size is a token change.
 */

/** The violet square carrying the mark — the design's brand tile (M4). */
export function BrandMark() {
  return (
    <View style={styles.brandTile}>
      <LogoMark size={height['brand-mark'] * 0.5} fill={color.textInverse} />
    </View>
  )
}

/** The initials disc in the top bar. `onPress` makes it the way into the account menu. */
export function Avatar({ initials, onPress }: { initials: string; onPress?: () => void }) {
  const disc = (
    <View style={styles.avatar}>
      <Text style={[text.uiXs, styles.avatarText]}>{initials}</Text>
    </View>
  )
  if (!onPress) return disc
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={onPress} hitSlop={space.sm}>
      {disc}
    </Pressable>
  )
}

/** "1 CREDIT" — mono on the accent wash. Not a status, so it does not take the status pill's tracking. */
export function CreditChip({ label }: { label: string }) {
  return (
    <View style={styles.credit}>
      <Text style={[text.metaMd, styles.creditText]}>{label}</Text>
    </View>
  )
}

/**
 * The top-level top bar: the brand on the left, whatever the screen needs on
 * the right (credit chip, avatar). Drill-in screens keep `AppBar`.
 */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <BrandMark />
        <Text style={[text.uiLgSemi, styles.wordmark]}>Apostrophe</Text>
      </View>
      <View style={styles.headerRight}>{children}</View>
    </View>
  )
}

/** The arrow every drill-in header leads with. */
function BackArrow() {
  return (
    <Svg width={height.glyph - 2} height={height.glyph - 2} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M11 6l-6 6 6 6" stroke={color.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** A close cross, for a header that ends a flow rather than stepping back. */
function CloseCross() {
  return (
    <Svg width={height.glyph - 4} height={height.glyph - 4} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color.text} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

/**
 * The drill-in header (Android M2, M3, M5, M9): a 48 back target, then an
 * optional title with a muted line under it. No fill and no rule — it sits on
 * the page ground. `onClose` swaps the arrow for a cross, right-aligned (M6).
 */
export function ScreenHeader({
  title, subtitle, onBack, onClose, right,
}: { title?: string; subtitle?: string; onBack?: () => void; onClose?: () => void; right?: React.ReactNode }) {
  return (
    <View style={[styles.screenHeader, onClose && !onBack && styles.screenHeaderEnd]}>
      {!!onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.headerTap}>
          <BackArrow />
        </Pressable>
      )}
      {(!!title || !!subtitle) && (
        <View style={styles.headerTitle}>
          {!!title && <Text style={text.displayXs} numberOfLines={1}>{title}</Text>}
          {!!subtitle && <Text style={[text.uiXs, styles.headerSub]} numberOfLines={1}>{subtitle}</Text>}
        </View>
      )}
      {right}
      {!!onClose && !onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.headerTap}>
          <CloseCross />
        </Pressable>
      )}
    </View>
  )
}

/** The title row of a bottom-bar screen (Jobs, My interviews, Chats): 22 at 600, nothing to go back to. */
export function TabTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.tabTitle}>
      <Text style={text.displaySm}>{title}</Text>
      {right}
    </View>
  )
}

/**
 * One choice in a 2-up grid (Android M10's qualification, M2's option tiles):
 * 48 tall, 12 radius. Selected is white with a 1.5 ink ring; an unselected tile
 * sits on the muted ground with a hairline.
 */
export function OptionTile({
  label, selected, onPress, disabled,
}: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, selected ? styles.tileOn : styles.tileOff, pressed && { opacity: opacity.pressed }]}
    >
      <Text style={[selected ? text.uiMdSemi : text.uiMd, { color: selected ? color.text : color.textMuted }]}>{label}</Text>
    </Pressable>
  )
}

/** The +91 mobile field (Android M1/M10): a fixed prefix, a hairline, then the number. */
export function PhoneInput({
  value, onChangeText, editable = true, invalid = false, textContentType,
}: {
  value: string
  onChangeText: (next: string) => void
  editable?: boolean
  invalid?: boolean
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType']
}) {
  return (
    <View style={[styles.phone, invalid && styles.phoneInvalid]}>
      <View style={styles.prefix}>
        <Body size="base" tone="muted">+91</Body>
      </View>
      <Input
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/\D/g, '').slice(0, 10))}
        keyboardType="number-pad"
        textContentType={textContentType}
        placeholder="98765 43210"
        editable={editable}
        style={styles.phoneInput}
      />
    </View>
  )
}

/**
 * A feature card on the ink ground with the violet bloom in its top-right
 * corner. The bloom is a radial gradient drawn in SVG because RN has no CSS
 * gradient; it is the accent at 45%, fading out by 70% of the radius.
 */
export function InkCard({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.ink, style]} {...rest}>
      <View style={styles.glow} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="inkGlow" cx="100%" cy="0%" rx="80%" ry="90%" fx="100%" fy="0%">
              <Stop offset="0" stopColor={color.accent} stopOpacity={0.45} />
              <Stop offset="0.7" stopColor={color.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#inkGlow)" />
        </Svg>
      </View>
      {children}
    </View>
  )
}

/** The pill on an ink card — "UPCOMING". */
export function InkPill({ label }: { label: string }) {
  return (
    <View style={styles.inkPill}>
      <Text style={[text.metaPill, styles.inkPillText]}>{label}</Text>
    </View>
  )
}

/** The two buttons on an ink card: a white fill and a hairline ghost. */
export function InkButton({
  variant = 'solid', label, style, ...rest
}: { variant?: 'solid' | 'ghost'; label: string } & Omit<PressableProps, 'children' | 'style'> & { style?: ViewProps['style'] }) {
  const solid = variant === 'solid'
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.inkButton, solid ? styles.inkButtonSolid : styles.inkButtonGhost, pressed && { opacity: opacity.pressed }, style]}
      {...rest}
    >
      <Body size="md" weight={solid ? 'semibold' : 'regular'} style={{ color: solid ? color.text : color.textInverse }}>
        {label}
      </Body>
    </Pressable>
  )
}

/** The states of the student's one film (`GET /students/me/video-resume`). */
export type FilmThumbStatus = 'NONE' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'UNPUBLISHED'

/**
 * A 9:16 still for the student's film, in whichever state it is.
 *
 * Only PUBLISHED is footage: slate into ink with a play mark (drawn in SVG, no CSS
 * gradient on RN), and the real poster over it when the app has one. Every other state
 * gets its own ground and glyph, so a dark rectangle with a play mark can only ever
 * mean "there is footage behind this" — the same rule the web `FilmThumb` follows.
 *
 *   PROCESSING   paper-muted with a spinner: something is being made
 *   FAILED       the rose well with a mark: nothing was made
 *   UNPUBLISHED  paper-muted with the eye-off glyph: it exists and is withheld
 *   NONE         the dashed placeholder, for a film that was never made
 *
 * `width` overrides the list-row size for a thumb that stands alone on a card.
 */
export function FilmThumb({
  status = 'PUBLISHED', posterUrl, width,
}: { status?: FilmThumbStatus; posterUrl?: string | null; width?: number }) {
  const size = width ? { width } : null

  if (status === 'PUBLISHED') {
    return (
      <View style={[styles.thumb, size]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="filmThumb" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.textSecondary} />
              <Stop offset="1" stopColor={color.inkRaised} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#filmThumb)" />
        </Svg>
        {!!posterUrl && <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        {/* Over a real still the mark needs a ground of its own; over the plain footage ground it is the bare triangle. */}
        <View style={posterUrl ? styles.thumbPlayGlass : undefined}>
          <Svg width={height['thumb-play']} height={height['thumb-play']} viewBox="0 0 10 10">
            <Path d="M2.5 1.5L8.5 5L2.5 8.5Z" fill={color.textInverse} />
          </Svg>
        </View>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.thumb,
        styles.thumbState,
        status === 'FAILED' && styles.thumbFailed,
        status === 'NONE' && styles.thumbNone,
        size,
      ]}
    >
      {status === 'PROCESSING' && <ActivityIndicator color={color.warning} />}
      {status === 'FAILED' && <Text style={[text.displayXs, { color: color.danger }]}>!</Text>}
      {status === 'UNPUBLISHED' && (
        <Svg width={space.xl} height={space.xl} viewBox="0 0 24 24" fill="none" stroke={color.textSubtle} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 3l18 18" />
          <Path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.6 3.8" />
          <Path d="M6.2 6.4C3.9 7.9 3 10.2 3 12c0 2.5 4 7 9 7a9.6 9.6 0 0 0 4.2-1" />
          <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </Svg>
      )}
      {status === 'NONE' && (
        <Svg width={space.xl} height={space.xl} viewBox="0 0 24 24" fill="none" stroke={color.borderStrong} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
          <Path d="m15.5 12 6-3.5v7Z" />
        </Svg>
      )}
    </View>
  )
}

/**
 * The extended floating action — "Book interview". Sits above the tab bar, so
 * it positions itself against whatever container the screen gives it.
 */
export function Fab({ label, onPress, glyph }: { label: string; onPress: () => void; glyph?: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: opacity.pressed }]}
    >
      {glyph}
      <Text style={[text.uiBaseSemi, styles.fabText]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  brandTile: {
    width: height['brand-mark'],
    height: height['brand-mark'],
    borderRadius: radius.ctl,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: height['avatar-lg'],
    height: height['avatar-lg'],
    borderRadius: radius.pill,
    backgroundColor: color.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: color.textInverse },
  credit: {
    paddingHorizontal: spaceHalf['2.5'],
    paddingVertical: spaceHalf['1.5'],
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
  },
  creditText: { color: color.accentText, textTransform: 'uppercase' },

  header: {
    height: height['top-bar'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  wordmark: { color: color.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  ink: {
    backgroundColor: color.ink,
    borderRadius: radius['card-lg'],
    padding: spaceHalf['4.5'],
    gap: spaceHalf['2.5'],
    overflow: 'hidden',
  },
  screenHeader: {
    height: height['screen-header'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
  },
  screenHeaderEnd: { justifyContent: 'flex-end' },
  headerTap: { width: height.control, height: height.control, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 },
  headerSub: { color: color.textMuted },
  tabTitle: {
    height: height['tab-title'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  tile: { flex: 1, height: height.control, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center', borderWidth: borderWidth.thin },
  tileOff: { backgroundColor: color.surfaceMuted, borderColor: color.border },
  tileOn: { backgroundColor: color.surface, borderColor: color.ink, borderWidth: borderWidth.medium },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    height: height.control,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  phoneInvalid: { borderColor: color.danger, backgroundColor: color.dangerSoft },
  prefix: {
    height: space.xl + space.xs,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRightWidth: borderWidth.thin,
    borderRightColor: color.border,
  },
  phoneInput: { flex: 1, height: height.control, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: space.md },
  stepBars: { flexDirection: 'row', gap: spaceHalf['1.5'], paddingHorizontal: spaceHalf['6'] },
  stepBar: { flex: 1, height: height['step-bar'], borderRadius: radius.bar },
  footerBar: {
    backgroundColor: color.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    paddingHorizontal: space.xl,
    paddingTop: spaceHalf['3.5'],
    gap: spaceHalf['2.5'],
  },
  menuGroup: { gap: space.sm },
  menuLabel: { color: color.textMuted, letterSpacing: trackingNative.eyebrow, paddingHorizontal: space.xs },
  menuCard: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, overflow: 'hidden' },
  menuRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  menuRow: { minHeight: height['screen-header'], flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  menuPressed: { backgroundColor: color.surfaceMuted },
  menuText: { flex: 1, minWidth: 0, gap: space['2xs'] },
  menuSub: { color: color.textMuted },
  menuDanger: { color: color.danger },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inkPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spaceHalf['2.5'],
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.accentOnInkSoft,
  },
  inkPillText: { color: color.accentMuted },
  inkButton: {
    height: height.control,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  inkButtonSolid: { backgroundColor: color.surface },
  inkButtonGhost: { borderWidth: borderWidth.thin, borderColor: color.onInkEdge },

  thumb: {
    width: height['thumb-w'],
    aspectRatio: 9 / 16,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A play mark over a real still: the glass disc the web's poster state draws under it.
  thumbPlayGlass: {
    width: space['2xl'],
    height: space['2xl'],
    borderRadius: radius.pill,
    backgroundColor: color.onInkGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbState: { backgroundColor: color.surfaceMuted, borderWidth: borderWidth.thin, borderColor: color.border },
  thumbFailed: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder },
  thumbNone: { borderStyle: 'dashed', borderColor: color.borderStrong },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    height: height.fab,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    shadowColor: color.accent,
    shadowOpacity: 0.35,
    shadowRadius: space.xl,
    shadowOffset: { width: 0, height: space.sm },
    elevation: 8,
  },
  fabText: { color: color.textInverse },
})

/**
 * The wizard's step bars (Android M2): one 4-tall bar per step — done in the
 * success green, the current step in the accent, the rest a hairline grey.
 */
export function StepBars({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.stepBars}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.stepBar, { backgroundColor: i + 1 < current ? color.successFill : i + 1 === current ? color.accent : color.border }]}
        />
      ))}
    </View>
  )
}

/**
 * The sticky bottom action bar (Android M2, M3, M5, M10): a white bar with a
 * hairline on top, padding 14/20, the safe-area inset underneath. Where a tab
 * bar shows below the screen the inset is already spoken for — pass `inset={false}`.
 */
export function StickyFooter({ children, inset = true }: { children: React.ReactNode; inset?: boolean }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.footerBar, { paddingBottom: spaceHalf['3.5'] + (inset ? insets.bottom : 0) }]}>{children}</View>
  )
}

/** A labelled group of rows on one card (Android M16's list pattern): mono eyebrow above, hairlines between. */
export function MenuGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean)
  return (
    <View style={styles.menuGroup}>
      {!!label && <Text style={[text.metaMd, styles.menuLabel]}>{label.toUpperCase()}</Text>}
      <View style={styles.menuCard}>
        {rows.map((row, i) => (
          <View key={i} style={i < rows.length - 1 ? styles.menuRule : undefined}>{row}</View>
        ))}
      </View>
    </View>
  )
}

/** One row in a MenuGroup: title, an optional muted line, and whatever sits on the right (a chevron by default). */
export function MenuRow({
  title, sub, onPress, right, tone = 'default', disabled,
}: { title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; tone?: 'default' | 'danger'; disabled?: boolean }) {
  const body = (
    <>
      <View style={styles.menuText}>
        <Text style={[text.uiBaseSemi, tone === 'danger' && styles.menuDanger]}>{title}</Text>
        {!!sub && <Text style={[text.uiXs, styles.menuSub]}>{sub}</Text>}
      </View>
      {right !== undefined ? right : onPress ? (
        <Svg width={space.lg} height={space.lg} viewBox="0 0 24 24" fill="none">
          <Path d="m9 5 7 7-7 7" stroke={color.textSubtle} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </>
  )
  if (!onPress) return <View style={styles.menuRow}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed, disabled && { opacity: opacity.disabled }]}
    >
      {body}
    </Pressable>
  )
}
