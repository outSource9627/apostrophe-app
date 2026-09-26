import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Linking, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { RtcSurfaceView, RenderModeType } from 'react-native-agora'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { initialsOf } from '../../components/employer/em'
import { getPrivateNotes, getQuestionScript, savePrivateNotes, type QuestionScriptDto } from '../../lib/api/interviewer'
import { useInterviewerRoom } from '../../lib/interviewer/useInterviewerRoom'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
import { educationLine } from '../../lib/interviewer/state'
import type { RootStackParamList } from '../../../App'

type Tab = 'script' | 'notes' | 'resume'
const pad = (n: number) => String(n).padStart(2, '0')
const ms = (sec: number) => `${pad(Math.floor(Math.abs(sec) / 60))}:${pad(Math.abs(sec) % 60)}`
const NOTES_SAVE_MS = 1200

/**
 * M3 · the live interview cockpit (Interviewer App Android).
 *
 * The candidate fills the screen (the video is a placeholder until the SDK
 * lands — see useInterviewerRoom), REC and the timer ride the top, the self
 * tile sits top-right, and the three round controls run down the left: mic,
 * camera, END. The sheet at the foot holds the Script (the assigned script's
 * areas; "Ask next" is the first prompt not marked asked), Notes (the private
 * notes, saved as they are typed; "+ mm:ss" stamps the session time and flags
 * the moment) and Resume (what the candidate's profile carries). Tapping the
 * handle or a tab raises it.
 *
 * The timer counts the booked length down from the SERVER's start and runs on
 * as +mm:ss. END asks first; the sheet says whether ending now clears the
 * server's completion mark (an estimate — the server measures again). No script
 * difficulty chips and no quick-note phrases are drawn: the API has neither.
 */
