import type { CapacitySlot, StudentInterview } from '../api/interviews'

/**
 * Everything time on the booking flow, in Asia/Kolkata and nowhere else — the
 * app half of apostrophe-user lib/interviews/slots.ts, producing the SAME
 * strings so the two surfaces cannot drift.
 *
 * IST IS A FIXED +05:30, COMPUTED BY HAND rather than through Intl's `timeZone`
 * option. India observes no daylight saving, so the offset never moves; and
 * Hermes on Android has shipped without full IANA timezone data, so an
 * `Intl.DateTimeFormat({ timeZone: 'Asia/Kolkata' })` that is correct on the web
 * can silently fall back to UTC on a phone. Shifting the instant by the fixed
 * offset and reading its UTC parts is correct on every runtime.
 */
const IST_OFFSET_MIN = 5 * 60 + 30

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The instant, as its IST wall-clock parts. */
function ist(iso: string | Date) {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60 * 1000)
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The IST calendar day, as a stable YYYY-MM-DD key for grouping. */
export function istDayKey(iso: string): string {
  const p = ist(iso)
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`
}

/** '7:30 PM' — the slot label, IST. */
export function fmtTime(iso: string): string {
  const { h, mi } = ist(iso)
  const am = h < 12
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(mi)} ${am ? 'AM' : 'PM'}`
}

/** 'Wednesday 16 September'. */
export function fmtLongDate(iso: string): string {
  const p = ist(iso)
  return `${DOW_LONG[p.dow]} ${p.d} ${MON_LONG[p.mo]}`
}

/** 'Wed 16 Sep'. */
export function fmtShortDate(iso: string): string {
  const p = ist(iso)
  return `${DOW[p.dow]} ${p.d} ${MON[p.mo]}`
}

/** 'Wed 16 Sep · 7:30 PM IST'. */
export const fmtStamp = (iso: string) => `${fmtShortDate(iso)} · ${fmtTime(iso)} IST`

/** { dow: 'Wed', num: '16' } for a day-strip chip. */
export function dayChip(iso: string): { dow: string; num: string } {
  const p = ist(iso)
  return { dow: DOW[p.dow], num: String(p.d) }
}

export const weekdayLong = (iso: string) => DOW_LONG[ist(iso).dow]

export interface DaySlots {
  key: string
  anchorIso: string
  slots: CapacitySlot[]
}

/** Group the flat capacity list into IST days, in order. An absent day is a genuinely empty day. */
export function groupByDay(slots: CapacitySlot[]): DaySlots[] {
  const byKey = new Map<string, DaySlots>()
  for (const s of slots) {
    const key = istDayKey(s.slotStart)
    const day = byKey.get(key)
    if (day) day.slots.push(s)
    else byKey.set(key, { key, anchorIso: s.slotStart, slots: [s] })
  }
  return Array.from(byKey.values())
}

/** The whole window in one call: [now + 12h, now + 21d], as ISO bounds capacity wants. */
export function bookingWindow(now = new Date()): { fromIso: string; untilIso: string } {
  const from = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const until = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
  from.setUTCMilliseconds(0)
  until.setUTCMilliseconds(0)
  return { fromIso: from.toISOString(), untilIso: until.toISOString() }
}

export const fmtCapacity = (n: number) => `${n} left`

export const bookingRef = (id: string) => `IV-${id.slice(-7).toUpperCase()}`

/** Upcoming first (soonest first), then past (most recent first). */
export function splitByTime(interviews: StudentInterview[], now = new Date()): {
  upcoming: StudentInterview[]
  past: StudentInterview[]
} {
  const t = now.getTime()
  const live = new Set<InterviewStatus>(['BOOKED', 'IN_PROGRESS'])
  const upcoming: StudentInterview[] = []
  const past: StudentInterview[] = []
  for (const iv of interviews) {
    const future = new Date(iv.slotEnd).getTime() >= t
    if (live.has(iv.status) && future) upcoming.push(iv)
    else past.push(iv)
  }
  upcoming.sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime())
  past.sort((a, b) => new Date(b.slotStart).getTime() - new Date(a.slotStart).getTime())
  return { upcoming, past }
}
type InterviewStatus = StudentInterview['status']
