import React from 'react'
import {
  ActivityIndicator, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  borderWidth, color, fontFamilyNative as FF, fontSize, height, leadingNative, opacity, radius, space, spaceHalf, trackingNative,
} from '../../theme'
import { Icon, type IconName } from './Icon'

/**
 * The video feed, shared by the student job feed and the employer candidate
 * feed (docs/tinder-feed-mockups.html · design 1).
 *
 * One dark card runs from under the top bar to just above the tab bar. The
 * film fills it under a shade; a glass tag and the sound button sit on top;
 * the facts sit at the foot; and the four round buttons — Undo, Pass,
 * Save/Shortlist, Apply/Interest — are fixed over the foot of the card, so
 * they stay put while the card is dragged away and the next one rises.
 *
 * The card has no bottom edge: from about halfway down it fades into the same
 * black as the page and the tab bar under it, and the facts and the buttons sit
 * in that fade (docs/feed-details-mockups.html · A, as on Tinder).
 *
 * The ⌃ opens `FeedSheet`, the dark details sheet (mockup A), built from the
 * `FeedSheet*` pieces below.
 *
 * Presentational only. The screens own the deck, the drag and what each
 * button does.
 */

/** How far up a card's facts sit, clear of the round buttons over its foot (the mockup's 84). */
export const FEED_FOOT = space.md + height['feed-action'] + spaceHalf['3.5']
/** Where the toast and the stamps sit from the top of the card: under the tag row. */
export const FEED_TOAST_TOP = space['4xl']
const STAMP_TOP = space['4xl'] * 2

/** The card itself: rounded, ink, and clipping the film. */
export function FeedCardFrame({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

/** The loading card — the same frame, empty, with a quiet spinner. */
export function FeedSkeleton({ label }: { label: string }) {
  return (
    <View style={[styles.card, styles.skeleton]} accessibilityLabel={label}>
      <ActivityIndicator color={color.textOnInkSubtle} />
    </View>
  )
}

/** Dark at the top for the tag, clear through the middle, then solid page-black from the facts down. */
export function FeedShade() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="feedShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.inkDeep} stopOpacity={0.55} />
          <Stop offset="0.16" stopColor={color.inkDeep} stopOpacity={0} />
          <Stop offset="0.4" stopColor={color.inkDeep} stopOpacity={0} />
          <Stop offset="0.58" stopColor={color.inkDeep} stopOpacity={0.7} />
          <Stop offset="0.74" stopColor={color.inkDeep} stopOpacity={0.96} />
          <Stop offset="0.84" stopColor={color.inkDeep} stopOpacity={1} />
          <Stop offset="1" stopColor={color.inkDeep} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#feedShade)" />
    </Svg>
  )
}

/** The film's progress, as the one story bar across the top of the card. */
export function FeedFilmBar({ progress }: { progress: Animated.Value }) {
  return (
    <View style={styles.filmTrack} pointerEvents="none">
      <Animated.View style={[styles.filmFill, { transform: [{ scaleX: progress }] }]} />
    </View>
  )
}

/** The row along the top of the card: the tag on the left, the glass buttons on the right. */
export function FeedCardTop({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.cardTop} pointerEvents="box-none">
      <View style={styles.cardTopLeft} pointerEvents="box-none">{left}</View>
      <View style={styles.cardTopRight} pointerEvents="box-none">{right}</View>
    </View>
  )
}

/** The glass tag over the film: a green dot and what the card is (a job's category, a verified interview). */
export function FeedTag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <View style={styles.tagDot} />
      <Text style={styles.tagText} numberOfLines={1}>{label}</Text>
    </View>
  )
}

/** A small glass count over the film ("13 / 40"). */
export function FeedCount({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  )
}

/** A round glass button on the card: `ink` for the sound toggle, `light` for the details arrow. */
export function FeedGlassButton({
  icon, label, onPress, tone = 'ink',
}: { icon: IconName; label: string; onPress?: () => void; tone?: 'ink' | 'light' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [styles.glass, tone === 'light' ? styles.glassLight : styles.glassInk, pressed && styles.pressed]}
    >
      <Icon name={icon} size={space.lg + 2} tint={color.textOnInk} weight={icon === 'chevU' ? 2.5 : 1.8} />
    </Pressable>
  )
}

