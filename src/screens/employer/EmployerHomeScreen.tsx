import React, { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { color, opacity, space, spaceHalf } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, EmMono, EmSteps, EmWell, type EmTone, type StepState } from '../../components/employer/em'
import { fetchShortlist } from '../../lib/api/employerShortlist'
import { fetchEmployerInterests, liveInterestOutcome } from '../../lib/api/employerInterests'
import { fetchEmployerJobs } from '../../lib/api/employerJobs'
import { useChatUnread } from '../../lib/employer/useNavCounts'
import { useEmployerConfig } from '../../lib/employer/useEmployerConfig'
import type { RootStackParamList } from '../../../App'
import { useEmployer } from '../../lib/employer/useEmployer'
import type { EmployerState } from '../../lib/api/employer'
import { formatIst, formatIstStep, needsAction, promptState } from '../../lib/employer/state'
import { EmployerLoadState, requirementActions, type DocumentKey } from './EmployerStatusScreen'

export interface EmployerHomeScreenProps {
  /** EM-05, optionally scrolled to one requirement. */
  onDocuments: (focus?: DocumentKey) => void
  /** EM-06. */
  onStatus: () => void
  /** EM-08, the candidate feed, from a verified employer's home. */
  onFeed?: () => void
}

/**
 * EM-04 · Home while verification is pending, and EM-04b once verified.
 *
 * Pending: one status card (badge, a sentence, the timeline, the reviewer's
 * words when there are any, and the one thing to do) over the list of what
 * verification unlocks. The design draws "in review"; the other pending states
 * (documents still to submit, more requested, not approved) reuse the card with
 * their own badge, step and action. The bell and the initials (to Account) are
 * the shell's.
 *
 * Verified: the badge card and four numbers, each from its own endpoint — a
 * read that failed shows a dash, never a made-up zero.
 *
 * When a read sees approval land while home is open, home hands over to EM-06,
 * where the Verified Employer moment is drawn.
 */
export function EmployerHomeScreen({ onDocuments, onStatus, onFeed }: EmployerHomeScreenProps) {
  const { state, error, refresh, justVerified } = useEmployer()

  const handedOver = useRef(false)
  useEffect(() => {
    if (!justVerified || handedOver.current) return
    handedOver.current = true
    onStatus()
  }, [justVerified, onStatus])

  if (!state) {
    return (
      <EmployerShell title="Home">
        <EmployerLoadState error={error} onRetry={refresh} />
      </EmployerShell>
    )
  }

  const first = state.company.authorisedPerson.name.trim().split(/\s+/)[0] ?? ''
  const prompt = promptState(state, { justVerified })

  if (prompt === null || prompt === 'verified') {
    return (
      <EmployerShell title={`Welcome back, ${first}.`}>
        <VerifiedHome state={state} onFeed={onFeed} />
      </EmployerShell>
    )
  }

  return (
    <EmployerShell title={`Welcome, ${first}.`}>
      <PendingCard state={state} prompt={prompt} onDocuments={onDocuments} onStatus={onStatus} />
      <EmCard>
        <EmMono>UNLOCKS WHEN VERIFIED</EmMono>
        {UNLOCKS.map((t) => (
          <View key={t} style={styles.unlock}>
            <Icon name="lock" size={space.md + 2} tint={color.textSubtle} weight={2} />
            <Text style={[text.uiMd, styles.secondary]}>{t}</Text>
          </View>
        ))}
      </EmCard>
    </EmployerShell>
  )
}

/** What is locked until a reviewer approves — product copy, as the design draws it. */
const UNLOCKS = [
  'Browse the candidate feed',
  'Play videos and full interviews',
  'Shortlist candidates',
  'Send Interests',
  'Post jobs',
  'Chat with connections',
]

const DOC_NAME: Record<'COMPANY_PROOF' | 'PHOTO_ID', string> = { COMPANY_PROOF: 'Company proof', PHOTO_ID: 'Photo ID' }

/**
 * EM-04 · the pending card. The design draws "in review"; the product has four
 * pending states, so one card carries each: its badge, its sentence, the
 * timeline, the reviewer's words when there are any, and the one thing to do.
 */
