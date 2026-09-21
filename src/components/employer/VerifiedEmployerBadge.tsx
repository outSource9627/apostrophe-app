import React from 'react'
import { StyleSheet, Text, View, type ViewProps } from 'react-native'
import { color, radius, space } from '../../theme'
import { text } from '../ui'
import { Glyph } from './parts'

/**
 * The Verified Employer badge (EM-06 approved, EM-07, every Interest after).
 *
 * It shares NO rule with VerifiedSeal, the Verified Interview mark, on purpose.
 * A candidate can see both on one screen, and must never read the company's
 * badge as an interview's certificate:
 *
 *                  VerifiedSeal            VerifiedEmployerBadge
 *   colour         crimson (accent)        success on successSoft
 *   shape          999 pill                radius-4 tag
 *   glyph          seal / tick             shield with a tick
 *
 * Absent, never greyed: a pending company simply does not draw this.
 */
export function VerifiedEmployerBadge({ style }: { style?: ViewProps['style'] }) {
  return (
    <View accessible accessibilityLabel="Verified employer" style={[styles.tag, style]}>
      <Glyph name="shieldCheck" size={space.md} tint={color.success} />
      <Text style={[text.metaPill, styles.label]}>Verified employer</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    backgroundColor: color.successSoft,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  label: { color: color.success },
})
