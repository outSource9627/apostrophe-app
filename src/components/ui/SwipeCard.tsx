import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { borderWidth, color, height, radius, space } from '../../theme'
import { Body, Display, Eyebrow } from './Type'
import { Button, IconButton } from './Button'
import { Tag } from './controls'
import { text } from './typography'

/**
 * The job feed card, and the row of actions under it.
 *
 * Two things about the gesture are deliberate and worth not "fixing" later.
 *
 * Right means SAVE, not apply. Saving is private and reversible; applying is
 * always a separate, deliberate step. The stamp says "Save" for exactly that
 * reason — a stamp reading "Apply" would make an irreversible thing feel like a
 * flick of the thumb.
 *
 * The same gesture means "shortlist" on the employer side. That collision is
 * open with the designer (Foundations §01) and is a product decision, not a
 * component one — this component only ever claims to save.
 *
 * Presentational only: it renders a card and reports intent. The drag itself,
 * the deck, and what a save DOES all belong to the screen.
 */
export function SwipeCard({
  title, company, location, salary, skills = [], stamp, onOpen,
}: {
  title: string
  company: string
  location?: string
  salary?: string
  skills?: string[]
  /** Which stamp is showing as the card is dragged. */
  stamp?: 'save' | 'pass' | null
  onOpen?: () => void
}) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Display level="md">{title}</Display>
        <Body size="sm" tone="muted" style={styles.company}>
          {[company, location].filter(Boolean).join(' · ')}
        </Body>

        {!!salary && (
          <View style={styles.salaryRow}>
            <Eyebrow>Salary</Eyebrow>
            <Text style={text.displaySm}>{salary}</Text>
          </View>
        )}

        {skills.length > 0 && (
          <View style={styles.skills}>
            {skills.map((s) => (
              <Tag key={s} label={s} />
            ))}
          </View>
        )}

        {/* Reading the full job is always available without swiping — the
            gesture is a shortcut, never the only way through. */}
        <Button variant="outline" size="md" full label="View full job" onPress={onOpen} />
      </View>

      {stamp === 'save' && (
        <View style={[styles.stamp, styles.stampSave]}>
          <Text style={[text.metaSm, styles.stampSaveText]}>Save</Text>
        </View>
      )}
      {stamp === 'pass' && (
        <View style={[styles.stamp, styles.stampPass]}>
          <Text style={[text.metaSm, styles.stampPassText]}>Pass</Text>
        </View>
      )}
    </View>
  )
}

/**
 * Pass, undo, save. Undo sits between the two destructive-feeling actions on
 * purpose: it is the thing you reach for immediately after a mis-swipe, and it
 * should be under the thumb that just made the mistake.
 */
export function SwipeActions({
  onPass, onSave, onUndo, undoLabel = 'Undo', canUndo = false,
}: {
  onPass?: () => void
  onSave?: () => void
  onUndo?: () => void
  undoLabel?: string
  canUndo?: boolean
}) {
  return (
    <View style={styles.actions}>
      <IconButton tone="outline" size="lg" label="Pass" onPress={onPass}>
        <Svg viewBox="0 0 16 16" width={space.lg} height={space.lg}>
          <Path d="M4 4l8 8M12 4l-8 8" stroke={color.textMuted} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </IconButton>

      <View style={[styles.undo, canUndo ? styles.undoOn : styles.undoOff]}>
        <Body size="xs" weight="semibold" tone={canUndo ? 'default' : 'subtle'} onPress={canUndo ? onUndo : undefined}>
          {undoLabel}
        </Body>
      </View>

      <IconButton tone="accent" size="lg" label="Save" onPress={onSave}>
        <Svg viewBox="0 0 16 16" width={space.lg} height={space.lg}>
          <Path
            d="M3 8.5 6.5 12 13 4.5"
            stroke={color.textInverse}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </IconButton>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: color.ink,
    shadowOpacity: 0.12,
    shadowRadius: radius.lg,
    shadowOffset: { width: 0, height: space.md },
    elevation: 4,
  },
  body: { padding: space.xl, gap: space.md },
  company: {},
  salaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  stamp: {
    position: 'absolute',
    top: space.xl,
    borderWidth: borderWidth.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.surface,
  },
  stampSave: { left: space.xl, borderColor: color.success, transform: [{ rotate: '-11deg' }] },
  stampPass: { right: space.xl, borderColor: color.textSubtle, transform: [{ rotate: '11deg' }] },
  stampSaveText: { color: color.success },
  stampPassText: { color: color.textMuted },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  undo: {
    flex: 1,
    height: height.tap,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  undoOn: { backgroundColor: color.surfaceMuted },
  undoOff: { backgroundColor: color.surface },
})
