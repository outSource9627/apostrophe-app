import React from 'react'
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native'
import { borderWidth, color, radius, space } from '../../theme'
import { Body, Display, Eyebrow } from './Type'

/** Foundations §04 and §08 — surfaces, the three card archetypes, progress. */

/**
 * Flat by default: a hairline does the work almost everywhere. `raised` is for
 * something that genuinely floats — a sheet, a toast, a card being dragged.
 */
export function Card({
  raised = false, style, children, ...rest
}: { raised?: boolean } & ViewProps) {
  return (
    <View style={[styles.card, raised && styles.raised, style]} {...rest}>
      {children}
    </View>
  )
}

/**
 * One row shape for every object in the product — a job, an application, an
 * interest, a connection, a chat.
 *
 * The status pill is always right-aligned. A column of pills that starts in a
 * different place on each row cannot be read downward at speed, which is the
 * only way these lists are ever read.
 */
export function ObjectRow({
  title, meta, status, thumb, muted = false, onPress, last = false,
}: {
  title: string
  meta?: string
  status?: React.ReactNode
  thumb?: React.ReactNode
  /** Closed, archived, expired — everything greys and nothing invites a press. */
  muted?: boolean
  onPress?: () => void
  last?: boolean
}) {
  const Container: React.ElementType = onPress ? Pressable : View
  return (
    <Container
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={[styles.row, last && styles.rowLast]}
    >
      {thumb}
      <View style={styles.grow}>
        <Body size="md" weight="semibold" tone={muted ? 'subtle' : 'default'} numberOfLines={1}>
          {title}
        </Body>
        {!!meta && (
          <Body size="xs" tone={muted ? 'subtle' : 'muted'} numberOfLines={1} style={styles.rowMeta}>
            {meta}
          </Body>
        )}
      </View>
      {status}
    </Container>
  )
}

/**
 * Exactly one per screen, at the top of Home.
 *
 * The ink border plus the red dot is the only combination in the system that
 * earns this much weight — which is what makes it work. A second one on the
 * same screen destroys the first, so this is a component you are meant to feel
 * slightly nervous about reaching for twice.
 */
export function NextAction({
  label = 'Do this next', title, body, action, aside,
}: { label?: string; title: string; body?: string; action?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <View style={[styles.card, styles.raised, styles.nextAction]}>
      <View style={styles.nextLabel}>
        <View style={styles.nextDot} />
        <Eyebrow tone="accent">{label}</Eyebrow>
      </View>
      <Display level="sm" style={styles.nextTitle}>
        {title}
      </Display>
      {!!body && (
        <Body size="sm" tone="muted" style={styles.nextBody}>
          {body}
        </Body>
      )}
      {!!(action || aside) && (
        <View style={styles.nextRow}>
          {action}
          {aside}
        </View>
      )}
    </View>
  )
}

/**
 * Progress against the gate that unlocks booking.
 *
 * The gate is drawn as a notch, because a bare "65%" means nothing to someone
 * who does not know the threshold — the only question they have is "can I book
 * yet", and the notch answers it without a sentence.
 */
export function ProgressBar({
  pct, gate, tone = 'accent', thin = false,
}: { pct: number; gate?: number; tone?: 'accent' | 'ink' | 'warning'; thin?: boolean }) {
  const fill = { accent: color.accent, ink: color.text, warning: color.warning }[tone]
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(pct), min: 0, max: 100 }}
      style={[styles.track, thin && styles.trackThin]}
    >
      <View style={[styles.fill, { width: `${Math.min(100, pct)}%`, backgroundColor: fill }]} />
      {gate != null && <View style={[styles.notch, { left: `${gate}%` }]} />}
    </View>
  )
}

export function CompletionCard({ pct, gate = 80, note }: { pct: number; gate?: number; note?: string }) {
  return (
    <Card style={styles.completion}>
      <View style={styles.completionHead}>
        <Body size="xs" weight="medium">
          Profile completion
        </Body>
        <Display level="sm">{`${pct}%`}</Display>
      </View>
      <ProgressBar pct={pct} gate={gate} />
      <Body size="xs" tone="muted" style={styles.completionNote}>
        {note ?? `Booking unlocks at ${gate}% — the marker shows how far that is.`}
      </Body>
    </Card>
  )
}

/**
 * One line of an interviewer's scorecard. The number is serif because it is
 * content the student paid for, not interface chrome. Employers never see this.
 */
export function ScoreRow({
  label, value, outOf = 10, emphasis = false,
}: { label: string; value: number; outOf?: number; emphasis?: boolean }) {
  return (
    <View style={styles.score}>
      <View style={styles.scoreHead}>
        <Body size="xs" weight="medium">
          {label}
        </Body>
        <Body size="lg">
          {value}
          <Body size="lg" style={{ color: color.borderStrong }}>{`/${outOf}`}</Body>
        </Body>
      </View>
      <ProgressBar pct={(value / outOf) * 100} tone={emphasis ? 'accent' : 'ink'} thin />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.lg,
  },
  raised: {
    shadowColor: color.ink,
    shadowOpacity: 0.12,
    shadowRadius: radius.lg,
    shadowOffset: { width: 0, height: space.md },
    elevation: 4,
  },
  grow: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowMeta: { marginTop: space['2xs'] },

  nextAction: { borderColor: color.ink, padding: space.xl },
  nextLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nextDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.accent },
  nextTitle: { marginTop: space.md },
  nextBody: { marginTop: space.sm },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },

  track: {
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSunken,
    overflow: 'hidden',
  },
  trackThin: { height: space.xs },
  fill: { height: '100%', borderRadius: radius.pill },
  notch: { position: 'absolute', top: 0, bottom: 0, width: borderWidth.medium, backgroundColor: color.text },

  completion: { padding: space.xl, gap: space.md },
  completionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  completionNote: {},

  score: { gap: space.sm },
  scoreHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
})
