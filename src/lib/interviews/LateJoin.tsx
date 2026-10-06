import React from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { borderWidth, color, height, radius, space, spaceHalf } from '../../theme'
import { text } from '../../components/ui/typography'
import { Icon } from '../../components/ui/Icon'
import { lateBandText, latePillText, otherLine, type LateJoin } from './late'

/**
 * The late-join warning's pieces (docs/late-join-mockups.html, red fill), drawn
 * the same way at every Join location. Each piece takes the one `LateJoin` from
 * late.ts and `onInk` for the dark cards. Token values only.
 *
 * Kept beside late.ts because the shared component folders belong to another
 * stream of work; they can move into components/ui as they are.
 */

type Tone = 'warn' | 'red'
const toneOf = (j: LateJoin): Tone | null => (j.phase === 'red' ? 'red' : j.phase === 'late' ? 'warn' : null)

/** The colour a late clock or countdown takes; null keeps the card's own. */
export function lateTint(j: LateJoin, onInk: boolean): string | null {
  const t = toneOf(j)
  if (!t) return null
  return t === 'red' ? (onInk ? color.dangerOnInk : color.danger) : (onInk ? color.warningOnInk : color.warning)
}

/** "Late · 2 min" with its dot — amber, then red. Nothing outside those two phases. */
export function LatePill({ j, onInk }: { j: LateJoin; onInk?: boolean }) {
  const t = toneOf(j)
  if (!t) return null
  const fg = lateTint(j, !!onInk)!
  const bg = t === 'red' ? (onInk ? color.dangerOnInkSoft : color.dangerSoft) : (onInk ? color.warningOnInkSoft : color.warningSoft)
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <View style={[s.pillDot, { backgroundColor: fg }]} />
      <Text style={[text.uiXsSemi, s.num, { color: fg }]} numberOfLines={1}>{latePillText(j)}</Text>
    </View>
  )
}

/** The bar that drains from the start to the moment Join closes. Drawn only when the close time is known. */
export function LateDrain({ j, onInk }: { j: LateJoin; onInk?: boolean }) {
  const t = toneOf(j)
  if (!t || j.remaining == null) return null
  const fill = t === 'red' ? (onInk ? color.dangerOnInk : color.dangerFill) : (onInk ? color.warningOnInk : color.warningEdgeStrong)
  return (
    <View style={[s.drain, { backgroundColor: onInk ? color.onInkBar : color.surfaceSunken }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.drainFill, { width: `${Math.round(j.remaining * 1000) / 10}%`, backgroundColor: fill }]} />
    </View>
  )
}

/** "You're 2 min late · join closes in 12:46". */
export function LateBand({ j, onInk, style }: { j: LateJoin; onInk?: boolean; style?: ViewStyle }) {
  const t = toneOf(j)
  if (!t) return null
  const fg = lateTint(j, !!onInk)!
  const look = t === 'red'
    ? (onInk ? { backgroundColor: color.dangerOnInkSoft, borderColor: color.dangerInkEdge } : { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder })
    : (onInk ? { backgroundColor: color.warningOnInkSoft, borderColor: color.warningOnInkSoft } : { backgroundColor: color.warningSoft, borderColor: color.warningEdge })
  const { lead, tail } = lateBandText(j)
  return (
    <View style={[s.band, look, style]} accessibilityRole="alert">
      <Icon name="clock" size={space.lg} tint={fg} weight={2} />
      <Text style={[text.uiSmSemi, s.grow, s.num, { color: fg }]}>
        {lead}
        {tail ? <Text style={text.uiSmMedium}>{` · ${tail}`}</Text> : null}
      </Text>
    </View>
  )
}

