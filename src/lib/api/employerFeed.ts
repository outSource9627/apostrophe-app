import { api } from './index'

export interface QuotaView {
  limit: number
  used: number
  remaining: number
  /** ISO date string of the next IST midnight. */
  resetAt: string
}

export interface EmployerLimitsView {
  cards: QuotaView
  videoPlays: QuotaView
}

export interface CandidateCard {
  id: string
  name: string
  photoUrl: string | null
  qualification: string | null
  tier: string | null
  city: string | null
  headline: string | null
  skills: string[]
  experienceYears: number
  languages: string[]
  expectedSalary: { minPaise: number | null; maxPaise: number | null }
  availability: string | null
  verifiedInterview: { verified: boolean; at: string | null }
  shortlistCount: number
  shortlisted: boolean
  interest: 'SENT' | 'ACCEPTED' | 'NOT_ACCEPTED' | null
  hasVideo: boolean
  posterUrl: string | null
  streamUrl: string | null
  publishedAt: string | null
}

export interface CandidateDetail extends Partial<CandidateCard> {
  id: string
  name: string
  city: string | null
  qualification: string | null
  tier: string | null
  languages: string[]
  education: {
    qualification?: string
    fieldOfStudy?: string
    institution?: string
    year?: number
    yearOfCompletion?: number
    score?: number
    scoreType?: string
  } | null
  experience: Array<{
    title: string
    company: string
    from: string
    to?: string
    description?: string
  }>
  experienceYears: number
  skills: string[]
  preferences: {
    desiredRoles?: string[]
    targetRoles?: string[]
    preferredLocations?: string[]
    expectedSalaryMinPaise?: number | null
    expectedSalaryMaxPaise?: number | null
    employmentTypes?: string[]
    availabilityToJoin?: string | null
    remote?: boolean
  } | null
  portfolioLinks: Array<{ label?: string; url: string }>
  photoUrl: string | null
  posterUrl?: string | null
  streamUrl?: string | null
  headline?: string | null
  expectedSalary?: { minPaise: number | null; maxPaise: number | null }
  availability?: string | null
  verifiedInterview: { verified: boolean; at: string | null }
  shortlistCount: number
  shortlisted: boolean
  interest: 'SENT' | 'ACCEPTED' | 'NOT_ACCEPTED' | null
  videos: Array<{
    id: string
    slot: number
    kind: string
    title: string | null
    durationSec: number | null
    unverified: boolean
  }>
  documents?: Array<{
    id: string
    kind: 'RESUME' | 'CERTIFICATE' | 'OTHER' | string
    name: string | null
    contentType: string | null
    sizeBytes: number | null
  }>
  limits?: EmployerLimitsView
  connection?: { active: boolean; threadId: string | null } | null
}

export interface CandidateFeedResponse {
  items: CandidateCard[]
  cards?: CandidateCard[]
  nextCursor: string | null
  quota?: QuotaView
}

export type Tier = 'T1' | 'T2' | 'T3' | 'T4'
export type Availability = 'IMMEDIATE' | 'DAYS_15' | 'DAYS_30' | 'DAYS_60'
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP' | 'CONTRACT' | 'REMOTE' | 'HYBRID'
export type LocationMode = 'LIVES' | 'RELOCATE' | 'REMOTE'
export type RecencyDays = 30 | 90 | 180

/**
 * EM-11's ten filters (PRD 14.2), the server's `CandidateFilters`. Several
 * values within one filter are any-of; filters combine with AND.
 */
export interface CandidateFilters {
  tiers?: Tier[]
  domains?: string[]
  skills?: string[]
  cities?: string[]
  locationModes?: LocationMode[]
  minExperienceYears?: number
  minExpectedSalaryPaise?: number
  maxExpectedSalaryPaise?: number
  languages?: string[]
  joinsWithin?: Availability
  employmentTypes?: EmploymentType[]
  interviewedWithinDays?: RecencyDays
}

/** GET/PUT /employers/feed/filters. */
export interface CandidateFiltersView {
  filters: CandidateFilters
  count: number
}

export type CandidateFilterKey =
  | 'tier' | 'fieldOfStudy' | 'skills' | 'location' | 'experience'
  | 'salary' | 'languages' | 'availability' | 'employmentType' | 'recency'

/** GET /employers/feed/match-count — free, spends no card. */
export interface CandidateMatchCount {
  matches: number
  /** The single row whose removal helps most; null when none does. */
  narrowest: { key: CandidateFilterKey; matchesWithout: number } | null
}

/** One page of the deck. The employer's persisted filters apply on the server. */
export interface CandidateFeedQuery {
  limit?: number
  cursor?: string
}

export interface SwipeInput {
  candidateId: string
  direction: 'RIGHT' | 'LEFT'
}

