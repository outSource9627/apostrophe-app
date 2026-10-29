import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated, BackHandler, Easing, Keyboard, Linking, Modal, PanResponder, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { RtcSurfaceView, RenderModeType } from 'react-native-agora'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, shadow, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { initialsOf } from '../../components/employer/em'
import { getPrivateNotes, getQuestionScript, savePrivateNotes, type QuestionScriptDto } from '../../lib/api/interviewer'
import { useInterviewerRoom } from '../../lib/interviewer/useInterviewerRoom'
import { useAppConfig } from '../../lib/interviewer/useInterviewer'
import { educationLine, istTime } from '../../lib/interviewer/state'
import { interviewerLateInput, lateJoin, lateRulesOf } from '../../lib/interviews/late'
import { OtherBand } from '../../lib/interviews/LateJoin'
import type { RootStackParamList } from '../../../App'

type Tab = 'script' | 'notes' | 'profile'
/** Where the sheet rests: half the screen, or pulled up to just under REC and the clock. */
type Snap = 'half' | 'full'
const pad = (n: number) => String(n).padStart(2, '0')
const ms = (sec: number) => `${pad(Math.floor(Math.abs(sec) / 60))}:${pad(Math.abs(sec) % 60)}`
const NOTES_SAVE_MS = 1200
/** The half sheet's top as a share of the screen (docs/feed-room-mockups.html, room A: 328 of 780). */
const SHEET_TOP = 0.42
/** With the keyboard up the candidate keeps the top quarter (the mockup's "Typing notes": 196 of 780). */
const SHEET_TOP_TYPING = 0.25
/** The least the sheet keeps on a short screen with the keyboard up: its head and a few lines of notes. */
const SHEET_FLOOR = height['chat-pane'] / 3 + height.control
/** Open, close and snap. A drag of a finger's width (or a flick) moves to the next stop. */
const SHEET_MS = 220
const SNAP_DY = height.tap
const SNAP_VY = 0.5

/**
 * M3 · the live interview room — full screen with a half sheet
 * (docs/feed-room-mockups.html §3, "Room sheet A · Half sheet" with Script as its
 * own button, 2026-10-15). It replaces the three stacked bands of direction A
 * (docs/interviewer-room-mockups.html); the web room is unchanged.
 *
 * The candidate (the student's 9:16 stream) fills the screen. Over it: REC (or
 * "Not recording yet") and the clock at the top, your own 16:9 tile under the
 * clock, the transient bands, and a soft shade at the foot so the controls read
 * on any picture. The bottom column, floating over the video:
 *   1. the candidate's name (live) — in the lobby, the waiting card and the setup
 *      check (camera, mic, network) instead;
 *   2. the dock — round icon controls with a caption under each: Mute, Camera,
 *      Flag (Sound before the session starts) and a red End (Leave in the lobby);
 *   3. three buttons — Script n/m (only when the interview has prompts), Notes
 *      (a dot: green once saved, red when a save failed) and Profile.
 *
 * A button opens a white half sheet on its tab. There is no scrim: the candidate
 * stays clear and live above it. The sheet's head is a Script · Notes · Profile
 * switch and ✕, and switching tabs keeps it open. Its body is the old panel:
 * Script (Ask next on top, then what is left and what is asked), Notes (private,
 * saved as they are typed, + mm:ss stamps) and Profile (what the candidate's
 * profile carries). Drag the handle up to stretch it to just under the clock,
 * down to shrink or close it. With the keyboard up it sits on the keyboard and
 * the candidate keeps a band at the top. Hardware back closes the sheet first;
 * live, it then asks to end.
 *
 * Before the session your own camera fills the screen in the candidate's place.
 * The clock counts the booked length down from the SERVER's start and runs on as
 * +mm:ss. End asks first and says whether ending now clears the completion mark
 * (an estimate — the server measures again). Asked prompts survive a reload on
 * this phone; nothing about them is sent. No script difficulty and no quick-note
 * phrases: the API has neither.
 *
 * In the lobby you are in the room, so only the student's side is shown: in, not in
 * yet, or how late (lib/interviews/late.ts) — and, once they are late, when Join
 * closes and that it is then settled as a student no-show.
 */
