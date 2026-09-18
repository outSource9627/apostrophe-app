import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { borderWidth, color, radius, space } from '../../theme'
import { Body, Card, Eyebrow, Meta, StatusPill, text } from '../ui'
import type { EmployerState, Requirement } from '../../lib/api/employer'
import {
  requirementKindLine, requirementPill, requirementReason, requirementTimes, requirementTitle,
} from '../../lib/employer/state'
import { Glyph } from './parts'

/**
 * EM-06 · one requirement's row. Status is per document, never one chip for
 * the account: the pill, the stamps, the reviewer's reason and the way on all
 * belong to the row they are about.
 *
 * Order inside the row is fixed — pill first, then the document, then its
 * times (Asia/Kolkata, mono), then the reason well, then the action — so a
 * column of rows reads downward at speed. Everything but `action` and `after`
 * is derived from the requirement by lib/employer/state, the same functions
 * the web row calls.
 *
 * The reason well is danger on dangerSoft for a refusal and warning on
 * warningSoft for a request. Neither is crimson; a status is none of the
 * accent's four jobs.
 */
export function DocumentStatusRow({
  requirement, state, title, fileName, times: timesOverride, action, after,
}: {
  requirement: Requirement
  state: Pick<EmployerState, 'verification'>
  /**
   * Overrules the derived title — 'Your submission' for a request that names no
   * document, which has no requirement of its own (the web row's `title`).
   */
  title?: string
  /** The file as the employer chose it, when this session still knows it. The record does not keep names. */
  fileName?: string
  /**
   * The stamps, when a screen keeps fewer than the full history — home (EM-04 ·
   * Rejected) keeps only the decision's, as the web row does. Omit for all of them.
   */
  times?: string[]
  /** The row's own way on — Resubmit on a refusal, Add on a request. */
  action?: React.ReactNode
  /** One line under the action: what happens after they press it. */
  after?: string
}) {
  const pill = requirementPill(requirement, 'row')
  const kindLine = requirementKindLine(requirement)
  const times = timesOverride ?? requirementTimes(requirement, state)
  const reason = requirementReason(requirement)

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <StatusPill tone={pill.tone} label={pill.label} />
        <View style={styles.names}>
          <Text style={text.uiBaseSemi}>{title ?? requirementTitle(requirement)}</Text>
          {!!kindLine && (
            <Body size="sm" tone="muted">
              {kindLine}
            </Body>
          )}
        </View>
      </View>

      {!!fileName && (
        <View style={styles.file}>
          <Glyph name="file" tint={color.textMuted} />
          <Body size="sm" weight="medium" style={styles.grow}>
            {fileName}
          </Body>
        </View>
      )}

      {times.length > 0 && (
        <View style={[styles.times, fileName ? styles.timesAfterFile : null]}>
          {times.map((t) => (
            <Meta key={t}>{t}</Meta>
          ))}
        </View>
      )}

      {!!reason && (
        <View style={[styles.well, reason.tone === 'danger' ? styles.wellDanger : styles.wellWarning]}>
          <Eyebrow tone={reason.tone === 'danger' ? 'danger' : undefined} style={reason.tone === 'warning' && styles.warningInk}>
            {reason.label}
          </Eyebrow>
          <Body size="sm">{reason.text}</Body>
        </View>
      )}

      {!!action && <View style={styles.action}>{action}</View>}

      {!!after && (
        <Body size="xs" tone="muted" style={styles.after}>
          {after}
        </Body>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { padding: space.lg },
  grow: { flex: 1 },
  head: { alignItems: 'flex-start', gap: space.sm },
  names: { gap: space['2xs'] },
  file: { marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  times: { marginTop: space.sm, gap: space['2xs'] },
  timesAfterFile: { marginTop: space.xs },
  well: {
    marginTop: space.md,
    gap: space.xs,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  wellDanger: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder },
  wellWarning: { backgroundColor: color.warningSoft, borderColor: 'transparent' },
  warningInk: { color: color.warning },
  action: { marginTop: space.md },
  after: { marginTop: space.sm },
})
