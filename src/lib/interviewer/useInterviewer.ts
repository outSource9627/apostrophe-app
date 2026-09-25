import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError } from '../api'
import { getMe, getNotifications, type Me } from '../api/account'
import { getConfig, type AppConfig } from '../api/config'
import {
  getInterviewerMe, listInterviewerInterviews, type InterviewerInterviewDto, type InterviewerMeDto,
} from '../api/interviewer'

/**
 * The interviewer's shared reads, one cache for every screen (react-query):
 *   me          GET /interviewers/me — status, profile, wallet balances and the Home fields
 *   interviews  GET /interviewers/me/interviews — the full list (refused while suspended)
 *   identity    GET /auth/me — name, email and mobile (/interviewers/me carries none)
 *   unread      GET /me/notifications — the bell's count
 *
 * Nothing is requested until the screen says it is signed in (`enabled`), so the
 * sign-in pages never fire these without a token. A refusal is surfaced as it is:
 * `mustChangePassword` (403 PASSWORD_CHANGE_REQUIRED) and `suspended` are read off
 * the error or the status, never guessed.
 */
export const INTERVIEWER_KEY = ['interviewer'] as const
const FRESH_MS = 5_000
const POLL_MS = 30_000

export const reasonOf = (e: unknown) => (e instanceof ApiClientError ? (e.meta?.reason as string | undefined) : undefined)

export function useInterviewerMe(enabled = true) {
  const q = useQuery<InterviewerMeDto>({
    queryKey: [...INTERVIEWER_KEY, 'me'],
    queryFn: getInterviewerMe,
    staleTime: FRESH_MS,
    refetchInterval: POLL_MS,
    retry: false,
    enabled,
  })
  const reason = reasonOf(q.error)
  return {
    me: q.data ?? null,
    error: q.error as Error | null,
    loading: q.isPending && enabled,
    refresh: q.refetch,
    suspended: q.data?.status === 'SUSPENDED' || reason === 'ACCOUNT_SUSPENDED',
    mustChangePassword: reason === 'PASSWORD_CHANGE_REQUIRED',
    deactivated: reason === 'ACCOUNT_DEACTIVATED',
  }
}

export function useInterviewerInterviews(enabled = true) {
  const q = useQuery<InterviewerInterviewDto[]>({
    queryKey: [...INTERVIEWER_KEY, 'interviews'],
    queryFn: listInterviewerInterviews,
    staleTime: FRESH_MS,
    refetchInterval: POLL_MS,
    retry: false,
    enabled,
  })
  return { interviews: q.data ?? null, error: q.error as Error | null, refresh: q.refetch }
}

export function useInterviewerIdentity(enabled = true): Me | null {
  const q = useQuery<Me>({ queryKey: [...INTERVIEWER_KEY, 'identity'], queryFn: getMe, staleTime: 5 * 60_000, retry: false, enabled })
  return q.data ?? null
}

export function useInterviewerUnread(enabled = true): number {
  const q = useQuery({
    queryKey: [...INTERVIEWER_KEY, 'unread'],
    queryFn: () => getNotifications({ perPage: 1 }),
    staleTime: FRESH_MS,
    refetchInterval: POLL_MS,
    retry: false,
    enabled,
  })
  return q.data?.unread ?? 0
}

/** Drops every cached interviewer read — on sign-out, so the next person never sees the last one's data. */
export function useForgetInterviewer() {
  const qc = useQueryClient()
  return () => qc.removeQueries({ queryKey: INTERVIEWER_KEY })
}

/** GET /config, once. Null until it lands; every sentence that needs a number drops it until then. */
export function useAppConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null)
  useEffect(() => {
    let alive = true
    getConfig().then((c) => alive && setConfig(c)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return config
}
