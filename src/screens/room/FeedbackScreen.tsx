import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { getFeedback, getInterview, type Feedback } from '../../lib/api/interviews'
import { hoursPhrase } from '../../lib/interviews/rules'
import { fmtStampZone } from '../../lib/chat/format'
import Svg, { Circle } from 'react-native-svg'
import { color, fontFamilyNative as FF } from '../../theme'
import { Btn, Panel, Skel, StateBlock } from '../../components/tab/kit'
import { Eyebrow, FlowHeader, Lead, Sub } from '../../components/tab/flow'

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
      <FlowHeader title="Your scorecard" subtitle={subtitle} onBack={onBack} />
      {c}
    </View>
  )
  if (q.isPending) return frame(<View style={styles.body}><Skel w="100%" h={140} /><Skel w="100%" h={44} /><Skel w="100%" h={200} /></View>)

  if (notFound) {
    if (ivQ.isPending) return frame(<View style={styles.body}><Skel w="100%" h={140} /><Skel w="100%" h={44} /><Skel w="100%" h={200} /></View>)
    const iv = ivQ.data
    // Anything but a COMPLETED interview never has feedback; a COMPLETED one says which of the three it is.
    const unavailable = iv ? iv.status !== 'COMPLETED' || iv.feedback === 'UNAVAILABLE' : false

    if (iv?.feedback === 'AWAITING') {
      return frame(
        <View style={styles.waiting}>
          <Eyebrow tone="accent">Feedback</Eyebrow>
          <Lead>Your feedback is on its way.</Lead>
          <Sub>
            {windowHours != null
              ? `Your interviewer writes it up after the session and has up to ${hoursPhrase(windowHours)} after the session to send it — we’ll notify you the moment it does.`
              : 'Your interviewer writes it up after the session — we’ll notify you the moment it does.'}
          </Sub>
          <View style={styles.awaitAction}><Btn variant="outline" label="Back to my interviews" onPress={onBack} /></View>
        </View>,
      )
    }
    if (unavailable) {
      return frame(
        <View style={styles.waiting}>
          <Eyebrow>Feedback</Eyebrow>
          <Lead>Feedback will not be available for this interview.</Lead>
          <View style={styles.awaitAction}><Btn variant="outline" label="Back to my interviews" onPress={onBack} /></View>
        </View>,
      )
    }
    // The interview could not be read, or it says READY while the feedback call said not yet (it landed in between), or it carries no state.
    return frame(
      <StateBlock
        icon="alert"
        title="Could not load your feedback."
        body="Nothing was changed. Try again in a moment."
        action="Try again"
        onAction={() => { q.refetch(); ivQ.refetch() }}
      />,
    )
  }
  if (q.isError || !q.data) return frame(<StateBlock icon="alert" title="Could not load your feedback." body="Nothing was changed. Try again in a moment." />)

  const s = q.data.scorecard
  return frame(
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.ring}>
          <ScoreRing value={s.scores.overall} />
          <View style={styles.ringCentre} pointerEvents="none">
            <Text style={styles.ringNum}>{s.scores.overall}</Text>
            <Text style={styles.ringOf}>/10</Text>
          </View>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>Overall score</Text>
          <Text style={styles.heroBody}>From your interviewer, out of ten.</Text>
        </View>
      </View>

      <View style={styles.private}>
        <Text style={styles.privateTag}>Private</Text>
        <Text style={styles.privateText}>Employers never see your scores or this note — only your video resume.</Text>
      </View>

      <Panel style={styles.scores}>
        {SCORES.filter((r) => r.key !== 'overall').map((row, i) => (
          <View key={row.key} style={[styles.scoreRow, i > 0 && styles.scoreRule]}>
            <View style={styles.scoreHead}>
              <Text style={styles.scoreLabel}>{row.label}</Text>
              <Text style={styles.scoreValue}>{s.scores[row.key]}</Text>
            </View>
            <View style={styles.cells}>
              {Array.from({ length: 10 }).map((_, n) => (
                <View key={n} style={[styles.cell, { backgroundColor: n < Math.round(s.scores[row.key]) ? color.accent : color.surfaceSunken }]} />
              ))}
            </View>
          </View>
        ))}
      </Panel>

      <Section tone="good" title="↑ Did well" body={s.strengths} />
      <Section tone="warn" title="→ Sharpen" body={s.improvements} />
    </ScrollView>,
    fmtStampZone(q.data.slotStart),
  )
}

/** The overall score as a ring: the track is the full circle, the fill the share out of ten. */
function ScoreRing({ value }: { value: number }) {
  const size = 104, stroke = 9, r = 44, c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(10, value))
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={r} fill="none" stroke={color.onInkBar} strokeWidth={stroke} />
      <Circle
        cx={50} cy={50} r={r} fill="none" stroke={color.accentBright} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${c}`} strokeDashoffset={c * (1 - v / 10)} transform="rotate(-90 50 50)"
      />
    </Svg>
  )
}

function Section({ title, body, tone }: { title: string; body: string; tone: 'good' | 'warn' }) {
  return (
    <Panel style={styles.section}>
      <Text style={[styles.sectionTitle, { color: tone === 'good' ? color.success : color.warning }]}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </Panel>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 12, paddingBottom: 28 },
  waiting: { paddingHorizontal: 20, paddingTop: 90, gap: 12 },
  awaitAction: { marginTop: 8, alignItems: 'flex-start' },
  hero: { backgroundColor: color.ink, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18 },
  ring: { width: 104, height: 104 },
  ringCentre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: FF.bodySemiBold, fontSize: 38, letterSpacing: -1.9, color: color.textOnInk, lineHeight: 42 },
  ringOf: { fontFamily: FF.body, fontSize: 12, color: color.textOnInkSubtle },
  heroText: { flex: 1 },
  heroEyebrow: { fontFamily: FF.bodyMedium, fontSize: 12.5, color: color.accentMuted },
  heroBody: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textOnInkMuted, marginTop: 6 },
  private: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: color.successSoft },
  privateTag: { fontFamily: FF.bodyMedium, fontSize: 12, color: color.textInverse, backgroundColor: color.successFill, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  privateText: { flex: 1, fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.success },
  scores: { paddingVertical: 6, paddingHorizontal: 14, gap: 0 },
  scoreRow: { paddingVertical: 12, gap: 8 },
  scoreRule: { borderTopWidth: 1, borderTopColor: color.border },
  scoreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  scoreLabel: { fontFamily: FF.bodyMedium, fontSize: 15, color: color.text },
  scoreValue: { fontFamily: FF.body, fontSize: 17, color: color.text, fontVariant: ['tabular-nums'] },
  cells: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, height: 8, borderRadius: 3 },
  section: { gap: 6 },
  sectionTitle: { fontFamily: FF.bodySemiBold, fontSize: 14 },
  sectionBody: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.text },
})
