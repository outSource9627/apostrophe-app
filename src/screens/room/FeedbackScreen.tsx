import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { ApiClientError } from '../../lib/api'
import { getFeedback, type Feedback } from '../../lib/api/interviews'
import { fmtStampZone } from '../../lib/chat/format'
import { color, space, radius, borderWidth, fontFamilyNative, fontSize } from '../../theme'
import { AppBar, Body, Button, Display, Eyebrow, Meta } from '../../components/ui'

const SCORES: { key: keyof Feedback['scorecard']['scores']; label: string }[] = [
  { key: 'communication', label: 'Communication' },
  { key: 'domainKnowledge', label: 'Domain knowledge' },
  { key: 'confidence', label: 'Confidence and presence' },
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'overall', label: 'Overall' },
]

/**
 * ST-33 — interview feedback. Awaiting most of its life (within 24h), then five
 * scores out of ten in the serif at the 40px step (tabular), strengths and
 * improvements IN FULL — no truncation — and a plain line that employers never
 * see any of this. No internal note, no recommendation.
 */
export function FeedbackScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => getFeedback(id),
    retry: (n, e) => !(e instanceof ApiClientError && e.status === 404) && n < 2,
  })
  const awaiting = q.error instanceof ApiClientError && q.error.status === 404

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)

  if (awaiting) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        {bar}
        <View style={[styles.body, { flex: 1, justifyContent: 'center' }]}>
          <Eyebrow>Feedback</Eyebrow>
          <Display level="lg">Your feedback is on its way.</Display>
          <Body size="base" tone="muted">Your interviewer writes it up after the session. It usually lands within a day of your interview — we&rsquo;ll notify you the moment it does.</Body>
          <View style={{ marginTop: space.md }}><Button variant="outline" size="md" label="Back to my interviews" onPress={onBack} /></View>
        </View>
      </View>
    )
  }
  if (q.isError || !q.data) return frame(<View style={styles.centre}><Body tone="muted">Could not load your feedback.</Body></View>)

  const s = q.data.scorecard
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>{`Feedback · ${fmtStampZone(q.data.slotStart)}`}</Eyebrow>
          <Display level="lg">How it went</Display>
        </View>

        <View style={styles.infoWell}>
          <Body size="sm" style={{ color: color.info }}>This is for you. Employers never see your scores or this note — only your video resume.</Body>
        </View>

        <View style={styles.scores}>
          {SCORES.map((row, i) => (
            <View key={row.key} style={[styles.scoreRow, i === 0 ? null : styles.scoreBorder]}>
              <Body size="base" style={{ flex: 1, color: color.text }}>{row.label}</Body>
              <Text style={styles.score}>{s.scores[row.key]}<Text style={styles.denom}>/10</Text></Text>
            </View>
          ))}
        </View>

        <Section title="What you did well" body={s.strengths} />
        <Section title="Where to sharpen" body={s.improvements} />

      </ScrollView>
    </View>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <Display level="xs">{title}</Display>
      <Text style={styles.prose}>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space['2xl'], paddingBottom: space['4xl'] },
  scores: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border },
  scoreRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.lg },
  scoreBorder: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  score: { fontFamily: fontFamilyNative.display, fontSize: fontSize['display-num'], color: color.text, fontVariant: ['tabular-nums'] },
  denom: { fontFamily: fontFamilyNative.body, fontSize: fontSize['ui-sm'], color: color.textSubtle },
  prose: { fontFamily: fontFamilyNative.display, fontSize: fontSize['display-xs'], lineHeight: 27, color: color.text },
  infoWell: { borderRadius: radius.md, backgroundColor: color.infoSoft, padding: space.md },
})
