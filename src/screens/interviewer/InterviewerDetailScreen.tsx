import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native'
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { color, height, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { IvAction, IvCard, IvLabel } from '../../components/interviewer/iv'
import { EmBadge, EmDialog, EmError, type EmTone } from '../../components/employer/em'
import { ApiClientError } from '../../lib/api'
import {
  declineInterview, getInterviewerInterview, getPrivateNotes, getQuestionScript, savePrivateNotes,
  type InterviewerInterviewDto, type QuestionScriptDto,
} from '../../lib/api/interviewer'
import { formatPaise } from '../../lib/format/money'
import { label } from '../../lib/profile/labels'
import { useNow } from '../../lib/employer/useNow'
import {
  clock, educationLine, groupOf, hms, interviewClock, istTime, istWeekday, joinState, NON_PAYABLE_TEXT, pastLabel,
} from '../../lib/interviewer/state'
import { INTERVIEWER_KEY, useAppConfig, useInterviewerMe } from '../../lib/interviewer/useInterviewer'
import type { RootStackParamList } from '../../../App'

/**
 * An interview (no artboard — the drawn screens' language): where it stands
 * and its one action (Join, Scorecard), the candidate as the profile carries
 * them, the assigned question script (with its opening and closing when the
 * server has them), the private notes (read from and saved to their own
 * endpoint — the interview payload carries none), and Decline for a booked
 * interview (the server decides whether it is still allowed and says why not).
 */
export function InterviewerDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewerDetail'>>()
  const { id } = route.params
  const focused = useIsFocused()
  const qc = useQueryClient()
  const config = useAppConfig()
  const { suspended } = useInterviewerMe()
  const now = useNow() || Date.now()

  const [iv, setIv] = useState<InterviewerInterviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [script, setScript] = useState<QuestionScriptDto | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declining, setDeclining] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setIv(await getInterviewerInterview(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this interview.')
    }
  }, [id])

  useEffect(() => {
    if (focused) load()
  }, [focused, load])
  useEffect(() => {
    getQuestionScript(id).then((r) => setScript(r.script)).catch(() => {})
    getPrivateNotes(id).then((r) => { setNotes(r.notes ?? ''); setDraft(r.notes ?? '') }).catch(() => setNotes(null))
  }, [id])

  if (!iv) {
    return (
      <InterviewerShell back={() => navigation.goBack()} title="Interview">
        {error ? <EmError title="Couldn’t load this interview." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /> : <ActivityIndicator color={color.textSubtle} style={styles.loading} />}
      </InterviewerShell>
    )
  }

  const g = groupOf(iv, config, now)
  const j = joinState(iv, config, now)
  const c = interviewClock(iv, config, now)
  let badge: { label: string; tone: EmTone }
  if (g === 'live') badge = { label: iv.status === 'IN_PROGRESS' ? 'In progress' : 'Join open', tone: 'green' }
  else if (g === 'upcoming') badge = { label: 'Booked', tone: 'violet' }
  else if (g === 'owed') badge = { label: 'Scorecard due', tone: c.status === 'URGENT' ? 'red' : 'violet' }
  else badge = { label: pastLabel(iv, config, now).text, tone: pastLabel(iv, config, now).tone }

  const s = iv.student
  const areas = script?.areas ?? iv.script?.areas ?? []
  const notesMax = config?.interviewer?.notesMaxChars

  async function saveNotes() {
    setSaving(true)
    setNotice(null)
    try {
      const r = await savePrivateNotes(id, draft)
      setNotes(r.notes ?? draft)
      setNotice('Notes saved.')
    } catch (e) {
      setNotice(e instanceof ApiClientError ? e.message : 'Notes not saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function decline() {
    setDeclining(true)
    try {
      const r = await declineInterview(id)
      setDeclineOpen(false)
      setNotice(r.message)
      qc.invalidateQueries({ queryKey: INTERVIEWER_KEY })
      load()
    } catch (e) {
      setDeclineOpen(false)
      setNotice(e instanceof ApiClientError ? e.message : 'Not declined. Try again.')
    } finally {
      setDeclining(false)
    }
  }

  return (
    <InterviewerShell back={() => navigation.goBack()} title={s.name} sub={`${istWeekday(iv.slotStart)} · ${istTime(iv.slotStart)} · ${iv.durationMin} min`}>
      <IvCard>
        <View style={styles.top}>
          <EmBadge label={badge.label} tone={badge.tone} small />
          <Text style={[text.metaXl, styles.fig]}>{formatPaise(iv.feePaise)}</Text>
        </View>
        <Text style={[text.uiSm, styles.muted]}>{[iv.tier, iv.domain, iv.language].filter(Boolean).join(' · ')}</Text>
        {g === 'live' || g === 'upcoming' ? (
          <IvAction
            label={j.kind === 'open' ? (j.rejoin ? 'Rejoin room' : 'Join room') : j.kind === 'closed' ? 'Join window closed' : j.opensInSec != null ? `Join opens in ${clock(j.opensInSec)}` : 'Join opens before the start'}
            tone={j.kind === 'open' && !suspended ? 'accent' : 'off'}
            onPress={j.kind === 'open' && !suspended ? () => navigation.navigate('InterviewerRoom', { id }) : undefined}
          />
        ) : g === 'owed' ? (
          <>
            {(c.status === 'OPEN' || c.status === 'URGENT') && <Text style={[text.metaBase, { color: c.status === 'URGENT' ? color.danger : color.text }]}>{`${hms(c.secondsLeft)} LEFT TO SUBMIT`}</Text>}
            <IvAction label="Write the scorecard" onPress={() => navigation.navigate('ScorecardDraft', { id })} />
          </>
        ) : iv.scorecard?.submittedAt ? (
          <Button variant="outline" size="md" label="View the scorecard" onPress={() => navigation.navigate('ScorecardDraft', { id })} />
        ) : null}
        {iv.payable === false && !!iv.nonPayableReason && g === 'past' && <Text style={[text.uiXs, styles.muted]}>{NON_PAYABLE_TEXT[iv.nonPayableReason]}</Text>}
        {!!iv.threadId && <Button variant="outline" size="md" icon="chat" label="Message" onPress={() => navigation.navigate('InterviewerThread', { id: iv.threadId! })} />}
      </IvCard>

      <IvCard>
        <IvLabel>CANDIDATE</IvLabel>
        <Text style={text.uiLeadSemi}>{s.name}</Text>
        {!!educationLine(s.education) && <Text style={[text.uiSm, styles.secondary]}>{educationLine(s.education)}</Text>}
        {!!s.city && <Text style={[text.uiSm, styles.muted]}>{s.city}</Text>}
        {!!s.languages?.length && <Text style={[text.uiSm, styles.muted]}>{s.languages.join(', ')}</Text>}
        {!!s.skills?.length && <Text style={[text.uiSm, styles.secondary]}>{s.skills.join(' · ')}</Text>}
        {(s.experience ?? []).map((x, k) => (
          <Text key={k} style={[text.uiSm, styles.muted]}>{[x.role ?? x.title, x.company, x.duration].filter(Boolean).join(' · ')}</Text>
        ))}
        {!!s.resumeUrl && <Button variant="outline" size="sm" icon="file" label="Open the resume" onPress={() => Linking.openURL(s.resumeUrl!).catch(() => {})} style={styles.start} />}
      </IvCard>

      {areas.length > 0 && (
        <IvCard>
          <IvLabel>QUESTION SCRIPT</IvLabel>
          {!!script?.intro && <Text style={[text.uiSm, styles.muted]}>{`Opening: ${script.intro}`}</Text>}
          {areas.map((a, k) => (
            <View key={k} style={styles.area}>
              <Text style={text.uiMdSemi}>{a.title}</Text>
              {a.prompts.map((p, pi) => <Text key={pi} style={[text.uiSm, styles.secondary]}>{`— ${p}`}</Text>)}
            </View>
          ))}
          {!!script?.closing && <Text style={[text.uiSm, styles.muted]}>{`Closing: ${script.closing}`}</Text>}
        </IvCard>
      )}

      {notes !== null && (
        <IvCard>
          <IvLabel>PRIVATE NOTES</IvLabel>
          <Input value={draft} onChangeText={setDraft} maxLength={notesMax} multiline textAlignVertical="top" placeholder="Only you see these. They flow into your scorecard." style={styles.notes} />
          <View style={styles.top}>
            <Text style={[text.uiXs, styles.muted]}>{notesMax ? `${draft.length} / ${notesMax}` : ''}</Text>
            <Button variant="secondary" size="sm" label="Save notes" busy={saving} disabled={saving || draft === notes} onPress={() => { saveNotes() }} />
          </View>
        </IvCard>
      )}

      {!!notice && <Text style={[text.uiSm, styles.secondary]}>{notice}</Text>}

      {iv.status === 'BOOKED' && g !== 'past' && (
        <Button variant="dangerText" size="md" label="Decline this interview" onPress={() => setDeclineOpen(true)} style={styles.start} />
      )}

      <EmDialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline this interview?"
        body={`${s.name.split(' ')[0]}’s interview is offered to another interviewer where one is free. Close to the start the server may not allow it.`}
        actions={
          <>
            <Button variant="ghost" size="md" label="Keep it" disabled={declining} onPress={() => setDeclineOpen(false)} />
            <Button variant="dangerFill" size="md" label="Decline" busy={declining} disabled={declining} onPress={() => { decline() }} />
          </>
        }
      />
      {!!iv.scorecard?.submittedAt && (
        <IvCard>
          <IvLabel>SCORECARD SUBMITTED</IvLabel>
          <Text style={[text.uiSm, styles.muted]}>{Object.entries(iv.scorecard.scores).map(([k, v]) => `${label(k)} ${v}`).join(' · ')}</Text>
        </IvCard>
      )}
    </InterviewerShell>
  )
}

const styles = StyleSheet.create({
  muted: { color: color.textMuted },
  secondary: { color: color.textSecondary },
  fig: { letterSpacing: trackingNative.meta },
  loading: { paddingVertical: space['3xl'] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  start: { alignSelf: 'flex-start', paddingHorizontal: space.md },
  area: { gap: space.xs, paddingTop: spaceHalf['1.5'] },
  notes: { height: height['note-field'] + space['2xl'], paddingTop: space.md },
})
