import { useCallback, useEffect, useRef, useState } from 'react'
import { getInterview, type StudentInterview } from '../api/interviews'

/**
 * ST-30 — the live room session (app), the twin of apostrophe-user's
 * lib/room/useRoom.ts.
 *
 * ═══ THE AGORA SWAP POINT ═══
 * The video transport is Agora RTC, integrated behind this hook as a STUB. To go
 * live: install `react-native-agora`, add AGORA_APP_ID to src/config/env.ts, and
 * in connect() create the engine, join(appId, channel, token, uid) from
 * getRoomCredentials(interviewId), enable the local camera track and render the
 * remote (interviewer) track — mapping the SDK's connection-state / network
 * events onto the RoomState union. Everything the screen reads (state machine,
 * reveal, controls, recording flag, timers) stays identical; only this file
 * changes. Unlike the web, there is no getUserMedia, so the self-preview is an
 * ink placeholder until the native camera module lands.
 *
 * The stub drives the real half from the server: it polls the interview to move
 * waiting → live and to reveal the interviewer the instant the session starts
 * (SC-16), and runs the elapsed clock. Recording is derived, never a control.
 */
export type RoomState = 'connecting' | 'waiting' | 'live' | 'reconnecting' | 'audio-only' | 'dropped' | 'ended'
export type NetworkQuality = 'good' | 'fair' | 'poor'

export interface RoomSession {
  state: RoomState
  elapsedSec: number
  reconnectSecLeft: number | null
  quality: NetworkQuality
  muted: boolean
  cameraOff: boolean
  recording: boolean
  interviewer: { name: string; photoUrl?: string | null } | null
  interview: StudentInterview | null
  minutesLeft: number | null
  toggleMic: () => void
  toggleCamera: () => void
  leave: () => void
}

const RECONNECT_WINDOW = 90

export function useRoom(interviewId: string, onLeft?: () => void): RoomSession {
  const [state, setState] = useState<RoomState>('connecting')
  const [interview, setInterview] = useState<StudentInterview | null>(null)
  const [elapsedSec, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const liveAt = useRef<number | null>(null)
  const left = useRef(false)

  useEffect(() => {
    let active = true
    const poll = () => getInterview(interviewId)
      .then((iv) => {
        if (!active || left.current) return
        setInterview(iv)
        const started = Boolean(iv.interviewer?.name) || iv.status === 'IN_PROGRESS'
        if (iv.status === 'COMPLETED' || iv.status === 'INCOMPLETE') { setState('ended'); return }
        if (started) { if (liveAt.current == null) liveAt.current = Date.now(); setState('live') }
        else setState('waiting')
      })
      .catch(() => {})
    void poll()
    const id = setInterval(poll, 5000)
    return () => { active = false; clearInterval(id) }
  }, [interviewId])

  useEffect(() => {
    if (state !== 'live') return
    const id = setInterval(() => { if (liveAt.current != null) setElapsed(Math.floor((Date.now() - liveAt.current) / 1000)) }, 1000)
    return () => clearInterval(id)
  }, [state])

  const toggleMic = useCallback(() => setMuted((m) => !m), [])
  const toggleCamera = useCallback(() => setCameraOff((c) => !c), [])
  const leave = useCallback(() => { left.current = true; setState('ended'); onLeft?.() }, [onLeft])

  const interviewer = interview?.interviewer?.name ? { name: interview.interviewer.name } : null
  const durationMin = interview?.durationMin ?? 20
  const minutesLeft = state === 'live' ? Math.max(0, durationMin - Math.floor(elapsedSec / 60)) : null

  return {
    state,
    elapsedSec,
    reconnectSecLeft: state === 'reconnecting' ? RECONNECT_WINDOW : null,
    quality: 'good',
    muted,
    cameraOff,
    recording: state === 'live' || state === 'reconnecting' || state === 'audio-only',
    interviewer,
    interview,
    minutesLeft,
    toggleMic,
    toggleCamera,
    leave,
  }
}
