import { api } from './index'

/**
 * The interests / connections / chat wire shapes, mirrored from apostrophe-admin
 * (src/contracts/{feed,chat}.ts and src/server/domain/chat) and kept identical to
 * the app client. The product rules these shapes carry — and that the SERVER, not
 * this file, enforces — are worth stating because the screens lean on them:
 *
 *   ONE CONNECTION CONCEPT, TWO DOORS. A Connection opens only when the student
 *   ACCEPTS an Interest, or APPLIES to an employer who had already shortlisted
 *   them (origin INTEREST | APPLICATION). There is no third way in and no follow.
 *
 *   THE EMPLOYER COUNTERPARTY IS THE COMPANY. `counterparty.name` on an employer
 *   thread is the company, never the recruiter — the recruiter only ever names
 *   themselves inside a message. A company is a square monogram, a person a circle.
 *
 *   SC-16 — THE INTERVIEWER IS MASKED until their session starts. The server sends
 *   `masked: true` and the string "Your Interviewer" (never a name or photo) right
 *   up to sessionStartedAt; the reveal is a fact of the payload, not a client toggle.
 *
 *   READING IS NEVER GATED BY STATE. Archived, not-yet-open and read-only threads
 *   all return their full history; only SENDING is refused, and the reason travels
 *   as `state.refusal` (a code), never as prose a blocked sender could read.
 */

// ── Connections (CN-02, CN-04) ───────────────────────────────────────────────
export type ConnectionStatus = 'ACTIVE' | 'CLOSED' | 'BLOCKED'
export type ConnectionOrigin = 'INTEREST' | 'APPLICATION'

export interface ConnectionRow {
  id: string
  status: ConnectionStatus
  origin: ConnectionOrigin
  openedAt: string
  closedAt: string | null
  /** `closedBy === 'STUDENT'`. A moderator-closed row reads false for BOTH sides. */
  closedByMe: boolean
  counterparty: { id: string; name: string | null; industry: string | null }
}

/**
 * status is NOT optional in effect — the server defaults it to ACTIVE, so there is
 * no "all statuses" call. Three fetches, one per status, is the only way to see
 * archived rows beside active ones (ST-42 draws all three).
 */
export const getConnections = (status: ConnectionStatus = 'ACTIVE', page = 1, perPage = 30) =>
  api.get<{ rows: ConnectionRow[]; total: number; page: number; perPage: number }>(
    '/students/me/connections',
    { query: { status, page, perPage } },
  )

export interface ConnectionActionResult {
  id: string
  status: 'CLOSED' | 'BLOCKED'
  threadsArchived: number
  suppressed: boolean
}

/**
 * There is NO STATE MACHINE server-side: WITHDRAW on a BLOCKED row silently
 * downgrades it and un-suppresses the pair. The screens must therefore never
 * offer Withdraw on a blocked row — Block is the only forward move from CLOSED.
 */
export const actOnConnection = (id: string, action: 'WITHDRAW' | 'BLOCK', reason?: string) =>
  api.patch<ConnectionActionResult>(`/students/me/connections/${id}`, reason ? { action, reason } : { action })

// ── Interests (CF-27, CF-28, CH-01) ──────────────────────────────────────────
export type InterestStatus = 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

export interface InterestRow {
  id: string
  company: { name: string; industry: string; size: string; officeLocation: string } | null
  message: string | null
  /** A resolved role LABEL (server $lookup), not the bare jobId — or null. */
  jobId: string | null
  role?: { title: string; location: string | null; employmentType: string | null } | null
  status: InterestStatus
  sentAt: string
  expiresAt: string
  respondedAt: string | null
}

/** A bare ARRAY inside data, capped at the 100 most recent, no paging. */
export const getInterests = () => api.get<InterestRow[]>('/students/me/interests')

export interface RespondResult {
  status: 'ACCEPTED' | 'DECLINED'
  connectionId: string | null
}

/**
 * NOT IDEMPOTENT — a second call is a 404 ('That interest is no longer open.').
 * Treat a 404 after a timeout as "probably succeeded" and refetch, never retry.
 */
export const respondToInterest = (id: string, response: 'ACCEPT' | 'DECLINE') =>
  api.post<RespondResult>(`/students/me/interests/${id}/respond`, { response })

// ── Threads and messages (CH-02..CH-12) ──────────────────────────────────────
export type ThreadKind = 'STUDENT_EMPLOYER' | 'STUDENT_INTERVIEWER' | 'USER_ADMIN'
export type ChatArchiveReason = 'WITHDRAWN' | 'BLOCKED' | 'EXPIRED' | 'MODERATED'
export type ChatRefusal =
  | 'NOT_CONNECTED' | 'SAME_ROLE' | 'ROLE_PAIR_NOT_PERMITTED' | 'NOT_ASSIGNED'
  | 'BLOCKED' | 'CONNECTION_CLOSED' | 'THREAD_NOT_OPEN' | 'THREAD_READ_ONLY'
  | 'THREAD_ARCHIVED' | 'NOT_A_PARTICIPANT' | 'ACCOUNT_INACTIVE' | 'EMPLOYER_NOT_VERIFIED'

export interface ThreadState {
  open: boolean
  readOnly: boolean
  archived: boolean
  refusal?: ChatRefusal
}

