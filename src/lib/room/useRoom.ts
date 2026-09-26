import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError } from '../api'
import {
  getInterview, getRoomCredentials, leaveRoom, postRoomEvent,
  type RoomCredentials, type StudentEventKind, type StudentInterview,
} from '../api/interviews'
import { RoomEngine, requestMediaPermissions, type LinkState } from './agoraEngine'

/**
 * ST-30 — the live room session (app), the twin of apostrophe-user's
 * lib/room/useRoom.ts, now on the real Agora engine (src/lib/room/agoraEngine.ts).
 *
 * Entry order matters: GET …/room is what STAMPS THE STUDENT PRESENT on the
 * server, and the session (and its recording) only starts once both parties
 * have been stamped — so it is called first, before any video work. Its refusals
 * are surfaced, not swallowed:
 *   503 Agora not configured · 400 join window closed · 409 already ended ·
 *   412/409 READINESS_REQUIRED → the caller sends the student to the device check.
 *
 * Then: engine init + join, link/quality events -> the RoomState union, a 90 s
 * reconnect countdown, an audio-only fallback when the uplink is poor, and every
 * notable moment logged to POST …/events. The interview is polled for the reveal
 * (SC-16) and the end of the session.
 */
export type RoomState = 'connecting' | 'waiting' | 'live' | 'reconnecting' | 'audio-only' | 'dropped' | 'ended'
export type NetworkQuality = 'good' | 'fair' | 'poor'
export type RoomErrorKind = 'unconfigured' | 'not-open' | 'ended' | 'permissions' | 'readiness' | 'other'
export interface RoomError { kind: RoomErrorKind; message: string }

export const RECONNECT_WINDOW = 90
const POOR_TICKS_FOR_FALLBACK = 3
const GOOD_TICKS_FOR_RECOVERY = 6
const DEFAULT_WARNINGS = [5, 1]

export interface RoomSession {
  state: RoomState
  error: RoomError | null
  elapsedSec: number
  remainingSec: number | null
  /** The smallest configured warning threshold (minutes) the session is now inside, or null. */
  warning: number | null
  reconnectSecLeft: number | null
  quality: NetworkQuality
  muted: boolean
  cameraOff: boolean
  speakerOn: boolean
  recording: boolean
  /** True once the engine is up and the local preview can render (uid 0). */
  localReady: boolean
  remoteUid: number | null
  remoteVideoOn: boolean
  interviewer: { name: string; photoUrl?: string | null } | null
  interview: StudentInterview | null
  minutesLeft: number | null
  toggleMic: () => void
  toggleCamera: () => void
  toggleSpeaker: () => void
  retry: () => void
  leave: () => void
}

function classify(e: unknown): RoomError {
  if (e instanceof ApiClientError) {
    const code = String(e.code)
    if (code === 'READINESS_REQUIRED' || e.status === 412) return { kind: 'readiness', message: e.message }
    if (e.status === 503) return { kind: 'unconfigured', message: 'Video is not set up on the server yet. Your presence is recorded; try again shortly.' }
    if (e.status === 409) return { kind: 'ended', message: e.message }
    if (e.status === 400) return { kind: 'not-open', message: e.message }
    return { kind: 'other', message: e.message }
  }
  return { kind: 'other', message: e instanceof Error ? e.message : 'The room could not be opened.' }
}

