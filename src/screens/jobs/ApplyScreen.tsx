import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api, ApiClientError } from '../../lib/api'
import { applyToJob, type JobDetail } from '../../lib/api/jobs'
import { color, space, borderWidth } from '../../theme'
import { AppBar, Banner, Body, Button, Card, Display, Eyebrow, Field, Input, Meta, StatusPill, VerifiedSeal } from '../../components/ui'

interface Profile { publishedAt: string | null }
type Phase = 'ready' | 'sending' | 'sent' | 'connected' | 'already' | 'unpublished' | 'closed'

/**
 * ST-39 — the confirmation of exactly what is being sent: profile + verified
 * video resume as FACT (not pickers or toggles); only the message is editable.
 * Applying needs a published video resume (JF-19), so with no interview yet this
 * is a refusal that routes to booking; a duplicate is refused as a calm state.
 */
export function ApplyScreen({ id, onBack, onApplications, onBook, onFeed }: {
  id: string; onBack: () => void; onApplications: () => void; onBook: () => void; onFeed: () => void
}) {
  const insets = useSafeAreaInsets()
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('ready')
  const [error, setError] = useState<string | null>(null)
  const jobQ = useQuery<JobDetail>({ queryKey: ['job', id], queryFn: () => api.get<JobDetail>(`/students/me/jobs/${id}`) })
  const profQ = useQuery<Profile>({ queryKey: ['profile'], queryFn: () => api.get<Profile>('/students/me/profile') })

  useEffect(() => {
    if (jobQ.data && profQ.data && phase === 'ready') {
      if (jobQ.data.application) setPhase('already')
      else if (!profQ.data.publishedAt) setPhase('unpublished')
    }
  }, [jobQ.data, profQ.data, phase])

  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="" onBack={onBack} />{c}</View>
  if (jobQ.isPending || profQ.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (jobQ.isError) {
    const closed = jobQ.error instanceof ApiClientError && jobQ.error.code === 'CONFLICT'
    return frame(<View style={{ padding: space.xl }}><Banner tone="warning">{closed ? 'Applications for this job have closed.' : 'This job is no longer available.'}</Banner></View>)
  }
  const job = jobQ.data!, profile = profQ.data!

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
    <View style={styles.centreBody}>
      <StatusPill tone="success" label={phase === 'connected' ? 'Connected' : 'Applied'} />
      <Display level="lg" style={{ marginTop: space.md }}>{phase === 'connected' ? 'You are connected.' : 'Your application is in.'}</Display>
      <Body tone="muted" style={{ marginTop: space.sm }}>{phase === 'connected' ? `${job.company.name} had already shortlisted you — a chat is open.` : `${job.company.name} has your profile and verified video resume. You will hear at every step.`}</Body>
      <View style={{ marginTop: space.xl, gap: space.md, width: '100%' }}>
        <Button variant="primary" size="lg" full label="Track your applications" onPress={onApplications} />
        <Button variant="text" size="md" label="Back to the feed" onPress={onFeed} />
      </View>
    </View>,
  )
  if (phase === 'already') return frame(
    <View style={styles.centreBody}>
      <StatusPill tone="neutral" label="Already applied" />
      <Display level="lg" style={{ marginTop: space.md }}>This one is already in your pipeline.</Display>
      <Body tone="muted" style={{ marginTop: space.sm }}>You cannot apply twice — track where it stands instead.</Body>
      <View style={{ marginTop: space.xl, width: '100%' }}><Button variant="primary" size="lg" full label="Track your applications" onPress={onApplications} /></View>
    </View>,
  )
  if (phase === 'unpublished') return frame(
    <View style={styles.centreBody}>
      <Eyebrow>Before you can apply</Eyebrow>
      <Display level="lg" style={{ marginTop: space.sm }}>Your video resume isn&rsquo;t ready yet.</Display>
      <Body tone="muted" style={{ marginTop: space.sm }}>Employers see your verified interview with every application — so applying opens once your film is published.</Body>
      <View style={{ marginTop: space.xl, width: '100%' }}><Button variant="primary" size="lg" full label="Book an interview" onPress={onBook} /></View>
    </View>,
  )
  if (phase === 'closed') return frame(<View style={{ padding: space.xl }}><Banner tone="warning">Applications for this job have closed.</Banner></View>)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.xs }}>
          <Eyebrow>Applying to</Eyebrow>
          <Display level="md">{job.title}</Display>
          <Display level="xs" style={{ color: color.textMuted }}>{job.company.name}</Display>
        </View>
        <View style={{ gap: space.sm }}>
          <Eyebrow>What {job.company.name} receives</Eyebrow>
          <Fact t="Your full profile — education, experience, skills and preferences." />
          <Fact t="Your verified video resume, from your interview." />
        </View>
        <Card style={styles.videoCard}>
          <View style={{ gap: space.sm }}>
            <Body weight="medium">Your video resume</Body>
            <VerifiedSeal date={profile.publishedAt ? fmtDate(profile.publishedAt) : undefined} />
          </View>
        </Card>
        <Field label="Add a note" helper="Optional — one or two lines to the employer.">
          <Input value={message} onChangeText={(v) => setMessage(v.slice(0, 600))} placeholder="Why this role, in a sentence." multiline maxLength={600} />
        </Field>
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + space.lg }]}>
        <Button variant="primary" size="lg" full busy={phase === 'sending'} label="Send application" onPress={send} />
      </View>
    </View>
  )
}

function Fact({ t }: { t: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}><Path d="M20 6 9 17l-5-5" stroke={color.success} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      <Body size="sm" style={{ flex: 1 }}>{t}</Body>
    </View>
  )
}
function fmtDate(iso: string) { const d = new Date(iso); const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}` }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centreBody: { flex: 1, padding: space.xl, justifyContent: 'center', alignItems: 'flex-start' },
  body: { padding: space.xl, gap: space.lg },
  videoCard: { padding: space.lg },
  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingHorizontal: space.xl, paddingTop: space.md },
})
