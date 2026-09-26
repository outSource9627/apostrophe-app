import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { borderWidth, color, height, radius, space, spaceHalf } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmDone, EmLabel, EmRadioRow, EmSheet } from '../../components/employer/em'
import { FeedFace } from '../../components/employer/feed'
import { ApiClientError } from '../../lib/api'
import { sendCandidateInterest, type SendInterestResult } from '../../lib/api/employerInterests'
import type { EmployerJobRef } from '../../lib/api/employerShortlist'
import { tierLine } from '../../lib/employer/candidateFormat'
import { formatIst } from '../../lib/employer/state'
import { useEmployer } from '../../lib/employer/useEmployer'
import { linkableJobs, useEmployerJobRefs } from '../../lib/employer/useLinkableJobs'
import { useShortlistConfig } from '../../lib/employer/useShortlistConfig'
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
 * EM-13 · Send an Interest, as a bottom sheet (Employer Android A.iForm): the
 * candidate, an optional message (the server's limit), an optional link to one
 * of the employer's live or paused jobs, the rules, and Send. The three answers
 * the server can give are drawn in the same sheet: sent (EM-13b), an Interest
 * already inside the cooldown (EM-13c), and already connected.
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
  const { state } = useEmployer()
  const cfg = useShortlistConfig()
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
  const company = state?.company.name

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
        setOutcome({ kind: 'cooldown', nextEligibleAt: err.details?.nextEligibleAt, cooldownDays: err.details?.cooldownDays ?? cfg.interestCooldownDays })
      } else if (err?.details?.reason === 'ALREADY_CONNECTED' || err?.code === 'ALREADY_CONNECTED') {
        setOutcome({ kind: 'connected' })
      } else {
        setError(e instanceof ApiClientError ? e.message : 'Could not send the Interest. Check your connection and try again.')
      }
    } finally {
      setSending(false)
    }
  }

  const doneFoot = { height: insets.bottom }

  if (outcome?.kind === 'sent') {
    const { result, job } = outcome
    return (
      <EmSheet open={open} onClose={onClose} scroll={false} foot={<View style={doneFoot} />}>
        <EmDone
          icon="check"
          tone="green"
          title={`Interest sent to ${first}`}
          body={`${job ? `Linked to ${job.title}. ` : ''}If accepted, a chat opens. Expires ${day(result.expiresAt)} if unanswered.`}
          actions={
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
            </>
          }
        />
      </EmSheet>
    )
  }

  if (outcome?.kind === 'cooldown') {
    const { nextEligibleAt, cooldownDays } = outcome
    const rule = typeof cooldownDays === 'number' ? `One per candidate every ${cooldownDays} days.` : 'Another Interest to the same candidate can’t go yet.'
    const when = nextEligibleAt ? ` The next can go from ${day(nextEligibleAt)}.` : ' Track it in Interests.'
    return (
      <EmSheet open={open} onClose={onClose} scroll={false} foot={<View style={doneFoot} />}>
        <EmDone
          icon="clock"
          tone="violet"
          title={`${first} already has an Interest`}
          body={`${rule}${when}`}
          actions={<Button variant="secondary" size="cta" label="Done" style={styles.grow} onPress={onClose} />}
        />
      </EmSheet>
    )
  }

  if (outcome?.kind === 'connected') {
    return (
      <EmSheet open={open} onClose={onClose} scroll={false} foot={<View style={doneFoot} />}>
        <EmDone
          icon="chat"
          tone="green"
          title={`You and ${first} are connected`}
          body="You already have an open conversation, so there is nothing to send. Carry on in Chats."
          actions={
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
            </>
          }
        />
      </EmSheet>
    )
  }

  const sub = [tierLine(candidate.tier, candidate.qualification), candidate.city].filter(Boolean).join(' · ')
  const rules: { icon: IconName; text: string }[] = []
  if (company) rules.push({ icon: 'shield', text: `${first} sees ${company} with your Verified Employer badge.` })
  rules.push({ icon: 'chat', text: 'If they accept, you’re connected and a chat opens.' })
  rules.push({
    icon: 'clock',
    text: `${typeof cfg.interestExpiryDays === 'number' ? `Unanswered Interests expire after ${cfg.interestExpiryDays} days.` : 'Unanswered Interests expire.'} A decline shows only as “Not accepted”.`,
  })
  if (typeof cfg.interestCooldownDays === 'number') rules.push({ icon: 'info', text: `One Interest per candidate every ${cfg.interestCooldownDays} days.` })

  return (
    <EmSheet
      open={open}
      onClose={onClose}
      tall
      title="Send an Interest"
      sub="Separate from your private shortlist."
      foot={
        <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
          {!!error && <Text style={[text.uiSm, styles.danger]}>{error}</Text>}
          <Button variant="primary" size="lg" full icon="heart" busy={sending} label={sending ? 'Sending…' : 'Send Interest'} onPress={() => { send() }} />
        </View>
      }
    >
      <View style={styles.cand}>
        <FeedFace name={candidate.name} photo={candidate.photoUrl} size={height.tap} />
        <View style={styles.grow}>
          <Text style={text.uiBaseSemi} numberOfLines={1}>{candidate.name}</Text>
          {!!sub && <Text style={[text.uiXs, styles.muted]} numberOfLines={1}>{sub}</Text>}
        </View>
        {candidate.verified && <Icon name="shield" size={spaceHalf['4.5']} tint={color.successFill} weight={2} />}
      </View>

      <View style={styles.field}>
        <EmLabel hint={`optional · ${message.length} / ${cfg.messageMax}`}>Message</EmLabel>
        <Input
          value={message}
          onChangeText={setMessage}
          maxLength={cfg.messageMax}
          multiline
          textAlignVertical="top"
          placeholder="Say why you’d like to talk."
          style={styles.area}
        />
      </View>

      {openings.length > 0 && (
        <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel="Link to a job post">
          <EmLabel hint="optional">Link to a job post</EmLabel>
          {openings.map((j) => <EmRadioRow key={j.id} label={j.title} on={jobId === j.id} onPress={() => setJobId(j.id)} />)}
          <EmRadioRow label="No specific job" on={jobId === ''} onPress={() => setJobId('')} />
        </View>
      )}

      <View style={styles.rules}>
        {rules.map((r) => (
          <View key={r.text} style={styles.rule}>
            <Icon name={r.icon} size={space.lg} tint={color.textMuted} />
            <Text style={[text.uiSm, styles.secondary, styles.grow]}>{r.text}</Text>
          </View>
        ))}
      </View>
    </EmSheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },
  cand: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.panel, borderWidth: borderWidth.thin, borderColor: color.border },
  field: { gap: spaceHalf['1.5'] },
  area: { height: height['note-field'] + space.xl, paddingTop: space.md },
  rules: { borderRadius: radius.tile, backgroundColor: color.surfaceMuted, paddingVertical: spaceHalf['3.5'], paddingHorizontal: space.lg, gap: spaceHalf['2.5'] },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'] },
  foot: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
})