export function InterviewerRoomScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewerRoom'>>()
  const { id } = route.params
  const insets = useSafeAreaInsets()
  const win = useWindowDimensions()
  const room = useInterviewerRoom(id)
  const config = useAppConfig()

  const mic = !room.muted
  const cam = !room.cameraOff
  const [tab, setTab] = useState<Tab>('script')
  const [endOpen, setEndOpen] = useState(false)
  const [script, setScript] = useState<QuestionScriptDto | null>(null)
  const [asked, setAsked] = useState<Record<string, boolean>>({})
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [notesFocused, setNotesFocused] = useState(false)
  const [flaggedAt, setFlaggedAt] = useState<number | null>(null)
  const notesLoaded = useRef(false)
  const askedKey = `room:${id}:asked`

  // ── the sheet: open or not, where it rests, and where the keyboard is ──
  const [sheetOpen, setSheetOpen] = useState(false)
  const [snap, setSnap] = useState<Snap>('half')
  /** The keyboard's top edge in window coordinates while it is up. */
  const [kbY, setKbY] = useState<number | null>(null)
  /** This screen's frame in the window — it shrinks if the window is resized for the keyboard. */
  const [frame, setFrame] = useState<{ y: number; h: number } | null>(null)
  const [sheetTop] = useState(() => new Animated.Value(win.height))
  const pageRef = useRef<React.ComponentRef<typeof View>>(null)
  const dragging = useRef(false)
  const closing = useRef(false)
  const dragFrom = useRef(0)

  useEffect(() => {
    getQuestionScript(id).then((r) => setScript(r.script)).catch(() => {})
    getPrivateNotes(id)
      .then((r) => setNotes(r.notes ?? ''))
      .catch(() => {})
      .finally(() => { notesLoaded.current = true })
    // Where the interviewer had got to, kept on this phone only (the web keeps it per tab).
    AsyncStorage.getItem(askedKey).then((v) => { if (v) setAsked(JSON.parse(v)) }).catch(() => {})
  }, [id, askedKey])

  // Private notes save as they are typed, debounced.
  useEffect(() => {
    if (!notesLoaded.current) return
    setNotesState('saving')
    const t = setTimeout(() => {
      savePrivateNotes(id, notes).then(() => setNotesState('saved')).catch(() => setNotesState('failed'))
    }, NOTES_SAVE_MS)
    return () => clearTimeout(t)
  }, [notes, id])

  const measure = useCallback(() => {
    pageRef.current?.measureInWindow((_x, y, _w, h) => {
      if (h > 0) setFrame((f) => (f && f.y === y && f.h === h ? f : { y, h }))
    })
  }, [])

  // The manifest says adjustResize, but with edge-to-edge the window may not shrink:
  // the sheet works out the overlap itself, as KeyboardAvoidingView does.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => { setKbY(e.endCoordinates.screenY); measure() })
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbY(null))
    return () => { show.remove(); hide.remove() }
  }, [measure])

  const pageH = frame?.h ?? win.height
  const kbOpen = kbY != null
  const kbLift = kbY == null ? 0 : Math.max(0, Math.round((frame?.y ?? 0) + pageH - kbY))
  // Pulled up, the sheet stops under REC and the clock so both stay in view.
  const topFull = insets.top + space.sm + height['feed-glass'] + space.sm
  const halfTop = Math.max(topFull, Math.min(Math.round(win.height * (kbOpen ? SHEET_TOP_TYPING : SHEET_TOP)), pageH - kbLift - SHEET_FLOOR))
  const sheetTarget = snap === 'full' ? topFull : halfTop
  // The drag handlers are made once; they read the live geometry from here.
  const geo = useRef({ snap, pageH, half: halfTop, full: topFull })
  useEffect(() => { geo.current = { snap, pageH, half: halfTop, full: topFull } })

  const animateTo = useCallback((to: number, done?: () => void) => {
    Animated.timing(sheetTop, { toValue: to, duration: SHEET_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false })
      .start(({ finished }) => { if (finished) done?.() })
  }, [sheetTop])

  const closeSheet = useCallback(() => {
    Keyboard.dismiss()
    closing.current = true
    animateTo(geo.current.pageH, () => {
      closing.current = false
      setSheetOpen(false)
      setSnap('half')
    })
  }, [animateTo])

  function openSheet(k: Tab) {
    setTab(k)
    setSnap('half')
    closing.current = false
    if (sheetOpen) {
      animateTo(halfTop)
    } else {
      sheetTop.setValue(pageH)
      setSheetOpen(true)
    }
  }

  function pickTab(k: Tab) {
    if (k !== 'notes') Keyboard.dismiss()
    setTab(k)
  }

  // Follow the resting place as it moves: opening, snapping, the keyboard coming and going.
  useEffect(() => {
    if (!sheetOpen || dragging.current || closing.current) return
    animateTo(sheetTarget)
  }, [sheetOpen, sheetTarget, animateTo])

  const settle = useCallback((dy: number, vy: number) => {
    dragging.current = false
    const g = geo.current
    if (dy < -SNAP_DY || vy < -SNAP_VY) {
      setSnap('full')
      animateTo(g.full)
    } else if (dy > SNAP_DY || vy > SNAP_VY) {
      // Down from the top stops at half, unless it was pulled past half already.
      if (g.snap === 'full' && dragFrom.current + dy < g.half + SNAP_DY) {
        setSnap('half')
        animateTo(g.half)
      } else {
        closeSheet()
      }
    } else {
      animateTo(g.snap === 'full' ? g.full : g.half)
    }
  }, [animateTo, closeSheet])

  // The handle and the head drag the sheet; a plain tap still reaches the switch and ✕.
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > space.sm && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => {
      dragging.current = true
      closing.current = false
      sheetTop.stopAnimation((v) => { dragFrom.current = v })
    },
    onPanResponderMove: (_e, g) => {
      const { full, pageH: h } = geo.current
      sheetTop.setValue(Math.min(h, Math.max(full, dragFrom.current + g.dy)))
    },
    onPanResponderRelease: (_e, g) => settle(g.dy, g.vy),
    onPanResponderTerminate: (_e, g) => settle(g.dy, g.vy),
    onPanResponderTerminationRequest: () => false,
  }), [sheetTop, settle])

  // The hardware back closes the sheet first, then leaves the room only through the End sheet once live.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetOpen) {
        closeSheet()
        return true
      }
      if (room.state === 'live') {
        setEndOpen(true)
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [room.state, sheetOpen, closeSheet])

  const ivAreas = room.interview?.script?.areas
  const prompts = useMemo(() => {
    const areas = script?.areas ?? ivAreas ?? []
    return areas.flatMap((a, ai) => a.prompts.map((p, pi) => ({ key: `${ai}-${pi}`, text: p, area: a.title })))
  }, [script, ivAreas])
  // A skipped prompt waits until every other unasked one has been asked.
  const nextQ = prompts.find((p) => !asked[p.key] && !skipped[p.key]) ?? prompts.find((p) => !asked[p.key]) ?? null
  const askedCount = prompts.filter((p) => asked[p.key]).length
  const toggle = (key: string) => {
    setSkipped((s) => ({ ...s, [key]: false }))
    setAsked((a) => {
      const next = { ...a, [key]: !a[key] }
      AsyncStorage.setItem(askedKey, JSON.stringify(next)).catch(() => {})
      return next
    })
  }

  const flag = async () => {
    const at = await room.markMoment()
    setNotes((n) => `${n}${n && !n.endsWith('\n') ? '\n' : ''}[${ms(at)}] `)
    setFlaggedAt(at)
    setTimeout(() => setFlaggedAt(null), 2500)
  }

  const iv = room.interview
  const student = iv?.student
  const firstName = student?.name?.split(' ')[0]
  const live = room.state === 'live'
  const lobby = room.state === 'lobby' || room.state === 'loading'
  const over = room.remainingSec < 0
  const timer = live ? (over ? `+${ms(room.remainingSec)}` : ms(room.remainingSec)) : ms(room.durationMin * 60)
  // The server's own warning list (room DTO `warnings`, minutes) — the largest is when the clock first turns.
  const warnSec = Math.max(...room.warnings) * 60
  const warn = live && room.remainingSec <= warnSec
  const notesMax = config?.interviewer?.notesMaxChars
  const remoteIn = room.remoteUid != null
  const left = live && !!room.studentLeftAt
  const rejoinLeft = room.studentLeftAt && room.rejoinWindowMinutes != null
    ? Math.max(0, Math.floor((Date.parse(room.studentLeftAt) + room.rejoinWindowMinutes * 60_000 - room.now) / 1000))
    : null
  const late = iv && room.state === 'lobby'
    ? lateJoin({ ...interviewerLateInput(iv), selfInRoom: true }, lateRulesOf(config), room.now)
    : null
  const other = late && late.phase !== 'off' ? late.other : null
  const who = firstName ?? 'The candidate'
  const pct = Math.round((room.elapsedSec / Math.max(1, room.durationMin * 60)) * 100)

  async function endAndScore() {
    const r = await room.end()
    if (r) {
      setEndOpen(false)
      navigation.replace('ScorecardDraft', { id })
    }
  }

  const scriptCount = `${askedCount}/${prompts.length}`
  const tabs: { key: Tab; label: string; count?: string }[] = [
    ...(prompts.length ? [{ key: 'script' as Tab, label: 'Script', count: scriptCount }] : []),
    { key: 'notes', label: 'Notes' },
    { key: 'profile', label: 'Profile' },
  ]
  const activeTab = prompts.length || tab !== 'script' ? tab : 'notes'
  const upNext = prompts.filter((p) => !asked[p.key] && p !== nextQ)
  const done = prompts.filter((p) => asked[p.key])
  const notesDot = notesState === 'saved' ? color.successOnInk : notesState === 'failed' ? color.dangerOnInk : undefined
  const bodyPad = kbOpen ? space.lg : insets.bottom + space.lg

  const bands: { key: string; tone: 'warning' | 'danger'; title: string; sub?: string }[] = []
  if (room.link === 'reconnecting') bands.push({ key: 'net', tone: 'warning', title: 'Reconnecting · nothing is lost', sub: `${room.reconnectSecLeft ?? 90}s` })
  if (room.link === 'failed') bands.push({ key: 'net', tone: 'danger', title: 'Connection lost', sub: 'rejoin from the interview screen' })
  if (left) {
    bands.push(rejoinLeft == null
      ? { key: 'left', tone: 'warning', title: 'Student left', sub: 'they can rejoin until the window closes' }
      : rejoinLeft > 0
        ? { key: 'left', tone: 'warning', title: 'Student left', sub: `they can rejoin for ${ms(rejoinLeft)}` }
        : { key: 'left', tone: 'warning', title: 'Student did not rejoin', sub: 'the session will end on its own' })
  }
  if (warn) bands.push({ key: 'time', tone: over ? 'danger' : 'warning', title: over ? 'Over time' : `${Math.ceil(room.remainingSec / 60)} min left`, sub: 'time to wrap up' })

  return (
    <View ref={pageRef} style={styles.page} onLayout={measure}>
      <StatusBar barStyle="light-content" />

      {/* ── the candidate, the whole screen ──────────────────────────── */}
      <View style={styles.video}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="roomFootage" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.inkHover} />
              <Stop offset="1" stopColor={color.inkDeeper} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#roomFootage)" />
        </Svg>

        {live && room.localReady && remoteIn && room.remoteVideoOn && (
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: room.remoteUid!, renderMode: RenderModeType.RenderModeHidden }} />
        )}
        {/* Before the session your own camera stands in the candidate's place. */}
        {lobby && room.localReady && cam && (
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0, renderMode: RenderModeType.RenderModeHidden }} />
        )}
        {live && (!remoteIn || !room.remoteVideoOn) && !left && (
          <View style={styles.faceWrap} pointerEvents="none">
            <View style={styles.face}><Text style={[text.displaySm, styles.onInk]}>{initialsOf(student?.name)}</Text></View>
          </View>
        )}
      </View>

      {/* A soft shade at the top and the foot, so REC, the clock and the controls read on any picture. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="roomShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.inkDeep} stopOpacity={0.45} />
            <Stop offset="0.14" stopColor={color.inkDeep} stopOpacity={0} />
            <Stop offset="0.58" stopColor={color.inkDeep} stopOpacity={0} />
            <Stop offset="0.78" stopColor={color.inkDeep} stopOpacity={0.72} />
            <Stop offset="1" stopColor={color.inkDeep} stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#roomShade)" />
      </Svg>

      <View style={[styles.topRow, { top: insets.top + space.sm }]}>
        {live ? (
          <View style={styles.rec}><View style={styles.recDot} /><Text style={[text.metaSm, styles.recText, styles.mono]}>Rec</Text></View>
        ) : (
          <View style={styles.rec}><View style={[styles.recDot, styles.recIdle]} /><Text style={[text.metaSm, styles.onInkMuted, styles.mono]}>Not recording yet</Text></View>
        )}
        <View style={[styles.timer, warn && styles.timerWarn]} accessibilityLabel={live ? (over ? 'Over the booked length by' : 'Time left') : 'Booked length'}>
          <Text style={[text.metaXl, styles.tabular, { color: warn ? color.warningOnInk : color.textOnInk }]}>{timer}</Text>
        </View>
      </View>

      {/* Off while the sheet is pulled up over it: the self view's surface is a media overlay and would draw through the sheet. */}
      {live && !(sheetOpen && snap === 'full') && (
        <View style={[styles.self, { top: insets.top + space.sm + height['feed-glass'] + space.md }]}>
          {room.localReady && cam && (
            <RtcSurfaceView style={StyleSheet.absoluteFill} zOrderMediaOverlay canvas={{ uid: 0, renderMode: RenderModeType.RenderModeHidden }} />
          )}
          {!cam && <View style={styles.selfOff}><Text style={[text.metaXs, styles.onInkSubtle, styles.mono]}>Camera off</Text></View>}
          <View style={styles.selfLabel}><Text style={[text.uiXsSemi, styles.onInk]}>{mic ? 'You' : 'You · muted'}</Text></View>
        </View>
      )}

      {bands.length > 0 && (
        <View style={[styles.bands, { top: insets.top + space.sm + height['feed-glass'] + space.md, right: live ? spaceHalf['3.5'] * 2 + height['room-tile-w'] : spaceHalf['3.5'] }]}>
          {bands.map((b) => (
            <View key={b.key} accessibilityRole="alert" style={[styles.band, b.tone === 'danger' && styles.bandDanger]}>
              <Icon name="clock" size={space.lg} tint={b.tone === 'danger' ? color.dangerOnInk : color.warningOnInk} weight={2} />
              <Text style={[text.uiXsSemi, styles.grow, { color: b.tone === 'danger' ? color.dangerOnInk : color.warningOnInk }]}>
                {b.title}{b.sub ? <Text style={text.uiXs}>{` · ${b.sub}`}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      )}

      {left && (
        <View style={styles.scrim} pointerEvents="none">
          <Text style={[text.displaySm, styles.onInk, styles.center]}>{`${firstName ?? 'The candidate'} has left the room`}</Text>
          <Text style={[text.uiSm, styles.onInkMuted, styles.center]}>
            {rejoinLeft != null && rejoinLeft > 0 ? `They can rejoin for ${ms(rejoinLeft)} · after that the session ends on its own` : 'They can rejoin until you end the session'}
          </Text>
        </View>
      )}

      {lobby && (
        <View style={[styles.previewTag, { top: insets.top + space.sm + height['feed-glass'] + space.md }]}>
          <Text style={[text.uiXsSemi, styles.onInk]}>Your camera · preview</Text>
        </View>
      )}

      {/* ── the bottom column: name (or the lobby card), the dock, the three buttons ── */}
      <View
        style={[styles.foot, { paddingBottom: insets.bottom + space.xl }]}
        pointerEvents="box-none"
        importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}
      >
        {live && (
          <View style={styles.nameTag}>
            <Text style={[text.uiSmSemi, styles.onInk]} numberOfLines={1}>{student?.name ?? 'Candidate'}</Text>
            {!remoteIn && !left && <Text style={[text.metaXs, styles.onInkMuted, styles.mono]}>Not in the room</Text>}
            {left && <Text style={[text.metaXs, styles.onInkMuted, styles.mono]}>Not in the room</Text>}
            {remoteIn && !room.remoteVideoOn && <Text style={[text.metaXs, styles.onInkMuted, styles.mono]}>Camera off</Text>}
          </View>
        )}

        {lobby && (
          <View style={styles.wait}>
            {other === 'in' ? (
              <>
                <Text style={[text.uiBaseSemi, styles.onInk, styles.center]}>Starting…</Text>
                <Text style={[text.uiSm, styles.onInkMuted, styles.center]}>{`${who} is here — the session starts in a moment.`}</Text>
              </>
            ) : (
              <>
                <Text style={[text.uiBaseSemi, styles.onInk, styles.center]}>{room.state === 'loading' ? 'Opening the room…' : `Waiting for ${firstName ?? 'the candidate'} to join`}</Text>
                {!!late && <OtherBand j={late} who={who} />}
                <Text style={[text.uiSm, styles.onInkMuted, styles.center]}>
                  {late && (other === 'late' || other === 'red') && late.closesAt != null
                    ? `Join closes at ${istTime(late.closesAt)}. If ${who} hasn't joined by then, it's settled as a student no-show.`
                    : 'The clock and the recording start when you are both in.'}
                </Text>
              </>
            )}
            {!!room.videoNote && <Text style={[text.uiXs, styles.onInkSubtle, styles.center]}>{room.videoNote}</Text>}
            <View style={styles.checks}>
              <Check ok={cam} label={cam ? 'Camera on' : 'Camera off'} />
              <Check ok={mic} label={mic ? 'Mic on' : 'Mic muted'} />
              <Check ok={room.quality !== 'poor'} label={`Network ${room.quality}`} />
            </View>
          </View>
        )}

        <View style={styles.dock}>
          <Ctl icon={mic ? 'mic' : 'micOff'} caption={mic ? 'Mute' : 'Unmute'} a11y={mic ? 'Mute microphone' : 'Unmute microphone'} off={!mic} onPress={room.toggleMic} />
          <Ctl icon={cam ? 'video' : 'videoOff'} caption={cam ? 'Camera' : 'Camera off'} a11y={cam ? 'Turn camera off' : 'Turn camera on'} off={!cam} onPress={room.toggleCamera} />
          {live ? (
            <Ctl icon="flag" caption={flaggedAt != null ? `Marked ${ms(flaggedAt)}` : 'Flag'} a11y="Flag this moment for the scorecard" onPress={() => { flag() }} />
          ) : (
            <Ctl icon={room.soundOff ? 'mute' : 'sound'} caption={room.soundOff ? 'Sound off' : 'Sound'} a11y={room.soundOff ? 'Hear the candidate again' : 'Silence the candidate'} off={room.soundOff} onPress={room.toggleSound} />
          )}
          {live ? (
            <Ctl icon="hangUp" caption="End" a11y="End the session" danger onPress={() => setEndOpen(true)} />
          ) : (
            <Ctl icon="hangUp" caption="Leave" a11y="Leave the room" danger onPress={() => navigation.goBack()} />
          )}
        </View>

        <View style={styles.rbtns}>
          {prompts.length > 0 && (
            <SheetButton icon="list" label="Script" count={scriptCount} a11y={`Script, ${askedCount} of ${prompts.length} asked`} onPress={() => openSheet('script')} />
          )}
          <SheetButton
            icon="note"
            label="Notes"
            dot={notesDot}
            a11y={notesState === 'saved' ? 'Notes, saved' : notesState === 'failed' ? 'Notes, not saved' : 'Notes'}
            onPress={() => openSheet('notes')}
          />
          <SheetButton icon="user" label="Profile" a11y="Candidate profile" onPress={() => openSheet('profile')} />
        </View>
      </View>

      {/* ── the half sheet: no scrim, the candidate stays live above it ── */}
      {sheetOpen && (
        <Animated.View style={[styles.sheet, { top: sheetTop, bottom: kbLift }]}>
          <View {...pan.panHandlers}>
            <View style={styles.sheetGrabZone}><View style={styles.sheetGrab} /></View>
            <View style={styles.shead}>
              <View style={styles.segc} accessibilityRole="tablist">
                {tabs.map((t) => {
                  const on = activeTab === t.key
                  return (
                    <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => pickTab(t.key)} style={[styles.seg, on && styles.segOn]}>
                      <Text style={[text.uiSmSemi, { color: on ? color.text : color.textMuted }]} numberOfLines={1}>{t.label}</Text>
                      {!!t.count && <Text style={[text.metaXs, styles.subtle]} numberOfLines={1}>{t.count}</Text>}
                    </Pressable>
                  )
                })}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeSheet} hitSlop={space.xs + 1} style={({ pressed }) => [styles.x, pressed && styles.pressed]}>
                <Icon name="x" size={space.lg} tint={color.text} weight={2.2} />
              </Pressable>
            </View>
          </View>

          {activeTab === 'notes' ? (
            <View style={[styles.grow, styles.sbody, { paddingBottom: bodyPad }]}>
              <View style={styles.notesHead}>
                <Text style={[text.metaSm, styles.mono, styles.shrink, { color: notesState === 'failed' ? color.danger : notesState === 'saved' ? color.success : color.textSubtle }]}>
                  {notesState === 'saving' ? 'Saving…' : notesState === 'saved' ? '● Saved · private · flows into the scorecard' : notesState === 'failed' ? 'Not saved · check connection' : 'Private · flows into the scorecard'}
                </Text>
                {live && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Add the session time to your notes" onPress={() => setNotes((n) => `${n}${n && !n.endsWith('\n') ? '\n' : ''}[${ms(room.elapsedSec)}] `)} style={({ pressed }) => [styles.stamp, pressed && styles.pressed]}>
                    <Text style={[text.metaSm, styles.text, styles.tabular]}>{`+ ${ms(room.elapsedSec)}`}</Text>
                  </Pressable>
                )}
              </View>
              {/* The field takes the rest of the sheet and scrolls inside itself, so the caret stays above the keyboard. */}
              <View style={[styles.notesBox, notesFocused && styles.notesBoxOn]}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => setNotesFocused(true)}
                  onBlur={() => setNotesFocused(false)}
                  maxLength={notesMax}
                  multiline
                  textAlignVertical="top"
                  placeholder="Observations, strengths, answers…"
                  placeholderTextColor={color.textSubtle}
                  style={[text.uiMd, styles.notes]}
                />
              </View>
              {live && !kbOpen && <Text style={[text.uiXs, styles.subtle]}>Flag in the dock drops a [mm:ss] stamp here too.</Text>}
            </View>
          ) : (
            <ScrollView style={styles.grow} contentContainerStyle={[styles.sbody, { paddingBottom: bodyPad }]} keyboardShouldPersistTaps="handled">
              {activeTab === 'script' && (
                <>
                  {nextQ ? (
                    <View style={styles.ask}>
                      <Text style={[text.metaSm, styles.accentText, styles.mono]} numberOfLines={1}>{`Ask next · ${nextQ.area}`}</Text>
                      <Text style={[text.uiBaseMedium, styles.text]}>{nextQ.text}</Text>
                      <View style={styles.row}>
                        <Pressable accessibilityRole="button" onPress={() => toggle(nextQ.key)} style={({ pressed }) => [styles.markAsked, pressed && styles.pressed]}>
                          <Icon name="check" size={space.lg} tint={color.textInverse} weight={2.4} />
                          <Text style={[text.uiSmSemi, styles.onInk]}>Mark asked</Text>
                        </Pressable>
                        {upNext.length > 0 && (
                          <Pressable accessibilityRole="button" onPress={() => setSkipped((s) => ({ ...s, [nextQ.key]: true }))} hitSlop={space.sm} style={styles.skip}>
                            <Text style={[text.uiSmSemi, styles.muted]}>Skip for now</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.lineCard}><Text style={[text.uiSm, styles.secondary]}>Every prompt is marked asked.</Text></View>
                  )}
                  {!!script?.intro && <LineCard head="Opening" body={script.intro} />}
                  {upNext.length > 0 && (
                    <>
                      <View style={styles.groupHead}>
                        <Text style={[text.metaSm, styles.subtle, styles.mono]}>Up next</Text>
                        <Text style={[text.metaSm, styles.subtle, styles.mono]}>{`${askedCount}/${prompts.length} asked`}</Text>
                      </View>
                      {upNext.map((p) => <PromptRow key={p.key} text={p.text} done={false} onPress={() => toggle(p.key)} />)}
                    </>
                  )}
                  {done.length > 0 && (
                    <>
                      <View style={styles.groupHead}><Text style={[text.metaSm, styles.subtle, styles.mono]}>{`Asked · ${done.length}`}</Text></View>
                      {done.map((p) => <PromptRow key={p.key} text={p.text} done onPress={() => toggle(p.key)} />)}
                    </>
                  )}
                  {!!script?.closing && <LineCard head="Closing" body={script.closing} />}
                </>
              )}
              {activeTab === 'profile' && (
                <>
                  <View style={styles.person}>
                    <View style={styles.avatar}><Text style={[text.uiBaseSemi, styles.onInk]}>{initialsOf(student?.name)}</Text></View>
                    <View style={styles.grow}>
                      <Text style={[text.uiLgSemi, styles.text]} numberOfLines={1}>{student?.name ?? 'Candidate'}</Text>
                      {!!(student?.city || student?.languages?.length) && (
                        <Text style={[text.uiSm, styles.muted]}>{[student?.city, student?.languages?.join(', ')].filter(Boolean).join(' · ')}</Text>
                      )}
                    </View>
                  </View>
                  {!!iv && <Fact head="Interview" lines={[[iv.tier, iv.domain, `${iv.durationMin} min`].filter(Boolean).join(' · ')]} />}
                  {!!educationLine(student?.education) && <Fact head="Education" lines={[educationLine(student?.education)!]} />}
                  {!!student?.experience?.length && (
                    <Fact head="Experience" lines={student.experience.map((x) => [x.role ?? x.title, x.company, x.duration].filter(Boolean).join(' · '))} />
                  )}
                  {!!student?.skills?.length && (
                    <View style={styles.fact}>
                      <Text style={[text.metaSm, styles.subtle, styles.mono]}>Skills</Text>
                      <View style={styles.skills}>{student.skills.map((k) => <View key={k} style={styles.skill}><Text style={[text.uiXsSemi, styles.text]}>{k}</Text></View>)}</View>
                    </View>
                  )}
                  {!!student?.resumeUrl && <Button variant="outline" size="sm" icon="file" label="Open their résumé" onPress={() => Linking.openURL(student.resumeUrl!).catch(() => {})} style={styles.start} />}
                  {!student?.education && !student?.experience?.length && !student?.skills?.length && <Text style={[text.uiSm, styles.muted]}>The candidate’s profile has nothing more to show.</Text>}
                </>
              )}
            </ScrollView>
          )}
        </Animated.View>
      )}

      {room.state === 'refused' && (
        <View style={styles.overlay}>
          <Text style={[text.displaySm, styles.onInk, styles.center]}>The room isn’t open.</Text>
          <Text style={[text.uiMd, styles.onInkMuted, styles.center]}>{room.refusal}</Text>
          <Button variant="outline" size="md" label="Back" onPress={() => navigation.goBack()} />
        </View>
      )}
      {room.state === 'ended' && (
        <View style={styles.overlay}>
          <Text style={[text.displaySm, styles.onInk, styles.center]}>The session has ended.</Text>
          <Button variant="primary" size="lg" label="Open the scorecard" onPress={() => navigation.replace('ScorecardDraft', { id })} />
        </View>
      )}

      <Modal visible={endOpen} transparent animationType="slide" onRequestClose={() => setEndOpen(false)} statusBarTranslucent>
        <View style={styles.endWrap}>
          <Pressable accessibilityLabel="Keep going" style={StyleSheet.absoluteFill} onPress={() => { if (!room.ending) setEndOpen(false) }} />
          <View style={[styles.endSheet, { paddingBottom: space['2xl'] + insets.bottom }]}>
            <View style={styles.grab} />
            <Text style={[text.displayCard, styles.text]}>End the session?</Text>
            <Text style={[text.uiMd, styles.muted]}>The recording stops and the scorecard opens. The room can’t be reopened.</Text>
            <View style={styles.len}>
              <Text style={[text.uiSm, styles.muted]}>Session length</Text>
              <Text style={[text.metaMd, styles.text]}>{`${ms(room.elapsedSec)} of ${room.durationMin}:00 · ${pct}%`}</Text>
            </View>
            {room.meetsMark != null && room.thresholdPct != null && (
              room.meetsMark ? (
                <View style={[styles.mark, styles.markOk]}>
                  <Text style={[text.uiSmSemi, styles.successText]}>This will count as a complete interview</Text>
                  <Text style={[text.uiSm, styles.successText]}>Once you submit the scorecard in time, the fee is payable.</Text>
                </View>
              ) : (
                <View style={[styles.mark, styles.markWarn]}>
                  <Text style={[text.uiSmSemi, styles.warningText]}>{`Below the ${room.thresholdPct}% completion mark`}</Text>
                  <Text style={[text.uiSm, styles.warningText]}>{`Sessions under ${room.thresholdPct}% go to review before they can be paid. ${ms(Math.max(0, (room.markAtSec ?? 0) - room.elapsedSec))} more reaches the mark.`}</Text>
                </View>
              )
            )}
            {!!room.endError && <Text style={[text.uiSm, styles.danger]}>{room.endError}</Text>}
            <Button variant="dangerFill" size="lg" full label="End & score" busy={room.ending} disabled={room.ending} onPress={() => { endAndScore() }} />
            <Button variant="ghost" size="block" full label="Keep going" disabled={room.ending} onPress={() => setEndOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

/** A round dock control with its caption under it. Muted/off reads inverted (white disc, ink glyph); End is red and wider. */
function Ctl({ icon, caption, a11y, off, danger, onPress }: { icon: IconName; caption: string; a11y: string; off?: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: !!off }} onPress={onPress} style={({ pressed }) => [styles.ctl, pressed && styles.pressed]}>
      <View style={[styles.disc, off && styles.discOff, danger && styles.discEnd]}>
        <Icon name={icon} size={space.xl} tint={off ? color.ink : color.textOnInk} weight={1.9} />
      </View>
      <Text style={[text.uiXsSemi, styles.caption]} numberOfLines={1}>{caption}</Text>
    </Pressable>
  )
}

