import type {
  Availability, CandidateFilterKey, CandidateFilters, EmploymentType, LocationMode, RecencyDays, Tier,
} from '../api/employerFeed'
import type { AppConfig } from '../api/config'
import { label } from '../profile/labels'

/**
 * EM-11's ten filters on the phone. The set lives on the SERVER
 * (GET/PUT/DELETE /employers/feed/filters), so it is the same on this phone and
 * on the web and survives a sign-out; this file only reads and edits it.
 *
 * The rules are the server's (contracts/feed.ts) and are copied, not
 * re-invented: several values within one row are any-of, rows AND together,
 * and a set is compared in its canonical form (trimmed, de-duplicated, sorted;
 * cities with no mode mean "lives there").
 */

export const TIERS: Tier[] = ['T1', 'T2', 'T3', 'T4']
export const AVAILABILITY: Availability[] = ['IMMEDIATE', 'DAYS_15', 'DAYS_30', 'DAYS_60']
export const EMPLOYMENT_TYPES: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'REMOTE', 'HYBRID']
const LOCATION_MODES: LocationMode[] = ['LIVES', 'RELOCATE', 'REMOTE']

/** The rows in the order drawn, with the fields each owns (the server's CANDIDATE_FILTER_ROWS). */
export const FILTER_ROWS: { key: CandidateFilterKey; label: string; any: string; fields: (keyof CandidateFilters)[] }[] = [
  { key: 'tier', label: 'Qualification tier', any: 'Any tier', fields: ['tiers'] },
  { key: 'fieldOfStudy', label: 'Field of study', any: 'Any field', fields: ['domains'] },
  { key: 'skills', label: 'Skills', any: 'Any skills', fields: ['skills'] },
  { key: 'location', label: 'City and remote', any: 'Anywhere', fields: ['cities', 'locationModes'] },
  { key: 'experience', label: 'Years of experience', any: 'Any', fields: ['minExperienceYears'] },
  { key: 'salary', label: 'Expected salary', any: 'Any salary', fields: ['minExpectedSalaryPaise', 'maxExpectedSalaryPaise'] },
  { key: 'languages', label: 'Languages', any: 'Any language', fields: ['languages'] },
  { key: 'availability', label: 'Availability to join', any: 'Any notice', fields: ['joinsWithin'] },
  { key: 'employmentType', label: 'Employment type sought', any: 'Any type', fields: ['employmentTypes'] },
  { key: 'recency', label: 'Interview recency', any: 'Any time', fields: ['interviewedWithinDays'] },
]

export const rowLabel = (key: CandidateFilterKey) => FILTER_ROWS.find((r) => r.key === key)?.label ?? key

// ── option lists ─────────────────────────────────────────────────────────────
const TIER_LABEL: Record<Tier, string> = { T1: 'T1 · 12th pass', T2: 'T2 · Graduation', T3: 'T3 · Post Graduation', T4: 'T4 · PhD' }
const MODE_LABEL: Record<LocationMode, string> = { LIVES: 'Lives there', RELOCATE: 'Would relocate', REMOTE: 'Open to remote' }
const RECENCY_LABEL: Record<RecencyDays, string> = { 30: 'Last 30 days', 90: 'Last 90 days', 180: 'Last 180 days' }
const JOINS_LABEL: Record<Availability, string> = { IMMEDIATE: 'Immediate', DAYS_15: '15 days', DAYS_30: '30 days', DAYS_60: '60 days' }

/** The experience floors offered: "1+ yrs", "3+ yrs", "5+ yrs". */
export const EXPERIENCE_FLOORS = [1, 3, 5] as const

const PAISE_PER_LAKH = 10_000_000
/** The expected-salary bands the design draws, in lakh per year: under 4, 4–8, 8–12, 12+. */
export const SALARY_BANDS: { key: string; min?: number; max?: number }[] = [
  { key: 'u4', max: 4 },
  { key: '4-8', min: 4, max: 8 },
  { key: '8-12', min: 8, max: 12 },
  { key: '12+', min: 12 },
]
export const bandLabel = (b: { min?: number; max?: number }) =>
  b.min === undefined ? `Under ₹${b.max} LPA` : b.max === undefined ? `₹${b.min} LPA+` : `₹${b.min}–${b.max} LPA`
