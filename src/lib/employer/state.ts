import type {
  CompanySize, DocKind, EmployerState, Requirement, RequirementKey, RequirementStatus,
} from '../api/employer'

/**
 * Everything the employer screens derive from `EmployerState`, in one pure file
 * with no React, no DOM and no Intl time zone — so this app copy and the web's
 * (apostrophe-user lib/employer/state.ts) can be the same text and produce the
 * same strings. A sentence that reads one way on the web and another in the
 * app is a parity defect, not a style difference.
 *
 * Two lines differ from the web file and nothing else may: the import path
 * above, and EMPLOYER_ROUTES below, whose values are this app's screen names
 * where the web's are paths. `PromptCopy.href` therefore holds a screen name
 * here — the same key, read by `navigation.navigate`.
 *
 * The SERVER decides; this file only reads. What is missing, whether a round
 * has started and when a decision is due all arrive on the state. The one
 * judgement made here is which of five prompt states to draw, and that is a
 * reading of fields the server already set.
 *
 * Copy comes from the canvas (docs/design/canvas/employer-onboarding/lib.mjs,
 * PROMPT and ACCEPTABLE, and boards/*.mjs). The fill points are the counts,
 * the document labels, slaHours and decisionTargetAt — never a number typed in
 * here, because the 24 hours is a server setting an admin can change.
 */

// ── Routes ───────────────────────────────────────────────────────────────────
/** RootStackParamList names. EM-01 is web-only, so `landing` is the app's Welcome. */
export const EMPLOYER_ROUTES = {
  landing: 'Welcome',
  register: 'EmployerRegister',
  verify: 'EmployerVerify',
  signin: 'EmployerSignIn',
  home: 'EmployerHome',
  documents: 'EmployerDocuments',
  status: 'EmployerStatus',
  company: 'EmployerCompany',
} as const

// ── Time (Asia/Kolkata, always) ──────────────────────────────────────────────
/*
  A fixed +05:30 shift rather than Intl's `timeZone`. India has no daylight
  saving, so the shift is exact, and Hermes has shipped without IANA data — the
  app cannot use the Intl route, and two implementations would be two chances
  to disagree about which day 11:42 PM UTC falls on.
*/
const IST_OFFSET_MS = 330 * 60 * 1000
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type IstInput = string | number | Date

function ist(input: IstInput) {
  const t = new Date(input).getTime()
  if (!Number.isFinite(t)) return null
  const d = new Date(t + IST_OFFSET_MS)
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }
}

const clock = (p: { h: number; mi: number }) =>
  `${p.h % 12 === 0 ? 12 : p.h % 12}:${String(p.mi).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`

/** '16 Sep 2026 · 11:42 AM IST' — every stamp on a document row. '' for a bad date. */
export function formatIst(input: IstInput): string {
  const p = ist(input)
  return p ? `${p.d} ${MON[p.mo]} ${p.y} · ${clock(p)} IST` : ''
}

/** '11:42 AM IST on 17 Sep' — the decision target inside a prompt sentence. */
export function formatIstTarget(input: IstInput): string {
  const p = ist(input)
  return p ? `${clock(p)} IST on ${p.d} ${MON[p.mo]}` : ''
}

/** '16 Sep · 5:05 PM' — the trailing stamp in the approved list, where the year and zone are already said. */
export function formatIstShort(input: IstInput): string {
  const p = ist(input)
  return p ? `${p.d} ${MON[p.mo]} · ${clock(p)}` : ''
}

/** '00:19' — a resend countdown, in mono at the call site. Never negative. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── Labels ───────────────────────────────────────────────────────────────────
/** A document kind as a label on its own — a row's kind line, a chip, a prompt title. */
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  GST: 'GST certificate',
  CIN: 'CIN',
  PAN: 'Company PAN',
  PHOTO_ID: 'Photo ID',
}

/** The same kind inside a sentence, where only a proper noun keeps its capital. */
const DOC_KIND_NOUN: Record<DocKind, string> = {
  GST: 'GST certificate',
  CIN: 'CIN',
  PAN: 'company PAN',
  PHOTO_ID: 'photo ID',
}

/** 'Aadhaar' is what the board draws, but the record does not say which ID it is. */
const DOC_KIND_LINE: Record<DocKind, string> = {
  GST: 'GST certificate',
  CIN: 'CIN',
  PAN: 'Company PAN',
  PHOTO_ID: 'Government photo ID',
}

