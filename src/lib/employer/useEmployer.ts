import { useCallback, useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ApiClientError, ErrorCode } from '../api'
import { getMe, type Me } from '../api/account'
import {
  employerSession, getEmployerMe, onEmployerSessionChange, type EmployerMe, type EmployerState,
} from '../api/employer'
import { EMPLOYER_ROUTES, verificationPrompt, type PromptCopy } from './state'
import type { RootStackParamList } from '../../../App'

/**
 * The employer's own state, shared by every screen and kept live while they
 * are unverified — the app half of the web hook (apostrophe-user
 * lib/employer/useEmployer.ts), on react-query.
 *
 * ONE CACHE ENTRY, NOT ONE FETCH PER COMPONENT. The shell draws the prompt from
 * this and the screen under it draws its rows from this, and the two must never
 * disagree for a poll's worth of time — a prompt saying "In review" above a row
 * saying "Rejected" is the screen lying. Every caller reads the same query.
 *
 * ONE POLLER. react-query gives every observer its own interval timer, and a
 * stack of employer screens mounts several observers, so `refetchInterval` is
 * set on exactly one of them: the first hook on the route in front. Every 15
 * seconds while the app is in the foreground, plus on returning to the
 * foreground and on an employer screen gaining focus — and only while the
 * account is not verified.
 *
 * APPROVAL LANDS ON THE LIVE SCREEN. When a read sees not-verified become
 * verified, the route in front is recorded, and `justVerified` is true on that
 * screen until it loses focus. There is no sign-out and no token reissue: the
 * server's gate re-reads the decision on every request, so the token they hold
 * already works.
 *
 * Once verified, polling stops. A verified employer's documents do not change
 * under them, and a phone polling for nothing is a phone losing battery.
 */

const POLL_MS = 15_000
/** A read younger than this is not repeated on focus or on foreground. */
const FRESH_MS = 5_000

/** The cache key, per employer session — see `employerSession` in the API module. */
export const employerQueryKey = (session: number) => ['employer', 'me', session] as const

/** A 403 that /auth/me explains: this account is not an employer at all. */
export class NotEmployerError extends Error {
  constructor(readonly role: Me['role']) {
    super('This account is not an employer account.')
    this.name = 'NotEmployerError'
  }
}

// ── App-wide facts about the employer screens ────────────────────────────────
/*
  Module state rather than component state. The screen that WATCHED approval,
  and which hook polls, are facts about the app, not about whichever of several
  mounted hooks happened to run a read.
*/
const shell = {
  /** The route key of the employer screen in front, or null. */
  focusedKey: null as string | null,
  /** The route key a not-verified → verified flip was observed on. */
  flippedOn: null as string | null,
  /** The one hook instance carrying `refetchInterval`, and the route it is on. */
  pollerId: null as string | null,
  pollerRoute: null as string | null,
}
const listeners = new Set<() => void>()

