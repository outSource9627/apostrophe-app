import { api } from './index'

export type JobStatus = 'DRAFT' | 'PENDING_MODERATION' | 'PUBLISHED' | 'PAUSED' | 'CLOSED'

export const EMPLOYER_JOB_STATUS_LABEL: Record<JobStatus, string> = {
  DRAFT: 'Draft',
  PENDING_MODERATION: 'Pending review',
  PUBLISHED: 'Published',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
}

export type ApplicationStatus = 'APPLIED' | 'VIEWED' | 'SHORTLISTED' | 'REJECTED' | 'CONNECTED'

export const EMPLOYER_APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  VIEWED: 'Viewed',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
  CONNECTED: 'Connected',
}

export interface EmployerJobRow {
  id: string
  title: string
  category: string | null
  location: string | null
  remote: boolean
  employmentType: string | null
  status: JobStatus
  statusLabel: string
  applicationDeadline: string | null
  deadlinePassed: boolean
  counters: {
    views: number
    saves: number
    applications: number
    shortlisted: number
  }
  video?: { durationSec: number; url?: string | null } | null
  moderation: {
    submittedAt: string | null
    reason: string | null
  }
  firstIncompleteStep?: string | null
  publishedAt: string | null
  pausedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployerJobDetail extends EmployerJobRow {
  department?: string | null
  vacancies: number
  description: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  requiredSkills: string[]
  minQualification?: string
  experienceMinYears: number
  experienceMaxYears?: number
  salaryMinPaise: number
  salaryMaxPaise: number
  joiningPreference?: string | null
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
  requiredSkills?: string[]
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
}

export type JobPatchInput = Partial<JobDraftInput>

export interface ApplicationCandidateSummary {
  id: string
  name: string
  city: string | null
  headline: string | null
  photoUrl: string | null
  experienceYears: number
  skills: string[]
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
  statusLabel: string
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
  }
  candidate: {
    id: string
    name: string
    city: string | null
    qualification?: string | null
    experienceYears: number
    skills: string[]
    photoUrl: string | null
    verifiedInterview: {
      verified: boolean
      at: string | null
    }
    available: boolean
  } | null
  message: string | null
  status: ApplicationStatus
  statusLabel: string
  rejectionReason: string | null
  appliedAt: string
  connected: boolean
  threadId?: string | null
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

export async function updateApplicationStatus(
  applicationId: string,
  input: {
    to: 'SHORTLISTED' | 'REJECTED' | 'CONNECTED'
    from?: ApplicationStatus
    reason?: string
  },
): Promise<{ id: string; status: ApplicationStatus }> {
  return api.patch<{ id: string; status: ApplicationStatus }>(`/employers/applications/${applicationId}`, {
    to: input.to,
    from: input.from,
    reason: input.reason,
  })
}
