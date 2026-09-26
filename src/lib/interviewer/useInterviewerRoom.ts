import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError } from '../api'
import {
  endSession, getInterviewerInterview, getRoomCredentials, recordRoomEvent,
  type InterviewerInterviewDto, type InterviewerRoomDto,
} from '../api/interviewer'
import { useNow } from '../employer/useNow'
import { RoomEngine, requestMediaPermissions, type LinkState, type Quality } from '../room/agoraEngine'

/**
 * IV-12 — the interviewer's live room on the phone (the web's useInterviewerRoom).
 *   - GET …/room on entry — the server stamps the interviewer present and starts
 *     the session (and its recording) once the student is in too. A 503 there
 *     means video is not configured on the server; presence is still recorded.
 *   - then the real Agora engine (src/lib/room/agoraEngine.ts): the interviewer
 *     publishes 16:9 landscape 1280x720 and receives the student's 9:16 portrait
 *     stream. Mic/camera toggles drive the engine; link state drives the
 *     reconnect UI (90 s window); network quality drives the bars.
 *   - polls the interview every 3 s for the server's `sessionStartedAt` / status;
 *   - runs the session clock from the SERVER's start, and the completion
 *     estimate against the server's `thresholdPct` (the server decides);
 *   - logs JOIN / LEAVE / HIGHLIGHT / MUTE / UNMUTE / CAMERA / NETWORK / RECONNECT,
 *     and ends the session (POST …/session END).
 */
export type RoomState = 'loading' | 'lobby' | 'live' | 'ended' | 'refused'

const RECONNECT_WINDOW = 90
const OVER = new Set(['COMPLETED', 'INCOMPLETE', 'CANCELLED', 'RESCHEDULED', 'STUDENT_NO_SHOW', 'INTERVIEWER_NO_SHOW'])

export interface EndResult { complete: boolean; pct: number }

