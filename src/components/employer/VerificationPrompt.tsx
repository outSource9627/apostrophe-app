import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { borderWidth, color, opacity, space } from '../../theme'
import { text } from '../ui'
import type { EmployerTone, PromptCopy } from '../../lib/employer/state'
import { Glyph } from './parts'

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
const TONES: Record<EmployerTone, { bg: string; fg: string; edge: string }> = {
  neutral: { bg: color.surfaceMuted, fg: color.textMuted, edge: 'transparent' },
  info: { bg: color.infoSoft, fg: color.info, edge: 'transparent' },
  warning: { bg: color.warningSoft, fg: color.warning, edge: 'transparent' },
  // A refusal also carries the drained danger hairline, so it reads as a
  // condition on the page rather than as a coloured stripe.
  danger: { bg: color.dangerSoft, fg: color.danger, edge: color.dangerBorder },
  success: { bg: color.successSoft, fg: color.success, edge: 'transparent' },
}

export function VerificationPrompt({
  prompt, here = false, onPress,
}: {
  prompt: PromptCopy
  /** This screen is where the prompt's state is resolved: no chevron, no press. */
  here?: boolean
  onPress?: () => void
}) {
  // Verified is drawn once, and not on its own destination: EM-06 draws the
  // moment in the serif there, and the band's absence is the flip (EM-06 ·
  // Approved, frame 01) — as the web prompt does.
  if (here && prompt.state === 'verified') return null

  const t = TONES[prompt.tone]
  const shell = [styles.shell, { backgroundColor: t.bg, borderColor: t.edge }]
  const alert = prompt.tone === 'danger'

  const inner = (
    <>
      <View style={styles.glyph}>
        <Glyph name={prompt.glyph} tint={t.fg} />
      </View>
      <View style={styles.copy}>
        <Text style={[text.uiBaseSemi, { color: t.fg }]}>{prompt.title}</Text>
        <Text style={[text.uiSm, { color: t.fg }]}>{prompt.body}</Text>
      </View>
      {!here && (
        <View style={styles.chevron}>
          <Glyph name="chevronRight" tint={t.fg} />
        </View>
      )}
    </>
  )

  if (here || !onPress) {
    return (
      <View
        style={shell}
        accessible
        accessibilityRole={alert ? 'alert' : 'summary'}
        accessibilityLiveRegion={alert ? 'assertive' : 'polite'}
      >
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
    alignItems: 'flex-start',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderTopWidth: borderWidth.thin,
    borderBottomWidth: borderWidth.thin,
  },
  pressed: { opacity: opacity.pressed },
  // Optically centred on the title's first line.
  glyph: { marginTop: space.xs },
  copy: { flex: 1, gap: space['2xs'] },
  chevron: { alignSelf: 'center' },
})
