import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvAction } from '../../components/interviewer/iv'
import { EmError, EmLabel, EmRadioRow, EmSheet } from '../../components/employer/em'
import { ApiClientError } from '../../lib/api'
import {
  getInterviewerInterview, getPrivateNotes, submitScorecard,
  type InterviewerInterviewDto, type Qualification, type Recommendation, type ScorecardInput, type ScorecardSubmitResult,
} from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { label } from '../../lib/profile/labels'
import { useNow } from '../../lib/employer/useNow'
import { hms, interviewClock, NON_PAYABLE_TEXT } from '../../lib/interviewer/state'
import { INTERVIEWER_KEY, useAppConfig } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

type Key = 'communication' | 'domainKnowledge' | 'confidence' | 'problemSolving' | 'overall'
const KEYS: Key[] = ['communication', 'domainKnowledge', 'confidence', 'problemSolving', 'overall']
const START = 7
type Sheet = null | 'text' | 'rec' | 'qual'

/**
 * M4 · the scorecard (Interviewer App Android).
 *
 * The band counts down to the server's `scorecardDueAt` and says what submitting
 * releases (the interview's own fee, only while it is payable). Five steppers
 * over the server's score range (`config.interviewer.scorecard`, starting at 7
 * as the web does), then three rows styled like the design's "Strengths &
 * coaching", each opening a sheet: the two texts (plus the optional internal
 * note, and the private notes to write from), the recommendation, and the
 * qualification check. Submit waits for all five checks.
 *
 * The body is the server's flat, strict shape. After submitting the band shows
 * what the server decided — credited, or not payable and why — never assumed.
 */
