import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

/**
 * The booking rules an admin controls, in the one shape every booking screen
 * reads them in — the same contract as the web (apostrophe-user
 * lib/interviews/rules.ts).
 *
 * NOTHING BELOW IS A DEFAULT. How far ahead a student may book, how soon, when
 * join unlocks and closes, how late a free move is still free and what share of
 * the profile must be filled are admin settings, served by /config. A number
 * typed into a screen keeps being quoted after an admin changes it, so a screen
 * that cannot read these shows its error state instead of guessing.
 * `noShowMinutesAfter` and `freeCancellationHours` are optional (older
 * backends): when absent, the sentence drops the number.
 */
export interface BookingRules {
  windowMinHours: number
  windowMaxDays: number
  minProfileCompletionPct: number
  joinOpensMinutesBefore: number
  rescheduleCutoffHours: number
  noShowMinutesAfter?: number
  freeCancellationHours?: number
}

const UNAVAILABLE = 'The booking settings are unavailable right now. Try again in a moment.'

export function bookingRules(config: { booking?: Record<string, unknown> }): BookingRules {
  const b = config.booking
  if (!b) throw new Error(UNAVAILABLE)
  const read = (v: unknown): number => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(UNAVAILABLE)
    return v
  }
  const optional = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined
  return {
    windowMinHours: read(b.windowMinHours),
    windowMaxDays: read(b.windowMaxDays),
    minProfileCompletionPct: read(b.minProfileCompletionPct),
    joinOpensMinutesBefore: read(b.joinOpensMinutesBefore),
    rescheduleCutoffHours: read(b.rescheduleCutoffHours),
    noShowMinutesAfter: optional(b.noShowMinutesAfter),
    freeCancellationHours: optional(b.freeCancellationHours),
  }
}

/**
 * The rules, loaded. Shares the app-wide ['config'] query, so it costs no extra
 * request once any screen has read /config. `error` is set when the config
 * could not be read or lacks a rule — show it, never a number.
 */
export function useBookingRules(): { rules: BookingRules | null; pending: boolean; error: string | null; retry: () => void } {
  const q = useQuery({ queryKey: ['config'], queryFn: () => api.get<{ booking?: Record<string, unknown> }>('/config') })
  if (q.isPending) return { rules: null, pending: true, error: null, retry: () => undefined }
  if (q.isError || !q.data) return { rules: null, pending: false, error: UNAVAILABLE, retry: () => { void q.refetch() } }
  try {
    return { rules: bookingRules(q.data), pending: false, error: null, retry: () => { void q.refetch() } }
  } catch (e) {
    return { rules: null, pending: false, error: e instanceof Error ? e.message : UNAVAILABLE, retry: () => { void q.refetch() } }
  }
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
export const hoursPhrase = (n: number) => plural(n, 'hour')
export const minutesPhrase = (n: number) => plural(n, 'minute')
export const nextDaysPhrase = (n: number) => (n === 1 ? 'Next day' : `Next ${n} days`)
