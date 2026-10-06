import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { AppConfig } from '../api/config'
import { getInterview, type StudentInterview } from '../api/interviews'

/**
 * The late-join warning (docs/late-join-mockups.html, red fill), computed once for
 * every Join location — the student's Home card and sheet, the interviews list and
 * detail, the readiness check and the room; the interviewer's Home, list, detail
 * and lobby.
 *
 *   before  the join window is open and the start is still ahead — the cards as they were
 *   late    past the start, the viewer is not in the room and the session has not started
 *   red     the same, `booking.lateRedMinutes` or more past the start
 *   joined  past the start, the viewer IS in the room (the server says so) and it has not started
 *   off     nothing to warn about: the window is shut, the session started, or it is not BOOKED
 *
 * Every number is the server's: the slot time, the presence booleans, and the two admin
 * settings from /config — `booking.noShowMinutesAfter` (when Join closes) and
 * `booking.lateRedMinutes` (when amber turns red). A setting the server does not send is
 * not guessed: without the close time the band drops it and the bar is not drawn; without
 * the red point the card stays amber.
 */
export type LatePhase = 'off' | 'before' | 'late' | 'red' | 'joined'

/** The other side's line: in the room (green), not in yet before the start, or late (amber / red). */
export type OtherTone = 'in' | 'neutral' | 'late' | 'red'

export interface LateRules {
  joinOpensMinutesBefore?: number
  noShowMinutesAfter?: number
  lateRedMinutes?: number
}

export interface LateInput {
  slotStart: string
  status: string
  sessionStartedAt?: string | null
  /** The server's own reading of the join window, used only where a setting is missing. */
  roomReady?: boolean
  /** The viewer's own presence — `studentInRoom` for the student, `interviewerInRoom` for the interviewer. */
  selfInRoom?: boolean
  /** The other side's presence. Absent (an older server, or another status) is unknown, never "not in". */
  otherInRoom?: boolean
}

