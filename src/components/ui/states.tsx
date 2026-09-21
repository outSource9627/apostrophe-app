import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { borderWidth, color, height, radius, space } from '../../theme'
import { Body, Display } from './Type'
import { text } from './typography'

/**
 * Foundations §10 — the six screen states.
 *
 * Every list, feed and detail view ships all six. Two rules run through them,
 * and both exist because of what a person is actually thinking at that moment:
 *
 *   An empty state always names the next action. An empty list with no way
 *   forward is a dead end, and the person cannot tell whether they did
 *   something wrong.
 *
 *   An error state always says whether money or data moved. That is the only
 *   question anyone has when something fails, and answering it first is worth
 *   more than an apology or an error code.
 */

/**
 * Skeletons in the shape of the real content — never a spinner on a list
 * screen. A spinner says "wait"; a skeleton says what is about to arrive, which
 * on a mid-range Android over a poor connection is the difference between a
 * slow screen and a broken one.
 */
export function Skeleton({ lines = 3, block = true }: { lines?: number; block?: boolean }) {
  const widths = ['75%', '92%', '54%', '66%', '83%'] as const
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={[styles.bar, { width: widths[i % widths.length] }]} />
      ))}
      {block && <View style={styles.blockBar} />}
    </View>
  )
}

function Shell({
  glyph, title, body, action,
}: { glyph?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.shell}>
      {glyph}
      <Display level="xs">{title}</Display>
      {!!body && (
        <Body size="xs" tone="muted" style={styles.center}>
          {body}
        </Body>
      )}
      {action}
    </View>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return <Shell glyph={<View style={styles.emptyGlyph} />} title={title} body={body} action={action} />
}

export function ErrorState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Shell
      glyph={
        <View style={styles.errorGlyph}>
          <Text style={[text.displayXs, { color: color.danger }]}>!</Text>
        </View>
      }
      title={title}
      body={body}
      action={action}
    />
  )
}

export function SuccessState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Shell
      glyph={
        <View style={styles.successGlyph}>
          <Svg viewBox="0 0 16 16" width={space.lg} height={space.lg}>
            <Path
              d="M3 8.5 6.5 12 13 4.5"
              stroke={color.success}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      }
      title={title}
      body={body}
      action={action}
    />
  )
}

/**
 * Something is genuinely in flight and the person must not close the app.
 *
 * States the money position first, gives an honest upper bound on the wait, and
 * shows a reference they can quote — a payment that "cannot be lost" is only
 * reassuring if there is something to point at when they call.
 */
export function PendingState({
  label, title, body, reference, elapsed,
}: { label: string; title: string; body?: string; reference?: string; elapsed?: string }) {
  return (
    <View style={styles.pending} accessibilityLiveRegion="polite">
      <View style={styles.pendingHead}>
        <ActivityIndicator size="small" color={color.warning} />
        <Text style={[text.metaSm, { color: color.warning }]}>{label}</Text>
      </View>
      <Display level="xs">{title}</Display>
      {!!body && (
        <Body size="xs" tone="muted">
          {body}
        </Body>
      )}
      {!!(reference || elapsed) && <Text style={text.metaMd}>{[reference, elapsed].filter(Boolean).join(' · ')}</Text>}
    </View>
  )
}

/**
 * The sixth state: the action exists but is not available yet, and the reason
 * is part of the component. A greyed button on its own is the most common way a
 * product loses someone at the last step.
 */
export function DisabledAction({
  action, reason, tone = 'warning', escape,
}: { action: React.ReactNode; reason: string; tone?: 'warning' | 'neutral'; escape?: React.ReactNode }) {
  return (
    <View style={styles.disabled}>
      {action}
      <View style={styles.reasonRow}>
        <View
          style={[styles.reasonDot, { backgroundColor: tone === 'warning' ? color.warning : color.borderStrong }]}
        />
        <Body size="xs" tone="muted" style={styles.grow}>
          {reason}
        </Body>
      </View>
      {escape}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  center: { textAlign: 'center' },

  skeleton: { gap: space.md, padding: space.xl },
  bar: { height: space.md, borderRadius: radius.sm, backgroundColor: color.surfaceSunken },
  blockBar: {
    height: height.tap + space.xl,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
    marginTop: space.xs,
  },

  shell: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space['3xl'] },
  emptyGlyph: {
    width: height.tap,
    height: height.tap,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    borderStyle: 'dashed',
  },
  errorGlyph: {
    width: height.tap,
    height: height.tap,
    borderRadius: radius.pill,
    borderWidth: borderWidth.medium,
    borderColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successGlyph: {
    width: height.tap,
    height: height.tap,
    borderRadius: radius.pill,
    backgroundColor: color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pending: { gap: space.md, paddingHorizontal: space.xl, paddingVertical: space['2xl'] },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  disabled: { gap: space.md },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  reasonDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, marginTop: space.sm },
})
