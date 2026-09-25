import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { borderWidth, color, opacity, space, spaceHalf } from '../../theme'
import { text } from '../ui'
import { Icon, type IconName } from '../ui/Icon'
import type { EmployerTone, PromptCopy } from '../../lib/employer/state'

/**
 * EM-04 · the verification prompt. Shell furniture: the Banner in its pinned
 * placement — full-bleed under the app bar, no radius — on every screen an
 * unverified employer can reach. EmployerShell draws it; no screen draws its own.
 *
 * One object, five states, and the state is the only thing that changes it:
 *
 *   todo      neutral   nothing submitted; names what is outstanding
 *   review    info      with a reviewer; names the decision target as a time
 *   moreInfo  warning   a request: something to ADD, nothing refused
 *   rejected  danger    a refusal: names the document, keeps what passed
 *   verified  success   the last state, once, on the screen that watched it
 *
 * Built in rather than left to a screen:
 *   - Never crimson. The tone table below has no accent entry and cannot take one.
 *   - Never dismissible. There is no close control to draw.
 *   - The whole block is the link to where its state is resolved, so there is
 *     no second button competing with the screen's own primary. On that screen
 *     (`here`) it is the same block without the chevron, and not pressable.
 *
 * It is not the library Banner itself: that one is rounded, inline, and draws
 * its own per-tone icons, where this carries the board's glyphs and a chevron.
 * The tones are the Banner's pairs exactly.
 */
/**
 * The design's strip (Employer Android, every pending frame): a full-width band
 * under the status bar, a 16 icon, the state in bold then its line, and a
 * "Status" link on the right. Review reads amber on the boards, so `info`
 * joins `warning` here.
 */
const TONES: Record<EmployerTone, { bg: string; fg: string; edge: string }> = {
  neutral: { bg: color.surfaceMuted, fg: color.textSecondary, edge: color.border },
  info: { bg: color.warningSoft, fg: color.warningInk, edge: color.warningEdge },
  warning: { bg: color.warningSoft, fg: color.warningInk, edge: color.warningEdge },
  danger: { bg: color.dangerSoft, fg: color.danger, edge: color.dangerBorder },
  success: { bg: color.successSoft, fg: color.success, edge: color.successSoft },
}

const ICON: Record<EmployerTone, IconName> = {
  neutral: 'file', info: 'clock', warning: 'clock', danger: 'alert', success: 'shield',
}

export function VerificationPrompt({
  prompt, here = false, onPress,
}: {
  prompt: PromptCopy
  /** This screen is where the prompt's state is resolved: no link, no press. */
  here?: boolean
  onPress?: () => void
}) {
  // Verified is drawn once, and not on its own destination.
  if (here && prompt.state === 'verified') return null

  const t = TONES[prompt.tone]
  const shell = [styles.shell, { backgroundColor: t.bg, borderBottomColor: t.edge }]
  const alert = prompt.tone === 'danger'

  const inner = (
    <>
      <Icon name={ICON[prompt.tone]} size={space.lg} tint={t.fg} weight={2} />
      <Text style={[text.uiXs, styles.copy, { color: t.fg }]}>
        <Text style={styles.strong}>{prompt.title}</Text>
        {` ${prompt.body}`}
      </Text>
      {!here && <Text style={[text.uiXsSemi, { color: t.fg }]}>Status</Text>}
    </>
  )

  if (here || !onPress) {
    return (
      <View style={shell} accessible accessibilityRole={alert ? 'alert' : 'summary'} accessibilityLiveRegion={alert ? 'assertive' : 'polite'}>
        {inner}
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${prompt.title}. ${prompt.body}`}
      accessibilityLiveRegion={alert ? 'assertive' : 'polite'}
      onPress={onPress}
      style={({ pressed }) => [shell, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceHalf['2.5'],
    paddingVertical: spaceHalf['2.5'],
    paddingHorizontal: space.lg,
    borderBottomWidth: borderWidth.thin,
  },
  pressed: { opacity: opacity.pressed },
  copy: { flex: 1 },
  strong: { fontFamily: text.uiXsSemi.fontFamily },
})
