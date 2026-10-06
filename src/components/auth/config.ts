import { Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { WEB_BASE_URL } from '../../config/env'
import { rupees } from '../../lib/profile/labels'

/**
 * What the sign-up screens read from GET /config — declared here rather than in
 * lib/api/config.ts so these screens can name the few fields that file does not
 * carry (employer.verificationSlaHours, employer.documentRequirements). Every
 * number the forms and the code screens quote is one of these: how long a code
 * is, how long it lives, how long to wait to ask again, how many sends an hour,
 * what a tier costs and how long it runs. Each is optional — a backend that does
 * not send one gets copy that quotes no number, never a number typed in here.
 */
export interface AuthConfig {
  auth?: {
    otpLength?: number
    otpTtlMinutes?: number
    otpResendCooldownSeconds?: number
    otpMaxSendsPerHour?: number
    otpMaxAttempts?: number
  }
  tiers?: { tier: string; amountPaise: number; durationMin: number }[]
  qualifications?: { value: string; tier: string }[]
  masterData?: {
    cities?: Named[]
    industries?: Named[]
    domains?: Named[]
    languages?: Named[]
  }
  employer?: {
    /** 0 when the setting is unseeded — then no sentence quotes it. */
    verificationSlaHours?: number
    verificationTargetHours?: number
    documentRequirements?: { key: string; label: string; kinds: string[] }[]
  }
  uploads?: Record<string, { contentTypes: string[]; maxBytes: number; label: string }>
}

export type Named = { name: string; slug: string }

/**
 * /config, anonymously: these screens run before there is an account, and a
 * stale session on the phone must not turn the read into a 401. Shares the
 * app's ['config'] cache entry — it is the same document.
 */
export function useAuthConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<AuthConfig>('/config', { anonymous: true }),
  })
}

/**
 * The length a code box row is drawn at until /config answers. It is the
 * server contract's own length (`registerMobileInput.code`, /^\d{6}$/), not a
 * setting — the copy still names no length until /config says it.
 */
export const CONTRACT_CODE_LENGTH = 6

const NUMBER_WORDS: Record<number, string> = {
  1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
}

/** "six" for 6 — how many is the server's word, the spelling is ours. */
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n)

/** "0:24" — a countdown you glance at. */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/** "09:12" — how long a code still has, read out with its leading zero. */
export const clockMMSS = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

/** "3:05 pm" — the clock the server's own limit message uses, always in IST. */
export const clockIST = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })

/** "98250 41127" — grouped the way the field's placeholder is. */
export const groupedMobile = (digits: string) =>
  digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits

/**
 * What the selected qualification costs and how long it runs, from /config's
 * tiers — undefined until /config has answered, and never a guessed price.
 */
export function tierFigures(config: AuthConfig | undefined, qualification: string): { price?: string; minutes?: number } {
  const tierId = config?.qualifications?.find((q) => q.value === qualification)?.tier
  const tier = tierId ? config?.tiers?.find((t) => t.tier === tierId) : undefined
  return {
    price: tier && tier.amountPaise > 0 ? rupees(tier.amountPaise) : undefined,
    minutes: tier && tier.durationMin > 0 ? tier.durationMin : undefined,
  }
}

/** The reviewer's decision target in hours, or null when the admin has not set one. */
export function verificationHours(config: AuthConfig | undefined): number | null {
  const sla = config?.employer?.verificationSlaHours
  if (sla && sla > 0) return sla
  const target = config?.employer?.verificationTargetHours
  return target && target > 0 ? target : null
}

/**
 * How a refused `POST /auth/otp/send` reads — the web's app/get-started/otpSend.ts,
 * ported. The server answers 429 for two different things:
 *
 *  - the resend COOLDOWN: `retryAfterSeconds` only. It does not spend a send.
 *  - the HOURLY CAP: `retryAfterSeconds` and `retryAt` (an ISO time).
 *
 * `retryAt` present means the cap. Without it, a wait longer than the
 * configured cooldown cannot be the cooldown, so it is read as the cap.
 */
export type SendRefusal = { kind: 'cooldown'; seconds: number } | { kind: 'hourly'; retryAt: Date | null; message: string }

export function readSendRefusal(err: unknown, cooldownSeconds: number): SendRefusal | null {
  if (!(err instanceof ApiClientError) || err.status !== 429) return null
  const rawSeconds = Number(err.meta?.retryAfterSeconds ?? err.details?.retryAfterSeconds)
  const seconds = Number.isFinite(rawSeconds) && rawSeconds > 0 ? Math.ceil(rawSeconds) : null
  const rawAt = err.meta?.retryAt ?? err.details?.retryAt
  const at = typeof rawAt === 'string' ? new Date(rawAt) : null
  const retryAt = at && !Number.isNaN(at.getTime()) ? at : null
  const hourly = rawAt != null || (seconds !== null && cooldownSeconds > 0 && seconds > cooldownSeconds)
  if (hourly) {
    return {
      kind: 'hourly',
      retryAt: retryAt ?? (seconds !== null ? new Date(Date.now() + seconds * 1000) : null),
      message: err.message,
    }
  }
  return seconds !== null ? { kind: 'cooldown', seconds } : null
}

/** `details.attemptsLeft` off a wrong-code answer, when the server sends it. */
export function serverAttemptsLeft(err: unknown): number | null {
  if (!(err instanceof ApiClientError)) return null
  const n = Number(err.details?.attemptsLeft)
  return err.details?.attemptsLeft != null && Number.isFinite(n) && n >= 0 ? n : null
}

/** The public legal pages, served by the same host as the API. */
export const legalUrl = (page: 'terms' | 'privacy') => `${WEB_BASE_URL}/${page}`

export const openLegal = (page: 'terms' | 'privacy') => {
  Linking.openURL(legalUrl(page)).catch(() => undefined)
}