export const bandFilters = (b: { min?: number; max?: number }): Pick<CandidateFilters, 'minExpectedSalaryPaise' | 'maxExpectedSalaryPaise'> => ({
  minExpectedSalaryPaise: b.min === undefined ? undefined : b.min * PAISE_PER_LAKH,
  maxExpectedSalaryPaise: b.max === undefined ? undefined : b.max * PAISE_PER_LAKH,
})
export const bandOf = (f: CandidateFilters) =>
  SALARY_BANDS.find((b) => (b.min ?? 0) * PAISE_PER_LAKH === (f.minExpectedSalaryPaise ?? 0) && (b.max === undefined ? f.maxExpectedSalaryPaise === undefined : b.max * PAISE_PER_LAKH === f.maxExpectedSalaryPaise))

/** What the sheet offers for each row, from /config where the server describes it. */
export function filterOptions(config: AppConfig | null) {
  const feed = config?.employer?.feed
  const md = config?.masterData
  return {
    tiers: (feed?.tiers ?? TIERS.map((value) => ({ value, label: TIER_LABEL[value] }))) as { value: Tier; label: string }[],
    domains: (md?.domains ?? []).map((d) => d.name),
    skills: (md?.skills ?? []).map((d) => d.name),
    cities: (md?.cities ?? []).map((d) => d.name),
    languages: (md?.languages ?? []).map((d) => d.name),
    locationModes: (feed?.locationModes ?? LOCATION_MODES.map((value) => ({ value, label: MODE_LABEL[value] }))) as { value: LocationMode; label: string }[],
    availability: ((feed?.availability ?? AVAILABILITY) as Availability[]).map((value) => ({ value, label: JOINS_LABEL[value] ?? label(value) })),
    employmentTypes: ((feed?.employmentTypes ?? EMPLOYMENT_TYPES) as EmploymentType[]).map((value) => ({ value, label: label(value) })),
    recency: (feed?.interviewRecencyDays ?? ([30, 90, 180] as RecencyDays[]).map((value) => ({ value, label: RECENCY_LABEL[value] }))) as { value: RecencyDays; label: string }[],
    listMax: feed?.listMax ?? 20,
  }
}

// ── the canonical form ───────────────────────────────────────────────────────
const names = (values?: readonly string[]) => {
  if (!values?.length) return undefined
  const seen = new Map<string, string>()
  for (const raw of values) {
    const v = raw.trim()
    if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
  }
  const out = [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v)
  return out.length ? out : undefined
}
const ordered = <T extends string>(order: readonly T[], values?: readonly T[]) => {
  if (!values?.length) return undefined
  const set = new Set(values)
  const out = order.filter((v) => set.has(v))
  return out.length ? out : undefined
}

/** The server's normalizeCandidateFilters, so a draft and the persisted set compare as the server would. */
export function normalize(f: CandidateFilters): CandidateFilters {
  const out: CandidateFilters = {}
  const tiers = ordered(TIERS, f.tiers)
  if (tiers) out.tiers = tiers
  const domains = names(f.domains)
  if (domains) out.domains = domains
  const skills = names(f.skills)
  if (skills) out.skills = skills
  const cities = names(f.cities)
  let modes = ordered(LOCATION_MODES, f.locationModes)
  if (cities) {
    out.cities = cities
    out.locationModes = modes ?? ['LIVES']
  } else {
    modes = modes?.filter((m) => m === 'REMOTE')
    if (modes?.length) out.locationModes = modes
  }
  if (f.minExperienceYears) out.minExperienceYears = f.minExperienceYears
  if (f.minExpectedSalaryPaise) out.minExpectedSalaryPaise = f.minExpectedSalaryPaise
  if (f.maxExpectedSalaryPaise !== undefined) out.maxExpectedSalaryPaise = f.maxExpectedSalaryPaise
  const languages = names(f.languages)
  if (languages) out.languages = languages
  if (f.joinsWithin) out.joinsWithin = f.joinsWithin
  const types = ordered(EMPLOYMENT_TYPES, f.employmentTypes)
  if (types) out.employmentTypes = types
  if (f.interviewedWithinDays) out.interviewedWithinDays = f.interviewedWithinDays
  return out
}

