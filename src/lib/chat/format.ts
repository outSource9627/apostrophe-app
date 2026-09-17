import type { ChatRefusal, ConnectionOrigin, MessageAttachment } from '../api/chat'

/**
 * Everything time and copy for the interests / connections / chat flow, in
 * Asia/Kolkata and nowhere else — the app half of apostrophe-user's
 * lib/chat/format.ts, producing the SAME strings so the two surfaces cannot
 * drift.
 *
 * IST IS A FIXED +05:30, COMPUTED BY HAND rather than through Intl's `timeZone`:
 * India observes no daylight saving, and Hermes on Android has shipped without
 * full IANA timezone data, so an `Intl.DateTimeFormat({ timeZone: 'Asia/Kolkata' })`
 * correct on the web can silently fall back to UTC on a phone. Shifting the
 * instant by the fixed offset and reading its UTC parts is correct everywhere.
 *
 * Relative readings ("6 hours left", "Today") take an explicit `now` — a screen
 * captures it once with useState(() => Date.now()) rather than reading the clock
 * during render.
 */
const IST_OFFSET_MIN = 5 * 60 + 30
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export interface IstParts { y: number; mo: number; d: number; dow: number; h: number; mi: number }

/** The instant, as its IST wall-clock parts. */
export function ist(iso: string | number | Date): IstParts {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60 * 1000)
  return {
    y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth(), d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(), h: shifted.getUTCHours(), mi: shifted.getUTCMinutes(),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (p: IstParts) => {
  const am = p.h < 12
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12
  return `${h12}:${pad(p.mi)} ${am ? 'AM' : 'PM'}`
}
const sameDay = (a: IstParts, b: IstParts) => a.y === b.y && a.mo === b.mo && a.d === b.d
const dayNumber = (p: IstParts) => Math.floor(Date.UTC(p.y, p.mo, p.d) / 86_400_000)

/** '9:12 AM' — a bare time, IST. */
export const fmtClock = (iso: string) => clock(ist(iso))
/** '21 Sep' — day and short month, no weekday. */
export const fmtDayMon = (iso: string) => { const p = ist(iso); return `${p.d} ${MON[p.mo]}` }
/** '3 October' — day and FULL month, for prose (sans) sentences, no year inside this one. */
export const fmtDayMonthLong = (iso: string) => { const p = ist(iso); return `${p.d} ${MON_LONG[p.mo]}` }
/** '2 Oct, 5:02 PM' — a full moment on one line. */
export const fmtDateTime = (iso: string) => { const p = ist(iso); return `${p.d} ${MON[p.mo]}, ${clock(p)}` }
/** '23 June 2026' — day, full month and year, for an absolute floor/deadline in prose. */
export const fmtDayMonthYear = (iso: string | number | Date) => { const p = ist(iso); return `${p.d} ${MON_LONG[p.mo]} ${p.y}` }
/** '2026-09-21' — an ISO date slug, for a generated export filename. */
export const fmtISODate = (iso: string | number | Date) => { const p = ist(iso); return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}` }
/** '21 September 2026, 7:44 PM IST' — a full moment with year, for a stats window line. */
export const fmtStampFull = (iso: string | number | Date) => { const p = ist(iso); return `${p.d} ${MON_LONG[p.mo]} ${p.y}, ${clock(p)} IST` }
/** 'Sun 11 Oct, 9:20 AM IST' — the operational stamp, zone stated. */
export const fmtStampZone = (iso: string) => { const p = ist(iso); return `${DOW[p.dow]} ${p.d} ${MON[p.mo]}, ${clock(p)} IST` }

/** A thread-row timestamp: today → time, this year → '21 Sep', else '21 Sep 2025'. */
export function fmtRowStamp(iso: string, now: number): string {
  const p = ist(iso), n = ist(now)
  if (sameDay(p, n)) return clock(p)
  return p.y === n.y ? `${p.d} ${MON[p.mo]}` : `${p.d} ${MON[p.mo]} ${p.y}`
}

/** A transcript day divider: 'Today' / 'Yesterday' / '24 September' (+ year if not this one). */
export function fmtDayDivider(iso: string, now: number): string {
  const p = ist(iso), n = ist(now)
  const diff = dayNumber(n) - dayNumber(p)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return p.y === n.y ? `${p.d} ${MON_LONG[p.mo]}` : `${p.d} ${MON_LONG[p.mo]} ${p.y}`
}

/** A delivery/read receipt: 'Read 9:22 AM' / 'Read yesterday 8:02 PM' / 'Read 2 Oct, 5:02 PM'. */
export function fmtReceipt(verb: string, iso: string, now: number): string {
  const p = ist(iso), n = ist(now)
  const diff = dayNumber(n) - dayNumber(p)
  if (diff === 0) return `${verb} ${clock(p)}`
  if (diff === 1) return `${verb} yesterday ${clock(p)}`
  return `${verb} ${fmtDateTime(iso)}`
}

// ── The fourteen-day Interest clock (§4 of the flow) ─────────────────────────
export type ClockReading = 'fresh' | 'soon' | 'urgent' | 'spent'

export interface InterestClock {
  reading: ClockReading
  relative: string
  absolute: string
  /** 0..100, the ELAPSED fraction — the rule fills as the fourteen days are used up. */
  pct: number
}

/**
 * The countdown is computed from `expiresAt`, never from `status`: an hourly cron
 * flips SENT → EXPIRED, so a row can read SENT for up to an hour past its clock.
 * A dead clock is `spent` here regardless of status.
 */
export function interestClock(sentAt: string, expiresAt: string, now: number): InterestClock {
  const end = new Date(expiresAt).getTime()
  const start = new Date(sentAt).getTime()
  const remaining = end - now
  const total = Math.max(1, end - start)
  const pct = Math.max(0, Math.min(100, ((now - start) / total) * 100))

  if (remaining <= 0) return { reading: 'spent', relative: 'Expired', absolute: `until ${fmtDateTime(expiresAt)}`, pct: 100 }

  const hours = remaining / 3_600_000
  let relative: string
  let reading: ClockReading
  if (hours < 24) {
    reading = 'urgent'
    const h = Math.round(hours)
    relative = h <= 0 ? 'under an hour left' : `${h} hour${h === 1 ? '' : 's'} left`
  } else {
    const days = Math.max(1, Math.round(hours / 24))
    relative = `${days} day${days === 1 ? '' : 's'} left`
    reading = hours <= 72 ? 'soon' : 'fresh'
  }
  return { reading, relative, absolute: `until ${fmtDateTime(expiresAt)}`, pct }
}

// ── Copy ─────────────────────────────────────────────────────────────────────
/** Which door this connection came through. Every ST-42 row states it in mono. */
export const originLabel = (origin: ConnectionOrigin) =>
  origin === 'INTEREST' ? 'Their Interest' : 'Your application'

/** CH-06 refusal copy, lifted verbatim from CHAT_REFUSAL_MESSAGE. */
export const CHAT_REFUSAL_COPY: Record<ChatRefusal, string> = {
  NOT_CONNECTED: 'You can message each other once you are connected.',
  SAME_ROLE: 'This conversation is not available.',
  ROLE_PAIR_NOT_PERMITTED: 'This conversation is not available.',
  NOT_ASSIGNED: 'This conversation is not available.',
  BLOCKED: 'This conversation is no longer available.',
  CONNECTION_CLOSED: 'This conversation has been archived.',
  THREAD_NOT_OPEN: 'This chat opens closer to your interview.',
  THREAD_READ_ONLY: 'This chat is now read-only.',
  THREAD_ARCHIVED: 'This conversation has been archived.',
  NOT_A_PARTICIPANT: 'This conversation is not available.',
  ACCOUNT_INACTIVE: 'This conversation is not available.',
  EMPLOYER_NOT_VERIFIED: 'This conversation is not available.',
}
export const refusalCopy = (reason?: ChatRefusal) => (reason ? CHAT_REFUSAL_COPY[reason] : 'This chat is not open.')

/** 'PDF · 240 KB' / 'JPG · 1.8 MB' — the mono chip under an attachment. */
export function attachmentMeta(att: MessageAttachment): string {
  const ext = att.fileName?.split('.').pop()?.toUpperCase()
  const kind = ext && ext.length <= 4 ? ext : att.kind === 'IMAGE' ? 'IMAGE' : 'FILE'
  const kb = att.sizeBytes / 1024
  const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`
  return `${kind} · ${size}`
}

/** A stable two-letter monogram for a company mark (SR, NT, …). */
export function monogram(name: string | null | undefined): string {
  if (!name) return '·'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '·'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** A short client message id for send idempotency (CH-10). */
export const newClientMessageId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
