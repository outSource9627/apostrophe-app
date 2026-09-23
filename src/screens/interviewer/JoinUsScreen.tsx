import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, fontFamilyNative, height, space } from '../../theme'
import { Logo } from '../../components/Logo'
import { Body, Button, Card, Display, Eyebrow, Meta, Spacer } from '../../components/ui'
import { TIER_FEES_PAISE } from '../../lib/interviewer/state'
import { formatPaise } from '../../lib/format/money'

const TIERS = [
  { tier: 'TIER_1', name: 'Tier 1 — Core', paise: TIER_FEES_PAISE.TIER_1, desc: 'Junior / Intern roles. Foundational technical and communication check.' },
  { tier: 'TIER_2', name: 'Tier 2 — Intermediate', paise: TIER_FEES_PAISE.TIER_2, desc: 'Mid-level ICs (1–4 yrs). System architecture basics and real-world code.' },
  { tier: 'TIER_3', name: 'Tier 3 — Senior', paise: TIER_FEES_PAISE.TIER_3, desc: 'Senior engineers (5+ yrs). Distributed systems, trade-offs, technical leadership.' },
  { tier: 'TIER_4', name: 'Tier 4 — Specialist', paise: TIER_FEES_PAISE.TIER_4, desc: 'Staff / Tech Lead / Niche tech. Deep domain expertise and organizational impact.' },
]

const PERKS = [
  { icon: '⏱️', title: '20-Minute Sessions', desc: 'Crisp, structured interviews with verified candidates. No 60-minute marathons.' },
  { icon: '💰', title: 'Guaranteed Payouts', desc: 'Earn ₹40 to ₹150 per interview credited directly to your interviewer wallet.' },
  { icon: '📅', title: 'Total Flexibility', desc: 'Set your recurring weekly slots or date overrides. Interview whenever suits your schedule.' },
  { icon: '🎯', title: 'Clear Structured Rubrics', desc: 'Standardized 4-question script and 5-scale scorecards. Fast completion within 24 hours.' },
]

export function JoinUsScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<any>>()

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.bar}>
        <Logo size={18} />
        <Pressable
          onPress={() => navigation.navigate('InterviewerSignIn')}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Body size="base" tone="muted">Sign In</Body>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
      >
        <View style={styles.hero}>
          <Eyebrow>APOSTROPHE · INTERVIEWER NETWORK</Eyebrow>
          {/* Two-line hero, one line italic — the italic face is a distinct
              bundled font file (`fontFamilyNative.headingItalic`), not a
              `fontStyle: 'italic'` toggle: this codebase's custom fonts have no
              synthetic italic on Android (see tokens.ts on fontFamilyNative), so
              `Display` — which has no italic modifier — can't express this line.
              Stays token-driven raw Text for that reason, the same escape hatch
              WelcomeScreen's own hero uses (there because the marketing hero
              exceeds Display's size ceiling; here because of the italic face). */}
          <Text style={styles.headline}>Evaluate Talent.</Text>
          <Text style={[styles.headline, styles.headlineItalic]}>Earn On Your Terms.</Text>
          <Body size="base" tone="muted" style={styles.lede}>
            Join an elite pool of industry practitioners conducting 20-minute structured technical and behavioral interviews. Fast, respectful, and fairly compensated.
          </Body>

          {/* The one primary (crimson) action on this screen — see the accent-colour rule. */}
          <Spacer size="sm" />
          <Button
            label="Apply to Interview"
            variant="primary"
            onPress={() => navigation.navigate('InterviewerApply')}
          />
        </View>

        {/* Tiers & Earnings */}
        <View style={styles.section}>
          <Eyebrow>COMPENSATION TIERS</Eyebrow>
          <Display level="sm" style={styles.sectionTitle}>Predictable per-session fees</Display>
          <View style={styles.tierList}>
            {TIERS.map((t) => (
              <Card key={t.tier} style={styles.tierCard}>
                <View style={styles.tierHeader}>
                  <Body size="base" weight="semibold">{t.name}</Body>
                  {/* Fee amount: mono/content, never accent — a price is not one
                      of the accent rule's four jobs. Matches how
                      InterviewerDetailScreen renders the same fee figure. */}
                  <Meta style={styles.tierFee}>{formatPaise(t.paise)}</Meta>
                </View>
                <Body size="sm" tone="muted">{t.desc}</Body>
              </Card>
            ))}
          </View>
        </View>

        {/* Perks */}
        <View style={styles.section}>
          <Eyebrow>WHY JOIN</Eyebrow>
          <Display level="sm" style={styles.sectionTitle}>Designed for working professionals</Display>
          <View style={styles.perkGrid}>
            {PERKS.map((p, i) => (
              <Card key={i} style={styles.perkItem}>
                <Text style={styles.perkIcon}>{p.icon}</Text>
                <Body size="md" weight="semibold">{p.title}</Body>
                <Body size="sm" tone="muted">{p.desc}</Body>
              </Card>
            ))}
          </View>
        </View>

        {/* Requirements */}
        <Card style={styles.reqCard}>
          <Display level="sm" style={styles.reqTitle}>Who We Look For</Display>
          <Body size="sm" tone="muted">• Minimum 2+ years of professional engineering or domain experience</Body>
          <Body size="sm" tone="muted">• Strong communication and empathetic evaluation skills</Body>
          <Body size="sm" tone="muted">• Reliable broadband connection and quiet interview environment</Body>
          <Body size="sm" tone="muted">• Commitment to complete scorecards within 24 hours</Body>
          <View style={styles.reqAction}>
            {/* Repeats the hero's action lower on the page — kept as the
                non-crimson `outline` variant so the screen still carries only
                one primary (accent) button, per the accent-colour rule. It was
                a second `variant="primary"` before this pass. */}
            <Button
              label="Submit Your Application"
              variant="outline"
              onPress={() => navigation.navigate('InterviewerApply')}
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.background,
  },
  bar: {
    height: height.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    gap: space['2xl'],
  },
  hero: {
    gap: space.sm,
    paddingVertical: space.md,
  },
  headline: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 28,
    fontWeight: '700',
    color: color.text,
    lineHeight: 34,
  },
  headlineItalic: {
    fontFamily: fontFamilyNative.headingItalic,
    // Was color.accent — a decorative crimson headline is not one of the
    // accent rule's four sanctioned jobs. Muted, like WelcomeScreen's own
    // italic hero line.
    color: color.textMuted,
  },
  lede: {
    marginBottom: space.sm,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    marginTop: 0,
  },
  tierList: {
    gap: space.sm,
    marginTop: space['2xs'],
  },
  tierCard: {
    padding: space.md,
    gap: space['2xs'],
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierFee: {
    color: color.text,
  },
  perkGrid: {
    gap: space.md,
    marginTop: space['2xs'],
  },
  perkItem: {
    padding: space.md,
    gap: space['2xs'],
  },
  perkIcon: {
    fontSize: 24,
    marginBottom: space['2xs'],
  },
  reqCard: {
    padding: space.lg,
    gap: space.xs,
    backgroundColor: color.surfaceSubtle,
  },
  reqTitle: {
    marginBottom: space['2xs'],
  },
  reqAction: {
    marginTop: space.md,
  },
})