/** Which rows are set; the count on the Filters pill is its length. */
export function activeRows(f: CandidateFilters): CandidateFilterKey[] {
  const n = normalize(f) as Record<string, unknown>
  return FILTER_ROWS.filter((row) => row.fields.some((field) => n[field] !== undefined)).map((row) => row.key)
}
export const filterCount = (f: CandidateFilters) => activeRows(f).length

const fingerprint = (f: CandidateFilters) => {
  const n = normalize(f) as Record<string, unknown>
  return JSON.stringify(FILTER_ROWS.flatMap((r) => r.fields as string[]).filter((k) => n[k] !== undefined).map((k) => [k, n[k]]))
}
export const sameFilters = (a: CandidateFilters, b: CandidateFilters) => fingerprint(a) === fingerprint(b)

export function withoutRow(f: CandidateFilters, key: CandidateFilterKey): CandidateFilters {
  const row = FILTER_ROWS.find((r) => r.key === key)
  const out = { ...f } as Record<string, unknown>
  for (const field of row?.fields ?? []) delete out[field]
  return normalize(out as CandidateFilters)
}

// ── chips ────────────────────────────────────────────────────────────────────
export interface FilterChip {
  /** Unique per chip: `field:value`. */
  key: string
  text: string
}

/** One removable chip per chosen value, in the sheet's order. */
export function filterChips(f: CandidateFilters): FilterChip[] {
  const n = normalize(f)
  const out: FilterChip[] = []
  n.tiers?.forEach((t) => out.push({ key: `tiers:${t}`, text: TIER_LABEL[t] ?? t }))
  n.domains?.forEach((d) => out.push({ key: `domains:${d}`, text: d }))
  n.skills?.forEach((d) => out.push({ key: `skills:${d}`, text: d }))
  n.cities?.forEach((d) => out.push({ key: `cities:${d}`, text: d }))
  n.locationModes?.filter((m) => m !== 'LIVES').forEach((m) => out.push({ key: `locationModes:${m}`, text: MODE_LABEL[m] }))
  if (n.minExperienceYears) out.push({ key: 'minExperienceYears', text: `${n.minExperienceYears}+ yrs` })
  if (n.minExpectedSalaryPaise || n.maxExpectedSalaryPaise !== undefined) {
    out.push({
      key: 'salary',
      text: bandLabel({
        min: n.minExpectedSalaryPaise ? n.minExpectedSalaryPaise / PAISE_PER_LAKH : undefined,
        max: n.maxExpectedSalaryPaise !== undefined ? n.maxExpectedSalaryPaise / PAISE_PER_LAKH : undefined,
      }),
    })
  }
  n.languages?.forEach((d) => out.push({ key: `languages:${d}`, text: d }))
  if (n.joinsWithin) out.push({ key: 'joinsWithin', text: n.joinsWithin === 'IMMEDIATE' ? 'Joins immediately' : `Joins within ${JOINS_LABEL[n.joinsWithin]}` })
  n.employmentTypes?.forEach((t) => out.push({ key: `employmentTypes:${t}`, text: label(t) }))
  if (n.interviewedWithinDays) out.push({ key: 'interviewedWithinDays', text: RECENCY_LABEL[n.interviewedWithinDays] })
  return out
}

/** The set with one chip taken off. */
export function withoutChip(f: CandidateFilters, chipKey: string): CandidateFilters {
  const next = { ...normalize(f) } as Record<string, unknown>
  const [field, value] = chipKey.split(':')
  if (field === 'salary') {
    delete next.minExpectedSalaryPaise
    delete next.maxExpectedSalaryPaise
  } else if (value === undefined) {
    delete next[field]
  } else {
    next[field] = ((next[field] as string[] | undefined) ?? []).filter((v) => v !== value)
  }
  return normalize(next as CandidateFilters)
}

/** 'T2 · Graduation · Pune · Immediate' — a saved search in one line. */
export const filterSummary = (f: CandidateFilters) => filterChips(f).map((c) => c.text).join(' · ')
