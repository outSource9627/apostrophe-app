import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Logo, LogoMark } from '../components/Logo'
import { color, space, radius, fontSize, fontWeight, fontFamilyNative, borderWidth, leading, opacity, trackingNative } from '../theme'

type Props = {
  onGetHired: () => void
  onWantToHire: () => void
  onSignIn: () => void
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
export function WelcomeScreen({ onGetHired, onWantToHire, onSignIn }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: insets.bottom + space['3xl'] }}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <Logo size={18} />
        <Pressable onPress={onSignIn} hitSlop={8}>
          <Text style={styles.signIn}>Sign in</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>APOSTROPHE · HUMAN-FIRST HIRING</Text>
        <Text style={styles.headline}>Beyond Resumes.</Text>
        <Text style={[styles.headline, styles.headlineItalic]}>Meet the Person.</Text>
        <Text style={styles.lede}>
          A hiring platform built around verified interview videos and structured stories — so
          employers understand who you actually are, not just what fits on a page.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={onGetHired}
          accessibilityRole="button"
        >
          <Text style={styles.primaryLabel}>Get Hired</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={onWantToHire}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLabel}>Want to Hire</Text>
        </Pressable>
      </View>

      <View style={styles.markBand}>
        <LogoMark size={92} />
      </View>

      <View style={styles.pillars}>
        {PILLARS.map((p) => (
          <View key={p.n} style={styles.pillar}>
            <Text style={styles.pillarNumber}>{p.n}</Text>
            <Text style={styles.pillarTitle}>{p.title}</Text>
            <Text style={styles.pillarBody}>{p.body}</Text>
          </View>
        ))}
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
  signIn: { fontSize: fontSize.base, color: color.textMuted },

  hero: { paddingHorizontal: space.xl, paddingTop: space['3xl'] },
  eyebrow: { fontSize: fontSize.xs, letterSpacing: trackingNative.eyebrowTight, color: color.textSubtle },
  headline: {
    marginTop: space.md, fontSize: fontSize['4xl'], lineHeight: fontSize['4xl'] * leading['106'],
    color: color.text, fontFamily: fontFamilyNative.displayFallback, letterSpacing: trackingNative.tightest,
  },
  headlineItalic: { marginTop: 0, fontStyle: 'italic', color: color.textMuted },
  lede: {
    marginTop: space.xl, fontSize: fontSize.lg, lineHeight: fontSize.lg * leading['155'],
    color: color.textMuted,
  },

  primary: {
    marginTop: space['2xl'], backgroundColor: color.accent, borderRadius: radius.pill,
    paddingVertical: space.lg, alignItems: 'center',
  },
  primaryLabel: { color: color.textInverse, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  secondary: {
    marginTop: space.md, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong,
    paddingVertical: space.lg, alignItems: 'center',
  },
  secondaryLabel: { color: color.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  pressed: { opacity: opacity.pressed },

  markBand: {
    marginTop: space['4xl'], paddingVertical: space['4xl'], alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },

  pillars: { paddingHorizontal: space.xl, paddingTop: space['3xl'], gap: space['2xl'] },
  pillar: { gap: space.xs },
  pillarNumber: { fontSize: fontSize.sm, color: color.textSubtle },
  pillarTitle: { fontSize: fontSize['2xl'], fontFamily: fontFamilyNative.displayFallback, color: color.text, letterSpacing: trackingNative.tight },
  pillarBody: { fontSize: fontSize.base, lineHeight: fontSize.base * leading['155'], color: color.textMuted },
})
