import { label } from '../profile/labels'

/**
 * How a candidate's facts read on the feed card, the profile and the player.
 * Every function returns null for a fact the API did not send, so the caller
 * omits the line instead of writing a placeholder.
 */

interface Paise {
  minPaise: number | null
  maxPaise: number | null
}

const lakh = (paise: number) => {
  const l = paise / 10_000_000
  return Number.isInteger(l) ? String(l) : String(Math.round(l * 10) / 10)
}

/** '₹3–6 LPA'. Null when the candidate stated no expectation. */
export function salaryLine(s: Paise | null | undefined): string | null {
  const min = s?.minPaise ?? null
  const max = s?.maxPaise ?? null
  if (min == null && max == null) return null
  if (min != null && max != null) return min === max ? `₹${lakh(min)} LPA` : `₹${lakh(min)}–${lakh(max)} LPA`
  return min != null ? `From ₹${lakh(min)} LPA` : `Up to ₹${lakh(max as number)} LPA`
}

/** 'Immediate', '15 days'. The raw value of a notice period this build does not know is left as the server said it. */
export function joinsLine(a: string | null | undefined): string | null {
  if (!a) return null
  switch (a) {
    case 'IMMEDIATE':
      return 'Immediate'
    case 'DAYS_15':
    case 'FIFTEEN_DAYS':
      return '15 days'
    case 'DAYS_30':
    case 'THIRTY_DAYS':
      return '30 days'
    case 'DAYS_60':
    case 'MORE_THAN_MONTH':
      return '60+ days'
    default:
      return label(a)
  }
}

/** The same notice period as a sentence part on the profile: 'Immediately', 'Within 15 days'. */
export const joinsSentence = (a: string | null | undefined) => (a ? label(a) : null)

/** '1 yr experience', '2.5 yrs experience', 'Fresher'. */
export function experienceLine(years: number | null | undefined): string | null {
  if (years == null) return null
  if (years <= 0) return 'Fresher'
  return `${years} ${years === 1 ? 'yr' : 'yrs'} experience`
}

/** 'T2 · Graduation'. Either half may be missing. */
export function tierLine(tier: string | null | undefined, qualification: string | null | undefined): string | null {
  const parts = [tier, qualification ? label(qualification) : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '12 Sep 2026' in India time — the date the Verified Interview mark carries. */
export function interviewDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // A fixed +05:30 shift: India has no daylight saving, and the month names are ours, not the browser's ("Sept").
  const t = new Date(d.getTime() + 330 * 60 * 1000)
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}

/** '18:36' from seconds. Null for an unknown or zero length. */
export function clock(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** '0:24' for a playhead: unlike `clock`, zero is a real reading. */
export function playhead(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 'TB' from 'Tara Banerjee'. */
export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => Array.from(w)[0] ?? '') : Array.from(words[0] ?? '').slice(0, 2)
  return letters.join('').toUpperCase()
}

/** 'Shortlisted by 10 employers'. Null at zero: a count of none is not a signal. */
export function shortlistedLine(n: number | null | undefined): string | null {
  if (!n || n < 1) return null
  return `Shortlisted by ${n} ${n === 1 ? 'employer' : 'employers'}`
}

/** '1:24' for a self-uploaded clip. */
export const clipLength = (sec: number | null | undefined) => (sec ? playhead(sec) : null)

/** 212 KB / 1.2 MB. */
export function fileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/** 'Jun 2024' from an ISO date or a 'YYYY-MM' string. */
export function monthYear(v: string | null | undefined): string | null {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