/** What is acceptable, said on the slot for the choice currently made. */
export const ACCEPTABLE: Record<DocKind, string> = {
  GST: 'Form GST REG-06. If it runs to several pages, send them as one PDF.',
  CIN: 'The certificate of incorporation from the MCA, showing the CIN.',
  PAN: 'The PAN card or allotment letter issued to the company, not to a director.',
  PHOTO_ID:
    'A government photo ID in the name you registered with: Aadhaar, passport, driving licence, voter ID or your own PAN card. A masked Aadhaar is fine.',
}

/** The sentence above a slot's choice — what the requirement is, before what each choice accepts. */
export const SLOT_EXPLANATION = {
  COMPANY_PROOF: 'One document issued to the company, not to a director or partner.',
  PHOTO_ID: ACCEPTABLE.PHOTO_ID,
} as const

export const REQUIREMENT_TITLE: Record<Exclude<RequirementKey, 'REQUESTED'>, string> = {
  COMPANY_PROOF: 'Company proof',
  PHOTO_ID: 'Your photo ID',
  WORK_EMAIL: 'Work email on your company domain',
}

/** The home checklist's second line, before anything is uploaded. */
export const REQUIREMENT_SUMMARY: Record<Exclude<RequirementKey, 'REQUESTED'>, string> = {
  COMPANY_PROOF: 'GST certificate, CIN or company PAN',
  PHOTO_ID: 'Aadhaar, passport, driving licence, voter ID or PAN card',
  WORK_EMAIL: 'Confirmed when you signed up',
}

export const COMPANY_SIZE_LABEL: Record<CompanySize, string> = {
  '1-10': '1–10',
  '11-50': '11–50',
  '51-200': '51–200',
  '201-500': '201–500',
  '501-1000': '501–1,000',
  '1000+': '1,000+',
}

/** '11–50' — with an en dash, as the chips draw it. Falls back to the raw value. */
export const companySizeLabel = (size: string) => COMPANY_SIZE_LABEL[size as CompanySize] ?? size

const orList = (kinds: DocKind[], dict: Record<DocKind, string>) => kinds.map((k) => dict[k]).join(' or ')
const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** 'Company proof' · 'Your photo ID' · 'Work email on your company domain' · 'GST certificate or CIN'. */
export function requirementTitle(req: Requirement): string {
  if (req.key === 'REQUESTED') return req.kinds.length ? orList(req.kinds, DOC_KIND_LABEL) : 'Requested document'
  return REQUIREMENT_TITLE[req.key]
}

/** The row's second line: the kind that was sent, the address, or who asked. Null when there is nothing to say. */
export function requirementKindLine(req: Requirement): string | null {
  if (req.key === 'WORK_EMAIL') return req.email ?? null
  if (req.key === 'REQUESTED' && !req.document) return 'Asked for by the reviewer'
  if (req.document) return DOC_KIND_LINE[req.document.kind]
  return req.key === 'PHOTO_ID' ? null : REQUIREMENT_SUMMARY.COMPANY_PROOF
}

// ── Status, per requirement ──────────────────────────────────────────────────
export type EmployerTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success'

/**
 * A requirement's pill. Crimson is not a tone here and cannot be passed: a
 * status is none of the accent's four jobs.
 *
 * `slot` is EM-05's reading, where a requirement is something to do — 'Required'
 * before anything is sent, 'Done' once it is. `row` is EM-06's, where it is a
 * decision somebody made.
 */
export function requirementPill(
  req: Pick<Requirement, 'status'>,
  context: 'row' | 'slot' = 'row',
): { label: string; tone: EmployerTone } {
  const map: Record<RequirementStatus, { label: string; tone: EmployerTone }> = {
    MISSING: { label: 'Required', tone: 'warning' },
    SUBMITTED: { label: 'Submitted', tone: 'info' },
    MORE_INFO: { label: 'More information requested', tone: 'warning' },
    APPROVED: { label: context === 'slot' ? 'Done' : 'Approved', tone: 'success' },
    REJECTED: { label: 'Rejected', tone: 'danger' },
  }
  return map[req.status]
}

/**
 * The mono stamps under a row, oldest first: 'Submitted 16 Sep 2026 · 11:42 AM
 * IST', then the decision. A request with nothing sent yet reads 'Requested …'
 * off the review that asked for it.
 */
