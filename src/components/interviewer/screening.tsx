import React, { useEffect, useRef } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import {
  borderWidth, color, fontFamilyNative as FF, fontSize, height, leadingNative, opacity, radius, shadow, space, spaceHalf, trackingNative,
} from '../../theme'
import { Button } from '../ui/Button'
import { Icon, type IconName } from '../ui/Icon'
import { text } from '../ui/typography'
import { EmIconButton, EmSheet } from '../employer/em'
import type { ScreeningQuestion } from '../../lib/api/screening'
import { LOW_TIME_MS, SECTION_NAME, SECTION_SHORT, mmss, type SectionRun } from '../../lib/interviewer/screening'

/**
 * The interviewer screening test's pieces (docs/screening-test-mockups.html ·
 * app), so the screen file holds the logic and these hold the drawing. The
 * apply flow keeps its red brand header; the test itself is a calm light
 * screen: a slim bar with the time left, a strip per section, one question,
 * four answers. Tokens only; nothing here is set in capitals.
 */

const LETTERS = ['A', 'B', 'C', 'D']

// ── buttons ──────────────────────────────────────────────────────────────────

/** The 50 pill with a trailing chevron — "Start the test" (white, on ink) and "Next" (accent). */
export function ArrowButton({
  label, onPress, tone = 'accent', icon = 'chevR', style,
}: { label: string; onPress: () => void; tone?: 'accent' | 'white'; icon?: IconName | null; style?: StyleProp<ViewStyle> }) {
  const tint = tone === 'white' ? color.ink : color.textInverse
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.arrowBtn, tone === 'white' ? styles.arrowWhite : styles.arrowAccent, pressed && styles.pressed, style]}
    >
      <Text style={[styles.arrowLabel, { color: tint }]}>{label}</Text>
      {!!icon && <Icon name={icon} size={space.lg + space['2xs']} tint={tint} weight={2} />}
    </Pressable>
  )
}

// ── the received screen's next step ─────────────────────────────────────────

/** The dark "Next step" card under "Application received.". */
export function NextStepCard({ total, minutes, onStart }: { total: number; minutes: number; onStart: () => void }) {
  return (
    <View style={styles.nextCard}>
      <Text style={styles.nextKicker}>Next step</Text>
      <Text style={styles.nextTitle} accessibilityRole="header">Take your screening test</Text>
      <View style={styles.nextChips}>
        {[`${total} questions`, `${minutes} minutes`, 'One attempt'].map((c) => (
          <View key={c} style={styles.nextChip}><Text style={styles.nextChipText}>{c}</Text></View>
        ))}
      </View>
      <ArrowButton tone="white" label="Start the test" onPress={onStart} style={styles.nextStart} />
    </View>
  )
}

// ── the test ─────────────────────────────────────────────────────────────────

/** The slim top bar: the name and "Question n of N", the time left (amber in the last five minutes), the map. */
export function TestBar({ position, total, leftMs, onMap }: { position: number; total: number; leftMs: number; onMap?: () => void }) {
  const low = leftMs <= LOW_TIME_MS
  const clock = mmss(leftMs)
  return (
    <View style={styles.bar}>
      <View style={styles.grow}>
        <Text style={styles.barTitle} accessibilityRole="header">Screening test</Text>
        <Text style={styles.barSub}>{`Question ${position + 1} of ${total}`}</Text>
      </View>
      <View style={[styles.timer, low && styles.timerLow]} accessibilityLabel={`Time left ${clock}`}>
        <Icon name="clock" size={spaceHalf['3.5']} tint={low ? color.warning : color.text} weight={2} />
        <Text style={[styles.timerText, low && styles.timerTextLow]}>{clock}</Text>
      </View>
      {!!onMap && (
        <EmIconButton name="grid" label="Questions" size={height['chip-lg']} iconSize={space.lg + space['2xs']} tint={color.textSecondary} bordered="soft" onPress={onMap} />
      )}
    </View>
  )
}

