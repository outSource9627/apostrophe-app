import { api } from './index'

/**
 * The job-feed wire shapes — byte-identical to the web client
 * (apostrophe-user lib/api/jobs.ts). Web and app are the same product. Two
 * server-enforced rules shape the flow: a SWIPE NEVER APPLIES (RIGHT saves,
 * LEFT suppresses 60 days), and APPLYING NEEDS A PUBLISHED VIDEO RESUME
 * (JF-19 → FORBIDDEN PROFILE_NOT_PUBLISHED when the interview is not done).
 */
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP' | 'CONTRACT' | 'REMOTE' | 'HYBRID'
export type ApplicationStatus = 'APPLIED' | 'VIEWED' | 'SHORTLISTED' | 'REJECTED' | 'CONNECTED'

export interface JobCard {
  id: string
  title: string
  company: { name: string; industry?: string; size?: string | null; officeLocation?: string | null }
  category: string
  department?: string | null
  location: string
  remote: boolean
  employmentType: EmploymentType
  vacancies: number
  minQualification?: string
  experience: { minYears: number; maxYears?: number | null }
  salary: { minPaise: number; maxPaise: number }
  joiningPreference?: string | null
  skills: string[]
  applicationDeadline?: string | null
  publishedAt?: string | null
  video?: { url: string | null; durationSec: number } | null
  saved: boolean
  applicationStatus: ApplicationStatus | null
}
export interface JobDetail extends JobCard {
  description: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  application: { status: ApplicationStatus; rejectionReason: string | null; appliedAt: string } | null
}
export interface JobFilters {
  keyword?: string; location?: string; remote?: boolean; minSalaryPaise?: number
  employmentType?: EmploymentType; industry?: string; maxExperienceYears?: number; company?: string
}
export interface SavedRow {
  id: string; jobId: string; title: string; company: { name: string; industry?: string }
  location: string; remote: boolean; employmentType: EmploymentType
  salary: { minPaise: number; maxPaise: number } | null
  applicationDeadline?: string | null; hasVideo: boolean; status: string | null
  open: boolean; applicationStatus: ApplicationStatus | null; savedAt: string
}
export interface ApplicationRow {
  id: string; jobId: string; title: string; company: { name: string }
  location: string; remote: boolean; employmentType: EmploymentType
  salary: { minPaise: number; maxPaise: number } | null
  status: ApplicationStatus; statusLabel: string; rejectionReason: string | null
  connectionId: string | null; appliedAt: string
}
export interface ApplyResult { id: string; jobId: string; status: 'APPLIED' | 'CONNECTED'; connectionId: string | null; appliedAt: string }
export interface SwipeResult { direction: 'RIGHT' | 'LEFT'; jobId: string; applied: boolean; suppressedUntil: string | null; application: null }

export const getFeed = (params: JobFilters & { limit?: number; cursor?: string; ignoreSavedFilters?: boolean } = {}) =>
  api.get<{ cards: JobCard[]; nextCursor: string | null; filters: JobFilters }>('/students/me/jobs', { query: cleanQuery(params) })
export const getJob = (id: string) => api.get<JobDetail>(`/students/me/jobs/${id}`)
export const applyToJob = (id: string, message?: string) =>
  api.post<ApplyResult>(`/students/me/jobs/${id}/apply`, message ? { message } : {})
export const swipeJob = (jobId: string, direction: 'RIGHT' | 'LEFT') =>
  api.post<SwipeResult>('/students/me/jobs/swipes', { jobId, direction })
export const undoSwipe = () => api.del<{ undone: 'RIGHT' | 'LEFT' | null; jobId: string | null }>('/students/me/jobs/swipes')
export const getSaved = (page = 1, perPage = 30) =>
  api.get<{ rows: SavedRow[]; total: number; page: number; perPage: number }>('/students/me/jobs/saved', { query: { page, perPage } })
export const removeSaved = (savedRowId: string) => api.del<{ id: string; jobId: string }>(`/students/me/jobs/saved/${savedRowId}`)
export const getApplications = (status?: ApplicationStatus, page = 1, perPage = 30) =>
  api.get<{ rows: ApplicationRow[]; total: number; page: number; perPage: number }>('/students/me/applications', { query: cleanQuery({ status, page, perPage }) })
export const getFilters = () => api.get<{ filters: JobFilters }>('/students/me/job-filters')
export const putFilters = (filters: JobFilters) => api.put<{ filters: JobFilters }>('/students/me/job-filters', { filters })
export const clearFilters = () => api.del<{ cleared: boolean }>('/students/me/job-filters')

function cleanQuery(params: object): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v as string | number | boolean
  }
  return out
}