export function requirementTimes(req: Requirement, state: Pick<EmployerState, 'verification'>): string[] {
  if (req.key === 'WORK_EMAIL') return req.confirmedAt ? [`Confirmed ${formatIst(req.confirmedAt)}`] : []
  if (!req.document) {
    return req.key === 'REQUESTED' && state.verification.reviewedAt
      ? [`Requested ${formatIst(state.verification.reviewedAt)}`]
      : []
  }
  const out = [`Submitted ${formatIst(req.document.uploadedAt)}`]
  if (req.document.reviewedAt && req.document.status === 'APPROVED') out.push(`Approved ${formatIst(req.document.reviewedAt)}`)
  if (req.document.reviewedAt && req.document.status === 'REJECTED') out.push(`Rejected ${formatIst(req.document.reviewedAt)}`)
  return out
}

/** The well under a row: the reviewer's reason on a refusal, their question on a request. */
export function requirementReason(req: Requirement): { label: string; tone: 'danger' | 'warning'; text: string } | null {
  if (!req.reason) return null
  if (req.status === 'REJECTED') return { label: 'Reason', tone: 'danger', text: req.reason }
  if (req.status === 'MORE_INFO') return { label: 'What the reviewer asked', tone: 'warning', text: req.reason }
  return null
}

/** Whether the employer has something to do on this row — send, or send again. */
export const needsAction = (req: Pick<Requirement, 'status'>) =>
  req.status === 'MISSING' || req.status === 'REJECTED' || req.status === 'MORE_INFO'

/**
 * EM-06's order: the rows that need you first, then the rest in EM-05's own
 * order (company proof, photo ID, work email, the request). Stable, so two
 * refusals keep their relative order.
 */
export function statusRowOrder(requirements: Requirement[]): Requirement[] {
  return [...requirements.filter(needsAction), ...requirements.filter((r) => !needsAction(r))]
}

/** The home checklist's 'N of 3 done': the base three with something on them. */
export function requirementsProgress(state: Pick<EmployerState, 'requirements'>): { done: number; total: number } {
  const base = state.requirements.filter((r) => r.key !== 'REQUESTED')
  return { done: base.filter((r) => r.status !== 'MISSING').length, total: base.length }
}

/** The requirement a DocumentSlot is for, by key. */
export const requirementFor = (state: Pick<EmployerState, 'requirements'>, key: RequirementKey) =>
  state.requirements.find((r) => r.key === key) ?? null

// ── The verification prompt ──────────────────────────────────────────────────
export type PromptState = 'todo' | 'review' | 'moreInfo' | 'rejected' | 'verified'
export type PromptGlyph = 'shield' | 'clock' | 'filePlus' | 'xCircle' | 'shieldCheck'

/**
 * Which of the five states the shell's prompt is in, or null for no prompt.
 *
 * `verified` is drawn ONCE: only when this screen watched the flip happen
 * (`justVerified`). A verified employer arriving fresh has no prompt at all —
 * the absence is the reward, and a permanent green band would be furniture
 * congratulating them forever.
 *
 * A rejected document outranks the account status, because a REJECTED row is
 * the thing to fix even while another document is still with a reviewer.
 */
export function promptState(
  state: Pick<EmployerState, 'verified' | 'verification' | 'requirements'> | null | undefined,
  opts: { justVerified?: boolean } = {},
): PromptState | null {
  if (!state) return null
  if (state.verified) return opts.justVerified ? 'verified' : null
  const v = state.verification
  if (v.status === 'REJECTED' || state.requirements.some((r) => r.status === 'REJECTED')) return 'rejected'
  if (v.status === 'MORE_INFO') return 'moreInfo'
  if (v.status === 'PENDING' && v.submittedAt) return 'review'
  return 'todo'
}

/** Where each state is resolved. The prompt links there, and drops its chevron when already there. */
export function promptRoute(prompt: PromptState): string {
  return prompt === 'todo' || prompt === 'moreInfo' ? EMPLOYER_ROUTES.documents : EMPLOYER_ROUTES.status
}

export const PROMPT_TONE: Record<PromptState, EmployerTone> = {
  todo: 'neutral',
  review: 'info',
  moreInfo: 'warning',
  rejected: 'danger',
  verified: 'success',
}

export const PROMPT_GLYPH: Record<PromptState, PromptGlyph> = {
  todo: 'shield',
  review: 'clock',
  moreInfo: 'filePlus',
  rejected: 'xCircle',
  verified: 'shieldCheck',
}

export interface PromptCopy {
  state: PromptState
  tone: EmployerTone
  glyph: PromptGlyph
  title: string
  body: string
  href: string
}

/** 'Company proof' / 'your photo ID' — the two base labels as a prompt sentence names them. */
const MISSING_PHRASE: Record<'COMPANY_PROOF' | 'PHOTO_ID', string> = {
  COMPANY_PROOF: 'company proof',
  PHOTO_ID: 'your photo ID',
}

