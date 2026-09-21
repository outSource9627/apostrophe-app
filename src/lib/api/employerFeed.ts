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

export interface CandidateDetail extends CandidateCard {
  education: {
    qualification?: string
    fieldOfStudy?: string
    institution?: string
    year?: number
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
  preferences: {
    employmentTypes?: string[]
    remote?: boolean
    preferredLocations?: string[]
    targetRoles?: string[]
  } | null
  portfolioLinks: Array<{ label?: string; url: string }>
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
    kind: string
    name: string | null
    contentType: string | null
    sizeBytes: number | null
  }>
  limits?: EmployerLimitsView
  connection?: { active: boolean; threadId: string | null } | null
}

export interface CandidateFeedResponse {
  items: CandidateCard[]
  nextCursor: string | null
}

export interface CandidateFeedQuery {
  city?: string
  skill?: string
  language?: string
  availability?: string
  minExperienceYears?: number
  maxExpectedSalaryPaise?: number
  savedSearchId?: string
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

export interface SavedSearch {
  id: string
  name: string
  filters: CandidateFeedQuery
  createdAt: string
}

export async function fetchCandidateFeed(query?: CandidateFeedQuery): Promise<CandidateFeedResponse> {
  const params: string[] = []
  if (query?.city) params.push(`city=${encodeURIComponent(query.city)}`)
  if (query?.skill) params.push(`skill=${encodeURIComponent(query.skill)}`)
  if (query?.language) params.push(`language=${encodeURIComponent(query.language)}`)
  if (query?.availability) params.push(`availability=${encodeURIComponent(query.availability)}`)
  if (query?.minExperienceYears != null) params.push(`minExperienceYears=${query.minExperienceYears}`)
  if (query?.maxExpectedSalaryPaise != null) params.push(`maxExpectedSalaryPaise=${query.maxExpectedSalaryPaise}`)
  if (query?.savedSearchId) params.push(`savedSearchId=${query.savedSearchId}`)
  if (query?.limit != null) params.push(`limit=${query.limit}`)
  if (query?.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`)

  const qs = params.length > 0 ? `?${params.join('&')}` : ''
  return api.get<CandidateFeedResponse>(`/employers/candidates${qs}`)
}

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

export async function saveSearch(name: string, filters: CandidateFeedQuery): Promise<SavedSearch> {
  return api.post<SavedSearch>('/employers/saved-searches', { name, filters })
}

export async function deleteSavedSearch(id: string): Promise<void> {
  return api.del<void>(`/employers/saved-searches/${id}`)
}
