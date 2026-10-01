import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, opacity, radius, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { EmIconButton, EmSheet } from '../../components/employer/em'
import { Face, StudioState } from '../../components/employer/studio'
import { ApiClientError } from '../../lib/api'
import { sendCandidateInterest, type SendInterestResult } from '../../lib/api/employerInterests'
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
export function SendInterestSheet({
  open, candidate, jobs, onClose, onSent,
}: {
  open: boolean
  candidate: InterestCandidate
  /** The employer's openings to offer. Omit and the sheet loads their live and paused jobs. */
  jobs?: EmployerJobRef[]
  onClose: () => void
  onSent?: (result: SendInterestResult) => void
}) {
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

      {openings.length > 0 && (
        <View style={styles.field}>
          <Text style={[text.metaSm, styles.mono, styles.muted]}>JOB</Text>
          <View style={styles.radios} accessibilityRole="radiogroup" accessibilityLabel="Link to a job post">
            {[...openings.map((j) => ({ id: j.id, title: j.title })), { id: '', title: 'No specific job' }].map((j, i) => {
              const on = jobId === j.id
              return (
                <Pressable
                  key={j.id || 'none'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={j.title}
                  onPress={() => setJobId(j.id)}
                  style={({ pressed }) => [styles.radio, i > 0 && styles.radioRule, pressed && styles.pressed]}
                >
                  <View style={[styles.ring, on && styles.ringOn]} />
                  <Text style={[text.uiMd, styles.grow]} numberOfLines={1}>{j.title}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      <View style={styles.field}>
        <Text style={[text.metaSm, styles.mono, styles.muted]}>MESSAGE</Text>
        <View style={styles.box}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            maxLength={messageMax}
            multiline
            textAlignVertical="top"
            placeholder="Say why you’d like to talk."
            placeholderTextColor={color.textSubtle}
            accessibilityLabel="Message, optional"
            style={[text.uiMd, styles.input]}
          />
          <Text style={[text.metaSm, styles.count]} accessibilityLabel={messageMax ? `${message.length} of ${messageMax} characters` : `${message.length} characters`}>
            {typeof messageMax === 'number' ? `${message.length} / ${messageMax}` : String(message.length)}
          </Text>
        </View>
      </View>
    </EmSheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  muted: { color: color.textMuted },
  danger: { color: color.danger },
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
})
