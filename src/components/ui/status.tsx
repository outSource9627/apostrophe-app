import React from 'react'
import { StyleSheet, Text, View, type ViewProps } from 'react-native'
import { borderWidth, color, radius, space, spaceHalf } from '../../theme'
import { Body } from './Type'
import { text } from './typography'

/**
 * Foundations §02 — status pairs, and the application status ladder.
 *
 * Status is mono, uppercase and pill-shaped everywhere, so the same state reads
 * identically in a list, on a card and in an app bar. The tones are held
 * deliberately low in chroma: if they got loud, the accent would stop meaning
 * "act now" and start meaning "something is coloured".
 *
 * `accent` is a status here — shortlisted, verified — and never an error.
 * Danger is its own tone precisely so the two cannot be confused.
 */
const TONES = {
  /** Applied · Draft · Archived */
  neutral: { bg: color.surfaceSunken, fg: color.textMuted, dot: color.borderStrong },
  /** Paid · Completed · Connected */
  success: { bg: color.successSoft, fg: color.success, dot: color.success },
  /** Processing · In review · Expiring */
  warning: { bg: color.warningSoft, fg: color.warning, dot: color.warning },
  /** Failed · Rejected · Cancelled */
  danger: { bg: color.dangerSoft, fg: color.danger, dot: color.danger },
  /** Viewed · Booked · Read-only */
  info: { bg: color.infoSoft, fg: color.info, dot: color.info },
  /** Shortlisted · Verified · Act now */
  accent: { bg: color.accentSoft, fg: color.accent, dot: color.accent },
} as const

export type Tone = keyof typeof TONES

export function StatusPill({ tone = 'neutral', label, dot = false }: { tone?: Tone; label: string; dot?: boolean }) {
  const t = TONES[tone]
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {dot && <View style={{ width: spaceHalf['1.5'], height: spaceHalf['1.5'], borderRadius: radius.pill, backgroundColor: t.fg, marginRight: spaceHalf['1.5'] }} />}
      <Text style={[text.metaPill, { color: t.fg }]}>{label}</Text>
    </View>
  )
}

export function StatusDot({ tone = 'neutral', style }: { tone?: Tone; style?: ViewProps['style'] }) {
  return <View style={[styles.dot, { backgroundColor: TONES[tone].dot }, style]} />
}

/**
 * Where an application has reached. A list of dots rather than a progress bar,
 * because the last step is not always the furthest one — rejected is an ending,
 * not a stall, and a bar would imply it was still going.
 */
export function StatusLadder({
  steps, currentIndex,
}: { steps: { label: string; tone: Tone }[]; currentIndex: number }) {
  return (
    <View style={styles.ladder}>
      {steps.map((s, i) => (
        <View key={s.label} style={[styles.ladderRow, i === steps.length - 1 && styles.ladderLast]}>
          <StatusDot tone={i <= currentIndex ? s.tone : 'neutral'} />
          <Body size="sm" weight="medium" tone={i <= currentIndex ? 'default' : 'subtle'} style={styles.grow}>
            {s.label}
          </Body>
          <Text style={text.metaMd}>{s.tone}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The Verified Interview mark — one of red's four jobs, and the product's
 * central distinction. A seal with a date, never a colour swap.
 */
export function VerifiedSeal({
  date,
  label = 'Verified',
  style,
}: {
  date?: string
  /** Defaults to 'Verified'. The employer feed explainer draws 'Verified interview'. */
  label?: string
  style?: ViewProps['style']
}) {
  return (
    <View style={[styles.seal, style]}>
      <View style={styles.sealRing}>
        <View style={styles.sealCore} />
      </View>
      <Text style={[text.metaXs, styles.sealText]}>{date ? `${label} · ${date}` : label}</Text>
    </View>
  )
}

/** Its counterpart: no seal, mono, and explicitly the word "Unverified". */
export function UnverifiedMark({ style }: { style?: ViewProps['style'] }) {
  return (
    <View style={[styles.unverified, style]}>
      <Text style={[text.metaXs, { color: color.textMuted }]}>Unverified</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  dot: { width: space.md, height: space.md, borderRadius: radius.pill },
  grow: { flex: 1 },
  ladder: {
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  ladderLast: { borderBottomWidth: 0 },
  seal: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    backgroundColor: color.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  sealRing: {
    width: space.md,
    height: space.md,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    borderColor: color.textInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealCore: { width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: color.textInverse },
  sealText: { color: color.textInverse },
  unverified: {
    alignSelf: 'flex-start',
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
})