export interface SwipeResult {
  applied: boolean
  candidateId: string
  direction: 'RIGHT' | 'LEFT'
}

export interface LastSwipeView {
  direction: 'RIGHT' | 'LEFT'
  candidateId: string
  name: string
  swipedAt: string
  suppressedUntil?: string | null
}

export interface CandidateRecordingPlay {
  kind: 'INTERVIEW'
  rendition?: 'PORTRAIT' | 'LANDSCAPE'
  url: string
  posterUrl: string | null
  expiresAt: string
  durationSec: number
  verified: boolean
  quota: QuotaView
}

/** EM-12 — a named filter set. `inUse` when it equals the persisted feed filters. */
export interface SavedSearch {
  id: string
  name: string
  filters: CandidateFilters
  count: number
  createdAt: string
  lastUsedAt: string | null
  inUse: boolean
}

export async function fetchCandidateFeed(query?: CandidateFeedQuery): Promise<CandidateFeedResponse> {
  const params = new URLSearchParams()
  if (query?.limit != null) params.set('limit', String(query.limit))
  if (query?.cursor) params.set('cursor', query.cursor)

  const qs = params.toString()
  const raw = await api.get<{
    items?: CandidateCard[]
    cards?: CandidateCard[]
    nextCursor?: string | null
    quota?: QuotaView
  }>(`/employers/candidates${qs ? `?${qs}` : ''}`)

  const candidateList = raw?.items ?? raw?.cards ?? []
  return {
    items: candidateList,
    cards: candidateList,
    nextCursor: raw?.nextCursor ?? null,
    quota: raw?.quota,
  }
}

/** The filters as a query string: every list a comma list (the server's CandidateFiltersQuery). */
function filterParams(f: CandidateFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      if (v.length) params.set(k, v.join(','))
    } else params.set(k, String(v))
  }
  return params
}

/** The persisted EM-11 set: "Filters stay on until cleared, across sessions" — on this phone and on the web. */
export const fetchFeedFilters = () => api.get<CandidateFiltersView>('/employers/feed/filters')

/** Replaces the persisted set with the whole sheet. */
export const saveFeedFilters = (filters: CandidateFilters) =>
  api.put<CandidateFiltersView>('/employers/feed/filters', { filters })

/** Clear all, in one action. */
export const clearFeedFilters = () => api.del<CandidateFiltersView & { cleared: boolean }>('/employers/feed/filters')

/** How many candidates a (draft) filter set matches, and the one row whose removal helps most. */
export function fetchMatchCount(filters: CandidateFilters): Promise<CandidateMatchCount> {
  const qs = filterParams(filters).toString()
  return api.get<CandidateMatchCount>(`/employers/feed/match-count${qs ? `?${qs}` : ''}`)
}

/** One self-uploaded clip from a full profile (always marked unverified). */
export const playSelfVideo = (candidateId: string, videoId: string) =>
  api.post<{ url: string; expiresAt: string; quota?: QuotaView }>(`/employers/candidates/${candidateId}/video`, { videoId })

/** The swipe DELETE /swipes would take back, or null (the undo bar after a reload). */
export const fetchLastSwipe = () => api.get<LastSwipeView | null>('/employers/swipes/last')

/** A 15-minute signed link to one document on a candidate's full profile. Spends no quota. */
export const fetchCandidateDocument = (candidateId: string, docId: string) =>
  api.get<{ url: string; expiresAt: string; name: string | null; contentType: string | null }>(
    `/employers/candidates/${candidateId}/documents/${docId}`,
  )

export async function fetchCandidateDetail(id: string): Promise<CandidateDetail> {
  return api.get<CandidateDetail>(`/employers/candidates/${id}`)
}

export async function postSwipe(candidateId: string, direction: 'RIGHT' | 'LEFT'): Promise<SwipeResult> {
  return api.post<SwipeResult>('/employers/swipes', { candidateId, direction })
}

export async function undoLastSwipe(): Promise<{ undone: boolean }> {
  return api.del<{ undone: boolean }>('/employers/swipes')
}

export async function playCandidateRecording(
  candidateId: string,
  rendition: 'LANDSCAPE' | 'PORTRAIT' = 'LANDSCAPE',
): Promise<CandidateRecordingPlay> {
  return api.post<CandidateRecordingPlay>(`/employers/candidates/${candidateId}/recording`, { rendition })
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  return api.get<SavedSearch[]>('/employers/saved-searches')
}

/** Saves (or, under a name already used, replaces) a named filter set. */
export async function saveSearch(name: string, filters: CandidateFilters): Promise<SavedSearch> {
  return api.post<SavedSearch>('/employers/saved-searches', { name, filters })
}

export async function deleteSavedSearch(id: string): Promise<void> {
  return api.del<void>(`/employers/saved-searches/${id}`)
}
