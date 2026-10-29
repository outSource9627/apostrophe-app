import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmIconButton, EmSheet } from '../../components/employer/em'
import { Face, StudioState } from '../../components/employer/studio'
import { ApiClientError } from '../../lib/api'
import {
  sendCandidateInterest, sendCandidateInterestBatch, type InterestBatchResult, type SendInterestBatchResult, type SendInterestResult,
} from '../../lib/api/employerInterests'
import type { EmployerJobRef } from '../../lib/api/employerShortlist'
import { formatIst } from '../../lib/employer/state'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import { linkableJobs, useEmployerJobRefs } from '../../lib/employer/useLinkableJobs'
import type { RootStackParamList } from '../../../App'

export interface InterestCandidate {
  id: string
  name: string
  photoUrl?: string | null
  tier?: string | null
  qualification?: string | null
  city?: string | null
  verified?: boolean
}

type Outcome =
  | { kind: 'sent'; result: SendInterestResult; job: EmployerJobRef | null }
  | { kind: 'cooldown'; nextEligibleAt?: string; cooldownDays?: number }
  | { kind: 'connected' }

/** '8 Oct' / '8 Oct 2026' in IST. */
const day = (iso: string, year = false) => {
  const [d] = formatIst(iso).split(' · ')
  return year ? d : d.split(' ').slice(0, 2).join(' ')
}

interface SheetBase {
  open: boolean
  /** The employer's openings to offer. Omit and the sheet loads their live and paused jobs. */
  jobs?: EmployerJobRef[]
  onClose: () => void
}

type OneProps = SheetBase & { candidate: InterestCandidate; candidates?: undefined; onSent?: (result: SendInterestResult) => void }
type BatchProps = SheetBase & {
  candidates: InterestCandidate[]
  candidate?: undefined
  /** The server has answered for everyone (some may not have been sent). */
  onBatchSent?: (result: SendInterestBatchResult) => void
}

/**
 * Send an Interest: to one candidate (EM-13), or — given `candidates` — to
 * everyone ticked in the Shortlist's select mode
 * (docs/feed-shortlist-forms-mockups.html · mass, frames 3 and 4).
 */
export function SendInterestSheet(props: OneProps | BatchProps) {
  return props.candidates ? <BatchInterestSheet {...props} /> : <OneInterestSheet {...props} />
}

/**
 * EM-13 · Send an Interest, as a bottom sheet — the Studio P3 frame
 * (docs/employer-app-studio.html · 03): the photo, "Send an Interest" to the
 * candidate, the JOB radio list (the employer's live or paused openings, or no
 * specific job), the MESSAGE field with its counter, Send, and the one line on
 * what happens next. The three answers the server can give are drawn in the
 * same sheet: sent (EM-13b), an Interest already inside the cooldown (EM-13c),
 * and already connected.
 *
 * Numbers are the server's: the message limit, how long an Interest stays open
 * and the cooldown come from /config, and each sentence drops its number when
 * the server does not say one.
 */
