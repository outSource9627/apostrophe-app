import { api } from './index'

export type JobStatus = 'DRAFT' | 'PENDING_MODERATION' | 'PUBLISHED' | 'PAUSED' | 'CLOSED'

export type ApplicationStatus = 'APPLIED' | 'VIEWED' | 'SHORTLISTED' | 'REJECTED' | 'CONNECTED'

export const EMPLOYER_APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  VIEWED: 'Viewed',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
  CONNECTED: 'Connected',
}

/**
 * The wire shape is `toEmployerJobDto` (apostrophe-admin, src/server/domain/jobs.ts).
 * It carries no status label, no deadline flag and no paused/closed timestamps —
 * the screens derive what they need (see app/employers/jobs/jobParts.tsx).
 */
export interface EmployerJobRow {
  id: string
  title: string
  category: string | null
  department: string | null
  vacancies: number
  location: string | null
  remote: boolean
  employmentType: string | null
  minQualification: string | null
  experience: { minYears: number; maxYears: number | null }
  salary: { minPaise: number; maxPaise: number }
  joiningPreference: string | null
  applicationDeadline: string | null
  hasVideo: boolean
  status: JobStatus
  moderation: {
    submittedAt: string | null
    decidedAt: string | null
    reason: string | null
  }
  counters: {
    views: number
    saves: number
    applications: number
    shortlisted: number
  }
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployerJobDetail extends EmployerJobRow {
  description: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  /** Master-data ids, not names — there is no endpoint that resolves them for an employer. */
  requiredSkills: string[]
  video: { durationSec: number; uploadedAt: string; url: string | null } | null
}

export interface EmployerJobListResponse {
  rows: EmployerJobRow[]
  total: number
  page: number
  perPage: number
  counts: Partial<Record<JobStatus, number>>
}

export interface JobDraftInput {
  title: string
  category: string
  department?: string
  vacancies?: number
  description: string
  responsibilities?: string[]
  requirements?: string[]
  benefits?: string[]
  minQualification: string
  experienceMinYears?: number
  experienceMaxYears?: number
  salaryMinPaise: number
  salaryMaxPaise: number
  location: string
  remote?: boolean
  employmentType: string
  joiningPreference?: string
  applicationDeadline?: string
  /** `null` removes the video; omit to leave it as it is. */
  video?: { key: string; durationSec: number } | null
}

export type JobPatchInput = Partial<JobDraftInput>

export interface ApplicationCandidateSummary {
  id: string
  name: string
  city: string | null
  headline: string | null
  photoUrl: string | null
  experienceYears: number
  verifiedInterview: {
    verified: boolean
    at: string | null
  }
  available: boolean
}

export interface ApplicationRow {
  id: string
  candidate: ApplicationCandidateSummary | null
  message: string | null
  status: ApplicationStatus
  rejectionReason: string | null
  hasVideoResume: boolean
  connected: boolean
  appliedAt: string
}

export interface JobApplicationsResponse {
  job: { id: string; title: string }
  rows: ApplicationRow[]
  total: number
  page: number
  perPage: number
  counts: Partial<Record<ApplicationStatus, number>>
}

export interface ApplicationDetail {
  id: string
  job: {
    id: string
    title: string
    category: string
    location: string
    employmentType: string
  } | null
  candidate: {
    id: string
    name: string
    removed: boolean
    city: string | null
    qualification: string | null
    tier: string | null
    languages: string[]
    education: {
      qualification?: string
      institution?: string
      fieldOfStudy?: string
      yearOfCompletion?: number
      scoreType?: string
      score?: number
    } | null
    experience: { company?: string; role?: string; from?: string; to?: string; description?: string }[]
    experienceYears: number
    skills: string[]
    preferences: {
      desiredRoles: string[]
      preferredLocations: string[]
      expectedSalaryMinPaise?: number
      expectedSalaryMaxPaise?: number
      employmentTypes: string[]
      availabilityToJoin?: string
    } | null
    portfolioLinks: string[]
    photoUrl: string | null
    verifiedInterview: {
      verified: boolean
      at: string | null
    }
    available: boolean
  }
  message: string | null
  videoResumeId: string | null
  status: ApplicationStatus
  rejectionReason: string | null
  statusHistory: { status: ApplicationStatus; at: string; by: string }[]
  connected: boolean
  appliedAt: string
}

export async function fetchEmployerJobs(query: {
  status?: JobStatus
  page?: number
  perPage?: number
} = {}): Promise<EmployerJobListResponse> {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.page) params.set('page', String(query.page))
  if (query.perPage) params.set('perPage', String(query.perPage))

  const qs = params.toString()
  return api.get<EmployerJobListResponse>(qs ? `/employers/jobs?${qs}` : '/employers/jobs')
}

export async function fetchEmployerJobDetail(jobId: string): Promise<EmployerJobDetail> {
  return api.get<EmployerJobDetail>(`/employers/jobs/${jobId}`)
}

export async function createEmployerJob(draft: JobDraftInput): Promise<EmployerJobRow> {
  return api.post<EmployerJobRow>('/employers/jobs', draft)
}

export async function updateEmployerJob(jobId: string, patch: JobPatchInput): Promise<EmployerJobRow> {
  return api.patch<EmployerJobRow>(`/employers/jobs/${jobId}`, patch)
}

export async function deleteEmployerJob(jobId: string): Promise<{ id: string; status: string }> {
  return api.del<{ id: string; status: string }>(`/employers/jobs/${jobId}`)
}

export async function submitEmployerJob(jobId: string): Promise<EmployerJobRow> {
  return api.post<EmployerJobRow>(`/employers/jobs/${jobId}/submit`)
}

export async function setEmployerJobStatus(
  jobId: string,
  action: 'PAUSE' | 'RESUME' | 'CLOSE',
): Promise<EmployerJobRow> {
  return api.post<EmployerJobRow>(`/employers/jobs/${jobId}/status`, { action })
}

export async function fetchJobApplications(
  jobId: string,
  query: { status?: ApplicationStatus; page?: number; perPage?: number } = {},
): Promise<JobApplicationsResponse> {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.page) params.set('page', String(query.page))
  if (query.perPage) params.set('perPage', String(query.perPage))

  const qs = params.toString()
  return api.get<JobApplicationsResponse>(`/employers/jobs/${jobId}/applications${qs ? `?${qs}` : ''}`)
}

export async function fetchApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  return api.get<ApplicationDetail>(`/employers/applications/${applicationId}`)
}

/**
 * CONNECTED is not settable by an employer (the server refuses it): a chat opens
 * only through the student's own act. A rejection carries the reason the student reads.
 */
export async function updateApplicationStatus(
  applicationId: string,
  input: { status: 'VIEWED' | 'SHORTLISTED' | 'REJECTED'; rejectionReason?: string },
): Promise<{ id: string; status: ApplicationStatus; changed: boolean }> {
  return api.patch<{ id: string; status: ApplicationStatus; changed: boolean }>(
    `/employers/applications/${applicationId}`,
    input,
  )
}
