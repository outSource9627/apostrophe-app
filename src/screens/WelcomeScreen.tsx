import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Logo, LogoMark } from '../components/Logo'
import { Body, Button, Display, Eyebrow, Meta } from '../components/ui'
import { color, space, fontSize, fontFamilyNative, height, leading, opacity, trackingNative } from '../theme'

type Props = {
  onGetHired: () => void
  onWantToHire: () => void
  /** Employer registration (EM-02). A text action, never a second crimson. */
  onCreateEmployer: () => void
  onSignIn: () => void
  /** Interviewer recruitment (Settled Decision D6). */
  onJoinUs?: () => void
}

const PILLARS = [
  { n: '01', title: 'Verified interviews',
    body: 'Every candidate sits a live interview with a real person.' },
  { n: '02', title: 'Signal, not noise',
    body: 'Structured profiles beyond bullet points — skills, experience, aspirations.' },
  { n: '03', title: 'Swipe to shortlist',
    body: 'Employers move with intent. Right to shortlist, left to pass.' },
]

/**
 * The app's first screen. Mirrors the web landing — same words, same mark, same
 * crimson — because PRD section 7 treats any divergence between the two
 * surfaces as a defect, and that starts with what a person sees first.
 */
export function WelcomeScreen({ onGetHired, onWantToHire, onCreateEmployer, onSignIn, onJoinUs }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: insets.bottom + space['3xl'] }}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <Logo size={18} />
        <Pressable onPress={onSignIn} hitSlop={8}>
          <Body size="base" tone="muted">Sign in</Body>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Eyebrow>APOSTROPHE · HUMAN-FIRST HIRING</Eyebrow>
        <Text style={styles.headline}>Beyond Resumes.</Text>
        <Text style={[styles.headline, styles.headlineItalic]}>Meet the Person.</Text>
        <Body size="base" tone="muted" style={styles.lede}>
          A hiring platform built around verified interview videos and structured stories — so
          employers understand who you actually are, not just what fits on a page.
        </Body>

        {/* The one primary action on this screen — see the accent-colour rule. */}
        <Button variant="primary" size="lg" full label="Get Hired" onPress={onGetHired} style={styles.primary} />
        <Button variant="outline" size="lg" full label="Want to Hire" onPress={onWantToHire} style={styles.secondary} />
      </View>

      <View style={styles.markBand}>
        <LogoMark size={92} />
      </View>

      <View style={styles.pillars}>
        {PILLARS.map((p) => (
          <View key={p.n} style={styles.pillar}>
            <Meta>{p.n}</Meta>
            <Display level="md">{p.title}</Display>
            <Body size="base" tone="muted">{p.body}</Body>
          </View>
        ))}
      </View>

      {/* The page ends on the employer's and interviewer's way in. */}
      <View style={styles.employer}>
        <Pressable
          onPress={onCreateEmployer}
          accessibilityRole="button"
          style={({ pressed }) => [styles.employerAction, pressed && styles.pressed]}
        >
          <Body size="md" weight="semibold" style={styles.employerLabel}>Hiring? Create an employer account</Body>
        </Pressable>
        {onJoinUs && (
          <Pressable
            onPress={onJoinUs}
            accessibilityRole="button"
            style={({ pressed }) => [styles.employerAction, pressed && styles.pressed, { marginTop: space.sm }]}
          >
            <Body size="md" weight="semibold" style={styles.employerLabel}>Evaluate talent? Interview on Apostrophe →</Body>
          </Pressable>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.xl, paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border,
  },

  hero: { paddingHorizontal: space.xl, paddingTop: space['3xl'] },
  // The marketing hero step (display-xl, 48px) sits above `Display`'s own
  // ceiling (`lg`, 36px) — see Foundations §03 / tokens.ts on `display-xl` vs
  // `display-2xl` — so this stays a token-driven Text rather than <Display>.
  headline: {
    marginTop: space.md, fontSize: fontSize['display-xl'], lineHeight: fontSize['display-xl'] * leading.display,
    color: color.text, fontFamily: fontFamilyNative.displayFallback, letterSpacing: trackingNative['tight-sm'],
  },
  headlineItalic: { marginTop: 0, fontStyle: 'italic', color: color.textMuted },
  lede: { marginTop: space.xl },

  primary: { marginTop: space['2xl'] },
  secondary: { marginTop: space.md },

  markBand: {
    marginTop: space['4xl'], paddingVertical: space['4xl'], alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },

  pillars: { paddingHorizontal: space.xl, paddingTop: space['3xl'], gap: space['2xl'] },
  pillar: { gap: space.xs },

  employer: {
    marginTop: space['3xl'], marginHorizontal: space.xl, paddingTop: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border, alignItems: 'flex-start',
  },
  employerAction: { minHeight: height.tap, justifyContent: 'center' },
  employerLabel: { textDecorationLine: 'underline', textDecorationColor: color.borderStrong },
  pressed: { opacity: opacity.pressed },
})
