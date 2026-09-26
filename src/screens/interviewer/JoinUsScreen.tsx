import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { BrandMark, Button, text } from '../../components/ui'
import { IvCard, IvGlow, IvLabel } from '../../components/interviewer/iv'
import { EmFoot } from '../../components/employer/em'
import { label } from '../../lib/profile/labels'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/** The web's /join-us steps, word for word — none of them carries a number. */
const STEPS = [
  { title: 'You apply', body: 'Your background, the domains and languages you interview in, and your CV if you have one to hand. It creates no account.' },
  { title: 'A person screens it', body: 'Someone on the Apostrophe team reads every application.' },
  { title: 'We create your account', body: 'If we go ahead, the team sets up your interviewer account, with the tiers and domains you will interview for.' },
  { title: 'Sign-in details by email', body: 'They go to the address on your application, with a password to use once.' },
  { title: 'You change the password', body: 'The first sign-in asks for a new password before anything else.' },
  { title: 'You publish your hours', body: 'Mark the weekly hours you are free. Students can book them from then.' },
]

/**
 * Join us (no artboard — the drawn screens' language). What the work is, how
 * long each tier's interview runs and which qualification lands in it
 * (`config.tiers`, `config.qualifications`), the rules an interviewer is held
 * to (`config.interviewer`, each line only when the server sent its number),
 * and the path from application to first booking. The old screen's fees
 * ("₹40 to ₹150"), "20-minute sessions", "4-question script" and "2+ years"
 * were written into the app; the interviewer's fee is not public, so it is
 * described rather than priced.
 */
export function JoinUsScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const config = useAppConfig()
  const iv = config?.interviewer
  const windowHours = iv?.scorecardWindowHours ?? config?.scorecard?.windowHours

  const tiers = (config?.tiers ?? [])
    .filter((t) => t.durationMin > 0)
    .map((t) => ({
      tier: t.tier,
      minutes: t.durationMin,
      quals: (config?.qualifications ?? []).filter((q) => q.tier === t.tier).map((q) => label(q.value)),
    }))

  const rules = [
    iv?.joinOpensMinutesBefore ? `The room opens ${iv.joinOpensMinutesBefore} minutes before the start.` : null,
    iv?.noShowMinutesAfter ? `A student who has not joined ${iv.noShowMinutesAfter} minutes in counts as a no-show.` : null,
    windowHours ? `The scorecard is due within ${windowHours} hours of the end${iv?.scorecardReminderHoursBefore ? `, with a reminder ${iv.scorecardReminderHoursBefore} hours before` : ''}.` : null,
    iv?.completionThresholdPct ? `A session that runs at least ${iv.completionThresholdPct}% of its length, with the scorecard in on time, is paid.` : null,
  ].filter((r): r is string => !!r)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.brand}>
          <BrandMark />
          <Text style={text.uiLeadSemi}>Apostrophe</Text>
        </View>
        <Pressable accessibilityRole="button" hitSlop={space.sm} onPress={() => navigation.navigate('InterviewerSignIn')} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[text.uiMdSemi, styles.muted]}>Sign in</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.grow} contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <IvGlow />
          <Text style={[text.metaMd, styles.eyebrow]}>FOR INTERVIEWERS</Text>
          <Text style={text.displayPage}>Interview students live,</Text>
          <Text style={[text.displayPage, styles.muted]}>on the hours you set.</Text>
          <Text style={[text.uiBase, styles.muted]}>
            You run the interview from a question script, write a scorecard afterwards, and are paid a fee for each one, in hours you publish yourself.
          </Text>
        </View>

        {tiers.length > 0 && (
          <IvCard>
            <IvLabel>THE INTERVIEWS</IvLabel>
            <Text style={[text.uiSm, styles.muted]}>The tier comes from the qualification the student declares.</Text>
            {tiers.map((t, i) => (
              <View key={t.tier} style={[styles.tier, i === tiers.length - 1 && styles.last]}>
                <View style={styles.grow}>
                  <Text style={text.uiMdSemi}>{t.quals.join(' · ') || label(t.tier)}</Text>
                  <Text style={[text.metaSm, styles.subtle, styles.mono]}>{t.tier.replace('_', ' ')}</Text>
                </View>
                <Text style={[text.metaXl, styles.fig]}>{`${t.minutes} min`}</Text>
              </View>
            ))}
          </IvCard>
        )}

        <IvCard>
          <IvLabel>THE FEE</IvLabel>
          <Text style={text.uiMd}>A fee per interview, set for your account by tier and shown on each interview before you run it. It is credited to your wallet when the scorecard is in, and you withdraw to your bank.</Text>
        </IvCard>

        {rules.length > 0 && (
          <IvCard>
            <IvLabel>WHAT WE ASK</IvLabel>
            {rules.map((r) => (
              <View key={r} style={styles.rule}>
                <View style={styles.dot} />
                <Text style={[text.uiMd, styles.grow]}>{r}</Text>
              </View>
            ))}
          </IvCard>
        )}

        <IvLabel style={styles.section}>HOW IT WORKS</IvLabel>
        <View>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <View style={styles.rail}>
                <View style={styles.num}><Text style={[text.metaSm, styles.onInk]}>{String(i + 1)}</Text></View>
                {i < STEPS.length - 1 && <View style={styles.line} />}
              </View>
              <View style={[styles.grow, styles.stepBody]}>
                <Text style={text.uiMdSemi}>{s.title}</Text>
                <Text style={[text.uiSm, styles.muted]}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <EmFoot>
        <View style={styles.grow}>
          <Button variant="primary" size="lg" full label="Apply to interview" onPress={() => navigation.navigate('InterviewerApply')} />
        </View>
      </EmFoot>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  onInk: { color: color.textInverse },
  mono: { letterSpacing: trackingNative.eyebrow },
  fig: { letterSpacing: 0 },
  bar: { height: height.header, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, backgroundColor: color.surface, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  hero: { gap: space.xs, paddingVertical: space.md, overflow: 'hidden' },
  eyebrow: { color: color.accent, letterSpacing: trackingNative.eyebrow, marginBottom: space.xs },
  section: { marginTop: space.sm },
  tier: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: spaceHalf['2.5'], borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  last: { borderBottomWidth: 0, paddingBottom: 0 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: { width: space.xs + 2, height: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.accent, marginTop: space.sm - 1 },
  step: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: height.chip },
  num: { width: height.chip, height: height.chip, borderRadius: radius.pill, backgroundColor: color.inkRaised, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: borderWidth.thin, backgroundColor: color.border, marginVertical: space['2xs'] },
  stepBody: { paddingBottom: space.lg },
})
