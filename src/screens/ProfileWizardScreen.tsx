import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api } from '../lib/api'
import { color, space, radius, fontSize, fontWeight, fontFamilyNative, borderWidth, height, leadingNative, trackingNative } from '../theme'

interface Completion { pct: number; canBook: boolean; missing: string[]; blockers: string[] }
interface Profile {
  education: Record<string, unknown> | null
  stepsCompleted: number[]
  resumeStep: number
  completion: Completion
}
interface Config {
  booking: { minProfileCompletionPct: number }
  profile: { steps: { key: string; step: number; label: string }[] }
}

const AUTOSAVE_MS = 1200

/**
 * ST-30–ST-37 on a phone.
 *
 * The six steps become a segmented bar rather than a rail: six vertical rows
 * would push the field you came to fill below the fold. The 80% booking gate is
 * a notch on the bar, because the useful question is never "what percent am I",
 * it is "can I book yet".
 *
 * Completion, what is missing and what blocks booking all arrive from the
 * server on every save. Nothing here recalculates them — a second
 * implementation in a shipped build is a disagreement waiting to happen with
 * the gate that actually decides.
 */
export function ProfileWizardScreen({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/students/me/profile'),
  })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  useEffect(() => {
    if (profile.data?.education) setDraft({ ...profile.data.education })
  }, [profile.data])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /** Autosave is a partial write, so a dropped connection costs nothing typed. */
  const patch = (next: Record<string, unknown>) => {
    setDraft((d) => ({ ...d, ...next }))
    setSaving('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSaving('saving')
      api.patch('/students/me/profile/education', { ...draft, ...next })
        .then(() => setSaving('saved'))
        .catch(() => setSaving('idle'))
    }, AUTOSAVE_MS)
  }

  if (profile.isPending || config.isPending) {
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.textSubtle} />
      </View>
    )
  }

  const steps = config.data?.profile.steps ?? []
  const done = new Set(profile.data?.stepsCompleted ?? [])
  const completion = profile.data?.completion
  const gate = config.data?.booking.minProfileCompletionPct ?? 80

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onExit} style={styles.iconTarget} hitSlop={6}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="m15 18-6-6 6-6" stroke={color.text} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.eyebrow}>STEP 2 OF {steps.length || 6}</Text>
        <Pressable onPress={onExit} style={styles.saveExitTarget}>
          <Text style={styles.saveExit}>Save &amp; exit</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.segments}>
          {(steps.length ? steps : Array.from({ length: 6 }, (_, i) => ({ step: i + 1, key: String(i), label: '' })))
            .map((s) => (
              <View
                key={s.step}
                style={[
                  styles.segment,
                  done.has(s.step) && { backgroundColor: color.success },
                  s.step === 2 && { backgroundColor: color.accent },
                ]}
              />
            ))}
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressNow}>Profile {completion?.pct ?? 0}%</Text>
          <Text style={styles.progressGate}>{gate}% needed to book</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>Education</Text>
        <Text style={styles.lede}>
          Your interviewer checks this against the document you upload.
        </Text>

        <Labelled label="Institution">
          <TextInput
            style={styles.input}
            value={String(draft.institution ?? '')}
            onChangeText={(v) => patch({ institution: v })}
            placeholder="College or university"
            placeholderTextColor={color.textSubtle}
          />
        </Labelled>

        <View style={styles.pair}>
          <Labelled label="Year" style={styles.pairItem}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={draft.yearOfCompletion ? String(draft.yearOfCompletion) : ''}
              onChangeText={(v) => patch({ yearOfCompletion: v ? Number(v) : undefined })}
              placeholder="2023"
              placeholderTextColor={color.textSubtle}
            />
          </Labelled>
          <Labelled label="Score" style={styles.pairItem}>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={draft.score != null ? String(draft.score) : ''}
              onChangeText={(v) => patch({ score: v ? Number(v) : undefined })}
              placeholder="7.4"
              placeholderTextColor={color.textSubtle}
            />
          </Labelled>
        </View>

        <View style={styles.proof}>
          <Text style={styles.proofTitle}>Proof of qualification</Text>
          <Text style={styles.proofBody}>
            Required before you can book. Never shown to employers.
          </Text>
          <Pressable style={styles.choose}>
            <Text style={styles.chooseLabel}>Choose a file</Text>
          </Pressable>
        </View>

        {!!completion && (completion.blockers.length > 0 || completion.missing.length > 0) && (
          <View style={styles.needed}>
            <Text style={styles.neededTitle}>
              {completion.canBook ? 'You can book an interview' : 'Before you can book an interview'}
            </Text>
            {[...completion.blockers, ...completion.missing.slice(0, 4).map((m) => `Add ${m}`)].map((line) => (
              <Text key={line} style={styles.neededLine}>· {line}</Text>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.savedRow}>
          {saving === 'saved' && (
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6 9 17l-5-5" stroke={color.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
          <Text style={styles.savedText}>
            {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : 'Saves as you type'}
          </Text>
        </View>
        <Pressable style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaLabel}>Continue</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Labelled({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  header: {
    height: height['app-bar-compact'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  iconTarget: { width: height.tap, height: height.tap, alignItems: 'center', justifyContent: 'center', marginLeft: -space.md },
  saveExitTarget: { height: height.tap, justifyContent: 'center', paddingHorizontal: space.md, marginRight: -space.md },
  saveExit: { fontSize: fontSize['ui-md'], color: color.accent, fontWeight: fontWeight.medium },
  eyebrow: { fontSize: fontSize['ui-2xs'], letterSpacing: trackingNative.widest, color: color.textSubtle },
  progressWrap: { paddingHorizontal: space.xl, paddingTop: space.sm },
  segments: { flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: space.xs, borderRadius: radius.pill, backgroundColor: color.surfaceSunken },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  progressNow: { fontSize: fontSize['ui-xs'], color: color.textMuted },
  progressGate: { fontSize: fontSize['ui-xs'], color: color.textSubtle },
  scroll: { paddingHorizontal: space.xl, paddingTop: space['2xl'], paddingBottom: space.xl },
  headline: { fontFamily: fontFamilyNative.display, fontSize: fontSize['display-md'], color: color.text },
  lede: { marginTop: space.sm, fontSize: fontSize['ui-sm'], lineHeight: leadingNative['ui-base'], color: color.textMuted },
  field: { marginTop: space.lg },
  fieldLabel: { fontSize: fontSize['ui-sm'], fontWeight: fontWeight.medium, color: color.text },
  input: {
    marginTop: space.sm, height: height.control, borderWidth: borderWidth.thin, borderColor: color.borderStrong,
    borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: fontSize['ui-base'], color: color.text,
  },
  pair: { flexDirection: 'row', gap: space.md },
  pairItem: { flex: 1 },
  proof: {
    marginTop: space.lg, borderWidth: borderWidth.thin, borderColor: color.border, borderLeftWidth: borderWidth.accent,
    borderLeftColor: color.accent, borderRadius: radius.md, padding: space.lg,
  },
  proofTitle: { fontSize: fontSize['ui-md'], fontWeight: fontWeight.medium, color: color.text },
  proofBody: { marginTop: space.xs, fontSize: fontSize['ui-xs'], lineHeight: leadingNative['ui-xs'], color: color.textMuted },
  choose: {
    marginTop: space.md, height: height.tap, borderWidth: borderWidth.thin, borderColor: color.borderStrong,
    borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
  },
  chooseLabel: { fontSize: fontSize['ui-md'], color: color.text },
  needed: { marginTop: space.xl, backgroundColor: color.surfaceMuted, borderRadius: radius.lg, padding: space.lg },
  neededTitle: { fontSize: fontSize['ui-md'], fontWeight: fontWeight.medium, color: color.text },
  neededLine: { marginTop: space.xs, fontSize: fontSize['ui-sm'], color: color.textMuted },
  footer: {
    borderTopWidth: borderWidth.thin, borderTopColor: color.border,
    paddingHorizontal: space.xl, paddingTop: space.md,
  },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  savedText: { fontSize: fontSize['ui-xs'], color: color.textMuted },
  cta: { height: height.control, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { backgroundColor: color.accentHover },
  ctaLabel: { color: color.textInverse, fontSize: fontSize['ui-base'], fontWeight: fontWeight.semibold },
})