export function InterviewerRoomScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewerRoom'>>()
  const { id } = route.params
  const insets = useSafeAreaInsets()
  const room = useInterviewerRoom(id)
  const config = useAppConfig()

  const mic = !room.muted
  const cam = !room.cameraOff
  const [tab, setTab] = useState<Tab>('script')
  const [open, setOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [script, setScript] = useState<QuestionScriptDto | null>(null)
  const [asked, setAsked] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const notesLoaded = useRef(false)

  useEffect(() => {
    getQuestionScript(id).then((r) => setScript(r.script)).catch(() => {})
    getPrivateNotes(id)
      .then((r) => setNotes(r.notes ?? ''))
      .catch(() => {})
      .finally(() => { notesLoaded.current = true })
  }, [id])

  // Private notes save as they are typed, debounced.
  useEffect(() => {
    if (!notesLoaded.current) return
    setNotesState('saving')
    const t = setTimeout(() => {
      savePrivateNotes(id, notes).then(() => setNotesState('saved')).catch(() => setNotesState('failed'))
    }, NOTES_SAVE_MS)
    return () => clearTimeout(t)
  }, [notes, id])

  // The hardware back leaves the room only through the END sheet once live.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (room.state === 'live') {
        setEndOpen(true)
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [room.state])

  const ivAreas = room.interview?.script?.areas
  const prompts = useMemo(() => {
    const areas = script?.areas ?? ivAreas ?? []
    return areas.flatMap((a, ai) => a.prompts.map((p, pi) => ({ key: `${ai}-${pi}`, text: p, area: a.title })))
  }, [script, ivAreas])
  const nextQ = prompts.find((p) => !asked[p.key]) ?? null
  const askedCount = prompts.filter((p) => asked[p.key]).length
  const toggle = (key: string) => setAsked((a) => ({ ...a, [key]: !a[key] }))

  const stamp = async () => {
    const at = await room.markMoment()
    setNotes((n) => `${n}${n && !n.endsWith('\n') ? '\n' : ''}[${ms(at)}] `)
  }

  const iv = room.interview
  const student = iv?.student
  const live = room.state === 'live'
  const over = room.remainingSec < 0
  const timer = live ? (over ? `+${ms(room.remainingSec)}` : ms(room.remainingSec)) : ms(room.durationMin * 60)
  // The server's own warning list (room DTO `warnings`, minutes) — the largest is when the band first shows.
  const warnSec = Math.max(...room.warnings) * 60
  const warn = live && room.remainingSec <= warnSec
  const warnText = over ? 'Over time · wrap up' : room.remainingSec <= 60 ? '1 min left' : `${Math.ceil(room.remainingSec / 60)} min left`
  const notesMax = config?.interviewer?.notesMaxChars

  async function endAndScore() {
    const r = await room.end()
    if (r) {
      setEndOpen(false)
      navigation.replace('ScorecardDraft', { id })
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    ...(prompts.length ? [{ key: 'script' as Tab, label: `Script ${askedCount}/${prompts.length}` }] : []),
    { key: 'notes', label: 'Notes' },
    { key: 'resume', label: 'Resume' },
  ]
  const activeTab = prompts.length || tab !== 'script' ? tab : 'notes'

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="roomFootage" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.inkHover} />
            <Stop offset="1" stopColor={color.inkDeeper} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#roomFootage)" />
      </Svg>

      {room.localReady && room.remoteUid != null && room.remoteVideoOn && (
        <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: room.remoteUid, renderMode: RenderModeType.RenderModeHidden }} />
      )}
      <View style={[styles.stageNote, { top: insets.top + height.fab * 3 }]} pointerEvents="none">
        <View style={[styles.face, room.remoteVideoOn && styles.hidden]}><Text style={[text.displaySm, styles.onInk]}>{initialsOf(student?.name)}</Text></View>
        <Text style={[text.metaSm, styles.onInkSubtle, styles.mono]}>{`${(student?.name ?? 'CANDIDATE').toUpperCase()} · FULL-SCREEN 9:16`}</Text>
        {room.state === 'lobby' && <Text style={[text.uiSm, styles.onInkMuted, styles.center]}>{`Waiting for ${student?.name?.split(' ')[0] ?? 'the candidate'}. The session and recording start when you are both in.`}</Text>}
        {room.state === 'loading' && <Text style={[text.uiSm, styles.onInkMuted]}>Opening the room…</Text>}
        {!!room.videoNote && <Text style={[text.uiXs, styles.onInkSubtle, styles.center]}>{room.videoNote}</Text>}
      </View>

      {/* Top: REC and the timer */}
      <View style={[styles.top, { top: insets.top + space.sm }]}>
        {live ? (
          <View style={styles.glass}><View style={styles.recDot} /><Text style={[text.metaSm, styles.rec, styles.mono]}>REC</Text></View>
        ) : <View />}
        <View style={[styles.glass, warn && styles.timerWarn]}>
          <Text style={[text.metaXl, { color: warn ? color.warningOnInk : color.textOnInk }]}>{timer}</Text>
        </View>
      </View>
      {warn && (
        <View style={[styles.warnBand, { top: insets.top + space.sm + height.control }]}>
          <Text style={[text.uiXsSemi, { color: over ? color.danger : color.warning }]}>{warnText}</Text>
        </View>
      )}

      {/* Self tile — the real local track, 16:9 as published */}
      <View style={[styles.self, { top: insets.top + height.fab + space['2xl'] }]}>
        {room.localReady && cam && (
          <RtcSurfaceView style={StyleSheet.absoluteFill} zOrderMediaOverlay canvas={{ uid: 0, renderMode: RenderModeType.RenderModeHidden }} />
        )}
        <View style={styles.selfLabel}><Text style={[text.uiXsSemi, styles.onInk]}>{cam ? 'You' : 'Camera off'}{mic ? '' : ' · muted'}</Text></View>
      </View>

      {/* Link state — quality bars and the 90 s reconnect window */}
      <View style={[styles.netBadge, { top: insets.top + space.sm + height.control + space.xs }]} accessibilityLabel={`Network ${room.quality}`}>
        {[1, 2, 3].map((n) => {
          const on = room.quality === 'good' ? 3 : room.quality === 'fair' ? 2 : 1
          const c = room.quality === 'good' ? color.success : room.quality === 'fair' ? color.warning : color.danger
          return <View key={n} style={{ width: space.xs, height: space.xs + n * space.xs, borderRadius: radius.sm, backgroundColor: c, opacity: n <= on ? 1 : 0.25 }} />
        })}
      </View>
      {(room.link === 'reconnecting' || room.link === 'failed') && (
        <View style={[styles.reconnect, { top: insets.top + space.sm + height.control * 2 + space.md }]}>
          <Text style={[text.uiXsSemi, { color: room.link === 'failed' ? color.danger : color.warning }]}>
            {room.link === 'failed' ? 'Connection lost · rejoin from the interview screen' : `Reconnecting · nothing is lost · ${room.reconnectSecLeft ?? 90}s`}
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { top: insets.top + height.fab + space['2xl'] }]}>
        <RoundControl label={mic ? 'MIC' : 'OFF'} a11y={mic ? 'Mute microphone' : 'Unmute microphone'} off={!mic} onPress={room.toggleMic} />
        <RoundControl label={cam ? 'CAM' : 'OFF'} a11y={cam ? 'Turn camera off' : 'Turn camera on'} off={!cam} onPress={room.toggleCamera} />
        {live ? (
          <RoundControl label="END" a11y="End the session" danger onPress={() => setEndOpen(true)} />
        ) : (
          <RoundControl label="EXIT" a11y="Leave the room" onPress={() => navigation.goBack()} />
        )}
      </View>

      {/* The sheet */}
      <View style={[styles.sheet, open ? styles.sheetOpen : styles.sheetShut, { paddingBottom: insets.bottom }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Lower the panel' : 'Raise the panel'} onPress={() => setOpen((o) => !o)} style={styles.handleArea}>
          <View style={styles.handle} />
        </Pressable>
        <View style={styles.tabs}>
          {tabs.map((t) => {
            const on = activeTab === t.key
            return (
              <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setTab(t.key); setOpen(true) }} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[text.uiSmSemi, { color: on ? color.text : color.textMuted }]}>{t.label}</Text>
              </Pressable>
            )
          })}
        </View>
        <ScrollView style={styles.grow} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {activeTab === 'script' && (
            <>
              {nextQ ? (
                <View style={styles.ask}>
                  <Text style={[text.metaSm, styles.accentText, styles.mono]} numberOfLines={1}>{`ASK NEXT · ${nextQ.area.toUpperCase()}`}</Text>
                  <Text style={text.uiBase}>{nextQ.text}</Text>
                  <Pressable accessibilityRole="button" onPress={() => toggle(nextQ.key)} style={({ pressed }) => [styles.markAsked, pressed && styles.pressed]}>
                    <Text style={[text.uiXsSemi, styles.onInk]}>Mark asked</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[text.uiSm, styles.muted]}>Every prompt is marked asked.</Text>
              )}
              {!!script?.intro && <Text style={[text.uiSm, styles.muted]}>{`Opening: ${script.intro}`}</Text>}
              {prompts.filter((p) => p !== nextQ).map((p) => (
                <Pressable key={p.key} accessibilityRole="checkbox" accessibilityState={{ checked: !!asked[p.key] }} onPress={() => toggle(p.key)} style={styles.q}>
                  <View style={[styles.box, asked[p.key] && styles.boxOn]}>{asked[p.key] && <Text style={[text.metaXs, styles.onInk]}>✓</Text>}</View>
                  <Text style={[text.uiSm, styles.grow, { color: asked[p.key] ? color.textSubtle : color.text }]}>{p.text}</Text>
                </Pressable>
              ))}
              {!!script?.closing && <Text style={[text.uiSm, styles.muted]}>{`Closing: ${script.closing}`}</Text>}
            </>
          )}
          {activeTab === 'notes' && (
            <>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                maxLength={notesMax}
                multiline
                textAlignVertical="top"
                placeholder="Private notes. They flow into your scorecard."
                placeholderTextColor={color.textSubtle}
                style={[text.uiMd, styles.notes]}
              />
              <View style={styles.notesFoot}>
                {live && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Stamp the time" onPress={() => { stamp() }} style={({ pressed }) => [styles.stamp, pressed && styles.pressed]}>
                    <Text style={[text.uiXs, styles.text]}>{`+ ${ms(room.elapsedSec)}`}</Text>
                  </Pressable>
                )}
                <Text style={[text.metaSm, styles.subtle, styles.mono]}>
                  {notesState === 'saving' ? 'SAVING…' : notesState === 'saved' ? 'SAVED · PRIVATE' : notesState === 'failed' ? 'NOT SAVED · CHECK CONNECTION' : 'PRIVATE'}
                </Text>
              </View>
            </>
          )}
          {activeTab === 'resume' && (
            <>
              {!!educationLine(student?.education) && <ResumeBlock head="EDUCATION" lines={[educationLine(student?.education)!]} />}
              {!!student?.experience?.length && (
                <ResumeBlock head="EXPERIENCE" lines={student.experience.map((x) => [x.role ?? x.title, x.company, x.duration].filter(Boolean).join(' · '))} />
              )}
              {!!student?.skills?.length && <ResumeBlock head="SKILLS" lines={[student.skills.join(', ')]} />}
              {!!student?.languages?.length && <ResumeBlock head="LANGUAGES" lines={[student.languages.join(', ')]} />}
              {!!student?.resumeUrl && <Button variant="outline" size="sm" icon="file" label="Open the resume" onPress={() => Linking.openURL(student.resumeUrl!).catch(() => {})} style={styles.start} />}
              {!student?.education && !student?.experience?.length && !student?.skills?.length && <Text style={[text.uiSm, styles.muted]}>The candidate’s profile has nothing more to show.</Text>}
            </>
          )}
        </ScrollView>
      </View>

      {room.state === 'refused' && (
        <View style={styles.refused}>
          <Text style={[text.displaySm, styles.onInk, styles.center]}>The room isn’t open.</Text>
          <Text style={[text.uiMd, styles.onInkMuted, styles.center]}>{room.refusal}</Text>
          <Button variant="outline" size="md" label="Back" onPress={() => navigation.goBack()} />
        </View>
      )}
      {room.state === 'ended' && (
        <View style={styles.refused}>
          <Text style={[text.displaySm, styles.onInk, styles.center]}>The session has ended.</Text>
          <Button variant="primary" size="lg" label="Open the scorecard" onPress={() => navigation.replace('ScorecardDraft', { id })} />
        </View>
      )}

      <Modal visible={endOpen} transparent animationType="slide" onRequestClose={() => setEndOpen(false)} statusBarTranslucent>
        <View style={styles.endWrap}>
          <Pressable accessibilityLabel="Keep going" style={StyleSheet.absoluteFill} onPress={() => setEndOpen(false)} />
          <View style={[styles.endSheet, { paddingBottom: space['2xl'] + insets.bottom }]}>
            <Text style={text.displayCard}>End the session?</Text>
            <Text style={[text.uiMd, styles.muted]}>
              {room.meetsMark == null
                ? 'The scorecard opens next.'
                : room.meetsMark
                  ? `The scorecard opens next. At ${Math.round((room.elapsedSec / Math.max(1, room.durationMin * 60)) * 100)}% of the booked time, this should count as complete.`
                  : `The scorecard opens next. This is below the ${room.thresholdPct}% mark, so it would be marked incomplete and not paid. ${ms(Math.max(0, (room.markAtSec ?? 0) - room.elapsedSec))} to go.`}
            </Text>
            {!!room.endError && <Text style={[text.uiSm, styles.danger]}>{room.endError}</Text>}
            <Button variant="dangerFill" size="lg" full label="End & score" busy={room.ending} disabled={room.ending} onPress={() => { endAndScore() }} />
            <Button variant="ghost" size="block" full label="Keep going" disabled={room.ending} onPress={() => setEndOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

function RoundControl({ label, a11y, off, danger, onPress }: { label: string; a11y: string; off?: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={({ pressed }) => [styles.round, (off || danger) && styles.roundDanger, pressed && styles.pressed]}>
      <Text style={[text.uiXsSemi, styles.onInk]}>{label}</Text>
    </Pressable>
  )
}

function ResumeBlock({ head, lines }: { head: string; lines: string[] }) {
  return (
    <View style={styles.block}>
      <Text style={[text.metaSm, styles.muted, styles.mono]}>{head}</Text>
      {lines.map((l, i) => <Text key={i} style={text.uiSm}>{l}</Text>)}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.inkDeep },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: opacity.pressed },
  center: { textAlign: 'center' },
  mono: { letterSpacing: trackingNative.eyebrow },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
  onInkSubtle: { color: color.textOnInkSubtle },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  text: { color: color.text },
  accentText: { color: color.accentText },
  start: { alignSelf: 'flex-start', paddingHorizontal: space.md },

  stageNote: { position: 'absolute', left: space['2xl'], right: space['2xl'], alignItems: 'center', gap: space.sm },
  face: { width: height.fab + space.lg, height: height.fab + space.lg, borderRadius: radius.pill, backgroundColor: color.onInkGround, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: spaceHalf['3.5'], right: spaceHalf['3.5'], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glass: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: spaceHalf['1.5'], paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.onInkGlass },
  timerWarn: { backgroundColor: color.onInkBar },
  recDot: { width: space.sm - 1, height: space.sm - 1, borderRadius: radius.pill, backgroundColor: color.dangerFill },
  rec: { color: color.dangerOnInk },
  warnBand: { position: 'absolute', alignSelf: 'center', paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.warningSoft },
  hidden: { opacity: 0 },
  netBadge: { position: 'absolute', left: spaceHalf['3.5'], flexDirection: 'row', alignItems: 'flex-end', gap: space['2xs'] },
  reconnect: { position: 'absolute', alignSelf: 'center', paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.onInkGlass },
  self: { position: 'absolute', right: spaceHalf['3.5'], width: height['profile-thumb-w'] * 1.4, aspectRatio: 16 / 9, borderRadius: radius.tile, overflow: 'hidden', borderWidth: borderWidth.thin, borderColor: color.onInkEdge, justifyContent: 'flex-end', padding: spaceHalf['1.5'] },
  selfLabel: { alignSelf: 'flex-start', paddingHorizontal: spaceHalf['1.5'], paddingVertical: space['2xs'], borderRadius: radius.sm, backgroundColor: color.onInkGlass },
  controls: { position: 'absolute', left: spaceHalf['3.5'], gap: space.sm },
  round: { width: height.control, height: height.control, borderRadius: radius.pill, backgroundColor: color.onInkPlay, alignItems: 'center', justifyContent: 'center' },
  roundDanger: { backgroundColor: color.dangerFill },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color.surface, borderTopLeftRadius: radius.frame, borderTopRightRadius: radius.frame, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  sheetOpen: { height: '64%' },
  sheetShut: { height: '29%' },
  handleArea: { height: space['2xl'] + space.xs, alignItems: 'center', justifyContent: 'center' },
  handle: { width: height.avatar, height: space.xs, borderRadius: radius.bar, backgroundColor: color.borderStrong },
  tabs: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.md, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  tab: { flex: 1, height: height.avatar, alignItems: 'center', justifyContent: 'center', borderBottomWidth: borderWidth.accent, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: color.accent },
  sheetBody: { paddingHorizontal: spaceHalf['3.5'], paddingVertical: space.md, gap: space.sm },
  ask: { borderRadius: radius.tile, backgroundColor: color.accentWash, borderWidth: borderWidth.thin, borderColor: color.accentMuted, padding: space.md, gap: spaceHalf['1.5'] },
  markAsked: { alignSelf: 'flex-start', height: height.chip, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.accent, justifyContent: 'center', marginTop: space.xs },
  q: { flexDirection: 'row', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.xs, borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  box: { width: space.lg, height: space.lg, borderRadius: radius.ctl - 3, borderWidth: borderWidth.medium, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: space['2xs'] },
  boxOn: { backgroundColor: color.accent, borderColor: color.accent },
  notes: { minHeight: height['chat-pane'] / 3, borderRadius: radius.tile, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.md, color: color.text },
  notesFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  stamp: { height: height.chip, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, justifyContent: 'center' },
  block: { gap: space.xs, paddingBottom: space.sm },

  refused: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrimModal, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space['2xl'] },
  endWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.scrimModal },
  endSheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.frame, borderTopRightRadius: radius.frame, paddingTop: space['2xl'], paddingHorizontal: space.xl, gap: space.md },
})
