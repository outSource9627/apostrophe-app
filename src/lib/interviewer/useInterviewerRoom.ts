import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError } from '../api'
import {
  endSession, getInterviewerInterview, getRoomCredentials, recordRoomEvent,
  type InterviewerInterviewDto, type InterviewerRoomDto,
} from '../api/interviewer'
import { useNow } from '../employer/useNow'

/**
 * IV-12 — the interviewer's live room on the phone (the web's useInterviewerRoom).
 *
 * ═══ THE VIDEO SWAP POINT ═══ The app has no video SDK yet (the student room is
 * a stub for the same reason). This hook does everything else for real:
 *   - GET …/room on entry — the server stamps the interviewer present and starts
 *     the session (and its recording) once the student is in too. A 503 there
 *     means video is not configured on the server; presence is still recorded.
 *   - polls the interview every 3 s for the server's `sessionStartedAt` / status;
 *   - runs the session clock from the SERVER's start, and the completion
 *     estimate against the server's `thresholdPct` (the server decides);
 *   - logs JOIN / LEAVE / HIGHLIGHT, and ends the session (POST …/session END).
 * To add video, create the engine from `credentials` here and map its link
 * state onto `RoomState`; the screen does not change.
 */
export type RoomState = 'loading' | 'lobby' | 'live' | 'ended' | 'refused'

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

  // Enter the room once.
  useEffect(() => {
    let alive = true
    getRoomCredentials(interviewId)
      .then((c) => {
        if (!alive) return
        setCredentials(c)
        joined.current = true
        recordRoomEvent(interviewId, 'JOIN').catch(() => {})
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
      if (joined.current && !finished.current) recordRoomEvent(interviewId, 'LEAVE').catch(() => {})
    }
  }, [interviewId])

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
  }
}
