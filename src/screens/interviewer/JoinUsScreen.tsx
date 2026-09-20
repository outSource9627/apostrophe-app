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
import { borderWidth, color, fontFamilyNative, height, opacity, radius, space } from '../../theme'
import { Logo } from '../../components/Logo'
import { Button, Card, Eyebrow } from '../../components/ui'
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
          <Text style={styles.signInLink}>Sign In</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space['2xl'] }]}
      >
        <View style={styles.hero}>
          <Eyebrow>APOSTROPHE · INTERVIEWER NETWORK</Eyebrow>
          <Text style={styles.headline}>Evaluate Talent.</Text>
          <Text style={[styles.headline, styles.headlineItalic]}>Earn On Your Terms.</Text>
          <Text style={styles.lede}>
            Join an elite pool of industry practitioners conducting 20-minute structured technical and behavioral interviews. Fast, respectful, and fairly compensated.
          </Text>

          <Button
            label="Apply to Interview"
            variant="primary"
            onPress={() => navigation.navigate('InterviewerApply')}
          />
        </View>

        {/* Tiers & Earnings */}
        <View style={styles.section}>
          <Eyebrow>COMPENSATION TIERS</Eyebrow>
          <Text style={styles.sectionTitle}>Predictable per-session fees</Text>
          <View style={styles.tierList}>
            {TIERS.map((t) => (
              <Card key={t.tier} style={styles.tierCard}>
                <View style={styles.tierHeader}>
                  <Text style={styles.tierName}>{t.name}</Text>
                  <Text style={styles.tierFee}>{formatPaise(t.paise)}</Text>
                </View>
                <Text style={styles.tierDesc}>{t.desc}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Perks */}
        <View style={styles.section}>
          <Eyebrow>WHY JOIN</Eyebrow>
          <Text style={styles.sectionTitle}>Designed for working professionals</Text>
          <View style={styles.perkGrid}>
            {PERKS.map((p, i) => (
              <View key={i} style={styles.perkItem}>
                <Text style={styles.perkIcon}>{p.icon}</Text>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkDesc}>{p.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Requirements */}
        <Card style={styles.reqCard}>
          <Text style={styles.reqTitle}>Who We Look For</Text>
          <Text style={styles.reqItem}>• Minimum 2+ years of professional engineering or domain experience</Text>
          <Text style={styles.reqItem}>• Strong communication and empathetic evaluation skills</Text>
          <Text style={styles.reqItem}>• Reliable broadband connection and quiet interview environment</Text>
          <Text style={styles.reqItem}>• Commitment to complete scorecards within 24 hours</Text>
          <View style={{ marginTop: space.md }}>
            <Button
              label="Submit Your Application"
              variant="primary"
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
  signInLink: {
    fontFamily: fontFamilyNative.body,
    fontSize: 14,
    fontWeight: '600',
    color: color.accent,
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
    color: color.accent,
  },
  lede: {
    fontFamily: fontFamilyNative.body,
    fontSize: 15,
    color: color.textMuted,
    lineHeight: 22,
    marginBottom: space.sm,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 18,
    fontWeight: '600',
    color: color.text,
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
  tierName: {
    fontFamily: fontFamilyNative.body,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  tierFee: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 16,
    fontWeight: '700',
    color: color.accent,
  },
  tierDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
  },
  perkGrid: {
    gap: space.md,
    marginTop: space['2xs'],
  },
  perkItem: {
    backgroundColor: color.surface,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: space['2xs'],
  },
  perkIcon: {
    fontSize: 24,
    marginBottom: space['2xs'],
  },
  perkTitle: {
    fontFamily: fontFamilyNative.body,
    fontSize: 15,
    fontWeight: '700',
    color: color.text,
  },
  perkDesc: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 18,
  },
  reqCard: {
    padding: space.lg,
    gap: space.xs,
    backgroundColor: color.surfaceSubtle,
  },
  reqTitle: {
    fontFamily: fontFamilyNative.heading,
    fontSize: 16,
    fontWeight: '700',
    color: color.text,
    marginBottom: space['2xs'],
  },
  reqItem: {
    fontFamily: fontFamilyNative.body,
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 20,
  },
})
