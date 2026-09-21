import { api, tokenStore } from './index'

/**
 * The account / notifications / data-rights wire shapes (F09), mirrored from
 * apostrophe-admin and kept identical to the app client. Everything here is on
 * the CROSS-ROLE `/me/**` surface (notifications, prefs, devices, deletion,
 * export) or `/auth/**`, so none of it is behind the ST-12 paywall — an unpaid
 * student is exactly who needs to read a `payment.failed` notice or erase their
 * registration.
 */

// ── Identity (ST-49) ─────────────────────────────────────────────────────────
export interface Me {
  id: string
  role: 'STUDENT' | 'EMPLOYER' | 'INTERVIEWER'
  name?: string
  email?: string
  mobile?: string
  emailVerified?: boolean
  mobileVerified?: boolean
}
export const getMe = () => api.get<Me>('/auth/me')

/** Re-send the email verification link. The address is the account's own. */
export const resendVerificationEmail = (email: string) =>
  api.post<{ sent: boolean } | Record<string, never>>('/auth/email/resend', { email })

/**
 * Revoke every live refresh token in this family (sign out). The route requires
 * { refreshToken } in the body (and reads no Authorization header), so a bodyless
 * POST 400s and revokes nothing — send the stored token, anonymously.
 */
export const logout = async () => {
  const t = await tokenStore.get()
  return api.post<Record<string, never>>('/auth/logout', { refreshToken: t?.refreshToken ?? '' }, { anonymous: true })
}

// ── Notifications (ST-46, NT-02) ─────────────────────────────────────────────
export type NotificationCategory =
  | 'ACCOUNT' | 'PAYMENT' | 'INTERVIEW' | 'CONNECTION' | 'MESSAGE' | 'APPLICATION' | 'JOB' | 'MARKETING'
export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL'

export interface NotificationRow {
  id: string
  /** The dotted stable event name, e.g. 'payment.failed', 'interview.reminder.1h'. */
  kind: string
  category: NotificationCategory
  title: string
  body: string | null
  /** Deep-link ids (threadId, interviewId, …) or null. Already-rendered copy — never re-template. */
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

export const getNotifications = (
  params: { unreadOnly?: boolean; category?: NotificationCategory; page?: number; perPage?: number } = {},
) =>
  api.get<{ rows: NotificationRow[]; total: number; unread: number; page: number; perPage: number }>(
    '/me/notifications',
    { query: { unreadOnly: params.unreadOnly ? '1' : undefined, category: params.category, page: params.page, perPage: params.perPage } },
  )

/**
 * Mark read. Passing an explicit id list marks those; passing NOTHING marks
 * everything. CAUTION: an empty array `[]` is treated as "everything" server-side
 * — so only send `ids` when it is non-empty.
 */
export const markNotificationsRead = (ids?: string[]) =>
  api.patch<{ updated: number }>('/me/notifications', ids && ids.length ? { ids } : {})

// ── Notification preferences (ST-47, NT-05) ──────────────────────────────────
export interface PrefRow {
  category: NotificationCategory
  /** true on ACCOUNT / PAYMENT / INTERVIEW — the three that cannot be switched off. */
  locked: boolean
  channels: Record<NotificationChannel, boolean>
}

/** A bare array of 8 rows. Human labels are NOT in the payload — see CATEGORY_LABELS. */
export const getNotificationPrefs = () => api.get<PrefRow[]>('/me/notification-prefs')

/**
 * Merge per-cell changes. Disabling a locked category on any channel is refused
 * whole-batch (VALIDATION, error.fields keyed CATEGORY.CHANNEL) — never offer it.
 */
export const putNotificationPrefs = (changes: { category: NotificationCategory; channel: NotificationChannel; enabled: boolean }[]) =>
  api.put<PrefRow[]>('/me/notification-prefs', { changes })

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  ACCOUNT: 'Account and security',
  PAYMENT: 'Payments and receipts',
  INTERVIEW: 'Interview scheduling',
  CONNECTION: 'Interests and connections',
  MESSAGE: 'Messages',
  APPLICATION: 'Job applications',
  JOB: 'Your job posts',
  MARKETING: 'News and offers',
}
export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: 'In app',
  PUSH: 'Push',
  EMAIL: 'Email',
}
export const CHANNEL_ORDER: NotificationChannel[] = ['PUSH', 'EMAIL', 'IN_APP']

// ── Push devices (NT / ST-47b) ───────────────────────────────────────────────
export const registerDevice = (token: string, platform: string) =>
  api.post<{ ok: boolean } | Record<string, never>>('/me/devices', { token, platform })
export const unregisterDevice = (token: string) =>
  api.del<Record<string, never>>('/me/devices', { query: { token } })

// ── Data rights (ST-50, AD-10 / AD-11) ───────────────────────────────────────
export type DeletionStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'

export interface DeletionRequest {
  id: string
  userId?: string
  role?: string
  status: DeletionStatus
  source?: string
  requestedAt: string
  dueAt: string
  completedAt?: string
  cancelledAt?: string
  error?: string | null
  /** Per-collection record once the purge has run. */
  steps?: Record<string, unknown>
}

/** The state of my own most recent request, or null if I have never asked. */
export const getDeletion = () => api.get<DeletionRequest | null>('/me/deletion')

/**
 * Request deletion. `confirm` must match this account's own name, mobile or email
 * (a server-side safety) — the CLIENT supplies it from the known identity, so the
 * student confirms with one button, never by typing DELETE (ST-50 rule 6).
 */
export const requestDeletion = (confirm: string, reason?: string) =>
  api.post<{ id: string; status: DeletionStatus; requestedAt: string; dueAt: string }>(
    '/me/deletion',
    reason ? { confirm, reason } : { confirm },
  )

/** Cancel a PENDING request inside the grace window — restores the snapshot. */
export const cancelDeletion = () => api.del<{ id: string; status: DeletionStatus }>('/me/deletion')

export type DataExportStatus = 'PENDING' | 'READY' | 'FAILED' | 'EXPIRED'
export interface DataExportRow {
  id: string
  status: DataExportStatus
  requestedAt: string
  readyAt?: string
  sizeBytes?: number
  /** Short-lived signed link, minted per read — never cache or persist it. */
  url?: string
  error?: string | null
}

/** This account's exports, newest first (max 20). */
export const getDataExports = () => api.get<{ rows: DataExportRow[] }>('/me/data-export')

/** Queue a background export. One PENDING at a time (409 otherwise). */
export const requestDataExport = () =>
  api.post<{ id: string; status: DataExportStatus; requestedAt: string; dueAt: string }>('/me/data-export')

// ── Audience / stats (ST-48) ─────────────────────────────────────────────────
export interface Audience {
  shortlistCount: number
  profileViews: number
  openInterests: number
  hiddenFromFeed: boolean
  published: boolean
}
/**
 * Aggregate counters only — how MANY employers shortlisted you, never WHICH
 * (ST-48 / rule 3). A shortlist fires no notification and surfaces as no event;
 * only the number moves.
 */
export const getAudience = () => api.get<Audience>('/students/me/audience')