function OneInterestSheet({ open, candidate, jobs, onClose, onSent }: OneProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const insets = useSafeAreaInsets()
  const config = useEmployerConfig()
  const messageMax = config.interestMessageMaxChars ?? config.interest?.messageMaxLength
  const expiryDays = config.interestExpiryDays ?? config.interest?.expiryDays
  const cooldownDays = config.interestCooldownDays ?? config.interest?.cooldownDays
  const fetched = useEmployerJobRefs(open && jobs === undefined)
  const openings = jobs ?? linkableJobs(fetched ?? [])

  const [message, setMessage] = useState('')
  const [jobId, setJobId] = useState('')
  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Each opening starts from an empty form.
  useEffect(() => {
    if (open) {
      setMessage('')
      setJobId('')
      setOutcome(null)
      setError(null)
    }
  }, [open, candidate.id])

  const first = candidate.name.trim().split(/\s+/)[0] || 'They'

  async function send() {
    setSending(true)
    setError(null)
    try {
      const result = await sendCandidateInterest(candidate.id, { message: message.trim() || undefined, jobId: jobId || undefined })
      setOutcome({ kind: 'sent', result, job: openings.find((j) => j.id === jobId) ?? null })
      onSent?.(result)
    } catch (e) {
      const err = e as { code?: string; details?: { reason?: string; nextEligibleAt?: string; cooldownDays?: number } }
      if (err?.details?.reason === 'INTEREST_COOLDOWN' || err?.code === 'INTEREST_COOLDOWN') {
        setOutcome({ kind: 'cooldown', nextEligibleAt: err.details?.nextEligibleAt, cooldownDays: err.details?.cooldownDays ?? cooldownDays })
      } else if (err?.details?.reason === 'ALREADY_CONNECTED' || err?.code === 'ALREADY_CONNECTED') {
        setOutcome({ kind: 'connected' })
      } else {
        setError(e instanceof ApiClientError ? e.message : 'Could not send the Interest. Check your connection and try again.')
      }
    } finally {
      setSending(false)
    }
  }

  /** An answer from the server, in the Studio state: the disc, the title, the sentence, the actions. */
  const answer = (state: React.ReactNode, actions: React.ReactNode) => (
    <EmSheet
      open={open}
      onClose={onClose}
      scroll={false}
      foot={<View style={[styles.answerFoot, { paddingBottom: space.md + insets.bottom }]}>{actions}</View>}
    >
      <View style={styles.answer}>{state}</View>
    </EmSheet>
  )

  if (outcome?.kind === 'sent') {
    const { result, job } = outcome
    return answer(
      <StudioState
        icon="check"
        tone="success"
        title={`Interest sent to ${first}`}
        body={`${job ? `Linked to ${job.title}. ` : ''}If accepted, a chat opens. Expires ${day(result.expiresAt)} if unanswered.`}
      />,
      <>
        <Button
          variant="outline"
          size="cta"
          label="Track in Interests"
          style={styles.grow}
          onPress={() => {
            onClose()
            navigation.navigate('EmployerInterests')
          }}
        />
        <Button variant="secondary" size="cta" label="Done" style={styles.grow} onPress={onClose} />
      </>,
    )
  }

  if (outcome?.kind === 'cooldown') {
    const { nextEligibleAt, cooldownDays: days } = outcome
    const rule = typeof days === 'number' ? `One per candidate every ${days} days.` : 'Another Interest to the same candidate can’t go yet.'
    const when = nextEligibleAt ? ` The next can go from ${day(nextEligibleAt)}.` : ' Track it in Interests.'
    return answer(
      <StudioState icon="clock" tone="accent" title={`${first} already has an Interest`} body={`${rule}${when}`} />,
      <Button variant="secondary" size="cta" label="Done" style={styles.grow} onPress={onClose} />,
    )
  }

  if (outcome?.kind === 'connected') {
    return answer(
      <StudioState
        icon="chat"
        tone="success"
        title={`You and ${first} are connected`}
        body="You already have an open conversation, so there is nothing to send. Carry on in Chats."
      />,
      <>
        <Button variant="outline" size="cta" label="Close" style={styles.grow} onPress={onClose} />
        <Button
          variant="primary"
          size="cta"
          label="Open chat"
          style={styles.grow}
          onPress={() => {
            onClose()
            navigation.navigate('EmployerChats')
          }}
        />
      </>,
    )
  }

  const unlock = `Contact details unlock if ${first} accepts${typeof expiryDays === 'number' ? ` · open for ${expiryDays} days` : ''}`

  return (
    <EmSheet
      open={open}
      onClose={onClose}
      foot={
        <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
          {!!error && <Text style={[text.uiSm, styles.danger]}>{error}</Text>}
          <Button
            variant="primary"
            size="cta"
            full
            icon="heart"
            busy={sending}
            label={sending ? 'Sending…' : 'Send Interest'}
            style={styles.cta}
            onPress={() => { send() }}
          />
          <Text style={[text.uiXs, styles.muted, styles.center]}>{unlock}</Text>
        </View>
      }
    >
      <View style={styles.head}>
        <Face name={candidate.name} photo={candidate.photoUrl} size={height['control-xs']} />
        <View style={styles.grow}>
          <Text style={text.displayXs} accessibilityRole="header">Send an Interest</Text>
          <Text style={[text.uiSm, styles.muted]} numberOfLines={1}>{`to ${candidate.name}`}</Text>
        </View>
        <EmIconButton name="x" label="Close" size={height['control-xs']} iconSize={space.xl} tint={color.textSecondary} onPress={onClose} />
      </View>

      <JobField openings={openings} jobId={jobId} onChange={setJobId} />
      <MessageField value={message} onChange={setMessage} max={messageMax} />
    </EmSheet>
  )
}

