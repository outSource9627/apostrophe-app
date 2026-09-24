import { StyleSheet } from 'react-native'
import { color, fontFamilyNative, fontSize, leadingNative, trackingNative } from '../../theme'

/**
 * Foundations §03 on React Native — three families, one job each.
 *
 * On the web the token NAME carries the binding: `text-display-md` is the serif
 * because of what it is called. RN has no such affordance — `fontSize` and
 * `fontFamily` are separate properties and nothing stops you pairing the serif
 * size with the sans face. So the binding lives here instead, as one prepared
 * style per step, and screens compose these rather than assembling a text style
 * by hand.
 *
 * Two RN facts shape the table:
 *
 *   There is no synthetic weight for a custom face. Asking for fontWeight 600
 *   on a Regular file silently gives you Regular on Android, so every weight is
 *   a separate bundled file named in `fontFamilyNative` — the weight lives in
 *   the family, never in a `fontWeight` property.
 *
 *   There is no unitless line height and no em. Both come from the resolved
 *   native scales, in points.
 */
export const text = StyleSheet.create({
  // ── display · Newsreader · content ──────────────────────────────────────
  displayXs: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-xs'],
    lineHeight: leadingNative['display-xs'],
    color: color.text,
  },
  displaySm: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-sm'],
    lineHeight: leadingNative['display-sm'],
    letterSpacing: trackingNative.snug,
    color: color.text,
  },
  displayMd: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-md'],
    lineHeight: leadingNative['display-md'],
    letterSpacing: trackingNative.snug,
    color: color.text,
  },
  /** The screen title: 28 at 600 on Android (the design's `Enter the code` / `Five things` step). */
  displayLg: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-lead'],
    lineHeight: leadingNative['display-lead'],
    letterSpacing: trackingNative['tight-md'],
    color: color.text,
  },
  /** The Android screen title ("Enter the code", "Five things"): 28 at 600, pulled together. */
  displayLead: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-lead'],
    lineHeight: leadingNative['display-lead'],
    letterSpacing: trackingNative['tight-md'],
    color: color.text,
  },
  /** A date's day number on a card (Android M5): 20 at 600. */
  displayCard: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-card'],
    lineHeight: leadingNative['display-card'],
    color: color.text,
  },
  /** The scorecard's overall figure (Android M9): 56 at 600, tight. */
  displayScore: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-score-sm'],
    lineHeight: leadingNative['display-score-sm'],
    letterSpacing: trackingNative['tight-2xl'],
    color: color.textOnInk,
  },
  /** A step's title (Android M2): 24 at 600. */
  displayHeading: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-heading'],
    lineHeight: leadingNative['display-heading'],
    letterSpacing: trackingNative['tight-md'],
    color: color.text,
  },
  /** The sign-up headline and the dashboard greeting scale: 34 at 600. */
  displayGreet: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-greet'],
    lineHeight: leadingNative['display-greet'],
    letterSpacing: trackingNative['tight-lg'],
    color: color.text,
  },
  /** Salary, scores, totals. */
  displayNum: {
    fontFamily: fontFamilyNative.display,
    fontSize: fontSize['display-num'],
    lineHeight: leadingNative['display-num'],
    letterSpacing: trackingNative['tight-sm'],
    color: color.text,
  },

  // ── ui · Instrument Sans · interface ────────────────────────────────────
  ui2xs: {
    fontFamily: fontFamilyNative.body,
    fontSize: fontSize['ui-2xs'],
    lineHeight: leadingNative['ui-2xs'],
    color: color.text,
  },
  uiXs: {
    fontFamily: fontFamilyNative.body,
    fontSize: fontSize['ui-xs'],
    lineHeight: leadingNative['ui-xs'],
    color: color.text,
  },
  /** The tab label: Geist 12 at 500, and 600 when active (Android M4). */
  uiXsMedium: {
    fontFamily: fontFamilyNative.bodyMedium,
    fontSize: fontSize['ui-xs'],
    lineHeight: leadingNative['ui-xs'],
    color: color.text,
  },
  uiXsSemi: {
    fontFamily: fontFamilyNative.bodySemiBold,
    fontSize: fontSize['ui-xs'],
    lineHeight: leadingNative['ui-xs'],
    color: color.text,
  },
  uiSm: {
    fontFamily: fontFamilyNative.body,
    fontSize: fontSize['ui-sm'],
    lineHeight: leadingNative['ui-sm'],
    color: color.text,
  },
  uiSmMedium: {
    fontFamily: fontFamilyNative.bodyMedium,
    fontSize: fontSize['ui-sm'],
    lineHeight: leadingNative['ui-sm'],
    color: color.text,
  },
  /** A field label: Geist 13 at 600, one step darker than muted. */
  uiSmSemi: {
    fontFamily: fontFamilyNative.bodySemiBold,
    fontSize: fontSize['ui-sm'],
    lineHeight: leadingNative['ui-sm'],
    color: color.textSecondary,
  },
  uiMdMedium: {
    fontFamily: fontFamilyNative.bodyMedium,
    fontSize: fontSize['ui-md'],
    lineHeight: leadingNative['ui-md'],
    color: color.text,
  },
  uiMd: {
    fontFamily: fontFamilyNative.body,
    fontSize: fontSize['ui-md'],
    lineHeight: leadingNative['ui-md'],
    color: color.text,
  },
  uiMdSemi: {
    fontFamily: fontFamilyNative.bodySemiBold,
    fontSize: fontSize['ui-md'],
    lineHeight: leadingNative['ui-md'],
    color: color.text,
  },
  /** The large button's label (Android CTA): 16 at 600. */
  uiLeadSemi: {
    fontFamily: fontFamilyNative.bodySemiBold,
    fontSize: fontSize['ui-lead'],
    lineHeight: leadingNative['ui-lead'],
    color: color.text,
  },
  /** Body copy, and the primary button's label. */
  uiBase: {
    fontFamily: fontFamilyNative.body,
    fontSize: fontSize['ui-base'],
    lineHeight: leadingNative['ui-base'],
    color: color.text,
  },
  uiBaseSemi: {
    fontFamily: fontFamilyNative.bodySemiBold,
    fontSize: fontSize['ui-base'],
    lineHeight: leadingNative['ui-base'],
    letterSpacing: trackingNative['snug-sm'],
    color: color.text,
  },
  /** List titles, the app bar. */
  uiLgSemi: {
    fontFamily: fontFamilyNative.bodySemiBold,
    fontSize: fontSize['ui-lg'],
    lineHeight: leadingNative['ui-lg'],
    letterSpacing: trackingNative['snug-sm'],
    color: color.text,
  },

  // ── meta · IBM Plex Mono · always uppercase ─────────────────────────────
  /** Dense badges sitting on footage. */
  metaXs: {
    fontFamily: fontFamilyNative.monoMedium,
    fontSize: fontSize['meta-xs'],
    lineHeight: leadingNative['meta-xs'],
    letterSpacing: trackingNative.meta,
    textTransform: 'uppercase',
    color: color.textSubtle,
  },
  /** Eyebrows and status pills — the canonical meta step. */
  metaSm: {
    fontFamily: fontFamilyNative.monoMedium,
    fontSize: fontSize['meta-sm'],
    lineHeight: leadingNative['meta-sm'],
    letterSpacing: trackingNative.eyebrow,
    textTransform: 'uppercase',
    color: color.textSubtle,
  },
  /** The same step inside a pill, where the tracking tightens slightly. */
  metaPill: {
    fontFamily: fontFamilyNative.monoMedium,
    fontSize: fontSize['meta-sm'],
    lineHeight: leadingNative['meta-sm'],
    letterSpacing: trackingNative.meta,
    textTransform: 'uppercase',
  },
  /** A monogram inside a 44 avatar: 13 mono. */
  metaLg: {
    fontFamily: fontFamilyNative.monoMedium,
    fontSize: fontSize['meta-lg'],
    lineHeight: leadingNative['meta-lg'],
    color: color.textSubtle,
  },
  /** A countdown or elapsed clock: 15 mono. */
  metaXl: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-xl'],
    lineHeight: leadingNative['meta-xl'],
    letterSpacing: trackingNative.meta,
    color: color.text,
  },
  /** One digit of a one-time code. */
  metaOtp: {
    fontFamily: fontFamilyNative.monoSemiBold,
    fontSize: fontSize['meta-otp'],
    lineHeight: leadingNative['meta-otp'],
    color: color.text,
  },
  /** Transaction references, durations, fine print. */
  metaMd: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-md'],
    lineHeight: leadingNative['meta-md'],
    textTransform: 'uppercase',
    color: color.textSubtle,
  },
  /**
   * `ProgressRing`'s centre value. No baked-in colour, unlike the steps
   * above: the ring's digits take their tone from the ring itself (ink,
   * warning, danger), the same way `Eyebrow` and `Body` apply theirs.
   */
  meta2xl: {
    fontFamily: fontFamilyNative.mono,
    fontSize: fontSize['meta-2xl'],
    lineHeight: leadingNative['meta-2xl'],
    letterSpacing: trackingNative.meta,
    textTransform: 'uppercase',
  },
})
