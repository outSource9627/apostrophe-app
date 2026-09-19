import { api } from './index'

export interface EmployerJobRef {
  id: string
  title: string
  location: string
  status: string
}

export interface ShortlistCandidateSummary {
  posterUrl: string | null
  durationSec: number | null
  qualification: string | null
  tier: string | null
  city: string | null
  skills: string[]
  expectedSalary: { minPaise: number | null; maxPaise: number | null }
  availability: string | null
  verifiedInterview: { verified: boolean; at: string | null }
}

export interface EmployerInterestState {
  id: string
  outcome: 'SENT' | 'ACCEPTED' | 'NOT_ACCEPTED'
  sentAt: string
  expiresAt: string
  nextEligibleAt: string | null
  jobId: string | null
}

export interface ShortlistRow {
  id: string
  candidateId: string
  name: string
  available: boolean
  candidate: ShortlistCandidateSummary | null
  notes: string
  notesUpdatedAt: string | null
  tags: string[]
  job: EmployerJobRef | null
  savedAt: string
  interest: EmployerInterestState | null
  connection: { threadId: string | null } | null
}

export interface ShortlistListResponse {
  rows: ShortlistRow[]
  total: number
  totalAll?: number
  page: number
  perPage: number
  facets?: {
    tags: string[]
    jobs: EmployerJobRef[]
  }
}

export interface ShortlistQuery {
  tag?: string
  jobId?: string
  sort?: 'ADDED' | 'INTERVIEWED'
  page?: number
  perPage?: number
}

export interface ShortlistPatchInput {
  notes?: string
  tags?: string[]
  jobId?: string | null
}

export interface ShortlistExportInput {
  ids?: string[]
  tag?: string
  jobId?: string
  sort?: 'ADDED' | 'INTERVIEWED'
}

export interface ShortlistExportResult {
  url: string
  expiresAt: string
  filename: string
  rows: number
}

export async function fetchShortlist(query: ShortlistQuery = {}): Promise<ShortlistListResponse> {
  const params = new URLSearchParams()
  if (query.tag) params.set('tag', query.tag)
  if (query.jobId) params.set('jobId', query.jobId)
  if (query.sort) params.set('sort', query.sort)
  if (query.page) params.set('page', String(query.page))
  if (query.perPage) params.set('perPage', String(query.perPage))

  const qs = params.toString()
  const path = qs ? `/employers/shortlist?${qs}` : '/employers/shortlist'
  return api.get<ShortlistListResponse>(path)
}

export async function updateShortlistEntry(
  shortlistId: string,
  patch: ShortlistPatchInput,
): Promise<{ id: string; candidateId: string; notes: string | null; tags: string[]; jobId: string | null }> {
  return api.patch<{ id: string; candidateId: string; notes: string | null; tags: string[]; jobId: string | null }>(
    `/employers/shortlist/${shortlistId}`,
    patch,
  )
}

export async function removeFromShortlist(shortlistId: string): Promise<{ id: string; candidateId: string }> {
  return api.del<{ id: string; candidateId: string }>(`/employers/shortlist/${shortlistId}`)
}

export async function exportShortlist(input: ShortlistExportInput = {}): Promise<ShortlistExportResult> {
  return api.post<ShortlistExportResult>('/employers/shortlist/export', input)
}