/** The other side's line: green when they are in, then amber / red as they run late. */
export function OtherLine({ j, who, onInk, center }: { j: LateJoin; who: string; onInk?: boolean; center?: boolean }) {
  const line = otherLine(j, who)
  if (!line || !j.other) return null
  const c = {
    in: onInk ? [color.successOnInk, color.successOnInk] : [color.success, color.successFill],
    neutral: onInk ? [color.textOnInkBody, color.textOnInkSubtle] : [color.textMuted, color.textSubtle],
    late: onInk ? [color.warningOnInk, color.warningOnInk] : [color.warning, color.warning],
    red: onInk ? [color.dangerOnInk, color.dangerOnInk] : [color.danger, color.danger],
  }[j.other]
  return (
    <View style={[s.other, center && s.center]}>
      <View style={[s.otherDot, { backgroundColor: c[1] }]} />
      <Text style={[text.uiSmMedium, s.num, s.shrink, { color: c[0] }]}>{line}</Text>
    </View>
  )
}

/**
 * The other side's state as a band over the room (the viewer is in, waiting): neutral glass
 * before the start, amber then red as they run late. Not drawn once they are in, or when the
 * server does not say.
 */
export function OtherBand({ j, who }: { j: LateJoin; who: string }) {
  const line = otherLine(j, who)
  if (!line || !j.other || j.other === 'in') return null
  const look = {
    neutral: { bg: color.onInkGround, edge: color.onInkHairline, fg: color.textOnInkMuted },
    late: { bg: color.warningOnInkSoft, edge: color.warningOnInkSoft, fg: color.warningOnInk },
    red: { bg: color.dangerOnInkSoft, edge: color.dangerInkEdge, fg: color.dangerOnInk },
  }[j.other]
  return (
    <View style={[s.band, s.center, { backgroundColor: look.bg, borderColor: look.edge }]} accessibilityRole="alert">
      <Icon name="clock" size={space.lg} tint={look.fg} weight={2} />
      <Text style={[text.uiSmSemi, s.num, s.shrink, { color: look.fg }]}>{line}</Text>
    </View>
  )
}

/**
 * The red fill behind an ink card past the red point: dangerInk into dangerInkDeep. Put it
 * first inside a card that carries `lateInk.red` (which also clips it to the corners).
 */
export function RedInkFill() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="lateRedInk" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.dangerInk} />
          <Stop offset="1" stopColor={color.dangerInkDeep} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#lateRedInk)" />
    </Svg>
  )
}

/** Card treatments. Ink cards: an amber edge while late, the red fill's ground and edge once red. */
export const lateInk = StyleSheet.create({
  late: { borderWidth: borderWidth.thin, borderColor: color.warningOnInk },
  red: { backgroundColor: color.dangerInk, borderWidth: borderWidth.medium, borderColor: color.dangerInkEdge, overflow: 'hidden' },
})

/** Light cards and rows: a 4 px amber edge while late; the red fill and its border once red. */
export const lateLight = StyleSheet.create({
  late: { borderLeftWidth: space.xs, borderLeftColor: color.warningEdgeStrong },
  red: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder },
})

/** The style for a card in this phase, or undefined. */
export function lateCard(j: LateJoin, onInk: boolean): ViewStyle | undefined {
  const t = toneOf(j)
  if (!t) return undefined
  return onInk ? (t === 'red' ? lateInk.red : lateInk.late) : (t === 'red' ? lateLight.red : lateLight.late)
}

/** The Join button past the red point: the danger fill with white text. */
export const lateJoinRed = StyleSheet.create({
  button: { backgroundColor: color.dangerFill, borderColor: color.dangerFill },
  label: { color: color.textInverse },
})

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  center: { justifyContent: 'center' },
  num: { fontVariant: ['tabular-nums'] },
  pill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spaceHalf['1.5'],
    borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: spaceHalf['2.5'],
  },
  pillDot: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  drain: { height: height['step-bar'], borderRadius: radius.pill, overflow: 'hidden' },
  drainFill: { height: '100%', borderRadius: radius.pill },
  band: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.tile, borderWidth: borderWidth.thin,
    paddingVertical: space.sm, paddingHorizontal: space.md,
  },
  other: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  otherDot: { width: space.sm, height: space.sm, borderRadius: radius.pill },
})