/** 'A reviewer decides within 24 hours of you submitting.' — slaHours from the server. */
const decidesWithin = (hours: number) => `A reviewer decides within ${hours} hours of you submitting.`

/** The document a requirement currently holds, as a sentence noun: 'your GST certificate'. */
const heldNoun = (req: Requirement) =>
  req.document ? `your ${DOC_KIND_NOUN[req.document.kind]}` : req.key === 'PHOTO_ID' ? 'your photo ID' : 'your company proof'

const DOCUMENT_KEYS: RequirementKey[] = ['COMPANY_PROOF', 'PHOTO_ID', 'REQUESTED']

/**
 * The prompt's title and sentence for a state, filled from the state. Every
 * branch starts from the board's own copy (lib.mjs → PROMPT) and changes only
 * the parts that are about THIS employer.
 */
export function promptCopy(state: EmployerState, prompt: PromptState): PromptCopy {
  const base = { state: prompt, tone: PROMPT_TONE[prompt], glyph: PROMPT_GLYPH[prompt], href: promptRoute(prompt) }
  const v = state.verification
  const docs = state.requirements.filter((r) => DOCUMENT_KEYS.includes(r.key))

  switch (prompt) {
    case 'todo': {
      const missing = state.missingRequirements.filter((k): k is 'COMPANY_PROOF' | 'PHOTO_ID' => k !== 'REQUESTED')
      const total = state.requirements.filter((r) => r.key !== 'REQUESTED').length
      if (!missing.length) {
        return { ...base, title: 'Verification · ready to submit', body: decidesWithin(v.slaHours) }
      }
      const named = capitalise(missing.map((k) => MISSING_PHRASE[k]).join(' and '))
      return {
        ...base,
        title: `Verification · ${missing.length} of ${total} still needed`,
        body: `${named}. ${decidesWithin(v.slaHours)}`,
      }
    }

    case 'review': {
      const inReview = docs.filter((r) => r.status === 'SUBMITTED')
      const who =
        inReview.length === 1
          ? `${capitalise(heldNoun(inReview[0]))} is`
          : inReview.length === 2
            ? 'Both documents are'
            : 'Your documents are'
      const when = v.decisionTargetAt
        ? `We aim to decide by ${formatIstTarget(v.decisionTargetAt)}.`
        : `We aim to decide within ${v.slaHours} hours.`
      return { ...base, title: 'In review', body: `${who} with a reviewer. ${when}` }
    }

    case 'moreInfo': {
      const kinds = v.requestedDocumentKinds
      if (!kinds.length) {
        return {
          ...base,
          title: 'More information requested',
          body: [v.reason, 'Nothing you sent was refused.'].filter(Boolean).join(' '),
        }
      }
      return {
        ...base,
        title: 'One more document requested',
        body: `Add a ${orList(kinds, DOC_KIND_NOUN)}. Nothing you sent was refused.`,
      }
    }

    case 'rejected': {
      const refused = docs.filter((r) => r.status === 'REJECTED')
      const passed = docs.filter((r) => r.status === 'APPROVED' && r.document)
      const title =
        refused.length === 1
          ? `${refused[0].document ? DOC_KIND_LABEL[refused[0].document.kind] : requirementTitle(refused[0])} not accepted`
          : refused.length > 1
            ? `${refused.length} documents not accepted`
            : 'Verification not accepted'
      // "A clearer copy" is the board's reading of ITS reason (a blurred photo).
      // The real reason is on the row; the prompt only says what finishing takes.
      const fix =
        refused.length > 1
          ? 'Upload new copies to finish.'
          : refused.length === 1
            ? 'Upload a new copy to finish.'
            : (v.reason ?? 'See what the reviewer said.')
      const kept = passed.length
        ? ` ${capitalise(passed.map(heldNoun).join(' and '))} ${passed.length > 1 ? 'are' : 'is'} approved.`
        : ''
      return { ...base, title, body: `${fix}${kept}` }
    }

    case 'verified':
      return { ...base, title: 'Verified just now', body: 'The candidate feed is open. No need to sign in again.' }
  }
}

/** promptState and promptCopy in one call — what the shell's prompt draws, or null for none. */
export function verificationPrompt(
  state: EmployerState | null | undefined,
  opts: { justVerified?: boolean } = {},
): PromptCopy | null {
  const prompt = promptState(state, opts)
  return state && prompt ? promptCopy(state, prompt) : null
}
