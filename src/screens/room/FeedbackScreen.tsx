import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { ApiClientError } from '../../lib/api'
import { getFeedback, type Feedback } from '../../lib/api/interviews'
import { fmtStampZone } from '../../lib/chat/format'
import { color, space, radius, fontFamilyNative, fontSize, leadingNative } from '../../theme'
import { AppBar, Body, Button, Card, Display, Divider, ErrorState, Eyebrow, ScoreRow, Skeleton } from '../../components/ui'

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
  if (q.isPending) return frame(<Skeleton lines={4} />)

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
  if (q.isError || !q.data) return frame(<ErrorState title="Could not load your feedback." />)

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

        <Card style={styles.scores}>
          {SCORES.map((row, i) => (
            <React.Fragment key={row.key}>
              {i > 0 && <Divider />}
              <ScoreRow label={row.label} value={s.scores[row.key]} />
            </React.Fragment>
          ))}
        </Card>

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
  body: { padding: space.xl, gap: space['2xl'], paddingBottom: space['4xl'] },
  scores: { padding: space.lg, gap: space.md },
  // The one long-form serif step (tokens.ts `fontSize.prose` / `leadingNative.prose`),
  // named for this exact screen (ST-33-delivered). `Display` has no `prose` level to
  // reuse yet — its `level` union stops at `lg` — so this stays a local styled `Text`
  // rather than a shared primitive.
  prose: { fontFamily: fontFamilyNative.display, fontSize: fontSize.prose, lineHeight: leadingNative.prose, color: color.text },
  infoWell: { borderRadius: radius.md, backgroundColor: color.infoSoft, padding: space.md },
})