export interface ThreadDto {
  id: string
  kind: ThreadKind
  counterparty: { name: string; photoUrl: string | null; masked: boolean; role: string | null }
  connectionId: string | null
  interviewId: string | null
  opensAt: string | null
  readOnlyAt: string | null
  state: ThreadState
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unread: number
  archivedReason: ChatArchiveReason | null
}

export type MessageKind = 'TEXT' | 'ATTACHMENT' | 'SYSTEM'
export type SystemKind =
  | 'THREAD_OPENED' | 'THREAD_WITHDRAWN' | 'THREAD_BLOCKED' | 'THREAD_EXPIRED' | 'IDENTITY_REVEALED'

export interface MessageAttachment {
  kind: 'IMAGE' | 'DOCUMENT'
  /** Signed read URL, minted fresh per read — expires, so never cache or persist it. */
  url: string | null
  fileName: string | null
  sizeBytes: number
}

export interface MessageDto {
  id: string
  mine: boolean
  kind: MessageKind
  systemKind: SystemKind | null
  body: string | null
  attachment: MessageAttachment | null
  deliveredAt: string | null
  readAt: string | null
  createdAt: string
}

export const getThreads = (
  params: { kind?: ThreadKind; archived?: boolean; page?: number; perPage?: number } = {},
) =>
  api.get<{ rows: ThreadDto[]; total: number; page: number; perPage: number }>(
    '/students/me/messages',
    { query: { kind: params.kind, archived: params.archived ? '1' : undefined, page: params.page, perPage: params.perPage } },
  )

export interface ThreadPage {
  thread: ThreadDto
  rows: MessageDto[]
  /** Non-null only when the page came back exactly full — one extra empty fetch to be sure. */
  nextBefore: string | null
}

/** Newest first. `before` is a keyset cursor (strictly older messages). Does NOT mark read. */
export const getThread = (id: string, params: { before?: string; limit?: number } = {}) =>
  api.get<ThreadPage>(`/students/me/messages/${id}`, { query: { before: params.before, limit: params.limit } })

export interface SendAttachment {
  key: string
  contentType: string
  sizeBytes: number
  fileName?: string
}

/**
 * REST send. Mirrors the socket write path exactly, but does NOT broadcast — a
 * recipient with a live socket only sees it on refetch, so we send over the
 * socket when connected and fall back to this. Switch failures on error.meta.reason
 * (a code), never the message: a blocked sender is deliberately never told they
 * were blocked. `clientMessageId` makes a lost-response retry return the stored
 * message with duplicate:true instead of a second copy.
 */
export const sendMessage = (
  id: string,
  input: { body?: string; attachment?: SendAttachment; clientMessageId?: string },
) => api.post<{ message: MessageDto; duplicate: boolean }>(`/students/me/messages/${id}`, input)

/** Marks the thread read up to now. `read` is a delta (0 on a second call), not a total. */
export const markThreadRead = (id: string) =>
  api.patch<{ read: number; at: string }>(`/students/me/messages/${id}`)

export interface MessageSearchHit {
  id: string
  threadId: string
  body: string | null
  mine: boolean
  createdAt: string
}

/** $text on the body index only — whole-word stemmed, attachments/system lines never match. */
export const searchMessages = (q: string, params: { threadId?: string; limit?: number } = {}) =>
  api.get<{ rows: MessageSearchHit[] }>('/students/me/messages/search', {
    query: { q, threadId: params.threadId, limit: params.limit },
  })

/**
 * connection → thread. The connections list carries no threadId; the thread list
 * carries connectionId. So "Open chat" from a Connection or a CONNECTED application
 * resolves by finding the (employer) thread whose connectionId matches. Archived
 * threads are excluded by default, so a withdrawn/blocked row falls through to null
 * and the caller lands on the list instead of a dead route.
 */
export async function threadIdForConnection(connectionId: string): Promise<string | null> {
  for (const archived of [false, true]) {
    const page = await getThreads({ kind: 'STUDENT_EMPLOYER', archived, perPage: 50 })
    const hit = page.rows.find((t) => t.connectionId === connectionId)
    if (hit) return hit.id
  }
  return null
}

// ── Reporting (CH-11) ─────────────────────────────────────────────────────────
export type ReportReason =
  | 'HARASSMENT' | 'SPAM' | 'SCAM_OR_FRAUD' | 'OFF_PLATFORM_PAYMENT'
  | 'INAPPROPRIATE_CONTENT' | 'IMPERSONATION' | 'OTHER'

/**
 * Files a moderation report against a whole conversation (or one message),
 * freezing the reported line as evidence. Reporting is the control — phone
 * numbers and emails are deliberately never redacted (CH-12). One report per
 * reporter per message; a repeat is a CONFLICT with meta.reason ALREADY_REPORTED.
 */
export const reportThread = (threadId: string, reason: ReportReason, note?: string) =>
  api.post<{ id: string }>('/me/reports', { target: 'THREAD', threadId, reason, note })

export const reportMessage = (threadId: string, messageId: string, reason: ReportReason, note?: string) =>
  api.post<{ id: string }>('/me/reports', { target: 'MESSAGE', threadId, messageId, reason, note })