export interface LateJoin {
  phase: LatePhase
  /** Whole seconds since the start; 0 before it. */
  secondsLate: number
  /** Whole seconds to the start; 0 once it has passed. */
  secondsToStart: number
  /** Whole minutes late, at least 1 once the start has passed; 0 before it. */
  minutesLate: number
  /** When Join closes (epoch ms), and how long is left; null when the server does not say. */
  closesAt: number | null
  closesInSec: number | null
  /** The share of the after-start window still left, 1 → 0, for the draining bar; null when unknown. */
  remaining: number | null
  /** The other side's line, or null when presence is unknown (the line is then not drawn). */
  other: OtherTone | null
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined

/** The three numbers from /config. The interviewer block mirrors the booking one; either will do. */
export function lateRulesOf(config: Partial<Pick<AppConfig, 'booking' | 'interviewer'>> | null | undefined): LateRules {
  const b = config?.booking as Record<string, unknown> | undefined
  const i = config?.interviewer as Record<string, unknown> | undefined
  return {
    joinOpensMinutesBefore: num(i?.joinOpensMinutesBefore) ?? num(b?.joinOpensMinutesBefore),
    noShowMinutesAfter: num(i?.noShowMinutesAfter) ?? num(b?.noShowMinutesAfter),
    lateRedMinutes: num(i?.lateRedMinutes) ?? num(b?.lateRedMinutes),
  }
}

/** The rules, from the app-wide ['config'] query (no extra request once any screen has read /config). */
export function useLateRules(): LateRules {
  const q = useQuery({ queryKey: ['config'], queryFn: () => api.get<AppConfig>('/config') })
  return lateRulesOf(q.data)
}

const OFF = (secondsToStart: number): LateJoin => ({
  phase: 'off', secondsLate: 0, secondsToStart, minutesLate: 0, closesAt: null, closesInSec: null, remaining: null, other: null,
})

export function lateJoin(input: LateInput, rules: LateRules, nowMs: number): LateJoin {
  const start = Date.parse(input.slotStart)
  if (!Number.isFinite(start) || !nowMs) return OFF(0)
  const secondsToStart = Math.max(0, Math.ceil((start - nowMs) / 1000))
  if (input.status !== 'BOOKED' || input.sessionStartedAt) return OFF(secondsToStart)

  const { joinOpensMinutesBefore: before, noShowMinutesAfter: after, lateRedMinutes: red } = rules
  const closesAt = after != null ? start + after * 60_000 : null
  const opened = before != null ? nowMs >= start - before * 60_000 : Boolean(input.roomReady)
  const shut = closesAt != null ? nowMs > closesAt : nowMs > start && !input.roomReady
  if (!opened || shut) return OFF(secondsToStart)

  const secondsLate = Math.max(0, Math.floor((nowMs - start) / 1000))
  const minutesLate = secondsLate > 0 ? Math.max(1, Math.floor(secondsLate / 60)) : 0
  const isRed = red != null && secondsLate >= red * 60
  const closesInSec = closesAt != null ? Math.max(0, Math.ceil((closesAt - nowMs) / 1000)) : null
  const remaining = closesAt != null && after ? Math.max(0, Math.min(1, (closesAt - nowMs) / (after * 60_000))) : null

  const phase: LatePhase = secondsLate === 0 ? 'before' : input.selfInRoom ? 'joined' : isRed ? 'red' : 'late'
  const other: OtherTone | null = input.otherInRoom == null ? null
    : input.otherInRoom ? 'in'
      : secondsLate === 0 ? 'neutral'
        : isRed ? 'red' : 'late'

  return { phase, secondsLate, secondsToStart, minutesLate, closesAt, closesInSec, remaining, other }
}

/** True while the viewer is the late one — the phases that change a card. */
export const isLate = (j: LateJoin) => j.phase === 'late' || j.phase === 'red'

const pad = (n: number) => String(n).padStart(2, '0')
/** mm:ss — minutes run past 59 rather than rolling into hours (the window is minutes long). */
export const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

/** The big clock: "04:12" to the start, "−02:14" past it (a true minus sign, as drawn). */
export const lateClock = (j: LateJoin) => (j.secondsLate > 0 ? `−${mmss(j.secondsLate)}` : mmss(j.secondsToStart))

/** The clock's label. */
export const lateClockLabel = (j: LateJoin) => (j.secondsLate > 0 ? 'Since the start' : 'Starts in')

/** The pill on a late card: "Late · 2 min". */
export const latePillText = (j: LateJoin) => `Late · ${j.minutesLate} min`

/** The band: "You're 2 min late · join closes in 12:46" (the close part only when the server says when). */
export function lateBandText(j: LateJoin): { lead: string; tail: string | null } {
  return {
    lead: `You're ${j.minutesLate} min late`,
    tail: j.closesInSec != null ? `join closes in ${mmss(j.closesInSec)}` : null,
  }
}

/**
 * The other side's line. `who` is "Interviewer" for the student (never a name — SC-16) and
 * the student's first name for the interviewer.
 */
export function otherLine(j: LateJoin, who: string): string | null {
  switch (j.other) {
    case 'in': return `${who} is in the room, waiting`
    case 'neutral': return `${who} not in yet`
    case 'late':
    case 'red': return `${who} not in yet · ${j.minutesLate} min late`
    default: return null
  }
}

/** While a row is in its join window the screens poll faster, so presence and lateness stay current. */
export const LIVE_POLL_MS = 10_000

/** A student interview, read for the warning: the student is "self", the interviewer the other side. */
export const studentLateInput = (iv: StudentInterview): LateInput => ({
  slotStart: iv.slotStart,
  status: iv.status,
  sessionStartedAt: iv.sessionStartedAt,
  roomReady: iv.roomReady,
  selfInRoom: iv.studentInRoom,
  otherInRoom: iv.interviewerInRoom,
})

/** An interviewer's interview (list row, detail or the Home's next session): the other way round. */
export const interviewerLateInput = (iv: {
  slotStart: string; status: string; sessionStartedAt?: string; roomReady?: boolean; studentInRoom?: boolean; interviewerInRoom?: boolean
}): LateInput => ({
  slotStart: iv.slotStart,
  status: iv.status,
  sessionStartedAt: iv.sessionStartedAt,
  roomReady: iv.roomReady,
  selfInRoom: iv.interviewerInRoom,
  otherInRoom: iv.studentInRoom,
})

/** A one-second clock that runs only while `active` (a slot near its start); 0 while it is off. */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return active ? now : 0
}

/** Within two hours of the start: close enough for the one-second clock to run. */
export const nearStart = (slotStart: string, nowMs: number) => Math.abs(Date.parse(slotStart) - nowMs) < 2 * 3_600_000

/**
 * The student's next interview, kept current while its join window is open: the screen's copy,
 * replaced by a fresh read every LIVE_POLL_MS once it has one, and the warning computed from it
 * on a one-second clock. `coarseNow` is the screen's own (slower) clock.
 */
export function useStudentLate(iv: StudentInterview, coarseNow: number): { iv: StudentInterview; late: LateJoin; now: number } {
  const rules = useLateRules()
  const now = useTicker(nearStart(iv.slotStart, coarseNow)) || coarseNow
  const live = lateJoin(studentLateInput(iv), rules, now).phase !== 'off'
  const fresh = useQuery({
    queryKey: ['interview', iv.id],
    queryFn: () => getInterview(iv.id),
    enabled: live,
    refetchInterval: live ? LIVE_POLL_MS : false,
  })
  const cur = live && fresh.isFetchedAfterMount && fresh.data ? fresh.data : iv
  return { iv: cur, late: lateJoin(studentLateInput(cur), rules, now), now }
}