/** The facts at the foot of the card. */
export function FeedHud({ children }: { children: React.ReactNode }) {
  return <View style={styles.hud} pointerEvents="box-none">{children}</View>
}

/** A pill in the cloud: pink for the facts that decide (pay, type, joining), dark glass for skills. */
export function FeedPill({ label, tone }: { label: string; tone: 'pink' | 'dark' }) {
  return (
    <View style={[styles.pill, tone === 'pink' ? styles.pillPink : styles.pillDark]}>
      <Text style={styles.pillText} numberOfLines={1}>{label}</Text>
    </View>
  )
}

export function FeedPills({ children }: { children: React.ReactNode }) {
  return <View style={styles.pills}>{children}</View>
}

/** The pin and one line of where / what / how long. */
export function FeedMeta({ label }: { label: string }) {
  return (
    <View style={styles.meta}>
      <Icon name="pin" size={space.md + 2} tint={color.textOnInkMuted} />
      <Text style={styles.metaText} numberOfLines={1}>{label}</Text>
    </View>
  )
}

/** The stamp a drag fades in: the right-swipe verb (green, tilted left), Pass (pink, tilted right), Skip (white, level). */
export function FeedStamp({ kind, label }: { kind: 'like' | 'pass' | 'skip'; label: string }) {
  const tone = kind === 'like' ? color.feedLike : kind === 'pass' ? color.feedPink : color.textOnInk
  return (
    <View style={[styles.stampWrap, kind === 'like' ? styles.stampLeft : kind === 'pass' ? styles.stampRight : styles.stampMid]} pointerEvents="none">
      <View style={[styles.stamp, { borderColor: tone }, kind === 'like' ? styles.tiltLeft : kind === 'pass' ? styles.tiltRight : null]}>
        <Text style={[styles.stampText, { color: tone }]}>{label}</Text>
      </View>
    </View>
  )
}

/**
 * The four round buttons over the foot of the card: Undo (gold) · Pass (pink) ·
 * Save or Shortlist (green) · Apply or Interest (violet).
 */
export function FeedActions({
  canUndo, disabled, passLabel, likeLabel, planeLabel, planeDisabled, onUndo, onPass, onLike, onPlane,
}: {
  canUndo: boolean
  disabled?: boolean
  passLabel: string
  likeLabel: string
  planeLabel: string
  planeDisabled?: boolean
  onUndo: () => void
  onPass: () => void
  onLike: () => void
  onPlane: () => void
}) {
  const undoOff = !canUndo || !!disabled
  const planeOff = !!disabled || !!planeDisabled
  return (
    <View style={styles.actions} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo"
        accessibilityState={{ disabled: undoOff }}
        disabled={undoOff}
        onPress={onUndo}
        style={({ pressed }) => [styles.round, styles.roundSm, undoOff && styles.off, pressed && styles.squeeze]}
      >
        <Icon name="undo" size={space.xl} tint={color.feedUndo} weight={2.5} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={passLabel}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPass}
        style={({ pressed }) => [styles.round, styles.roundLg, disabled && styles.off, pressed && styles.squeeze]}
      >
        <Icon name="x" size={space['2xl']} tint={color.feedPink} weight={2.8} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={likeLabel}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onLike}
        style={({ pressed }) => [styles.round, styles.roundLg, disabled && styles.off, pressed && styles.squeeze]}
      >
        <Icon name="heart" size={space['2xl']} tint={color.feedLike} fill={color.feedLike} weight={2} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={planeLabel}
        accessibilityState={{ disabled: planeOff }}
        disabled={planeOff}
        onPress={onPlane}
        style={({ pressed }) => [styles.round, styles.roundSm, planeOff && styles.off, pressed && styles.squeeze]}
      >
        <Icon name="send" size={space.xl} tint={color.accentBright} weight={2.5} />
      </Pressable>
    </View>
  )
}

