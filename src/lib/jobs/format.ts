import type { ApplicationStatus, EmploymentType } from '../api/jobs'
import type { Tone } from '../../components/ui/status'

/** Job formatting, mirrored from the web (apostrophe-user lib/jobs/format.ts). */
const TYPE_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time', PART_TIME: 'Part-time', INTERNSHIP: 'Internship',
  CONTRACT: 'Contract', REMOTE: 'Remote', HYBRID: 'Hybrid',
}
export const employmentLabel = (t: EmploymentType) => TYPE_LABEL[t] ?? t

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** IST wall-clock (fixed +5:30) — matches slots.ts, avoids Hermes timezone gaps. */
function ist(iso: string) {
  const d = new Date(new Date(iso).getTime() + (5 * 60 + 30) * 60000)
  return { d: d.getUTCDate(), mo: d.getUTCMonth() }
}

export function salaryRange(s: { minPaise: number; maxPaise: number } | null | undefined): string | null {
  if (!s) return null
  const lpa = (p: number) => {
    const rs = p / 100
    return rs >= 100000 ? `₹${Number.isInteger(rs / 100000) ? rs / 100000 : (rs / 100000).toFixed(1)}` : `₹${Math.round(rs).toLocaleString('en-IN')}`
  }
  const min = lpa(s.minPaise), max = lpa(s.maxPaise)
  return s.minPaise >= 100000 * 100 ? `${min} – ${max} LPA` : `${min} – ${max}`
}

export const locationLine = (location: string, remote: boolean) =>
  remote && location ? `${location} · Remote` : remote ? 'Remote' : location

export function deadlineLine(iso?: string | null, now = Date.now()): string | null {
  if (!iso) return null
  if (new Date(iso).getTime() < now) return 'Closed'
  const p = ist(iso)
  return `Closes ${p.d} ${MON[p.mo]}`
}
export function dateLine(iso: string): string {
  const p = ist(iso)
  return `${p.d} ${MON[p.mo]}`
}
export function experienceLine(e: { minYears: number; maxYears?: number | null }): string {
  if (!e.minYears && !e.maxYears) return 'Any experience'
  if (e.maxYears == null) return `${e.minYears}+ years`
  return `${e.minYears}–${e.maxYears} years`
}
export function activeFilterCount(f: object): number {
  return Object.entries(f as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== '').length
}
export function applicationMark(status: ApplicationStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'APPLIED': return { label: 'Applied', tone: 'neutral' }
    case 'VIEWED': return { label: 'Viewed', tone: 'info' }
    case 'SHORTLISTED': return { label: 'Shortlisted', tone: 'accent' }
    case 'REJECTED': return { label: 'Not selected', tone: 'neutral' }
    case 'CONNECTED': return { label: 'Connected', tone: 'success' }
  }
}
