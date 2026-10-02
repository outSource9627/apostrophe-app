import { WEB_BASE_URL } from '../../config/env'
import type { InterviewerProfilePatch } from '../api/interviewer'

/**
 * The pure rules of the interviewer's Account screens: what the server accepts
 * on PATCH /interviewers/me/profile, which of the typed fields actually changed,
 * and the small formatters. Kept free of React and the network so they are
 * tested on their own.
 */
export const NAME_MIN = 2
export const NAME_MAX = 80
export const BIO_MAX = 280
export const LANGUAGES_MAX = 12

export interface ProfileDraft { name: string; languages: string[]; bio: string }
export type ProfileErrors = Partial<Record<'name' | 'languages' | 'bio', string>>

/** The server's own limits, in the screen's words. */
export function validateProfileDraft(d: ProfileDraft): ProfileErrors {
  const e: ProfileErrors = {}
  const n = d.name.trim()
  if (n.length < NAME_MIN) e.name = `Enter your name (at least ${NAME_MIN} characters)`
  else if (n.length > NAME_MAX) e.name = `Use at most ${NAME_MAX} characters`
  if (d.languages.length < 1) e.languages = 'Pick at least one language'
  else if (d.languages.length > LANGUAGES_MAX) e.languages = `Pick at most ${LANGUAGES_MAX} languages`
  if (d.bio.length > BIO_MAX) e.bio = `Keep your bio to ${BIO_MAX} characters or fewer`
  return e
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000')

/**
 * The fields of `draft` that differ from what is saved, as the PATCH body
 * (the server rejects an empty one). `avatar` is the key to set, null to remove
 * the photo, or undefined to leave it.
 */
export function profileChanges(base: ProfileDraft, draft: ProfileDraft, avatar?: string | null): InterviewerProfilePatch {
  const out: InterviewerProfilePatch = {}
  if (draft.name.trim() !== base.name.trim()) out.name = draft.name.trim()
  if (!sameSet(draft.languages, base.languages)) out.languages = draft.languages
  if (draft.bio !== base.bio) out.bio = draft.bio
  if (avatar !== undefined) out.avatarKey = avatar
  return out
}

export const hasChanges = (p: InterviewerProfilePatch) => Object.keys(p).length > 0

/** '+91 98000 00001'. Anything that is not ten digits is shown as stored. */
export const mobileLabel = (m: string) => {
  const d = m.replace(/\D/g, '').slice(-10)
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : m
}

/** The server accepts the account's own name, mobile or email (any case, spacing in the mobile ignored). */
export function deletionConfirmMatches(typed: string, who: { name?: string; mobile?: string; email?: string }) {
  const t = typed.trim().toLowerCase()
  if (!t) return false
  const digits = (v: string) => v.replace(/\D/g, '')
  return [who.name, who.email].some((v) => !!v && v.trim().toLowerCase() === t)
    || (!!who.mobile && (digits(who.mobile).slice(-10) === digits(t).slice(-10) && digits(t).length >= 10 || who.mobile.toLowerCase() === t))
}

/** A public page of the web host: webUrl('/terms'). */
export const webUrl = (path: string) => `${WEB_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

/** The first two initials, or '' when there is no name. */
export const initialsFrom = (n?: string | null) => (n ? n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '')
