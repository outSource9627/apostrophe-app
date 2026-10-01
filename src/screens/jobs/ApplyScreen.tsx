import React, { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { applyToJob, type JobDetail } from '../../lib/api/jobs'
import { getVideoResume } from '../../lib/api/student'
import { fmtDayMonthYear } from '../../lib/chat/format'
import { borderWidth, color, fontFamilyNative as FF, opacity } from '../../theme'
import { StatusPill, VerifiedSeal } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { Btn, Panel, Skel } from '../../components/tab/kit'
import { Notice } from './jobKit'

const NOTE_MAX = 600

interface Profile { publishedAt: string | null }
type Phase = 'ready' | 'sending' | 'sent' | 'connected' | 'already' | 'unpublished' | 'closed'

/**
 * ST-39 — option A of docs/student-job-detail-mockup.html: a bottom sheet over a scrim. The confirmation of exactly what is being sent: profile + verified
 * video resume as FACT (not pickers or toggles); only the message is editable.
 * Applying needs a published video resume (JF-19), so with no interview yet this
 * is a refusal that routes to booking; a duplicate is refused as a calm state.
 */
export function ApplyScreen({ id, onBack, onApplications, onBook, onFeed }: {
  id: string; onBack: () => void; onApplications: () => void; onBook: () => void; onFeed: () => void
}) {
  const insets = useSafeAreaInsets()
  const { height: screenH } = useWindowDimensions()
  const [noteFocus, setNoteFocus] = useState(false)
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('ready')
  const [error, setError] = useState<string | null>(null)
  const jobQ = useQuery<JobDetail>({ queryKey: ['job', id], queryFn: () => api.get<JobDetail>(`/students/me/jobs/${id}`) })
  const profQ = useQuery<Profile>({ queryKey: ['profile'], queryFn: () => api.get<Profile>('/students/me/profile') })
  // The seal carries the day of the INTERVIEW. `profile.publishedAt` is set once and never moves, so it is the day the profile first
  // went live, not the day this film was made. Only the two dates are kept: the film's signed address is not held in the cache.
  const filmQ = useQuery({
    queryKey: ['video-resume', 'apply-dates'],
    queryFn: () => getVideoResume().then((f) => ({ interviewedAt: f.interviewedAt, publishedAt: f.publishedAt })),
  })

  useEffect(() => {
    if (jobQ.data && profQ.data && phase === 'ready') {
      if (jobQ.data.application) setPhase('already')
      else if (!profQ.data.publishedAt) setPhase('unpublished')
    }
  }, [jobQ.data, profQ.data, phase])

  // The sheet: grab handle, then whichever state the flow is in.
  const frame = (c: React.ReactNode) => (
    <View style={styles.page}>
      <Pressable accessibilityLabel="Close" onPress={onBack} style={StyleSheet.absoluteFill} />
      <View style={[styles.sheet, { maxHeight: screenH * 0.88, paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.grab} />
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {c}
        </ScrollView>
      </View>
    </View>
  )
  if (jobQ.isPending || profQ.isPending) return frame(<View style={styles.skel}><Skel w="80%" h={34} /><Skel w="45%" h={18} /><Skel w="100%" h={90} /></View>)
  if (jobQ.isError) {
    const closed = jobQ.error instanceof ApiClientError && jobQ.error.code === 'CONFLICT'
    return frame(<Notice tone="warning">{closed ? 'Applications for this job have closed.' : 'This job is no longer available.'}</Notice>)
  }
  const job = jobQ.data!
  // Never a date that is not the film's: when the film's dates cannot be read the seal carries none.
  const sealAt = filmQ.data ? filmQ.data.interviewedAt ?? filmQ.data.publishedAt : null

  async function send() {
    setPhase('sending'); setError(null)
    try {
      const r = await applyToJob(id, message.trim() || undefined)
      setPhase(r.status === 'CONNECTED' ? 'connected' : 'sent')
    } catch (e) {
      if (e instanceof ApiClientError) {
        const reason = (e.details as { reason?: string })?.reason
        if (e.code === 'CONFLICT' && reason === 'ALREADY_APPLIED') return setPhase('already')
        if (e.code === 'CONFLICT') return setPhase('closed')
        if (reason === 'PROFILE_NOT_PUBLISHED') return setPhase('unpublished')
        setError(e.message)
      } else setError('Could not send your application. Try again.')
      setPhase('ready')
    }
  }

  if (phase === 'sent' || phase === 'connected') return frame(
    <View style={styles.done}>
      <View style={styles.ring}><Icon name="check" size={30} tint={color.success} weight={2.4} /></View>
      <StatusPill tone="success" label={phase === 'connected' ? 'Connected' : 'Applied'} />
      <Text style={styles.h2}>{phase === 'connected' ? 'You are connected.' : 'Your application is in.'}</Text>
      <Text style={styles.lead}>{phase === 'connected' ? `${job.company.name} had already shortlisted you — a chat is open.` : `${job.company.name} has your profile and verified video resume. You will hear at every step.`}</Text>
      <View style={styles.actions}>
        <Btn variant="primary" label="Track your applications" onPress={onApplications} />
        <Btn variant="quiet" label="Back to the feed" onPress={onFeed} />
      </View>
    </View>,
  )
  if (phase === 'already') return frame(
    <View style={styles.done}>
      <StatusPill tone="neutral" label="Already applied" />
      <Text style={styles.h2}>This one is already in your pipeline.</Text>
      <Text style={styles.lead}>You cannot apply twice — track where it stands instead.</Text>
      <View style={styles.actions}><Btn variant="primary" label="Track your applications" onPress={onApplications} /></View>
    </View>,
  )
  if (phase === 'unpublished') return frame(
    <View style={styles.done}>
      <Text style={styles.eyebrow}>BEFORE YOU CAN APPLY</Text>
      <Text style={styles.h2}>Your video resume isn&rsquo;t ready yet.</Text>
      <Text style={styles.lead}>Employers see your verified interview with every application — so applying opens once your film is published.</Text>
      <View style={[styles.actions, styles.actionsGap]}><Btn variant="primary" label="Book an interview" onPress={onBook} /></View>
    </View>,
  )
  if (phase === 'closed') return frame(<Notice tone="warning">Applications for this job have closed.</Notice>)

  return frame(
    <>
      <View style={styles.applyHead}>
        <View style={styles.grow}>
          <Text style={[styles.eyebrow, { color: color.accent }]}>APPLYING TO</Text>
          <Text style={styles.h2}>{job.title}</Text>
          <Text style={styles.co}>{job.company.name}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onBack} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Icon name="x" size={20} tint={color.textMuted} />
        </Pressable>
      </View>
      <View style={styles.receives}>
        <Text style={styles.eyebrow}>{`WHAT ${job.company.name} RECEIVES`.toUpperCase()}</Text>
        <Fact t="Your full profile — education, experience, skills and preferences." />
        <Fact t="Your verified video resume, from your interview." />
      </View>
      <Panel style={styles.videoCard}>
        <Text style={styles.videoTitle}>Your video resume</Text>
        <VerifiedSeal date={sealAt ? fmtDayMonthYear(sealAt) : undefined} style={styles.seal} />
      </Panel>
      <View>
        <Text style={styles.label}>Add a note</Text>
        <TextInput
          value={message}
          onChangeText={(v) => setMessage(v.slice(0, NOTE_MAX))}
          onFocus={() => setNoteFocus(true)}
          onBlur={() => setNoteFocus(false)}
          placeholder="Why this role, in a sentence."
          placeholderTextColor={color.textSubtle}
          multiline
          maxLength={NOTE_MAX}
          textAlignVertical="top"
          style={[styles.note, noteFocus && styles.noteFocus]}
        />
        <View style={styles.noteRow}>
          <Text style={[styles.hint, styles.grow]}>Optional — one or two lines to the employer.</Text>
          <Text style={styles.count}>{message.length} / {NOTE_MAX}</Text>
        </View>
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Btn variant="primary" busy={phase === 'sending'} label="Send application" onPress={send} />
    </>,
  )
}

function Fact({ t }: { t: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.tick}><Icon name="check" size={16} tint={color.success} weight={2.4} /></View>
      <Text style={styles.factText}>{t}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.scrim },
  pressed: { opacity: opacity.pressed },
  grow: { flex: 1, minWidth: 0 },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 20 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 4, backgroundColor: color.borderStrong, marginBottom: 12 },
  sheetBody: { gap: 16 },
  eyebrow: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 1.54, color: color.textMuted },
  h2: { fontFamily: FF.bodyBold, fontSize: 22, lineHeight: 25, letterSpacing: -0.66, color: color.text },
  lead: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.textMuted },
  co: { fontFamily: FF.body, fontSize: 15, color: color.textMuted },
  done: { gap: 10, alignItems: 'flex-start' },
  ring: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: color.successSoft },
  skel: { gap: 12 },
  receives: { gap: 9 },
  actionsGap: { marginTop: 8 },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 6 },
  applyHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  fact: { flexDirection: 'row', gap: 10 },
  tick: { marginTop: 2 },
  factText: { flex: 1, fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.text },
  videoCard: { padding: 14, gap: 8 },
  videoTitle: { fontFamily: FF.bodySemiBold, fontSize: 15.5, color: color.text },
  seal: { alignSelf: 'flex-start' },
  label: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.text, marginBottom: 6 },
  note: {
    minHeight: 84, borderWidth: borderWidth.medium, borderColor: color.borderStrong, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    fontFamily: FF.body, fontSize: 15, lineHeight: 21, color: color.text, backgroundColor: color.surface,
  },
  noteFocus: { borderColor: color.accent },
  noteRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  hint: { fontFamily: FF.body, fontSize: 13, color: color.textSubtle },
  count: { fontFamily: FF.monoMedium, fontSize: 11, color: color.textSubtle },
})