function PendingCard({
  state, prompt, onDocuments, onStatus,
}: {
  state: EmployerState
  prompt: 'todo' | 'review' | 'moreInfo' | 'rejected'
  onDocuments: (focus?: DocumentKey) => void
  onStatus: () => void
}) {
  const company = state.company.name
  const v = state.verification
  const hours = useEmployerConfig().verificationTargetHours ?? v.slaHours
  const missing = state.requirements.filter((r) => (r.key === 'COMPANY_PROOF' || r.key === 'PHOTO_ID') && r.status === 'MISSING')
  const acting = state.requirements.filter((r) => r.key !== 'WORK_EMAIL' && needsAction(r))
  const firstAction = requirementActions(acting).values().next().value
  const badge: Record<typeof prompt, { label: string; tone: EmTone; icon: IconName }> = {
    todo: { label: 'Pending verification', tone: 'amber', icon: 'clock' },
    review: { label: 'Pending verification', tone: 'amber', icon: 'clock' },
    moreInfo: { label: 'More documents', tone: 'violet', icon: 'file' },
    rejected: { label: 'Not approved', tone: 'red', icon: 'x' },
  }
  const title = {
    todo: `Verify ${company}.`,
    review: `We’re checking ${company}.`,
    moreInfo: 'One more document, please.',
    rejected: 'We couldn’t verify the company.',
  }[prompt]
  const decisionLine = hours ? `Usually within ${hours} hours` : undefined
  const steps: { title: string; sub?: string; state: StepState }[] = [
    { title: 'Account created', state: 'done' },
    { title: 'Email and mobile verified', state: 'done' },
    prompt === 'todo'
      ? { title: 'Documents to submit', sub: missing.map((r) => DOC_NAME[r.key as 'COMPANY_PROOF' | 'PHOTO_ID']).join(' · ') || undefined, state: 'now' }
      : { title: 'Documents submitted', sub: v.submittedAt ? formatIstStep(v.submittedAt) : undefined, state: 'done' },
    prompt === 'rejected'
      ? { title: 'Not approved', sub: 'Fix it and resubmit. There’s no limit.', state: 'bad' }
      : prompt === 'moreInfo'
        ? { title: 'More documents requested', sub: 'Add them and the review carries on', state: 'now' }
        : { title: 'Reviewer decision', sub: decisionLine, state: prompt === 'review' ? 'now' : 'todo' },
  ]
  const action =
    prompt === 'todo' ? { label: 'Submit documents', onPress: () => onDocuments() }
      : prompt === 'review' ? { label: 'View status', onPress: onStatus }
        : { label: prompt === 'moreInfo' ? 'Add document' : 'Update and resubmit', onPress: () => onDocuments(firstAction?.focus ?? undefined) }

  return (
    <EmCard style={styles.pending}>
      <EmBadge label={badge[prompt].label} tone={badge[prompt].tone} icon={badge[prompt].icon} />
      <Text style={text.displayCard}>{title}</Text>
      <EmSteps steps={steps} />
      {(prompt === 'moreInfo' || prompt === 'rejected') && !!v.reason && (
        <EmWell label={prompt === 'rejected' ? 'Reason' : 'From the reviewer'} tone={prompt === 'rejected' ? 'red' : 'violet'}>{v.reason}</EmWell>
      )}
      <Button variant="secondary" size="pair" full label={action.label} onPress={action.onPress} />
    </EmCard>
  )
}

/**
 * EM-04b · verified. The badge card, then four numbers — each from its own
 * endpoint and each allowed to fail on its own: a card whose read failed shows
 * a dash rather than a made-up zero (the web's rule).
 */
function VerifiedHome({ state, onFeed }: { state: EmployerState; onFeed?: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const approvedAt = state.verification.approvedAt ?? state.verification.reviewedAt
  const shortlist = useQuery({ queryKey: ['employer', 'shortlist', 'count'], queryFn: () => fetchShortlist({ perPage: 1 }) })
  const interests = useQuery({ queryKey: ['employer', 'interests', 'sent'], queryFn: () => fetchEmployerInterests({ outcome: 'SENT', perPage: 50 }) })
  const jobs = useQuery({ queryKey: ['employer', 'jobs', 'live'], queryFn: () => fetchEmployerJobs({ status: 'PUBLISHED', perPage: 50 }) })
  const chats = useChatUnread(true)
  const dash = '—'
  const liveInterests = interests.data
    ? interests.data.total > interests.data.rows.length ? interests.data.total : interests.data.rows.filter((i) => liveInterestOutcome(i) === 'SENT').length
    : null
  const liveJobs = jobs.data ? jobs.data.counts.PUBLISHED ?? jobs.data.total : null
  // Applicants are the sum over the live jobs — only honest while every live job was read.
  const applicants = jobs.data && liveJobs !== null && jobs.data.rows.length >= liveJobs
    ? jobs.data.rows.reduce((sum, j) => sum + j.counters.applications, 0) : null

  const stats: { icon: IconName; value: string; label: string; to: keyof RootStackParamList }[] = [
    { icon: 'bookmark', value: shortlist.data ? String(shortlist.data.totalAll ?? shortlist.data.total) : dash, label: 'SHORTLISTED', to: 'EmployerShortlist' },
    { icon: 'heart', value: liveInterests !== null ? String(liveInterests) : dash, label: 'INTEREST PENDING', to: 'EmployerInterests' },
    { icon: 'brief', value: liveJobs !== null ? (applicants !== null ? `${liveJobs} · ${applicants}` : String(liveJobs)) : dash, label: applicants !== null ? 'JOBS · APPLICANTS' : 'LIVE JOBS', to: 'EmployerJobs' },
    { icon: 'chat', value: String(chats), label: chats === 1 ? 'UNREAD CHAT' : 'UNREAD CHATS', to: 'EmployerChats' },
  ]

  return (
    <>
      <EmCard style={styles.verified}>
        <EmBadge label="Verified employer" tone="green" icon="shield" />
        <Text style={text.displaySm}>{`${state.company.name} is a Verified Employer.`}</Text>
        {!!approvedAt && <EmMono tone="subtle">{`APPROVED ${formatIst(approvedAt).toUpperCase()}`}</EmMono>}
        <Button variant="primary" size="cta" full label="Open the candidate feed" onPress={onFeed ?? (() => navigation.navigate('EmployerFeed'))} />
      </EmCard>
      <View style={styles.grid}>
        {stats.map((st) => (
          <Pressable
            key={st.label}
            accessibilityRole="button"
            accessibilityLabel={`${st.value} ${st.label.toLowerCase()}`}
            onPress={() => navigation.navigate(st.to as never)}
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
          >
            <EmCard style={styles.stat}>
              <Icon name={st.icon} size={space.lg + 2} tint={color.accent} />
              <Text style={text.displayHeading}>{st.value}</Text>
              <EmMono>{st.label}</EmMono>
            </EmCard>
          </Pressable>
        ))}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  pending: { padding: spaceHalf['4.5'], gap: spaceHalf['3.5'] },
  verified: { padding: spaceHalf['4.5'], gap: space.md },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'] },
  secondary: { color: color.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['2.5'] },
  cell: { width: '48.5%', flexGrow: 1 },
  stat: { gap: space.sm },
  pressed: { opacity: opacity.pressed },
})