export function ScorecardDraftScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'ScorecardDraft'>>()
  const { id } = route.params
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const config = useAppConfig()
  const now = useNow() || Date.now()
  const sc = config?.interviewer?.scorecard

  const [iv, setIv] = useState<InterviewerInterviewDto | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<Key, number>>({ communication: START, domainKnowledge: START, confidence: START, problemSolving: START, overall: START })
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [qual, setQual] = useState<'yes' | 'no' | null>(null)
  const [actual, setActual] = useState<Qualification | null>(null)
  const [notes, setNotes] = useState('')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScorecardSubmitResult | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const i = await getInterviewerInterview(id)
      setIv(i)
      if (i.scorecard) {
        setScores({ ...i.scorecard.scores })
        setStrengths(i.scorecard.strengths)
        setImprovements(i.scorecard.improvements)
        setInternalNote(i.scorecard.internalNote ?? '')
        setRec(i.scorecard.recommendation ?? null)
        setQual(i.scorecard.qualificationConfirmed === false ? 'no' : i.scorecard.qualificationConfirmed ? 'yes' : null)
        setActual((i.scorecard.actualQualification as Qualification) ?? null)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load this interview.')
    }
  }, [id])

  useEffect(() => {
    load()
    getPrivateNotes(id).then((r) => setNotes(r.notes ?? '')).catch(() => {})
  }, [load, id])

  if (!iv) {
    return (
      <InterviewerShell back={() => navigation.goBack()} title="Scorecard">
        {loadError ? (
          <EmError title="Couldn’t load this interview." body={loadError} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </InterviewerShell>
    )
  }

  const min = sc?.scoreMin ?? 1
  const max = sc?.scoreMax ?? 10
  const sMin = sc?.strengthsMinChars ?? 1
  const iMin = sc?.improvementsMinChars ?? 1
  const submitted = !!(result || iv.scorecard?.submittedAt)
  const clk = interviewClock(iv, config, now)
  const expired = clk.status === 'EXPIRED' && !submitted
  const locked = submitted || expired || !iv.sessionEndedAt
  const fee = formatPaise(iv.feePaise)
  const okS = strengths.trim().length >= sMin
  const okI = improvements.trim().length >= iMin
  const okR = !!rec
  const okQ = qual === 'yes' || (qual === 'no' && !!actual)
  const done = [true, okS, okI, okR, okQ].filter(Boolean).length
  const valid = okS && okI && okR && okQ
  const labelOf = (k: Key) => sc?.competencies.find((c) => c.key === k)?.label ?? label(k)
  const recLabel = (v: Recommendation) => sc?.recommendations.find((r) => r.value === v)?.label ?? label(v)
  const quals = (config?.qualifications ?? []) as { value: Qualification; tier: string }[]
  const profileQual = iv.student.education?.qualification

  const toneOf = (v: number) => {
    const f = (v - min) / Math.max(1, max - min)
    return f >= 0.78 ? color.successFill : f >= 0.45 ? color.accent : color.warningStrong
  }
  const set = (k: Key, v: number) => setScores((s) => ({ ...s, [k]: Math.max(min, Math.min(max, v)) }))

  async function submit() {
    if (!valid || !rec) return
    setBusy(true)
    setError(null)
    const body: ScorecardInput = {
      ...scores,
      strengths: strengths.trim(),
      improvements: improvements.trim(),
      internalNote: internalNote.trim() || undefined,
      qualificationConfirmed: qual === 'yes',
      actualQualification: qual === 'no' && actual ? actual : undefined,
      recommendation: rec,
    }
    try {
      const r = await submitScorecard(id, body)
      setResult(r)
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Not submitted. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  // The band: time left, or what happened.
  const payable = result ? result.payable : iv.payable
  const reason = result?.nonPayableReason ?? iv.nonPayableReason
  let band: { bg: string; big: string; small: string }
  if (submitted) {
    band = payable !== false
      ? { bg: color.successFill, big: '✓', small: `${formatPaise(result?.feePaise ?? iv.feePaise)} credited` }
      : { bg: color.inkRaised, big: '✓', small: `Submitted · not paid${reason ? ` · ${NON_PAYABLE_TEXT[reason] ?? ''}` : ''}` }
  } else if (!iv.sessionEndedAt) {
    band = { bg: color.inkRaised, big: '—', small: 'The session has not ended yet' }
  } else if (clk.status === 'EXPIRED') {
    band = { bg: color.dangerFill, big: '00:00:00', small: 'Window closed · fee withheld' }
  } else if (clk.status === 'OPEN' || clk.status === 'URGENT') {
    band = { bg: clk.status === 'URGENT' ? color.dangerFill : color.ink, big: hms(clk.secondsLeft), small: iv.payable === false && iv.nonPayableReason === 'SESSION_TOO_SHORT' ? 'left · the session was below the mark' : `left · ${fee} on submit` }
  } else {
    band = { bg: color.ink, big: '—', small: `${fee} on submit` }
  }

  const submitLabel = submitted
    ? payable !== false ? `✓ Submitted · ${formatPaise(result?.feePaise ?? iv.feePaise)} credited` : '✓ Submitted'
    : busy ? 'Submitting…' : valid ? `Submit scorecard · release ${fee}` : `${done} of 5 done`

  return (
    <InterviewerShell
      back={() => navigation.goBack()}
      title={iv.student.name}
      sub={['Scorecard', iv.tier, iv.domain].filter(Boolean).join(' · ')}
      contentGap="sm"
      footer={
        <View style={styles.footInner}>
          {!!error && <Text style={[text.uiXs, styles.danger]}>{error}</Text>}
          <IvAction
            label={expired ? 'The window has closed' : submitLabel}
            tone={submitted ? 'success' : valid && !locked && !busy ? 'accent' : 'off'}
            onPress={valid && !locked && !busy ? () => { submit() } : undefined}
          />
        </View>
      }
    >
      <View style={[styles.band, { backgroundColor: band.bg }]}>
        <Text style={[text.metaBand, styles.onInk]}>{band.big}</Text>
        <Text style={[text.uiXsSemi, styles.onInk, styles.grow]} numberOfLines={2}>{band.small}</Text>
      </View>

      {KEYS.map((k) => {
        const v = scores[k]
        const tone = toneOf(v)
        return (
          <View key={k} style={styles.comp}>
            <View style={styles.compTop}>
              <Text style={[text.uiMdSemi, styles.grow]}>{labelOf(k)}</Text>
              <Stepper sign="−" label={`Lower ${labelOf(k)}`} disabled={locked || v <= min} onPress={() => set(k, v - 1)} />
              <Text style={[text.meta2xl, styles.score, { color: tone }]}>{v}</Text>
              <Stepper sign="+" label={`Raise ${labelOf(k)}`} disabled={locked || v >= max} onPress={() => set(k, v + 1)} />
            </View>
            <View style={styles.track}><View style={[styles.fill, { backgroundColor: tone, width: `${((v - min) / Math.max(1, max - min)) * 100}%` }]} /></View>
          </View>
        )
      })}

      <Row
        title="Strengths & coaching"
        status={okS && okI ? 'Both written' : !okS && !okI ? 'Strengths and improvements missing' : !okS ? 'Strengths missing' : 'Improvement areas missing'}
        good={okS && okI}
        onPress={() => setSheet('text')}
      />
      <Row title="Recommendation" status={rec ? recLabel(rec) : 'Not chosen'} good={okR} onPress={() => setSheet('rec')} />
      <Row
        title="Qualification check"
        status={qual === 'yes' ? 'Matches the profile' : qual === 'no' ? (actual ? `Mismatch · ${label(actual)}` : 'Choose the actual qualification') : 'Not checked'}
        good={okQ}
        onPress={() => setSheet('qual')}
      />

      <EmSheet
        open={sheet === 'text'}
        onClose={() => setSheet(null)}
        tall
        title="Strengths & coaching"
        sub="The student reads both."
        foot={<View style={[styles.sheetFoot, { paddingBottom: space.md + insets.bottom }]}><Button variant="secondary" size="lg" full label="Done" onPress={() => setSheet(null)} /></View>}
      >
        <TextField label="Observed strengths" help="Specific moments the student should keep doing." value={strengths} onChange={setStrengths} min={sMin} max={sc?.textMaxChars} locked={locked} />
        <TextField label="Areas for improvement" help="One or two actionable changes, with how to practise." value={improvements} onChange={setImprovements} min={iMin} max={sc?.textMaxChars} locked={locked} />
        <TextField label="Internal note" help="Never shown to the student." value={internalNote} onChange={setInternalNote} max={sc?.internalNoteMaxChars} locked={locked} optional />
        {!!notes.trim() && (
          <View style={styles.scratch}>
            <Text style={[text.metaSm, styles.muted, styles.mono]}>FROM YOUR NOTES</Text>
            <Text style={[text.uiSm, styles.secondary]}>{notes}</Text>
          </View>
        )}
      </EmSheet>

      <EmSheet open={sheet === 'rec'} onClose={() => setSheet(null)} title="Recommendation" sub="Your read on where the student stands.">
        {(sc?.recommendations ?? []).map((r) => (
          <EmRadioRow key={r.value} label={r.label} on={rec === r.value} disabled={locked} onPress={() => { setRec(r.value); setSheet(null) }} />
        ))}
      </EmSheet>

      <EmSheet open={sheet === 'qual'} onClose={() => setSheet(null)} title="Qualification check" sub={profileQual ? `The profile says ${label(profileQual)}. Does that match what you heard?` : 'Does the student’s stated qualification match what you heard?'}>
        <EmRadioRow label="Yes, it matches" on={qual === 'yes'} disabled={locked} onPress={() => { setQual('yes'); setActual(null); setSheet(null) }} />
        <EmRadioRow label="No, it’s a mismatch" on={qual === 'no'} disabled={locked} onPress={() => setQual('no')} />
        {qual === 'no' && (
          <View style={styles.field}>
            <EmLabel>Actual qualification</EmLabel>
            {quals.map((q) => (
              <EmRadioRow key={q.value} label={`${label(q.value)} · ${q.tier}`} on={actual === q.value} disabled={locked} onPress={() => { setActual(q.value); setSheet(null) }} />
            ))}
          </View>
        )}
      </EmSheet>
    </InterviewerShell>
  )
}

function Stepper({ sign, label: a11y, disabled, onPress }: { sign: string; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={disabled} onPress={onPress} hitSlop={space.sm / 2} style={({ pressed }) => [styles.step, disabled && styles.dim, pressed && styles.pressed]}>
      <Text style={text.uiLgSemi}>{sign}</Text>
    </Pressable>
  )
}

function Row({ title, status, good, onPress }: { title: string; status: string; good: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.grow}>
        <Text style={text.uiMdSemi}>{title}</Text>
        <Text style={[text.uiXs, { color: good ? color.success : color.danger }]}>{status}</Text>
      </View>
      <Icon name="chevR" size={space.xl} tint={color.textSubtle} />
    </Pressable>
  )
}

function TextField({
  label: title, help, value, onChange, min, max, locked, optional,
}: { label: string; help: string; value: string; onChange: (v: string) => void; min?: number; max?: number; locked?: boolean; optional?: boolean }) {
  const n = value.trim().length
  const short = !!min && n > 0 && n < min
  return (
    <View style={styles.field}>
      <EmLabel hint={optional ? 'optional' : min ? `${n} / ${min} MIN` : undefined}>{title}</EmLabel>
      <Input value={value} onChangeText={onChange} editable={!locked} maxLength={max} multiline textAlignVertical="top" invalid={short} style={styles.area} />
      <Text style={[text.uiXs, { color: short ? color.danger : color.textMuted }]}>{short ? `At least ${min} characters.` : help}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pressed: { opacity: opacity.pressed },
  dim: { opacity: opacity.disabled },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },
  onInk: { color: color.textOnInk },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space['3xl'] },
  band: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], borderRadius: radius.tile, paddingVertical: spaceHalf['2.5'], paddingHorizontal: spaceHalf['3.5'] },
  comp: { borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], gap: spaceHalf['2.5'] },
  compTop: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'] },
  step: { width: height.chip, height: height.chip, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  score: { width: space['2xl'] + spaceHalf['1.5'], textAlign: 'center', letterSpacing: 0 },
  track: { height: spaceHalf['1.5'], borderRadius: radius.bar, backgroundColor: color.surfaceMuted, overflow: 'hidden' },
  fill: { height: spaceHalf['1.5'], borderRadius: radius.bar },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], minHeight: height.control + space.md },
  field: { gap: spaceHalf['1.5'] },
  area: { height: height['note-field'] + space.xl, paddingTop: space.md },
  scratch: { borderRadius: radius.tile, backgroundColor: color.surfaceMuted, padding: space.md, gap: space.xs },
  sheetFoot: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
  footInner: { flex: 1, gap: space.sm },
})
