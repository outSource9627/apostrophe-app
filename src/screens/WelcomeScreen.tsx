import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader, Body, Button, Card, Meta, text } from '../components/ui'
import { color, space, height, opacity, trackingNative } from '../theme'

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
      <View style={{ paddingTop: insets.top }}>
        <AppHeader>
          <Pressable onPress={onSignIn} hitSlop={space.md} style={styles.signIn}>
            <Body size="md" weight="semibold" tone="accent">Sign in</Body>
          </Pressable>
        </AppHeader>
      </View>

      <View style={styles.hero}>
        <Text style={[text.metaMd, styles.eyebrow]}>APOSTROPHE · HUMAN-FIRST HIRING</Text>
        <Text style={text.displayGreet}>
          Beyond Resumes.{'\n'}
          <Text style={styles.headlineAccent}>Meet the Person.</Text>
        </Text>
        <Body size="base" tone="muted" style={styles.lede}>
          A hiring platform built around verified interview videos and structured stories — so
          employers understand who you actually are, not just what fits on a page.
        </Body>

        {/* The one primary action on this screen — see the accent-colour rule. */}
        <Button variant="primary" size="lg" full label="Get Hired" onPress={onGetHired} style={styles.primary} />
        <Button variant="outline" size="lg" full label="Want to Hire" onPress={onWantToHire} style={styles.secondary} />
      </View>

      <View style={styles.pillars}>
        {PILLARS.map((p) => (
          <Card key={p.n} style={styles.pillar}>
            <Meta>{p.n}</Meta>
            <Text style={text.displayXs}>{p.title}</Text>
            <Body size="md" tone="muted">{p.body}</Body>
          </Card>
        ))}
      </View>

      {/* The page ends on the employer's and interviewer's way in. */}
      <View style={styles.employer}>
        <Pressable
          onPress={onCreateEmployer}
          accessibilityRole="button"
          style={({ pressed }) => [styles.employerAction, pressed && styles.pressed]}
        >
          <Body size="md" weight="semibold" tone="accent">Hiring? Create an employer account</Body>
        </Pressable>
        {onJoinUs && (
          <Pressable
            onPress={onJoinUs}
            accessibilityRole="button"
            style={({ pressed }) => [styles.employerAction, pressed && styles.pressed]}
          >
            <Body size="md" weight="semibold" tone="accent">Evaluate talent? Interview on Apostrophe →</Body>
          </Pressable>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  signIn: { height: height.tap, justifyContent: 'center' },
  hero: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  headlineAccent: { color: color.accent },
  lede: { marginTop: space.sm },
  primary: { marginTop: space.xl },
  secondary: { marginTop: space.xs },

  pillars: { paddingHorizontal: space.xl, paddingTop: space['2xl'], gap: space.md },
  pillar: { padding: space.lg, gap: space.xs },

  employer: { marginTop: space.xl, marginHorizontal: space.xl, gap: space.xs, alignItems: 'flex-start' },
  employerAction: { minHeight: height.tap, justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
})
