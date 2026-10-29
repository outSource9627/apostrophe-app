import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ScreeningCounts, ScreeningOffer } from '../api/screening'

/**
 * The applicant's screening test, kept on this phone (the web keeps it in
 * localStorage). The token comes back once, in the apply response, and there
 * is no email with the link — so "Do it later" only works because the test
 * outlives the app here, until the link expires. One test at a time: a new
 * application's test replaces the last one.
 *
 * Also kept: the deadline once the test has started (from then on it, not the
 * link's date, decides whether Join us offers the test), and the picks the
 * server has not confirmed yet, so an answer made offline survives the app
 * being closed and is sent when the test is opened again.
 */
const KEY = 'apostrophe.interviewer.screening'

export interface StoredScreening {
  token: string
  expiresAt: string
  counts: ScreeningCounts
  total: number
  timeLimitMinutes: number
  /** The address on the application — "Test submitted." names it. */
  email: string
  deadlineAt?: string | null
  /** Unconfirmed picks by question index (a JSON key, so a string). */
  pending?: Record<string, number | null>
}

export async function readScreening(): Promise<StoredScreening | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    const s = parsed as StoredScreening
    return typeof s.token === 'string' && typeof s.expiresAt === 'string' ? s : null
  } catch {
    return null
  }
}

/**
 * Writes run one after another, in the order they were asked for. Each patch
 * is read-modify-write, and the screen saves the unconfirmed picks on every tap
 * and every confirmation — two overlapping writes could otherwise land out of
 * order and keep a stale pick that would be replayed over a newer answer.
 */
let chain: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.catch(() => undefined)
  return run
}

async function write(s: StoredScreening): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* No storage. The test still works now; only "later" is lost. */
  }
}

/** Keep a newly issued test, replacing any earlier one. */
export function keepScreening(offer: ScreeningOffer, email: string): Promise<void> {
  return serial(() => write({
    token: offer.token,
    expiresAt: offer.expiresAt,
    counts: offer.counts,
    total: offer.total,
    timeLimitMinutes: offer.timeLimitMinutes,
    email,
  }))
}

/** Update the kept test — only if it is still this token's. */
export function patchScreening(token: string, patch: Partial<Pick<StoredScreening, 'deadlineAt' | 'pending'>>): Promise<void> {
  return serial(async () => {
    const s = await readScreening()
    if (s?.token !== token) return
    await write({ ...s, ...patch })
  })
}

/** Drop the kept test once it is submitted, expired or unknown — only if it is still this token's. */
export function forgetScreening(token: string): Promise<void> {
  return serial(async () => {
    const s = await readScreening()
    if (s?.token !== token) return
    try {
      await AsyncStorage.removeItem(KEY)
    } catch {
      /* Nothing to drop. */
    }
  })
}

/**
 * Whether Join us should offer the test: before the deadline once started,
 * before the link's date until then. The phone's clock is good enough for an
 * offer; the server decides when the test is opened.
 */
export function isOpen(s: StoredScreening, now: number): boolean {
  const until = Date.parse(s.deadlineAt ?? s.expiresAt)
  return Number.isFinite(until) && until > now
}