export function useRoom(
  interviewId: string,
  opts: { onLeft?: () => void; onEnded?: () => void; onReadinessRequired?: () => void } = {},
): RoomSession {
  const [state, setState] = useState<RoomState>('connecting')
  const [error, setError] = useState<RoomError | null>(null)
  const [interview, setInterview] = useState<StudentInterview | null>(null)
  const [creds, setCreds] = useState<RoomCredentials | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [quality, setQuality] = useState<NetworkQuality>('good')
  const [localReady, setLocalReady] = useState(false)
  const [remoteUid, setRemoteUid] = useState<number | null>(null)
  const [remoteVideoOn, setRemoteVideoOn] = useState(false)
  const [reconnectSecLeft, setReconnectSecLeft] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  const engine = useRef<RoomEngine | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const left = useRef(false)
  const inRoom = useRef(false)
  const liveAt = useRef<number | null>(null)
  const state_ = useRef<RoomState>('connecting')
  state_.current = state
  const cameraOffRef = useRef(false)
  cameraOffRef.current = cameraOff
  const audioOnly = useRef(false)
  const poorTicks = useRef(0)
  const goodTicks = useRef(0)
  const lastQuality = useRef<NetworkQuality>('good')
  const reconnectStart = useRef<number | null>(null)

  const log = useCallback((kind: StudentEventKind, payload?: Record<string, unknown>) => {
    postRoomEvent(interviewId, kind, payload).catch(() => {})
  }, [interviewId])

  // Connect: credentials first (stamps presence), then the engine.
  useEffect(() => {
    let alive = true
    left.current = false
    setError(null)
    setState('connecting')
    ;(async () => {
      let c: RoomCredentials
      try {
        c = await getRoomCredentials(interviewId)
      } catch (e) {
        if (!alive) return
        const err = classify(e)
        if (err.kind === 'readiness') { optsRef.current.onReadinessRequired?.(); return }
        setError(err)
        setState(err.kind === 'ended' ? 'ended' : 'dropped')
        return
      }
      if (!alive) return
      inRoom.current = true
      setCreds(c)
      setState('waiting')

      const perms = await requestMediaPermissions().catch(() => ({ camera: false, microphone: false }))
      if (!alive) return
      if (!perms.camera || !perms.microphone) {
        setError({ kind: 'permissions', message: 'Camera and microphone access are needed to join. Allow them in Settings, then retry.' })
        setState('dropped')
        return
      }
      if (!c.appId) {
        setError({ kind: 'unconfigured', message: 'Video is not set up on the server yet.' })
        setState('dropped')
        return
      }
      try {
        const eng = new RoomEngine('student', {
          onLink: (s: LinkState) => {
            if (left.current) return
            if (s === 'reconnecting') {
              if (reconnectStart.current == null) { reconnectStart.current = Date.now(); log('RECONNECT', { phase: 'lost' }) }
              setState('reconnecting')
              setReconnectSecLeft(RECONNECT_WINDOW)
            } else if (s === 'connected') {
              if (reconnectStart.current != null) {
                log('RECONNECT', { phase: 'restored', downSec: Math.round((Date.now() - reconnectStart.current) / 1000) })
                reconnectStart.current = null
              }
              setReconnectSecLeft(null)
              setState(liveAt.current != null ? (audioOnly.current ? 'audio-only' : 'live') : 'waiting')
            } else if (s === 'failed' || (s === 'disconnected' && reconnectStart.current != null)) {
              setState('dropped')
              setReconnectSecLeft(null)
            }
          },
          onQuality: (q) => {
            if (left.current) return
            setQuality(q)
            if (q !== lastQuality.current) { lastQuality.current = q; log('NETWORK', { quality: q }) }
            if (q === 'poor') { poorTicks.current += 1; goodTicks.current = 0 } else { goodTicks.current += 1; poorTicks.current = 0 }
            if (!audioOnly.current && poorTicks.current >= POOR_TICKS_FOR_FALLBACK) {
              audioOnly.current = true
              eng.publishVideo(false)
              if (state_.current === 'live') setState('audio-only')
              log('AUDIO_ONLY', { on: true })
            } else if (audioOnly.current && goodTicks.current >= GOOD_TICKS_FOR_RECOVERY) {
              audioOnly.current = false
              if (!cameraOffRef.current) eng.publishVideo(true)
              if (state_.current === 'audio-only') setState('live')
              log('AUDIO_ONLY', { on: false })
            }
          },
          onRemoteJoined: (uid) => setRemoteUid(uid),
          onRemoteLeft: () => { setRemoteUid(null); setRemoteVideoOn(false) },
          onRemoteVideo: (_uid, on) => setRemoteVideoOn(on),
          onTokenExpiring: () => {
            getRoomCredentials(interviewId).then((n) => engine.current?.renewToken(n.token)).catch(() => {})
          },
        })
        engine.current = eng
        eng.init(c.appId)
        eng.join(c)
        setLocalReady(true)
      } catch (e) {
        setError({ kind: 'other', message: e instanceof Error ? e.message : 'Video could not start.' })
        setState('dropped')
      }
    })()
    return () => {
      alive = false
      engine.current?.destroy()
      engine.current = null
      setLocalReady(false)
      setRemoteUid(null)
      setRemoteVideoOn(false)
      if (inRoom.current && !left.current) leaveRoom(interviewId).catch(() => {})
      inRoom.current = false
    }
  }, [interviewId, attempt, log])

  // The 90 s reconnect window is real: the countdown gives up into 'dropped'.
  useEffect(() => {
    if (state !== 'reconnecting') return
    const id = setInterval(() => {
      const start = reconnectStart.current
      if (start == null) return
      const rem = RECONNECT_WINDOW - Math.floor((Date.now() - start) / 1000)
      if (rem <= 0) { setReconnectSecLeft(null); setState('dropped'); engine.current?.leave() }
      else setReconnectSecLeft(rem)
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  // Follow the server: the reveal (SC-16), session start and end.
  useEffect(() => {
    if (!creds) return
    let active = true
    const poll = () => getInterview(interviewId)
      .then((iv) => {
        if (!active || left.current) return
        setInterview(iv)
        if (iv.status === 'COMPLETED' || iv.status === 'INCOMPLETE') { setState('ended'); optsRef.current.onEnded?.(); return }
        const started = Boolean(iv.interviewer?.name) || iv.status === 'IN_PROGRESS'
        if (started && liveAt.current == null) {
          liveAt.current = creds.sessionStartedAt ? Date.parse(creds.sessionStartedAt) : Date.now()
          // Re-read the credentials for the server's own session start (rejoin-safe clock).
          getRoomCredentials(interviewId).then((n) => {
            if (n.sessionStartedAt) { liveAt.current = Date.parse(n.sessionStartedAt); setCreds((p) => (p ? { ...p, sessionStartedAt: n.sessionStartedAt } : p)) }
          }).catch(() => {})
        }
        setState((s) => (s === 'waiting' && started ? (audioOnly.current ? 'audio-only' : 'live') : s))
      })
      .catch(() => {})
    void poll()
    const id = setInterval(poll, 3000)
    return () => { active = false; clearInterval(id) }
  }, [interviewId, creds])

  useEffect(() => {
    if (state !== 'live' && state !== 'audio-only' && state !== 'reconnecting') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [state])

  const toggleMic = useCallback(() => {
    const next = !muted
    setMuted(next)
    engine.current?.muteMic(next)
    log(next ? 'MUTE' : 'UNMUTE')
  }, [muted, log])
  const toggleCamera = useCallback(() => {
    const next = !cameraOff
    setCameraOff(next)
    // While in the audio-only fallback the video stays unpublished regardless.
    if (!audioOnly.current) engine.current?.publishVideo(!next)
    log('CAMERA', { on: !next })
  }, [cameraOff, log])
  const toggleSpeaker = useCallback(() => {
    const next = !speakerOn
    setSpeakerOn(next)
    engine.current?.setSpeaker(next)
  }, [speakerOn])
  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  const leave = useCallback(() => {
    left.current = true
    engine.current?.destroy()
    engine.current = null
    leaveRoom(interviewId).catch(() => {})
    setState('ended')
    optsRef.current.onLeft?.()
  }, [interviewId])

  const durationMin = interview?.durationMin ?? 20
  const elapsedSec = liveAt.current != null && state !== 'connecting' && state !== 'waiting' ? Math.max(0, Math.floor((now - liveAt.current) / 1000)) : 0
  const endMs = creds?.scheduledEndAt ? Date.parse(creds.scheduledEndAt) : null
  const remainingSec = liveAt.current == null ? null
    : endMs != null ? Math.max(0, Math.floor((endMs - now) / 1000))
    : Math.max(0, durationMin * 60 - elapsedSec)
  const thresholds = (creds?.warnings?.length ? creds.warnings : DEFAULT_WARNINGS).slice().sort((a, b) => a - b)
  const warning = remainingSec != null && remainingSec > 0 ? (thresholds.find((w) => remainingSec <= w * 60) ?? null) : null
  const interviewer = interview?.interviewer?.name
    ? { name: interview.interviewer.name, photoUrl: interview.interviewer.photoUrl ?? null }
    : creds?.interviewer?.name ? { name: creds.interviewer.name, photoUrl: creds.interviewer.photoUrl ?? null } : null

  return {
    state, error, elapsedSec, remainingSec, warning,
    reconnectSecLeft: state === 'reconnecting' ? (reconnectSecLeft ?? RECONNECT_WINDOW) : null,
    quality, muted, cameraOff, speakerOn,
    recording: state === 'live' || state === 'reconnecting' || state === 'audio-only',
    localReady, remoteUid, remoteVideoOn,
    interviewer, interview,
    minutesLeft: remainingSec != null ? Math.ceil(remainingSec / 60) : null,
    toggleMic, toggleCamera, toggleSpeaker, retry, leave,
  }
}
