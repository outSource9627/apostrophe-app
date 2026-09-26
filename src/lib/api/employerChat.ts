import { api } from './index'
import type {
  ConnectionStatus,
  ConnectionOrigin,
  ConnectionActionResult,
  ThreadKind,
  ChatArchiveReason,
  ChatRefusal,
  ThreadState,
  ThreadDto,
  MessageKind,
  SystemKind,
  MessageAttachment,
  MessageDto,
  ThreadPage,
  SendAttachment,
  MessageSearchHit,
  ReportReason,
} from './chat'

export type {
  ConnectionStatus,
  ConnectionOrigin,
  ConnectionActionResult,
  ThreadKind,
  ChatArchiveReason,
  ChatRefusal,
  ThreadState,
  ThreadDto,
  MessageKind,
  SystemKind,
  MessageAttachment,
  MessageDto,
  ThreadPage,
  SendAttachment,
  MessageSearchHit,
  ReportReason,
}

// ── Connections (EM-24, CN-02, CN-04, CN-05) ───────────────────────────────────

export interface EmployerConnectionRow {
  id: string
  status: ConnectionStatus
  origin: ConnectionOrigin
  openedAt: string
  closedAt: string | null
  closedByMe: boolean
  threadId: string | null
  interviewedAt: string | null
  counterparty: { id: string; name: string | null; industry: string | null }
  /**
   * The candidate's contact details, shared once connected (EM-24). The API does not send them today;
   * a row shows them only when it does, and never asks for them separately.
   */
  contact?: { email?: string | null; mobile?: string | null } | null
}

export const getEmployerConnections = (
  params: {
    status?: ConnectionStatus
    statuses?: ConnectionStatus[]
    page?: number
    perPage?: number
  } = {},
) =>
  api.get<{ rows: EmployerConnectionRow[]; total: number; page: number; perPage: number }>(
    '/employers/connections',
    {
      query: {
        status: params.status,
        statuses: params.statuses?.join(','),
        page: params.page ?? 1,
        perPage: params.perPage ?? 30,
      },
    },
  )

export const actOnEmployerConnection = (
  id: string,
  action: 'WITHDRAW' | 'BLOCK',
  reason?: string,
) =>
  api.patch<ConnectionActionResult>(
    `/employers/connections/${id}`,
    reason ? { action, reason } : { action },
  )

// ── Threads and Messages (EM-25, EM-26, CH-02..CH-12) ──────────────────────────

export const getEmployerThreads = (
  params: { kind?: ThreadKind; archived?: boolean; page?: number; perPage?: number } = {},
) =>
  api.get<{ rows: ThreadDto[]; total: number; page: number; perPage: number }>(
    '/employers/messages',
    {
      query: {
        kind: params.kind,
        archived: params.archived ? '1' : undefined,
        page: params.page ?? 1,
        perPage: params.perPage ?? 30,
      },
    },
  )

export const getEmployerThread = (
  id: string,
  params: { before?: string; limit?: number } = {},
) =>
  api.get<ThreadPage>(`/employers/messages/${id}`, {
    query: { before: params.before, limit: params.limit },
  })

export const sendEmployerMessage = (
  id: string,
  input: { body?: string; attachment?: SendAttachment; clientMessageId?: string },
) =>
  api.post<{ message: MessageDto; duplicate: boolean }>(
    `/employers/messages/${id}`,
    input,
  )

export const markEmployerThreadRead = (id: string) =>
  api.patch<{ read: number; at: string }>(`/employers/messages/${id}`)

export const searchEmployerMessages = (
  q: string,
  params: { threadId?: string; limit?: number } = {},
) =>
  api.get<{ rows: MessageSearchHit[] }>('/employers/messages/search', {
    query: { q, threadId: params.threadId, limit: params.limit },
  })

export async function threadIdForEmployerConnection(connectionId: string): Promise<string | null> {
  for (const archived of [false, true]) {
    const page = await getEmployerThreads({ kind: 'STUDENT_EMPLOYER', archived, perPage: 50 })
    const hit = page.rows.find((t) => t.connectionId === connectionId)
    if (hit) return hit.id
  }
  return null
}

// ── Reporting (CH-11) ─────────────────────────────────────────────────────────

export const reportEmployerThread = (threadId: string, reason: ReportReason, note?: string) =>
  api.post<{ id: string }>('/me/reports', { target: 'THREAD', threadId, reason, note })

export const reportEmployerMessage = (
  threadId: string,
  messageId: string,
  reason: ReportReason,
  note?: string,
) =>
  api.post<{ id: string }>('/me/reports', { target: 'MESSAGE', threadId, messageId, reason, note })

// ── Support (EM-27, EM-25) ────────────────────────────────────────────────────

/** Opens (creating on first use) the caller's one support conversation and returns its thread id. */
export const openEmployerSupport = () =>
  api.get<{ threadId: string }>('/me/support', { query: { limit: 1 } })
