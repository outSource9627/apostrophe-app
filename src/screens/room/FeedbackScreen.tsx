import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { getFeedback, getInterview, type Feedback } from '../../lib/api/interviews'
import { hoursPhrase } from '../../lib/interviews/rules'
import { fmtStampZone } from '../../lib/chat/format'
import { color, space, spaceHalf, radius, trackingNative } from '../../theme'
import { Body, Button, Card, ErrorState, Eyebrow, InkCard, ScoreRow, ScreenHeader, Skeleton, text } from '../../components/ui'

const SCORES: { key: keyof Feedback['scorecard']['scores']; label: string }[] = [
  { key: 'communication', label: 'Communication' },
  { key: 'domainKnowledge', label: 'Domain knowledge' },
  { key: 'confidence', label: 'Confidence and presence' },
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'overall', label: 'Overall' },
]

/**
 * ST-33 / SP-08 — interview feedback. Five scores out of ten in the serif at the
 * 40px step (tabular), strengths and improvements IN FULL — no truncation — and a
 * plain line that employers never see any of this. No internal note, no
 * recommendation.
 *
 * A 404 from the feedback call is a state, and there are two of them that read
 * alike: the interviewer still has time (AWAITING — say it is on its way) and the
 * interviewer's time ran out (UNAVAILABLE — it will never come, so say that and
 * promise nothing). The server's message differs between them, but the screen
 * reads the interview's own `feedback` field rather than matching on wording.
 * How long an interviewer has is the admin's number (`scorecard.windowHours` in
 * /config): when it is not there the sentence drops it.
 */
export function FeedbackScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => getFeedback(id),
    retry: (n, e) => !(e instanceof ApiClientError && e.status === 404) && n < 2,
  })
  const notFound = q.error instanceof ApiClientError && q.error.status === 404
  // Only a 404 needs to know why: the interview says whether the feedback is still expected.
  const ivQ = useQuery({ queryKey: ['interview', id], queryFn: () => getInterview(id), enabled: notFound })
  const cfgQ = useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<{ scorecard?: { windowHours?: number } }>('/config'),
    enabled: notFound,
  })
  const windowHours = cfgQ.data?.scorecard?.windowHours

  const frame = (c: React.ReactNode, subtitle?: string) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader title="Your scorecard" subtitle={subtitle} onBack={onBack} />
      {c}
    </View>
  )
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={4} /></View>)

  if (notFound) {
    if (ivQ.isPending) return frame(<View style={styles.body}><Skeleton lines={4} /></View>)
    const iv = ivQ.data
    // Anything but a COMPLETED interview never has feedback; a COMPLETED one says which of the three it is.
    const unavailable = iv ? iv.status !== 'COMPLETED' || iv.feedback === 'UNAVAILABLE' : false

    if (iv?.feedback === 'AWAITING') {
      return frame(
        <View style={[styles.body, styles.centred]}>
          <Eyebrow tone="accent">Feedback</Eyebrow>
          <Text style={text.displayLead}>Your feedback is on its way.</Text>
          <Body size="base" tone="muted">
            {windowHours != null
              ? `Your interviewer writes it up after the session and has up to ${hoursPhrase(windowHours)} after the session to send it — we’ll notify you the moment it does.`
              : 'Your interviewer writes it up after the session — we’ll notify you the moment it does.'}
          </Body>
          <View style={styles.awaitAction}><Button variant="outline" size="md" label="Back to my interviews" onPress={onBack} /></View>
        </View>,
      )
    }
    if (unavailable) {
      return frame(
        <View style={[styles.body, styles.centred]}>
          <Eyebrow>Feedback</Eyebrow>
          <Text style={text.displayLead}>Feedback will not be available for this interview.</Text>
          <View style={styles.awaitAction}><Button variant="outline" size="md" label="Back to my interviews" onPress={onBack} /></View>
        </View>,
      )
    }
    // The interview could not be read, or it says READY while the feedback call said not yet (it landed in between), or it carries no state.
    return frame(
      <View style={styles.centred}>
        <ErrorState
          title="Could not load your feedback."
          body="Nothing was changed. Try again in a moment."
          action={<Button variant="outline" size="md" label="Try again" onPress={() => { q.refetch(); ivQ.refetch() }} />}
        />
      </View>,
    )
  }
  if (q.isError || !q.data) return frame(<View style={styles.centred}><ErrorState title="Could not load your feedback." body="Nothing was changed. Try again in a moment." /></View>)

  const s = q.data.scorecard
  return frame(
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <InkCard style={styles.hero}>
        <View style={styles.heroScore}>
          <Text style={text.displayScore}>{s.scores.overall}</Text>
          <Text style={[text.uiMd, styles.outOf]}>/10</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={[text.metaSm, styles.heroEyebrow]}>OVERALL SCORE</Text>
          <Text style={[text.uiSm, styles.heroBody]}>From your interviewer, out of ten.</Text>
        </View>
      </InkCard>

      <View style={styles.private}>
        <Text style={[text.metaSm, styles.privateTag]}>PRIVATE</Text>
        <Text style={[text.uiXs, styles.privateText]}>Employers never see your scores or this note — only your video resume.</Text>
      </View>

      <Card style={styles.scores}>
        {SCORES.filter((r) => r.key !== 'overall').map((row) => (
          <ScoreRow key={row.key} label={row.label} value={s.scores[row.key]} />
        ))}
      </Card>

      <Section tone="good" title="↑ Did well" body={s.strengths} />
      <Section tone="warn" title="→ Sharpen" body={s.improvements} />
    </ScrollView>,
    fmtStampZone(q.data.slotStart),
  )
}

function Section({ title, body, tone }: { title: string; body: string; tone: 'good' | 'warn' }) {
  return (
    <Card style={styles.section}>
      <Text style={[text.uiSmSemi, { color: tone === 'good' ? color.success : color.warning }]}>{title}</Text>
      <Text style={text.uiMd}>{body}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md, paddingBottom: space.xl },
  centred: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },
  awaitAction: { marginTop: space.md, alignItems: 'flex-start' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['4.5'] },
  heroScore: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  outOf: { color: color.textOnInkSubtle },
  heroText: { flex: 1, gap: space.xs },
  heroEyebrow: { color: color.accentMuted, letterSpacing: trackingNative.eyebrow },
  heroBody: { color: color.textOnInkSoft },
  private: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.tile, backgroundColor: color.successSoft },
  privateTag: { color: color.textInverse, backgroundColor: color.successFill, paddingHorizontal: spaceHalf['1.5'], paddingVertical: space['2xs'], borderRadius: radius.sm, overflow: 'hidden' },
  privateText: { flex: 1, color: color.success },
  scores: { paddingHorizontal: spaceHalf['3.5'], paddingVertical: space.sm },
  section: { padding: space.md, gap: space.xs, borderRadius: radius.panel },
})