/** One strip per section, sized by its question count; the current one says how far it is. */
export function SectionStrips({ runs, current }: { runs: SectionRun[]; current: string }) {
  return (
    <View style={styles.strips}>
      {runs.map((r) => {
        const on = r.section === current
        const count = r.positions.length
        return (
          <View key={r.section} style={[styles.strip, { flexGrow: count }]}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((r.answered / count) * 100)}%` }]} />
            </View>
            <Text style={[styles.stripLabel, on && styles.stripLabelOn]} numberOfLines={1}>
              {on ? `${SECTION_NAME[r.section]} ${r.answered}/${count}` : SECTION_SHORT[r.section]}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** The section and, for a technical question, its domain. */
export function QuestionHead({ q }: { q: ScreeningQuestion }) {
  return (
    <View style={styles.qsec}>
      <Text style={styles.qsecText}>{SECTION_NAME[q.section]}</Text>
      {!!q.domain && <Text style={styles.qsecDomain} numberOfLines={1}>{`· ${q.domain}`}</Text>}
    </View>
  )
}

export function QuestionText({ children }: { children: string }) {
  return <Text style={styles.qtext}>{children}</Text>
}

/** An answer: the A–D disc and the option. A tap picks it. */
export function OptionCard({ at, label, on, onPress }: { at: number; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${LETTERS[at]}. ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.opt, on && styles.optOn, pressed && styles.pressed]}
    >
      <View style={[styles.letter, on && styles.letterOn]}>
        <Text style={[text.uiSmSemi, on && styles.onAccent]}>{LETTERS[at] ?? String(at + 1)}</Text>
      </View>
      <Text style={styles.optText}>{label}</Text>
    </Pressable>
  )
}

/** The tick under the answers once the server has the pick. */
export function SavedMark() {
  return (
    <View style={styles.saved} accessibilityLiveRegion="polite">
      <Icon name="check" size={spaceHalf['3.5']} tint={color.success} weight={2.6} />
      <Text style={styles.savedText}>Saved</Text>
    </View>
  )
}

/** Under the strips while the phone has no network. */
export function OfflineBanner() {
  return (
    <View style={styles.offline} accessibilityLiveRegion="polite">
      <View style={styles.offlineIcon}><Icon name="wifi" size={space.lg + space['2xs']} tint={color.textSecondary} /></View>
      <View style={styles.grow}>
        <Text style={text.uiMdSemi}>You’re offline</Text>
        <Text style={[text.uiSm, styles.muted]}>Your last answer will save when you’re back. The clock keeps running.</Text>
      </View>
    </View>
  )
}

// ── the question map ─────────────────────────────────────────────────────────

/**
 * The sheet the grid opens: every question by section, the answered ones
 * filled, the current one ringed in ink. A number jumps there. Submit lives here.
 */
export function QuestionMap({
  open, onClose, runs, questions, answers, current, total, answered, onJump, onSubmit,
}: {
  open: boolean
  onClose: () => void
  runs: SectionRun[]
  questions: ScreeningQuestion[]
  answers: Array<number | null>
  current: number
  total: number
  answered: number
  onJump: (position: number) => void
  onSubmit: () => void
}) {
  const { width } = useWindowDimensions()
  // Eight to a row across the sheet's body (its gutter is space.xl a side).
  const cell = Math.floor((width - space.xl * 2 - spaceHalf['1.5'] * 7) / 8)
  return (
    <EmSheet open={open} onClose={onClose}>
      <View style={styles.mapHead}>
        <Text style={styles.mapTitle} accessibilityRole="header">Questions</Text>
        <Text style={[text.uiSm, styles.muted]}>{`${answered} of ${total} answered`}</Text>
      </View>
      {runs.map((r) => (
        <View key={r.section} style={styles.mapGroup}>
          <Text style={styles.mapGroupTitle}>{`${SECTION_NAME[r.section]} · ${r.positions.length}`}</Text>
          <View style={styles.mapGrid}>
            {r.positions.map((pos) => {
              const done = answers[questions[pos].index] != null
              const here = pos === current
              return (
                <Pressable
                  key={pos}
                  accessibilityRole="button"
                  accessibilityLabel={`Question ${pos + 1}${done ? ', answered' : ''}`}
                  onPress={() => onJump(pos)}
                  style={({ pressed }) => [styles.cell, { width: cell }, done && styles.cellDone, here && styles.cellHere, pressed && styles.pressed]}
                >
                  <Text style={[styles.cellText, done && styles.onAccent, here && !done && styles.cellTextHere]}>{String(pos + 1)}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
      <View style={styles.mapKey}>
        <View style={styles.keyItem}><View style={[styles.swatch, styles.cellDone]} /><Text style={[text.uiXs, styles.muted]}>Answered</Text></View>
        <View style={styles.keyItem}><View style={styles.swatch} /><Text style={[text.uiXs, styles.muted]}>Not yet</Text></View>
        <View style={styles.keyItem}><View style={[styles.swatch, styles.swatchHere]} /><Text style={[text.uiXs, styles.muted]}>You are here</Text></View>
      </View>
      <Button variant="outline" size="block" full label="Submit test" onPress={onSubmit} />
    </EmSheet>
  )
}

// ── dialogs and states ───────────────────────────────────────────────────────

/**
 * A centre dialog in the shared sign-out dialog's shape (components/ui/
 * SignOutDialog): the accent disc, a title and one line, then the main action
 * over a quiet one. While `busy`, nothing but the main action's spinner moves.
 */
export function ScreeningDialog({
  open, onClose, icon = 'test', title, body, primary, secondary, busy,
}: {
  open: boolean
  onClose: () => void
  icon?: IconName
  title: string
  body: string
  primary: { label: string; onPress: () => void }
  secondary: { label: string; onPress: () => void }
  busy?: boolean
}) {
  const settle = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!open) return
    settle.setValue(0)
    Animated.spring(settle, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start()
  }, [open, settle])
  const close = () => { if (!busy) onClose() }
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.dlgWrap}>
        <Pressable accessibilityLabel="Close" disabled={busy} onPress={close} style={styles.scrim} />
        <Animated.View
          style={[styles.dlg, { transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}
          accessibilityViewIsModal
        >
          <View style={styles.disc}><Icon name={icon} size={height.glyph} tint={color.accent} /></View>
          <Text style={styles.dlgTitle} accessibilityRole="header">{title}</Text>
          <Text style={[text.uiMd, styles.dlgBody]}>{body}</Text>
          <View style={styles.dlgActions}>
            <Button variant="primary" size="cta" label={primary.label} busy={busy} onPress={primary.onPress} />
            <View style={busy && styles.off} pointerEvents={busy ? 'none' : 'auto'}>
              <Button variant="quiet" size="block" label={secondary.label} onPress={secondary.onPress} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

export type StateTone = 'ok' | 'amber' | 'quiet'
const STATE_TONE: Record<StateTone, { bg: string; fg: string }> = {
  ok: { bg: color.successSoft, fg: color.success },
  amber: { bg: color.warningSoft, fg: color.warning },
  quiet: { bg: color.surfaceMuted, fg: color.textSecondary },
}

/** A centred edge state — Time's up, expired, already submitted, getting ready. */
export function StateBlock({ icon, tone, title, body }: { icon: IconName; tone: StateTone; title?: string; body?: string }) {
  const t = STATE_TONE[tone]
  return (
    <View style={styles.state}>
      <View style={[styles.stateDisc, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={space.xl + space['2xs']} tint={t.fg} weight={2.2} />
      </View>
      {!!title && <Text style={styles.stateTitle} accessibilityRole="header">{title}</Text>}
      {!!body && <Text style={[text.uiMd, styles.muted, styles.center]}>{body}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  off: { opacity: opacity.disabled },
  muted: { color: color.textMuted },
  center: { textAlign: 'center' },
  onAccent: { color: color.textInverse },

  arrowBtn: {
    height: height['control-cta'], borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.sm, paddingHorizontal: space.xl,
  },
  arrowAccent: { backgroundColor: color.accent },
  arrowWhite: { backgroundColor: color.surface },
  arrowLabel: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-base'] },

  nextCard: { alignSelf: 'stretch', marginTop: spaceHalf['1.5'], padding: space.lg, borderRadius: radius['card-lg'], backgroundColor: color.ink },
  nextKicker: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], lineHeight: leadingNative['meta-md'], color: color.textOnInkMuted },
  nextTitle: {
    marginTop: space.xs, fontFamily: FF.bodyBold, fontSize: fontSize['display-xs'], lineHeight: leadingNative['display-xs'],
    letterSpacing: trackingNative['snug-sm'], color: color.textOnInk,
  },
  nextChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'], marginTop: spaceHalf['2.5'] },
  nextChip: { paddingVertical: space.xs, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill, backgroundColor: color.onInkGround },
  nextChipText: { fontFamily: FF.bodyMedium, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['meta-sm'], color: color.textOnInk },
  nextStart: { marginTop: spaceHalf['3.5'] },

  bar: {
    height: height['screen-header'], flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingHorizontal: space.lg,
    backgroundColor: color.surface, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border,
  },
  barTitle: { fontFamily: FF.bodyBold, fontSize: fontSize['ui-lead'], lineHeight: leadingNative['ui-md'], color: color.text },
  barSub: { fontFamily: FF.bodyMedium, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['meta-sm'], color: color.textMuted, fontVariant: ['tabular-nums'] },
  timer: {
    height: height['control-banner'], flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], paddingHorizontal: space.md,
    borderRadius: radius.pill, backgroundColor: color.surfaceMuted,
  },
  timerLow: { backgroundColor: color.warningSoft },
  timerText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-md'], color: color.text, fontVariant: ['tabular-nums'] },
  timerTextLow: { color: color.warning },

  strips: { flexDirection: 'row', gap: spaceHalf['1.5'], paddingHorizontal: space.lg, paddingTop: space.md },
  strip: { flexBasis: 0, minWidth: 0, gap: space.xs },
  track: { height: height['step-bar'], borderRadius: radius.bar, backgroundColor: color.surfaceSunken, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.bar, backgroundColor: color.accent },
  stripLabel: { fontFamily: FF.bodyMedium, fontSize: fontSize['ui-2xs'], lineHeight: leadingNative['ui-2xs'], color: color.textSubtle },
  stripLabelOn: { fontFamily: FF.bodySemiBold, color: color.text },

  qsec: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  qsecText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['meta-md'], lineHeight: leadingNative['meta-md'], color: color.accentText },
  qsecDomain: { flexShrink: 1, fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], lineHeight: leadingNative['meta-md'], color: color.textMuted },
  qtext: {
    marginTop: spaceHalf['1.5'], fontFamily: FF.bodySemiBold, fontSize: fontSize['display-xs'], lineHeight: leadingNative['display-sm'],
    letterSpacing: trackingNative['snug-xs'], color: color.text,
  },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: height['control-lg'],
    paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.panel,
    borderWidth: borderWidth.medium, borderColor: color.border, backgroundColor: color.surface,
  },
  optOn: { borderColor: color.accent, backgroundColor: color.accentWash },
  letter: {
    width: space['2xl'], height: space['2xl'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    borderWidth: borderWidth.medium, borderColor: color.borderStrong,
  },
  letterOn: { backgroundColor: color.accent, borderColor: color.accent },
  optText: { flex: 1, minWidth: 0, fontFamily: FF.body, fontSize: fontSize['ui-base'], lineHeight: leadingNative['ui-md'], color: color.text },
  saved: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: spaceHalf['3.5'] },
  savedText: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], color: color.success },

  offline: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginHorizontal: space.lg, marginTop: space.md,
    padding: space.md, borderRadius: radius.tile, backgroundColor: color.surfaceMuted,
  },
  offlineIcon: { paddingTop: space['2xs'] },

  mapHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  mapTitle: { fontFamily: FF.bodyBold, fontSize: fontSize['display-row'], lineHeight: leadingNative['display-card'], letterSpacing: trackingNative['snug-sm'], color: color.text },
  mapGroup: { gap: space.sm },
  mapGroupTitle: { fontFamily: FF.bodySemiBold, fontSize: fontSize['meta-md'], lineHeight: leadingNative['meta-md'], color: color.textMuted },
  mapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  cell: {
    height: height['control-banner'], borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: borderWidth.medium, borderColor: color.border, backgroundColor: color.surface,
  },
  cellDone: { backgroundColor: color.accent, borderColor: color.accent },
  cellHere: { borderColor: color.ink },
  cellText: { fontFamily: FF.bodySemiBold, fontSize: fontSize['ui-sm'], color: color.textSecondary, fontVariant: ['tabular-nums'] },
  cellTextHere: { color: color.ink },
  mapKey: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['3.5'] },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: space.md, height: space.md, borderRadius: radius.bar, borderWidth: borderWidth.medium, borderColor: color.border },
  swatchHere: { borderColor: color.ink },

  dlgWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl + space['2xs'] },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  dlg: {
    backgroundColor: color.surface, borderRadius: radius.modal, boxShadow: shadow.frame,
    paddingTop: spaceHalf['6'], paddingHorizontal: space.xl, paddingBottom: space.lg,
  },
  disc: {
    alignSelf: 'center', width: height['control-lg'], height: height['control-lg'], borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentSoft,
  },
  dlgTitle: {
    marginTop: spaceHalf['3.5'], fontFamily: FF.bodyBold, fontSize: fontSize['display-tile'], lineHeight: fontSize['display-tile'] + space.xs,
    letterSpacing: trackingNative['snug-sm'], color: color.text, textAlign: 'center',
  },
  dlgBody: { marginTop: spaceHalf['1.5'], color: color.textMuted, textAlign: 'center' },
  dlgActions: { marginTop: space.xl, gap: space.sm },

  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space['2xl'] },
  stateDisc: { width: height['deck-action-sm'], height: height['deck-action-sm'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { marginTop: space.xs, fontFamily: FF.bodyBold, fontSize: fontSize['ui-lg'], lineHeight: leadingNative['ui-lg'], color: color.text, textAlign: 'center' },
})
