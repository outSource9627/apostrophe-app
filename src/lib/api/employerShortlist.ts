import { api } from './index'

export interface EmployerJobRef {
  id: string
  title: string
  location: string
  status: string
}

/**
 * One shortlist entry as the screen reads it.
 *
 * The server sends the entry flat (name, city, headline, experienceYears,
 * photoUrl, verifiedInterview, available, notes, tags, jobId, shortlistedAt).
 * The interview state and the linked job's title are NOT on it — they are
 * joined by the screen from /employers/interests and /employers/jobs — and the
 * server sends neither a tier nor a film length nor a field of study, so none
 * is invented here. `tier` and `qualification` are read if a newer server adds
 * them; until then they are null and the meta line simply leaves them out.
 */
export interface ShortlistRow {
  id: string
  candidateId: string
  name: string
  available: boolean
  photoUrl: string | null
  city: string | null
  headline: string | null
  experienceYears: number | null
  tier: string | null
  qualification: string | null
  verifiedInterview: { verified: boolean; at: string | null }
  notes: string
  notesUpdatedAt: string | null
  tags: string[]
  jobId: string | null
  savedAt: string
}

export interface ShortlistListResponse {
  rows: ShortlistRow[]
  total: number
  /** The unfiltered count. The server does not send one, so it is `total`. */
  totalAll?: number
  page: number
  perPage: number
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

/** The wire row: everything optional, because an older or newer server may omit any of it. */
interface WireShortlistRow {
  id: string
  candidateId: string
  name?: string | null
  city?: string | null
  headline?: string | null
  experienceYears?: number | null
  photoUrl?: string | null
  tier?: string | null
  qualification?: string | null
  verifiedInterview?: { verified?: boolean; at?: string | null } | null
  available?: boolean
  notes?: string | null
  notesUpdatedAt?: string | null
  tags?: string[] | null
  jobId?: string | null
  shortlistedAt?: string
  savedAt?: string
}

function normalizeRow(w: WireShortlistRow): ShortlistRow {
  return {
    id: w.id,
    candidateId: w.candidateId,
    name: w.name?.trim() || 'Candidate',
    available: w.available !== false,
    photoUrl: w.photoUrl ?? null,
    city: w.city ?? null,
    headline: w.headline ?? null,
    experienceYears: typeof w.experienceYears === 'number' ? w.experienceYears : null,
    tier: w.tier ?? null,
    qualification: w.qualification ?? null,
    verifiedInterview: { verified: Boolean(w.verifiedInterview?.verified), at: w.verifiedInterview?.at ?? null },
    notes: w.notes ?? '',
    notesUpdatedAt: w.notesUpdatedAt ?? null,
    tags: w.tags ?? [],
    jobId: w.jobId ?? null,
    savedAt: w.shortlistedAt ?? w.savedAt ?? '',
  }
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
  const res = await api.get<{ rows?: WireShortlistRow[]; total?: number; page?: number; perPage?: number }>(path)
  const rows = (res?.rows ?? []).map(normalizeRow)
  const total = res?.total ?? rows.length
  return { rows, total, totalAll: total, page: res?.page ?? 1, perPage: res?.perPage ?? rows.length }
}

/** The server's page ceiling for this list. */
const SHORTLIST_PAGE_MAX = 100

/**
 * Every entry, newest first. The screen filters by tag and re-sorts in memory —
 * the tag tabs need every tag on the list, and a filtered request could not
 * supply them — so it reads the whole list, a page at a time.
 */
export async function fetchAllShortlist(): Promise<ShortlistRow[]> {
  const all: ShortlistRow[] = []
  for (let page = 1; ; page++) {
    const res = await fetchShortlist({ page, perPage: SHORTLIST_PAGE_MAX })
    all.push(...res.rows)
    if (res.rows.length < SHORTLIST_PAGE_MAX || all.length >= res.total) break
  }
  return all
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