/** One of the glass buttons under the dock; it opens the sheet on its tab. `dot` is the Notes save state. */
function SheetButton({ icon, label, count, dot, a11y, onPress }: { icon: IconName; label: string; count?: string; dot?: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={({ pressed }) => [styles.rbtn, pressed && styles.pressed]}>
      <Icon name={icon} size={spaceHalf['4.5']} tint={color.textOnInk} weight={2} />
      <Text style={[text.uiMdSemi, styles.onInk, styles.shrink]} numberOfLines={1}>{label}</Text>
      {!!count && <Text style={[text.uiXsMedium, styles.onInkSubtle, styles.tabular]} numberOfLines={1}>{count}</Text>}
      {!!dot && <View style={[styles.rdot, { backgroundColor: dot }]} />}
    </Pressable>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.check, !ok && styles.checkOff]}>
      <Icon name={ok ? 'check' : 'x'} size={space.md + 1} tint={ok ? color.successOnInk : color.dangerOnInk} weight={2.6} />
      <Text style={[text.uiXsSemi, { color: ok ? color.successOnInk : color.dangerOnInk }]}>{label}</Text>
    </View>
  )
}

function PromptRow({ text: body, done, onPress }: { text: string; done: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={onPress} style={styles.q}>
      <View style={[styles.box, done && styles.boxOn]}>{done && <Icon name="check" size={space.md} tint={color.textInverse} weight={3} />}</View>
      <Text style={[text.uiSm, styles.grow, { color: done ? color.textSubtle : color.text }]}>{body}</Text>
    </Pressable>
  )
}