/** The faces drawn over the batch sheet; past this, a "+n" disc counts the rest. */
const FACE_STACK_MAX = 3

/** 'Nikhil Verma, Meera Kulkarni and Aarav Mehta' — past three, the first two and how many others. */
function namesLine(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= FACE_STACK_MAX) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`
}

/**
 * Mass Send Interest (docs/feed-shortlist-forms-mockups.html · mass 3–4): one
 * job and one message to everyone ticked on the Shortlist. Frame 3 is the
 * form — the faces, who they are, the JOB list and the MESSAGE field the single
 * sheet draws, then Send. The server runs the single send for each person, so
 * frame 4 lists its own answer by name: sent, an Interest still inside the
 * cooldown (with the date the next may go), or no longer available. Nothing is
 * all-or-nothing, except a job the server refuses, which stops the whole send
 * before anything goes and is said over the button.
 *
 * The message limit and how long an Interest stays open are /config's; the
 * foot sentence is left out when the server sends no number.
 */
function BatchInterestSheet({ open, candidates, jobs, onClose, onBatchSent }: BatchProps) {
  const insets = useSafeAreaInsets()
  const config = useEmployerConfig()
  const messageMax = config.interestMessageMaxChars ?? config.interest?.messageMaxLength
  const expiryDays = config.interestExpiryDays ?? config.interest?.expiryDays
  const fetched = useEmployerJobRefs(open && jobs === undefined)
  const openings = jobs ?? linkableJobs(fetched ?? [])

  const [message, setMessage] = useState('')
  const [jobId, setJobId] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendInterestBatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Each opening starts from an empty form.
  useEffect(() => {
    if (open) {
      setMessage('')
      setJobId('')
      setResult(null)
      setError(null)
    }
  }, [open])

  const count = candidates.length

  async function send() {
    setSending(true)
    setError(null)
    try {
      const res = await sendCandidateInterestBatch(candidates.map((c) => c.id), { message: message.trim() || undefined, jobId: jobId || undefined })
      setResult(res)
      onBatchSent?.(res)
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.fields?.jobId ?? e.message
          : 'Could not send the Interests. Check your connection and try again.',
      )
    } finally {
      setSending(false)
    }
  }

  if (result) {
    const total = result.results.length
    const none = result.sent === 0
    const byId = new Map(candidates.map((c) => [c.id, c]))
    return (
      <EmSheet
        open={open}
        onClose={onClose}
        foot={
          <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
            <Button variant="primary" size="cta" full label="Done" onPress={onClose} />
          </View>
        }
      >
        <View style={styles.batchHead}>
          <View style={[styles.mark, none && styles.markNone]}>
            <Icon name={none ? 'x' : 'check'} size={height.glyph + 2} tint={none ? color.warning : color.success} weight={2.6} />
          </View>
          <View style={styles.heading}>
            <Text style={text.displayXs} accessibilityRole="header">
              {result.sent === total ? `Sent to ${total}` : `Sent to ${result.sent} of ${total}`}
            </Text>
            <Text style={[text.uiSm, styles.muted]}>
              {none ? 'No Interest went out. Each reason is below.' : 'They’ll see it in their Interests. You’ll get a chat when one accepts.'}
            </Text>
          </View>
        </View>
        <View>
          {result.results.map((r, i) => (
            <ResultRow key={r.candidateId} person={byId.get(r.candidateId)} result={r} last={i === total - 1} />
          ))}
        </View>
      </EmSheet>
    )
  }

  return (
    <EmSheet
      open={open}
      onClose={onClose}
      foot={
        <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
          {!!error && <Text style={[text.uiSm, styles.danger]}>{error}</Text>}
          <Button
            variant="primary"
            size="cta"
            full
            icon="heart"
            busy={sending}
            label={sending ? 'Sending…' : `Send to ${count}`}
            style={styles.cta}
            onPress={() => { send() }}
          />
          {typeof expiryDays === 'number' && (
            <Text style={[text.uiXs, styles.muted, styles.center]}>{`Each Interest stays open for ${expiryDays} ${expiryDays === 1 ? 'day' : 'days'}.`}</Text>
          )}
        </View>
      }
    >
      <View style={styles.batchHead}>
        <FaceStack people={candidates} />
        <View style={styles.heading}>
          <Text style={text.displayXs} accessibilityRole="header">{`Send an Interest to ${count} ${count === 1 ? 'person' : 'people'}`}</Text>
          <Text style={[text.uiSm, styles.muted]} numberOfLines={2}>{namesLine(candidates.map((c) => c.name))}</Text>
        </View>
      </View>

      <JobField openings={openings} jobId={jobId} onChange={setJobId} />
      <MessageField value={message} onChange={setMessage} max={messageMax}>
        <Text style={[text.uiXs, styles.muted]}>Each of them gets this message on their own. No one sees who else got it.</Text>
      </MessageField>
    </EmSheet>
  )
}

/** The JOB radio list: the employer's live or paused openings, then no specific job. Nothing when they have none. */
function JobField({ openings, jobId, onChange }: { openings: EmployerJobRef[]; jobId: string; onChange: (id: string) => void }) {
  if (openings.length === 0) return null
  return (
    <View style={styles.field}>
      <Text style={[text.metaSm, styles.mono, styles.muted]}>Job</Text>
      <View style={styles.radios} accessibilityRole="radiogroup" accessibilityLabel="Link to a job post">
        {[...openings.map((j) => ({ id: j.id, title: j.title })), { id: '', title: 'No specific job' }].map((j, i) => {
          const on = jobId === j.id
          return (
            <Pressable
              key={j.id || 'none'}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={j.title}
              onPress={() => onChange(j.id)}
              style={({ pressed }) => [styles.radio, i > 0 && styles.radioRule, pressed && styles.pressed]}
            >
              <View style={[styles.ring, on && styles.ringOn]} />
              <Text style={[text.uiMd, styles.grow]} numberOfLines={1}>{j.title}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/** The MESSAGE field with its counter; the limit is /config's, and the counter drops it when there is none. */
function MessageField({
  value, onChange, max, children,
}: { value: string; onChange: (v: string) => void; max: number | undefined; children?: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[text.metaSm, styles.mono, styles.muted]}>Message</Text>
      <View style={styles.box}>
        <TextInput
          value={value}
          onChangeText={onChange}
          maxLength={max}
          multiline
          textAlignVertical="top"
          placeholder="Say why you’d like to talk."
          placeholderTextColor={color.textSubtle}
          accessibilityLabel="Message, optional"
          style={[text.uiMd, styles.input]}
        />
        <Text style={[text.metaSm, styles.count]} accessibilityLabel={max ? `${value.length} of ${max} characters` : `${value.length} characters`}>
          {typeof max === 'number' ? `${value.length} / ${max}` : String(value.length)}
        </Text>
      </View>
      {children}
    </View>
  )
}

/** Three shades of the brand red, so overlapped initials read as three people (mass · 3). */
const STACK_TINTS = [color.accentBright, color.accent, color.accentDeep]

/** The batch sheet's faces (mass · 3): three, overlapped on a white ring, and "+n" for the rest. */
function FaceStack({ people }: { people: InterestCandidate[] }) {
  const more = people.length - FACE_STACK_MAX
  return (
    <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {people.slice(0, FACE_STACK_MAX).map((p, i) => (
        <View key={p.id} style={[styles.stackRing, i > 0 && styles.stackOverlap]}>
          <Face name={p.name} photo={p.photoUrl} size={height['control-xs'] - borderWidth.accent * 2} tint={STACK_TINTS[i % STACK_TINTS.length]} />
        </View>
      ))}
      {more > 0 && (
        <View style={[styles.stackRing, styles.stackOverlap, styles.stackMore]}>
          <Text style={[text.uiSmSemi, styles.secondary]}>{`+${more}`}</Text>
        </View>
      )}
    </View>
  )
}

/** One person's answer (mass · 4): the face and name, why it did not go, and Sent or Not sent. */
function ResultRow({ person, result, last }: { person: InterestCandidate | undefined; result: InterestBatchResult; last: boolean }) {
  const name = person?.name ?? 'Candidate'
  const sent = result.outcome === 'SENT'
  const why =
    result.outcome === 'COOLDOWN'
      ? `An Interest is already open${result.nextEligibleAt ? ` · next from ${day(result.nextEligibleAt)}` : ''}`
      : result.outcome === 'UNAVAILABLE'
        ? 'No longer available'
        : null
  return (
    <View
      style={[styles.row, !last && styles.rowRule]}
      accessible
      accessibilityLabel={[name, sent ? 'Sent' : 'Not sent', why].filter(Boolean).join(', ')}
    >
      <Face name={name} photo={person?.photoUrl} size={height.avatar} />
      <View style={styles.grow}>
        <Text style={text.uiMd} numberOfLines={1}>{name}</Text>
        {!!why && <Text style={[text.uiXs, styles.muted]}>{why}</Text>}
      </View>
      {sent ? (
        <View style={styles.status}>
          <Icon name="check" size={spaceHalf['3.5']} tint={color.success} weight={2.6} />
          <Text style={[text.uiSmSemi, styles.ok]}>Sent</Text>
        </View>
      ) : (
        <Text style={[text.uiSmSemi, styles.warn]}>Not sent</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },
  ok: { color: color.success },
  warn: { color: color.warning },
  mono: { letterSpacing: trackingNative.eyebrow },
  pressed: { opacity: opacity.pressed },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space['2xs'] },
  field: { gap: space.sm },

  radios: { borderRadius: radius.panel, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, overflow: 'hidden' },
  radio: { minHeight: height['control-md'], flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: spaceHalf['3.5'] },
  radioRule: { borderTopWidth: borderWidth.thin, borderTopColor: color.borderSoft },
  ring: { width: space.xl, height: space.xl, borderRadius: radius.pill, borderWidth: borderWidth.accent, borderColor: color.borderStrong },
  ringOn: { borderWidth: spaceHalf['1.5'], borderColor: color.accent },

  box: {
    minHeight: height['note-field'] + space.lg + space.lg,
    borderRadius: radius.tile,
    borderWidth: borderWidth.thin,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
    paddingTop: spaceHalf['2.5'],
    paddingHorizontal: space.md,
    paddingBottom: space['2xl'] - space.xs,
  },
  input: { flex: 1, minHeight: height['note-field'] - space.sm, padding: 0, color: color.text },
  count: { position: 'absolute', right: spaceHalf['2.5'], bottom: spaceHalf['1.5'], color: color.textSubtle },

  foot: { paddingHorizontal: space.lg, gap: space.sm, backgroundColor: color.surface },
  cta: { boxShadow: shadow.accent },

  answer: { paddingTop: spaceHalf['4.5'], paddingBottom: space.sm },
  answerFoot: { flexDirection: 'row', gap: spaceHalf['2.5'], paddingHorizontal: space.xl, paddingTop: space.lg, backgroundColor: color.surface },

  // mass · 3 and 4
  batchHead: { gap: space.md, paddingTop: space['2xs'] },
  heading: { gap: space['2xs'] },
  stack: { flexDirection: 'row' },
  stackRing: { borderRadius: radius.pill, borderWidth: borderWidth.accent, borderColor: color.surface },
  stackOverlap: { marginLeft: -spaceHalf['1.5'] },
  stackMore: { width: height['control-xs'], height: height['control-xs'], backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  mark: { width: height.fab, height: height.fab, borderRadius: radius.pill, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center' },
  markNone: { backgroundColor: color.warningSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'] },
  rowRule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
})