/** What just happened, and the one way back (Undo, Back). Sits under the tag row so it never covers the facts or the buttons. */
export function FeedToast({
  message, note, action, onAction, disabled,
}: { message: string; note?: string; action?: string; onAction?: () => void; disabled?: boolean }) {
  return (
    <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <View style={styles.toastText}>
        <Text style={styles.toastMsg} numberOfLines={1}>{message}</Text>
        {!!note && <Text style={styles.toastNote} numberOfLines={1}>{note}</Text>}
      </View>
      {!!action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          disabled={disabled}
          onPress={onAction}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.toastBtn, (pressed || disabled) && styles.pressed]}
        >
          <Text style={styles.toastAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  )
}

/** A round button in the bar above the card, on ink while a card is up and on the page otherwise. */
export function FeedTopButton({
  icon, label, dark, badge, disabled, onPress,
}: { icon: IconName; label: string; dark: boolean; badge?: number; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} on` : label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [styles.top, dark ? styles.topDark : styles.topLight, (pressed || disabled) && styles.pressed, disabled && styles.off]}
    >
      <Icon name={icon} size={space.lg + 2} tint={dark ? color.textOnInk : color.text} />
      {!!badge && (
        <View style={[styles.badge, { borderColor: dark ? color.inkDeep : color.background }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  )
}

// ── the details sheet (docs/feed-details-mockups.html · A) ──────────────────

/**
 * The dark sheet the card's ⌃ opens: it rises to just under the status bar over
 * a scrim, carries a head (face or logo, the big line, one line under it, ✕),
 * a scrolling body, and a fixed foot (Pass · Save/Shortlist · the main verb).
 */
export function FeedSheet({
  open, onClose, head, foot, children,
}: { open: boolean; onClose: () => void; head: React.ReactNode; foot: React.ReactNode; children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetWrap}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.sheetScrim} />
        <View style={[styles.sheet, { top: insets.top + space.xl }]}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.sheetHandleArea}><View style={styles.sheetHandle} /></Pressable>
          {head}
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <View style={[styles.sheetFoot, { paddingBottom: spaceHalf['4.5'] + insets.bottom }]}>{foot}</View>
        </View>
      </View>
    </Modal>
  )
}

/** The sheet's head: the logo or face, the big line (with the verified tick), the line under it, and ✕. */
export function FeedSheetHead({
  lead, title, sub, verified, onClose,
}: { lead: React.ReactNode; title: string; sub?: string | null; verified?: boolean; onClose: () => void }) {
  return (
    <View style={styles.sheetHead}>
      {lead}
      <View style={styles.grow}>
        <View style={styles.sheetTitleRow}>
          <Text style={[styles.sheetTitle, styles.shrink]} numberOfLines={2}>{title}</Text>
          {verified && <Icon name="check" size={space.lg + 2} tint={color.feedLike} weight={2.6} />}
        </View>
        {!!sub && <Text style={styles.sheetSub} numberOfLines={1}>{sub}</Text>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={space.sm} style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}>
        <Icon name="x" size={space.lg} tint={color.textOnInk} weight={2.2} />
      </Pressable>
    </View>
  )
}

/** A company's initials on the glass tile — the card's and the sheet's. */
export function FeedSheetLogo({ initials }: { initials: string }) {
  return <View style={styles.logo}><Text style={styles.logoText}>{initials}</Text></View>
}

/** A candidate's photo, else their initials, on the rounded glass tile. */
export function FeedSheetFace({ initials, photo }: { initials: string; photo?: string | null }) {
  return photo
    ? <Image source={{ uri: photo }} style={[styles.face, styles.faceImg]} />
    : <View style={styles.face}><Text style={styles.faceText}>{initials}</Text></View>
}

/** The 2 × 2 grid of the deciding facts; `pink` marks the money one. A fact the API did not send is left out. */
export function FeedSheetFacts({ items }: { items: { label: string; value: string; pink?: boolean }[] }) {
  const rows: (typeof items)[] = []
  for (let k = 0; k < items.length; k += 2) rows.push(items.slice(k, k + 2))
  return (
    <View style={styles.factGrid}>
      {rows.map((row) => (
        <View key={row[0].label} style={styles.factRow}>
          {row.map((f) => (
            <View key={f.label} style={styles.factBox}>
              <Text style={styles.factKey}>{f.label}</Text>
              <Text style={[styles.factValue, f.pink && styles.factPink]}>{f.value}</Text>
            </View>
          ))}
          {row.length === 1 && <View style={styles.factSpacer} />}
        </View>
      ))}
    </View>
  )
}

/** A wrapped row of chips: outlined (skills, languages) or `soft` (category, department, what they want). */
export function FeedSheetChips({ items, soft }: { items: string[]; soft?: boolean }) {
  if (!items.length) return null
  return (
    <View style={styles.chips}>
      {items.map((c) => (
        <View key={c} style={[styles.chip, soft && styles.chipSoft]}><Text style={styles.chipText}>{c}</Text></View>
      ))}
    </View>
  )
}

/** A section: the heading, then whatever it holds. */
export function FeedSheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.secTitle}>{title}</Text>
      {children}
    </View>
  )
}

export function FeedSheetProse({ children }: { children: React.ReactNode }) {
  return <Text style={styles.prose}>{children}</Text>
}

/** Pink-dotted lines. */
export function FeedSheetBullets({ items }: { items: string[] }) {
  return (
    <View style={styles.bullets}>
      {items.map((b, k) => (
        <View key={`${k}-${b}`} style={styles.bullet}>
          <View style={styles.bulletDot} />
          <Text style={[styles.prose, styles.grow]}>{b}</Text>
        </View>
      ))}
    </View>
  )
}

/** One entry of a history (a job, a degree): the icon on its tile, the title, the where-and-when, and a line of what was done. */
export function FeedSheetEntry({ icon, title, sub, body }: { icon: IconName; title: string; sub?: string | null; body?: string | null }) {
  return (
    <View style={styles.entry}>
      <View style={styles.entryIcon}><Icon name={icon} size={space.lg} tint={color.textOnInkMuted} /></View>
      <View style={styles.grow}>
        <Text style={styles.entryTitle}>{title}</Text>
        {!!sub && <Text style={styles.entrySub}>{sub}</Text>}
        {!!body && <Text style={[styles.entrySub, styles.entryBody]}>{body}</Text>}
      </View>
    </View>
  )
}

/** A tappable row in a list (a clip, a document, a link): its leading mark, two lines and a trailing mark. */
export function FeedSheetItem({
  lead, title, sub, trail, label, disabled, onPress,
}: { lead: React.ReactNode; title: string; sub?: string | null; trail?: React.ReactNode; label: string; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || !onPress} onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      {lead}
      <View style={styles.grow}>
        <Text style={styles.entryTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.entrySub} numberOfLines={1}>{sub}</Text>}
      </View>
      {trail}
    </Pressable>
  )
}

/** The round play mark that leads a clip row. */
export function FeedSheetPlay() {
  return <View style={styles.itemPlay}><Icon name="tri" size={space.md} tint={color.textOnInk} fill={color.textOnInk} weight={1.5} /></View>
}

/** The film row: its still with a play mark, what it is, and the one button that opens it. */
export function FeedSheetFilm({
  poster, title, sub, action, onPress,
}: { poster?: string | null; title: string; sub: string; action: string; onPress?: () => void }) {
  return (
    <View style={styles.film}>
      <Pressable accessibilityRole="button" accessibilityLabel={action} disabled={!onPress} onPress={onPress} style={styles.filmThumb}>
        {!!poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <Icon name="tri" size={space.lg + 2} tint={color.textOnInk} fill={color.textOnInk} weight={1.5} />
      </Pressable>
      <View style={styles.grow}>
        <Text style={styles.entryTitle}>{title}</Text>
        <Text style={styles.entrySub}>{sub}</Text>
        {!!onPress && (
          <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.filmBtn, pressed && styles.pressed]}>
            <Icon name="max" size={space.md + 2} tint={color.textOnInk} weight={2} />
            <Text style={styles.filmBtnText}>{action}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

/** The foot's round button: ✕ (pass) in pink, ♥ (save / shortlist) in green — filled once it is done. */
export function FeedSheetRound({
  kind, label, disabled, onPress,
}: { kind: 'pass' | 'like'; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.footRound, disabled && styles.off, pressed && styles.squeeze]}
    >
      {kind === 'pass'
        ? <Icon name="x" size={space.xl + 2} tint={color.feedPink} weight={2.6} />
        : <Icon name="heart" size={space.xl + 2} tint={color.feedLike} fill={color.feedLike} weight={2} />}
    </Pressable>
  )
}

/** The foot's main verb, in pink: Apply with video resume, Send Interest. */
export function FeedSheetCta({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.cta, disabled && styles.off, pressed && styles.pressed]}
    >
      {!disabled && <Icon name="send" size={space.lg} tint={color.textOnInk} weight={2.4} />}
      <Text style={styles.ctaText} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

/** The sheet's quiet states: a spinner while the rest loads, a line when it did not. */
export function FeedSheetNote({ loading, children }: { loading?: boolean; children?: React.ReactNode }) {
  return (
    <View style={styles.note}>
      {loading ? <ActivityIndicator color={color.textOnInkSubtle} /> : <Text style={styles.noteText}>{children}</Text>}
    </View>
  )
}

/** The card's type: the big line (a job title, a candidate's name), the line under it, and the name beside a logo. */
export const feedText = StyleSheet.create({
  /** A candidate's name on the card (22), a step under a job title. */
  person: { fontFamily: FF.bodyBold, fontSize: fontSize['display-sm'], lineHeight: leadingNative['display-sm'], letterSpacing: trackingNative['tight-sm'], color: color.textOnInk },
  title: { fontFamily: FF.bodyBold, fontSize: fontSize['display-heading'], lineHeight: leadingNative['display-heading'], letterSpacing: trackingNative['tight-sm'], color: color.textOnInk },
  name: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-lead'], lineHeight: leadingNative['ui-lead'], color: color.textOnInk },
  sub: { fontFamily: FF.body, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-xs'], color: color.textOnInkMuted },
})

const styles = StyleSheet.create({
  pressed: { opacity: opacity.pressed },
  off: { opacity: opacity.disabled },
  squeeze: { transform: [{ scale: 0.92 }] },

  card: { flex: 1, borderTopLeftRadius: radius.feed, borderTopRightRadius: radius.feed, overflow: 'hidden', backgroundColor: color.inkDeep },
  skeleton: { alignItems: 'center', justifyContent: 'center' },

  filmTrack: {
    position: 'absolute', top: spaceHalf['2.5'], left: spaceHalf['3.5'], right: spaceHalf['3.5'], zIndex: 2,
    height: height['film-progress'], borderRadius: radius.bar, backgroundColor: color.onInkLevel, overflow: 'hidden',
  },
  filmFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.textOnInk, transformOrigin: 'left' },

  cardTop: { position: 'absolute', top: space.xl, left: spaceHalf['3.5'], right: spaceHalf['3.5'], zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cardTopLeft: { flexShrink: 1, flexDirection: 'row', alignItems: 'center' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], flexShrink: 1,
    height: height['chip-sm'], paddingHorizontal: spaceHalf['2.5'] + 1, borderRadius: radius.pill,
    backgroundColor: color.onInkGlass,
  },
  tagDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.feedLike },
  tagText: { flexShrink: 1, fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-xs'], color: color.textOnInk, fontVariant: ['tabular-nums'] },

  glass: { width: height['feed-glass'], height: height['feed-glass'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: borderWidth.thin },
  glassInk: { backgroundColor: color.onInkGlass, borderColor: color.onInkEdge },
  glassLight: { backgroundColor: color.onInkEdge, borderColor: color.onInkOutline },

  hud: { position: 'absolute', left: 0, right: 0, bottom: FEED_FOOT, zIndex: 2, paddingHorizontal: space.lg, gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  pill: { maxWidth: '100%', paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: borderWidth.thin },
  pillPink: { backgroundColor: color.feedPinkPill, borderColor: color.onInkOutline },
  pillDark: { backgroundColor: color.feedPill, borderColor: color.onInkEdge },
  pillText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-2xs'], color: color.textOnInk },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  metaText: { flex: 1, minWidth: 0, fontFamily: FF.bodyMedium, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.textOnInkMuted },

  stampWrap: { position: 'absolute', top: STAMP_TOP, zIndex: 3 },
  stampLeft: { left: space.xl },
  stampRight: { right: space.xl },
  stampMid: { left: 0, right: 0, alignItems: 'center' },
  stamp: { paddingHorizontal: spaceHalf['4.5'], paddingVertical: spaceHalf['1.5'], borderRadius: radius.tile, borderWidth: borderWidth.stamp, backgroundColor: color.onInkGlass },
  tiltLeft: { transform: [{ rotate: '-15deg' }] },
  tiltRight: { transform: [{ rotate: '15deg' }] },
  stampText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['meta-otp'], lineHeight: leadingNative['meta-otp'], letterSpacing: trackingNative.widest },

  actions: { position: 'absolute', left: 0, right: 0, bottom: space.md, zIndex: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: spaceHalf['6'] },
  round: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.feedAction, borderWidth: borderWidth.thin, borderColor: color.onInkGround },
  roundSm: { width: height['feed-action-sm'], height: height['feed-action-sm'] },
  roundLg: { width: height['feed-action'], height: height['feed-action'] },

  toast: {
    position: 'absolute', top: FEED_TOAST_TOP, left: space.md, right: space.md, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: spaceHalf['2.5'], paddingLeft: space.lg, paddingRight: space.md,
    borderRadius: radius.panel, backgroundColor: color.inkRaised, borderWidth: borderWidth.thin, borderColor: color.onInkEdge,
  },
  toastText: { flex: 1, minWidth: 0 },
  toastMsg: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.textOnInk },
  toastNote: { fontFamily: FF.body, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-xs'], color: color.textOnInkMuted },
  toastBtn: { paddingHorizontal: space.xs, paddingVertical: space.xs },
  toastAction: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.feedUndo },

  top: { width: height['feed-top'], height: height['feed-top'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: borderWidth.thin },
  topDark: { backgroundColor: color.onInkGlass, borderColor: color.onInkEdge },
  topLight: { backgroundColor: color.surface, borderColor: color.borderStrong },
  badge: {
    position: 'absolute', top: -space.xs, right: -space.xs, minWidth: space.lg + space['2xs'] * 2, height: space.lg + space['2xs'] * 2,
    paddingHorizontal: space.xs, borderRadius: radius.pill, borderWidth: borderWidth.accent,
    backgroundColor: color.feedPink, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['meta-xs'], lineHeight: leadingNative['meta-xs'], fontVariant: ['tabular-nums'], color: color.textOnInk },

  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  logo: {
    width: height['avatar-lg'], height: height['avatar-lg'], borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.onInkEdge, borderWidth: borderWidth.thin, borderColor: color.onInkOutline,
  },
  logoText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textOnInk },
  face: {
    width: height.avatar, height: height.avatar, borderRadius: radius.panel, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.onInkEdge, borderWidth: borderWidth.thin, borderColor: color.onInkOutline, overflow: 'hidden',
  },
  faceImg: { backgroundColor: color.inkRaised },
  faceText: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-base'], color: color.textOnInk },

  sheetWrap: { flex: 1 },
  sheetScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.feedScrim },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden',
    borderTopLeftRadius: radius['feed-sheet'], borderTopRightRadius: radius['feed-sheet'],
    backgroundColor: color.feedSheet, borderTopWidth: borderWidth.thin, borderColor: color.onInkEdge,
  },
  sheetHandleArea: { alignItems: 'center', paddingTop: spaceHalf['2.5'], paddingBottom: space['2xs'] },
  sheetHandle: { width: height['control-xs'], height: space.xs, borderRadius: radius.tail, backgroundColor: color.onInkOutline },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingHorizontal: space.lg, paddingTop: spaceHalf['2.5'], paddingBottom: space.md,
    borderBottomWidth: borderWidth.thin, borderBottomColor: color.onInkHairline,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  sheetTitle: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-cta'], lineHeight: leadingNative['ui-lg'], letterSpacing: trackingNative['snug-sm'], color: color.textOnInk },
  sheetSub: { fontFamily: FF.body, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-xs'], color: color.textOnInkMuted, marginTop: space['2xs'] },
  sheetClose: { width: height['feed-glass'], height: height['feed-glass'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.onInkWash },
  sheetScroll: { flex: 1 },
  sheetBody: { paddingHorizontal: space.lg, paddingTop: spaceHalf['3.5'], paddingBottom: space['2xl'], gap: space.lg },
  sheetFoot: {
    flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingHorizontal: space.lg, paddingTop: space.md,
    borderTopWidth: borderWidth.thin, borderTopColor: color.onInkHairline, backgroundColor: color.feedSheetFoot,
  },

  factGrid: { gap: space.sm },
  factRow: { flexDirection: 'row', gap: space.sm },
  factBox: {
    flex: 1, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.tile,
    backgroundColor: color.onInkWash, borderWidth: borderWidth.thin, borderColor: color.onInkHairline,
  },
  factSpacer: { flex: 1 },
  factKey: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-sm'], lineHeight: leadingNative['meta-sm'], color: color.textOnInkSubtle },
  factValue: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textOnInk, marginTop: space['2xs'] },
  factPink: { color: color.feedPinkSoft },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  chip: { paddingHorizontal: spaceHalf['2.5'] + 1, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.onInkEdge },
  chipSoft: { backgroundColor: color.onInkWash, borderColor: color.onInkWash },
  chipText: { fontFamily: FF.bodyMedium, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-xs'], color: color.textOnInkSoft },

  secTitle: { fontFamily: FF.bodySemiBold, fontSize: fontSize['meta-md'], lineHeight: leadingNative['meta-md'], color: color.textOnInkSubtle, marginBottom: spaceHalf['1.5'] },
  prose: { fontFamily: FF.body, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'] + space['2xs'], color: color.textOnInkSoft },
  bullets: { gap: spaceHalf['1.5'] },
  bullet: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  bulletDot: { width: spaceHalf['1.5'], height: spaceHalf['1.5'], borderRadius: radius.pill, backgroundColor: color.feedPink, marginTop: space.sm },

  entry: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  entryIcon: { width: height['feed-glass'], height: height['feed-glass'], borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.onInkWash },
  entryTitle: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textOnInk },
  entrySub: { fontFamily: FF.body, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-xs'], color: color.textOnInkMuted },
  entryBody: { marginTop: space.xs },

  item: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'] - 1, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.tile, backgroundColor: color.onInkWash },
  itemPlay: { width: space['2xl'] + space['2xs'], height: space['2xl'] + space['2xs'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.onInkGround },

  film: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: spaceHalf['2.5'], borderRadius: radius.panel,
    backgroundColor: color.onInkWash, borderWidth: borderWidth.thin, borderColor: color.onInkHairline,
  },
  filmThumb: { width: height['feed-thumb-w'], height: height['feed-thumb-h'], borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: color.inkRaised },
  filmBtn: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], marginTop: space.sm,
    height: height['feed-glass'], paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.onInkEdge,
  },
  filmBtnText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-sm'], color: color.textOnInk },

  footRound: {
    width: height['control-cta'], height: height['control-cta'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.feedAction, borderWidth: borderWidth.thin, borderColor: color.onInkEdge,
  },
  cta: { flex: 1, height: height['control-cta'], borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: color.feedPink, paddingHorizontal: space.lg },
  ctaText: { flexShrink: 1, fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-base'], color: color.textOnInk },

  note: { paddingVertical: space.xl, alignItems: 'center' },
  noteText: { fontFamily: FF.body, fontSize: fontSize['ui-md'], lineHeight: leadingNative['ui-md'], color: color.textOnInkMuted, textAlign: 'center' },
})