function LineCard({ head, body }: { head: string; body: string }) {
  return (
    <View style={styles.lineCard}>
      <Text style={[text.metaXs, styles.subtle, styles.mono]}>{head}</Text>
      <Text style={[text.uiSm, styles.secondary]}>{body}</Text>
    </View>
  )
}

function Fact({ head, lines }: { head: string; lines: string[] }) {
  return (
    <View style={styles.fact}>
      <Text style={[text.metaSm, styles.subtle, styles.mono]}>{head}</Text>
      {lines.map((l, i) => <Text key={i} style={[text.uiSm, styles.text]}>{l}</Text>)}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.ink },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pressed: { opacity: opacity.pressed },
  center: { textAlign: 'center' },
  mono: { letterSpacing: trackingNative.eyebrow },
  tabular: { fontVariant: ['tabular-nums'] },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
  onInkSubtle: { color: color.textOnInkSubtle },
  text: { color: color.text },
  secondary: { color: color.textSecondary },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  accentText: { color: color.accentText },
  successText: { color: color.success },
  warningText: { color: color.warning },
  start: { alignSelf: 'flex-start', paddingHorizontal: space.md },

  // the candidate, and what floats over the top of it
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: color.inkDeep },
  faceWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  face: { width: height.fab + space.lg, height: height.fab + space.lg, borderRadius: radius.pill, backgroundColor: color.onInkGround, alignItems: 'center', justifyContent: 'center' },
  topRow: { position: 'absolute', left: spaceHalf['3.5'], right: spaceHalf['3.5'], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rec: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: height['feed-glass'] - space.xs, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill, backgroundColor: color.onInkGlass, borderWidth: borderWidth.thin, borderColor: color.onInkHairline },
  recDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.dangerFill },
  recIdle: { backgroundColor: color.textOnInkSubtle },
  recText: { color: color.dangerOnInk },
  timer: { height: height['feed-glass'], paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: color.onInkGlass, borderWidth: borderWidth.thin, borderColor: color.onInkHairline },
  timerWarn: { borderColor: color.warningOnInk },
  self: { position: 'absolute', right: spaceHalf['3.5'], width: height['room-tile-w'], aspectRatio: 16 / 9, borderRadius: radius.tile, overflow: 'hidden', borderWidth: borderWidth.thin, borderColor: color.onInkEdge, backgroundColor: color.inkRaised, justifyContent: 'flex-end', padding: spaceHalf['1.5'] },
  selfOff: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  selfLabel: { alignSelf: 'flex-start', paddingHorizontal: spaceHalf['1.5'], paddingVertical: space['2xs'], borderRadius: radius.sm, backgroundColor: color.onInkGlass },
  bands: { position: 'absolute', left: spaceHalf['3.5'], gap: space.sm },
  band: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.tile, backgroundColor: color.onInkGlass, borderWidth: borderWidth.thin, borderColor: color.warningOnInk },
  bandDanger: { borderColor: color.dangerOnInk },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrimStrong, alignItems: 'center', justifyContent: 'center', gap: spaceHalf['1.5'], padding: space['2xl'] },
  previewTag: { position: 'absolute', left: spaceHalf['3.5'], paddingHorizontal: spaceHalf['2.5'], paddingVertical: space.xs, borderRadius: radius.ctl, backgroundColor: color.onInkGlass },

  // the bottom column (docs/feed-room-mockups.html: .ntag, .dock.float, .rbtns)
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  nameTag: { alignSelf: 'flex-start', marginLeft: space.lg, marginBottom: space['2xl'], maxWidth: '70%', flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], height: height['feed-glass'] - space.xs, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.ctl, backgroundColor: color.onInkGlass },
  wait: { marginHorizontal: space.lg, marginBottom: space.lg, gap: space.xs, paddingVertical: spaceHalf['3.5'], paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: color.scrimStrong, borderWidth: borderWidth.thin, borderColor: color.onInkHairline },
  checks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spaceHalf['1.5'], marginTop: spaceHalf['1.5'] },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs, paddingHorizontal: space.sm + 1, borderRadius: radius.pill, backgroundColor: color.successOnInkSoft },
  checkOff: { backgroundColor: color.dangerOnInkSoft },
  dock: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingHorizontal: spaceHalf['2.5'], marginBottom: spaceHalf['2.5'] },
  ctl: { alignItems: 'center', gap: spaceHalf['1.5'], minWidth: height.fab },
  disc: { width: height.control, height: height.control, borderRadius: radius.pill, backgroundColor: color.onInkPlay, alignItems: 'center', justifyContent: 'center' },
  discOff: { backgroundColor: color.textOnInk },
  discEnd: { width: height['room-end-w'], backgroundColor: color.dangerFill },
  caption: { color: color.textOnInkBody },
  rbtns: { flexDirection: 'row', gap: spaceHalf['2.5'], paddingHorizontal: space.lg },
  rbtn: { flex: 1, minWidth: 0, height: height.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderRadius: radius.pill, backgroundColor: color.onInkGround, borderWidth: borderWidth.thin, borderColor: color.onInkEdge },
  rdot: { width: space.sm - 1, height: space.sm - 1, borderRadius: radius.pill },

  // the half sheet (docs/feed-room-mockups.html: .sheet, .grab, .shead, .segc, .x, .sbody)
  sheet: { position: 'absolute', left: 0, right: 0, overflow: 'hidden', backgroundColor: color.surface, borderTopLeftRadius: radius.frame, borderTopRightRadius: radius.frame, boxShadow: shadow.modal },
  sheetGrabZone: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.xs },
  sheetGrab: { width: space['3xl'], height: space.xs + 1, borderRadius: radius.bar, backgroundColor: color.borderStrong },
  shead: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingTop: spaceHalf['1.5'], paddingBottom: space.md, paddingHorizontal: space.lg, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  segc: { flex: 1, minWidth: 0, flexDirection: 'row', gap: space['2xs'], padding: space['2xs'] + 1, borderRadius: radius.pill, backgroundColor: color.surfaceMuted },
  seg: { flex: 1, minWidth: 0, height: height.chip, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs + 1, paddingHorizontal: space.xs, borderRadius: radius.pill },
  segOn: { backgroundColor: color.surface, boxShadow: shadow.raised },
  x: { width: height['feed-glass'], height: height['feed-glass'], borderRadius: radius.pill, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  sbody: { paddingTop: space.md, paddingHorizontal: space.lg, gap: spaceHalf['2.5'] },
  ask: { borderRadius: radius.lg, backgroundColor: color.accentWash, borderWidth: borderWidth.thin, borderColor: color.accentMuted, paddingVertical: spaceHalf['3.5'], paddingHorizontal: space.lg, gap: space.sm },
  markAsked: { flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], height: height['chip-lg'] - space['2xs'], paddingHorizontal: spaceHalf['3.5'], borderRadius: radius.pill, backgroundColor: color.accent },
  skip: { minHeight: height['chip-lg'], justifyContent: 'center' },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.xs },
  q: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.tile, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface },
  box: { width: spaceHalf['4.5'], height: spaceHalf['4.5'], borderRadius: radius.sm, borderWidth: borderWidth.medium, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: space['2xs'] },
  boxOn: { backgroundColor: color.accent, borderColor: color.accent },
  lineCard: { borderRadius: radius.tile, backgroundColor: color.surfaceMuted, paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, gap: space['2xs'] },
  notesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  stamp: { height: height.chip - space.xs, paddingHorizontal: spaceHalf['2.5'], borderRadius: radius.pill, borderWidth: borderWidth.thin, borderColor: color.borderStrong, justifyContent: 'center' },
  notesBox: { flex: 1, minHeight: height.control, borderRadius: radius.panel, borderWidth: borderWidth.thin, borderColor: color.border },
  notesBoxOn: { borderColor: color.accent, boxShadow: shadow.focus },
  notes: { flex: 1, padding: space.md, color: color.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: height.tap, height: height.tap, borderRadius: radius.pill, backgroundColor: color.accentBright, alignItems: 'center', justifyContent: 'center' },
  fact: { gap: space.xs },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  skill: { paddingHorizontal: spaceHalf['2.5'], paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.surfaceMuted },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrimModal, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space['2xl'] },
  endWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.scrimModal },
  endSheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.frame, borderTopRightRadius: radius.frame, paddingTop: space.md, paddingHorizontal: space.xl, gap: space.md },
  grab: { alignSelf: 'center', width: height.avatar + space.md, height: space.xs + 1, borderRadius: radius.bar, backgroundColor: color.borderStrong, marginBottom: space.xs },
  len: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radius.tile, backgroundColor: color.surfaceMuted, paddingVertical: spaceHalf['2.5'], paddingHorizontal: spaceHalf['3.5'] },
  mark: { borderRadius: radius.panel, paddingVertical: space.md, paddingHorizontal: spaceHalf['3.5'], gap: space['2xs'] },
  markOk: { backgroundColor: color.successSoft },
  markWarn: { backgroundColor: color.warningSoft, borderWidth: borderWidth.thin, borderColor: color.warningEdge },
})