function patch(next: Partial<typeof shell>) {
  Object.assign(shell, next)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const readFlippedOn = () => shell.flippedOn
const readPollerId = () => shell.pollerId

/** Record a not-verified → verified change against the screen in front. */
function observe(prev: EmployerState | undefined, next: EmployerState) {
  if (prev && !prev.verified && next.verified) patch({ flippedOn: shell.focusedKey })
}

// A new session is a new employer: nothing the last one watched carries over.
onEmployerSessionChange(() => patch({ flippedOn: null }))

async function fetchEmployer(qc: QueryClient, session: number): Promise<EmployerMe> {
  try {
    const next = await getEmployerMe()
    // Read AFTER the request, so a state `apply` landed meanwhile is the one
    // compared — otherwise a poll that left before approval re-announces it.
    observe(qc.getQueryData<EmployerMe>(employerQueryKey(session)), next)
    return next
  } catch (e) {
    // 403 is either the wrong kind of account or a suspended one. Only /auth/me
    // can say which, and only the first earns a redirect.
    if (e instanceof ApiClientError && e.code === ErrorCode.FORBIDDEN) {
      const me = await getMe().catch(() => null)
      if (me && me.role !== 'EMPLOYER') throw new NotEmployerError(me.role)
    }
    throw e
  }
}

/** An answer more polling cannot change: signed out, not an employer, suspended. */
const settledError = (e: unknown) =>
  e instanceof NotEmployerError ||
  (e instanceof ApiClientError && (e.code === ErrorCode.UNAUTHENTICATED || e.code === ErrorCode.FORBIDDEN))

export interface UseEmployer {
  /** Null until the first read lands. */
  state: EmployerMe | null
  /** True only before the first read — a background poll never sets it. */
  loading: boolean
  /** The last failure. The previous state stays in `state` beside it. */
  error: Error | null
  refresh: () => Promise<EmployerMe | null>
  apply: (next: EmployerState) => void
  /** This screen watched the account become verified. False on every other screen. */
  justVerified: boolean
  /** What the shell's prompt draws, or null for none. */
  prompt: PromptCopy | null
}

/**
 * Call from an employer screen (or the shell inside one): it reads the route
 * it is mounted on, so it must sit under the navigator.
 */
export function useEmployer(): UseEmployer {
  const id = useId()
  const qc = useQueryClient()
  const route = useRoute()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const isFocused = useIsFocused()
  const session = useSyncExternalStore(onEmployerSessionChange, employerSession)
  const flippedOn = useSyncExternalStore(subscribe, readFlippedOn)
  const polls = useSyncExternalStore(subscribe, readPollerId) === id
  const key = useMemo(() => employerQueryKey(session), [session])

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchEmployer(qc, session),
    staleTime: FRESH_MS,
    retry: (count, e) => !settledError(e) && count < 1,
    refetchInterval: polls
      ? (q) =>
          q.state.data?.verified || settledError(q.state.error) || AppState.currentState !== 'active'
            ? false
            : POLL_MS
      : false,
  })

  const { refetch } = query

  // The focus effect reads these through a ref. Were they dependencies, every
  // poll would re-run it — and its cleanup would clear the very flip that poll
  // just recorded.
  const latest = useRef({ verified: false, dataUpdatedAt: 0, refetch })
  latest.current = { verified: Boolean(query.data?.verified), dataUpdatedAt: query.dataUpdatedAt, refetch }

  useFocusEffect(
    useCallback(() => {
      shell.focusedKey = route.key
      // First hook on the route in front takes the interval. Whether the old
      // screen's cleanup runs before or after this, the claim lands on this route.
      if (shell.pollerRoute !== route.key) patch({ pollerId: id, pollerRoute: route.key })

      const wake = () => {
        const l = latest.current
        if (l.verified || Date.now() - l.dataUpdatedAt < FRESH_MS) return
        l.refetch({ cancelRefetch: false })
      }
      wake()
      // Coming back to the foreground. The interval itself stands down in the
      // background (see refetchInterval), and this read restarts it.
      const sub = AppState.addEventListener('change', (s) => s === 'active' && wake())

      return () => {
        sub.remove()
        if (shell.focusedKey === route.key) shell.focusedKey = null
        if (shell.pollerId === id) patch({ pollerId: null, pollerRoute: null })
        // The success prompt holds its slot until the employer leaves the
        // screen it landed on, and not a screen longer.
        if (shell.flippedOn === route.key) patch({ flippedOn: null })
      }
    }, [id, route.key]),
  )

  const error = query.error instanceof Error ? query.error : null

  useEffect(() => {
    if (!isFocused) return
    if (error instanceof NotEmployerError) {
      navigation.reset({ index: 0, routes: [{ name: error.role === 'STUDENT' ? 'Home' : 'Welcome' }] })
    } else if (error instanceof ApiClientError && error.code === ErrorCode.UNAUTHENTICATED) {
      // The session could not be refreshed, so the poll has stood down and the
      // screen would keep drawing the last state it read — an approval never
      // seen. The web client sends that employer to sign in; here Sign in opens
      // over the landing, as EmployerLoadState's button does.
      navigation.reset({ index: 1, routes: [{ name: EMPLOYER_ROUTES.landing }, { name: EMPLOYER_ROUTES.signin }] })
    }
  }, [isFocused, error, navigation])

  const refresh = useCallback(async () => {
    // Cancels a read already in flight, so the answer postdates the caller's own write.
    const r = await refetch({ cancelRefetch: true })
    return r.data ?? null
  }, [refetch])

  /**
   * Hands a state a POST already returned (documents, submit) to every screen,
   * without waiting for the next poll. The daily limits and notifications only
   * GET /employers/me carries are kept from the last read.
   */
  const apply = useCallback(
    (next: EmployerState) => {
      const prev = qc.getQueryData<EmployerMe>(key)
      if (!prev) {
        refetch({ cancelRefetch: false })
        return
      }
      observe(prev, next)
      qc.setQueryData<EmployerMe>(key, { ...prev, ...next })
    },
    [qc, key, refetch],
  )

  const state = query.data ?? null
  const justVerified = flippedOn !== null && flippedOn === route.key
  return {
    state,
    loading: state === null && error === null,
    error,
    refresh,
    apply,
    justVerified,
    prompt: verificationPrompt(state, { justVerified }),
  }
}