export function useInterviewerRoom(interviewId: string) {
  const [interview, setInterview] = useState<InterviewerInterviewDto | null>(null)
  const [credentials, setCredentials] = useState<InterviewerRoomDto | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [videoNote, setVideoNote] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const joined = useRef(false)
  const finished = useRef(false)
  const engine = useRef<RoomEngine | null>(null)
  const reconnectStart = useRef<number | null>(null)
  const lastQuality = useRef<Quality>('good')
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [localReady, setLocalReady] = useState(false)
  const [remoteUid, setRemoteUid] = useState<number | null>(null)
  const [remoteVideoOn, setRemoteVideoOn] = useState(false)
  const [quality, setQuality] = useState<Quality>('good')
  const [link, setLink] = useState<LinkState>('connecting')
  const [reconnectSecLeft, setReconnectSecLeft] = useState<number | null>(null)

  const startVideo = useCallback(async (c: InterviewerRoomDto) => {
    const perms = await requestMediaPermissions().catch(() => ({ camera: false, microphone: false }))
    if (!perms.camera || !perms.microphone) { setVideoNote('Camera and microphone access are needed for video. Allow them in Settings.'); return }
    if (!c.appId) { setVideoNote('Video is not configured on the server.'); return }
    try {
      const eng = new RoomEngine('interviewer', {
        onLink: (s) => {
          setLink(s)
          if (s === 'reconnecting') {
            if (reconnectStart.current == null) { reconnectStart.current = Date.now(); recordRoomEvent(interviewId, 'RECONNECT', { phase: 'lost' }).catch(() => {}) }
            setReconnectSecLeft(RECONNECT_WINDOW)
          } else if (s === 'connected') {
            if (reconnectStart.current != null) { recordRoomEvent(interviewId, 'RECONNECT', { phase: 'restored' }).catch(() => {}); reconnectStart.current = null }
            setReconnectSecLeft(null)
          } else if (s === 'failed') setReconnectSecLeft(null)
        },
        onQuality: (q) => {
          setQuality(q)
          if (q !== lastQuality.current) { lastQuality.current = q; recordRoomEvent(interviewId, 'NETWORK', { quality: q }).catch(() => {}) }
        },
        onRemoteJoined: (uid) => setRemoteUid(uid),
        onRemoteLeft: () => { setRemoteUid(null); setRemoteVideoOn(false) },
        onRemoteVideo: (_u, on) => setRemoteVideoOn(on),
        onTokenExpiring: () => { getRoomCredentials(interviewId).then((n) => engine.current?.renewToken(n.token)).catch(() => {}) },
      })
      engine.current = eng
      eng.init(c.appId)
      eng.join(c)
      setLocalReady(true)
    } catch (e) {
      setVideoNote(e instanceof Error ? e.message : 'Video could not start.')
    }
  }, [interviewId])

  // The 90 s reconnect window counts down for real; past it the link is shown as dropped.
  useEffect(() => {
    if (link !== 'reconnecting') return
    const t = setInterval(() => {
      const st = reconnectStart.current
      if (st == null) return
      const rem = RECONNECT_WINDOW - Math.floor((Date.now() - st) / 1000)
      if (rem <= 0) { setReconnectSecLeft(0); setLink('failed'); clearInterval(t) } else setReconnectSecLeft(rem)
    }, 1000)
    return () => clearInterval(t)
  }, [link])

  const toggleMic = useCallback(() => {
    const next = !muted
    setMuted(next); engine.current?.muteMic(next)
    recordRoomEvent(interviewId, next ? 'MUTE' : 'UNMUTE').catch(() => {})
  }, [muted, interviewId])
  const toggleCamera = useCallback(() => {
    const next = !cameraOff
    setCameraOff(next); engine.current?.publishVideo(!next)
    recordRoomEvent(interviewId, 'CAMERA', { on: !next }).catch(() => {})
  }, [cameraOff, interviewId])

  // Enter the room once.
  useEffect(() => {
    let alive = true
    getRoomCredentials(interviewId)
      .then((c) => {
        if (!alive) return
        setCredentials(c)
        joined.current = true
        recordRoomEvent(interviewId, 'JOIN').catch(() => {})
        startVideo(c)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiClientError && e.status === 503) {
          // Presence is stamped before the server checks its video config.
          joined.current = true
          setVideoNote(e.message)
        } else {
          setRefusal(e instanceof Error ? e.message : 'The room could not be opened.')
        }
      })
    return () => {
      alive = false
      engine.current?.destroy()
      engine.current = null
      if (joined.current && !finished.current) recordRoomEvent(interviewId, 'LEAVE').catch(() => {})
    }
  }, [interviewId, startVideo])

  // Follow the server.
  useEffect(() => {
    let alive = true
    const poll = () =>
      getInterviewerInterview(interviewId)
        .then((iv) => {
          if (!alive) return
          setInterview(iv)
          if (OVER.has(iv.status)) finished.current = true
        })
        .catch(() => {})
    poll()
    const t = setInterval(() => {
      if (!finished.current) poll()
    }, 3000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [interviewId])

  const startedIso = interview?.sessionStartedAt ?? credentials?.sessionStartedAt
  const startedAt = startedIso ? Date.parse(startedIso) : null
  const over = ended || (interview != null && OVER.has(interview.status))
  const now = useNow() || Date.now()
  const durationMin = interview?.durationMin ?? 0
  const total = durationMin * 60
  const elapsedSec = startedAt != null && !over ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
  const remainingSec = total - elapsedSec
  const thresholdPct = credentials?.thresholdPct ?? null
  const markAtSec = thresholdPct != null ? Math.ceil((total * thresholdPct) / 100) : null
  const meetsMark = markAtSec != null ? elapsedSec >= markAtSec : null

  const markMoment = useCallback(async () => {
    const atSec = elapsedSec
    await recordRoomEvent(interviewId, 'HIGHLIGHT', { atSec }).catch(() => {})
    return atSec
  }, [interviewId, elapsedSec])

  const end = useCallback(async (): Promise<EndResult | null> => {
    setEnding(true)
    setEndError(null)
    try {
      await recordRoomEvent(interviewId, 'LEAVE').catch(() => {})
      const r = await endSession(interviewId)
      finished.current = true
      engine.current?.destroy()
      engine.current = null
      setLocalReady(false)
      setEnded(true)
      return { complete: r.complete, pct: r.pct }
    } catch (e) {
      setEndError(e instanceof Error ? e.message : 'The session did not end. Try again.')
      return null
    } finally {
      setEnding(false)
    }
  }, [interviewId])

  let state: RoomState
  if (refusal && !interview?.sessionStartedAt) state = 'refused'
  else if (over) state = 'ended'
  else if (!interview) state = 'loading'
  else state = startedAt != null ? 'live' : 'lobby'

  return {
    state, interview, credentials, refusal, videoNote,
    elapsedSec, remainingSec, durationMin, thresholdPct, markAtSec, meetsMark,
    ending, endError, markMoment, end,
    muted, cameraOff, toggleMic, toggleCamera, localReady, remoteUid, remoteVideoOn, quality, link, reconnectSecLeft,
    warnings: credentials?.warnings ?? [5, 1],
  }
}
