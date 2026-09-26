import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { aspect, borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmBadge, EmCard, EmChip, EmError, EmLabel, EmMono, EmSheet } from '../../components/employer/em'
import {
  EMPLOYER_APPLICATION_STATUS_LABEL, fetchApplicationDetail, updateApplicationStatus,
  type ApplicationDetail, type ApplicationStatus,
} from '../../lib/api/employerJobs'
import { experienceLine, interviewDate, joinsLine, monthYear, nameInitials, salaryLine } from '../../lib/employer/candidateFormat'
import { APPLICATION_TONE, istStamp, useJobConfig } from '../../lib/employer/jobs'
import { label } from '../../lib/profile/labels'
import type { RootStackParamList } from '../../../App'

const STEPS: ApplicationStatus[] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'CONNECTED']

/** The design's suggestions: one tap fills the field, and it stays editable. */
const REASONS = [
  'The role has been filled',
  'We need more experience for this role',
  'Location doesn’t work for this role',
  'Skills don’t match this role',
]

/**
 * EM-21 · one application (Employer Android): the film and the facts, the
 * application status as steps, the profile, and the actions in the foot —
 * Reject (a sheet with the design's reasons), Shortlist, and Open chat once
 * connected.
 *
 * The server's rules, as on the web: opening this marks an Applied application
 * Viewed (the GET does it); an employer can move it to Shortlisted or Rejected
 * only — Connected happens through the student — and a rejection needs a
 * reason (the server refuses one without), which the student sees.
 */
export function ApplicantDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'ApplicantDetail'>>()
  const insets = useSafeAreaInsets()
  const { id } = route.params
  const { rejectMax } = useJobConfig()

  const [app, setApp] = useState<ApplicationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      setApp(await fetchApplicationDetail(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this application.')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function move(status: 'SHORTLISTED' | 'REJECTED', rejectionReason?: string) {
    setBusy(true)
    setNotice(null)
    try {
      await updateApplicationStatus(id, { status, rejectionReason })
      setRejecting(false)
      setReason('')
      await load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update the application.')
    } finally {
      setBusy(false)
    }
  }

  if (!app) {
    return (
      <EmployerShell back={() => navigation.goBack()} title="Applicant">
        {error ? (
          <EmError title="This application didn’t load." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </EmployerShell>
    )
  }

  const c = app.candidate
  const first = c.name.split(' ')[0] || 'The student'
  const status = app.status
  const canShortlist = status === 'APPLIED' || status === 'VIEWED' || status === 'REJECTED'
  const canReject = status !== 'REJECTED' && status !== 'CONNECTED'
  const date = c.verifiedInterview.verified ? interviewDate(c.verifiedInterview.at) : null
  const salary = salaryLine({ minPaise: c.preferences?.expectedSalaryMinPaise ?? null, maxPaise: c.preferences?.expectedSalaryMaxPaise ?? null })
  const joins = joinsLine(c.preferences?.availabilityToJoin)
  const reached = (s: ApplicationStatus) => STEPS.indexOf(s) <= STEPS.indexOf(status === 'REJECTED' ? 'VIEWED' : status)
  const at = (s: ApplicationStatus) => app.statusHistory.find((h) => h.status === s)?.at
  const openFull = () => navigation.navigate('CandidateVideo', { id: c.id, name: c.name, photoUrl: c.photoUrl, interviewAt: c.verifiedInterview.at })

  const edu = c.education
  const eduTitle = edu ? [edu.qualification ? label(edu.qualification) : null, edu.fieldOfStudy].filter(Boolean).join(', ') : ''
  const eduMeta = edu ? [edu.institution, edu.yearOfCompletion].filter(Boolean).join(' · ') : ''

  return (
    <EmployerShell
      back={() => navigation.goBack()}
      title={c.name}
      sub={app.job?.title.toUpperCase()}
      footer={
        c.removed ? undefined : (
          <>
            {canReject && <Button variant="destructive" size="cta" label="Reject" disabled={busy} onPress={() => setRejecting(true)} style={styles.reject} />}
            {status === 'CONNECTED' || app.connected ? (
              <Button variant="primary" size="cta" icon="chat" label="Open chat" style={styles.grow} onPress={() => navigation.navigate('EmployerChats')} />
            ) : canShortlist ? (
              <Button variant="secondary" size="cta" label="Shortlist" busy={busy} disabled={busy} style={styles.grow} onPress={() => { move('SHORTLISTED') }} />
            ) : (
              <Button variant="quiet" size="cta" label="Shortlisted" disabled style={styles.grow} />
            )}
          </>
        )
      }
    >
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${c.name}’s full interview`} onPress={openFull} style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}>
          {c.photoUrl ? <Image source={{ uri: c.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
            <Text style={[text.displayCard, styles.thumbText]}>{nameInitials(c.name)}</Text>
          )}
          <View style={styles.disc}><Icon name="tri" size={space.md} tint={color.ink} fill={color.ink} weight={1.5} /></View>
        </Pressable>
        <View style={styles.headText}>
          {!!date && <EmBadge label={`Verified interview · ${date}`} tone="green" icon="check" small />}
          <Text style={[text.uiSm, styles.muted]}>{[c.tier, c.city, experienceLine(c.experienceYears)].filter(Boolean).join(' · ')}</Text>
          {(!!salary || !!joins) && <Text style={[text.uiSm, styles.secondary]}>{[salary, joins ? `joins ${joins.toLowerCase()}` : null].filter(Boolean).join(' · ')}</Text>}
          <EmBadge label={EMPLOYER_APPLICATION_STATUS_LABEL[status]} tone={APPLICATION_TONE[status]} small />
          <Button variant="outline" size="sm" icon="video" label="Full video" onPress={openFull} style={styles.start} />
        </View>
      </View>

      {c.removed && <Text style={[text.uiSm, styles.muted]}>This student is no longer on Apostrophe.</Text>}
      {!!notice && <Text style={[text.uiSm, styles.danger]}>{notice}</Text>}

      <EmCard>
        <EmMono>APPLICATION STATUS</EmMono>
        <View>
          {STEPS.map((s, i) => {
            const on = s === status
            const done = reached(s)
            return (
              <View key={s} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.dot, on ? styles.dotOn : done ? styles.dotDone : styles.dotTodo]} />
                  {i < STEPS.length - 1 && <View style={[styles.bar, done && reached(STEPS[i + 1]) ? styles.barDone : null]} />}
                </View>
                <View style={styles.stepText}>
                  <Text style={[text.uiMdSemi, !done && styles.subtle]}>{EMPLOYER_APPLICATION_STATUS_LABEL[s]}</Text>
                  {!!at(s) && <Text style={[text.uiXs, styles.muted]}>{istStamp(at(s)!)}</Text>}
                </View>
              </View>
            )
          })}
        </View>
        {status === 'REJECTED' && (
          <View style={styles.rejected}>
            <Text style={[text.uiXs, styles.rejectedText]}>{`Rejected${app.rejectionReason ? ` · ${app.rejectionReason}` : ''}`}</Text>
          </View>
        )}
      </EmCard>

      {!!app.message && (
        <EmCard>
          <EmMono>{`${first.toUpperCase()}’S NOTE`}</EmMono>
          <Text style={[text.uiMd, styles.secondary]}>{app.message}</Text>
        </EmCard>
      )}

      {edu && (eduTitle || eduMeta) ? (
        <EmCard>
          <EmMono>EDUCATION</EmMono>
          <View style={styles.line}>
            <Text style={text.uiMdSemi}>{eduTitle || 'Education'}</Text>
            {!!eduMeta && <Text style={[text.uiXs, styles.muted]}>{eduMeta}</Text>}
          </View>
        </EmCard>
      ) : null}

      <EmCard>
        <EmMono>EXPERIENCE</EmMono>
        {c.experience.length > 0 ? (
          c.experience.map((x, i) => (
            <View key={i} style={styles.line}>
              <Text style={text.uiMdSemi}>{[x.role, x.company].filter(Boolean).join(' · ')}</Text>
              <Text style={[text.uiXs, styles.muted]}>{[monthYear(x.from), x.to ? monthYear(x.to) : 'Present'].filter(Boolean).join(' – ')}</Text>
              {!!x.description && <Text style={[text.uiSm, styles.secondary]}>{x.description}</Text>}
            </View>
          ))
        ) : (
          <Text style={[text.uiMd, styles.muted]}>No work experience listed.</Text>
        )}
      </EmCard>

      {c.skills.length > 0 && (
        <EmCard>
          <EmMono>SKILLS</EmMono>
          <View style={styles.tags}>
            {c.skills.map((s) => <View key={s} style={styles.tag}><Text style={[text.metaMd, styles.mono, styles.secondary]}>{s.toUpperCase()}</Text></View>)}
          </View>
        </EmCard>
      )}

      {c.languages.length > 0 && (
        <EmCard>
          <EmMono>LANGUAGES</EmMono>
          <Text style={text.uiMd}>{c.languages.join(', ')}</Text>
        </EmCard>
      )}

      <EmSheet
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject application?"
        sub={`${first} sees your reason with the status change.`}
        foot={
          <View style={[styles.foot, { paddingBottom: space.md + insets.bottom }]}>
            <Button
              variant="dangerFill"
              size="lg"
              full
              label="Reject application"
              busy={busy}
              disabled={busy || !reason.trim()}
              onPress={() => { move('REJECTED', reason.trim()) }}
            />
          </View>
        }
      >
        <View style={styles.chips}>
          {REASONS.map((r) => <EmChip key={r} label={r} on={reason === r} onPress={() => setReason(r)} />)}
        </View>
        <View style={styles.field}>
          <EmLabel hint={rejectMax ? `${reason.length} / ${rejectMax}` : undefined}>Reason shared with the student</EmLabel>
          <Input value={reason} onChangeText={setReason} maxLength={rejectMax} multiline textAlignVertical="top" placeholder="Why this application didn’t go ahead." style={styles.area} />
        </View>
      </EmSheet>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  secondary: { color: color.textSecondary },
  danger: { color: color.danger },
  mono: { letterSpacing: trackingNative.eyebrow },
  loading: { paddingVertical: space['3xl'] },
  start: { alignSelf: 'flex-start', paddingHorizontal: space.md },
  reject: { paddingHorizontal: spaceHalf['4.5'] },

  head: { flexDirection: 'row', gap: space.md },
  thumb: { width: height['room-tile-w'] - space.xs - 2, aspectRatio: aspect.videoResume, borderRadius: radius.panel, backgroundColor: color.inkRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbText: { color: color.textOnInkMuted },
  disc: { position: 'absolute', width: height.chip + 4, height: height.chip + 4, borderRadius: radius.pill, backgroundColor: color.onInkBadge, alignItems: 'center', justifyContent: 'center', paddingLeft: space['2xs'] },
  headText: { flex: 1, minWidth: 0, gap: spaceHalf['1.5'] },

  step: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center' },
  dot: { width: spaceHalf['4.5'], height: spaceHalf['4.5'], borderRadius: radius.pill },
  dotOn: { backgroundColor: color.accent },
  dotDone: { backgroundColor: color.successFill },
  dotTodo: { backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong },
  bar: { width: borderWidth.accent, flex: 1, minHeight: space.lg, backgroundColor: color.border },
  barDone: { backgroundColor: color.successFill },
  stepText: { flex: 1, paddingBottom: space.md, gap: space['2xs'] },
  rejected: { borderRadius: radius.md, backgroundColor: color.dangerSoft, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md },
  rejectedText: { color: color.danger },

  line: { borderLeftWidth: borderWidth.accent, borderLeftColor: color.border, paddingLeft: space.md, gap: space['2xs'] + 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  tag: { height: height['chip-sm'], paddingHorizontal: spaceHalf['2.5'] + 1, borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, justifyContent: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  field: { gap: spaceHalf['1.5'] },
  area: { height: height['note-field'] + spaceHalf['4.5'], paddingTop: space.md },
  foot: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
})
