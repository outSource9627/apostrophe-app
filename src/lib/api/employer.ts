import { Platform } from 'react-native'
import { api, tokenStore } from './index'
import { ApiClientError, ErrorCode } from './types'
import type { Me, NotificationRow } from './account'

/**
 * The employer onboarding and verification wire shapes (EM-02..EM-07),
 * mirrored from apostrophe-admin and kept identical to the web client
 * (apostrophe-user lib/api/employer.ts). A name or a shape that differs
 * between the two is a parity defect.
 *
 * The SERVER owns every rule these describe. What is still needed, whether a
 * round of review has started and when a decision is due all arrive computed
 * on `EmployerState`; nothing here re-derives them, because a second copy of
 * the review rules in a released build is a disagreement with the gate that
 * actually decides.
 *
 * Registration is anonymous end to end. The three calls before the account
 * exists (`register/otp`, `register/verify`, `register`) skip the Authorization
 * header, so a stale session on the phone can never turn a sign-up into a 401.
 *
 * The one real difference from the web is the file: a phone has no `File`, so
 * uploads take a `PickedFile` (a uri plus what the picker said about it), and
 * picking is part of this module rather than an `<input type="file">`.
 */

// ── Vocabulary ───────────────────────────────────────────────────────────────
export type DocKind = 'GST' | 'CIN' | 'PAN' | 'PHOTO_ID'
export type DocStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type RequirementKey = 'COMPANY_PROOF' | 'PHOTO_ID' | 'WORK_EMAIL' | 'REQUESTED'
export type RequirementStatus = 'MISSING' | 'SUBMITTED' | 'MORE_INFO' | 'APPROVED' | 'REJECTED'
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_INFO'
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+'
export type CodeChannel = 'EMAIL' | 'MOBILE'

/** The three kinds that satisfy COMPANY_PROOF. One slot, one choice. */
export const COMPANY_PROOF_KINDS: readonly DocKind[] = ['GST', 'CIN', 'PAN']

export const COMPANY_SIZES: readonly CompanySize[] = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

// ── State (GET /employers/me) ────────────────────────────────────────────────
export interface EmployerDocument {
  kind: DocKind
  uploadedAt: string
  status: DocStatus
  /** The reviewer's own sentences. Set on REJECTED, null otherwise. */
  reason: string | null
  reviewedAt: string | null
}

export interface Requirement {
  key: RequirementKey
  /** What satisfies it. [] for WORK_EMAIL, which is proven at sign-up. */
  kinds: DocKind[]
  status: RequirementStatus
  /** The latest document of `kinds`, or null while nothing is attached. */
  document: EmployerDocument | null
  reason: string | null
  /** WORK_EMAIL only. */
  email?: string
  domain?: string
  matchesWebsite?: boolean
  confirmedAt?: string | null
}

export interface EmployerVerification {
  status: VerificationStatus
  submittedAt: string | null
  reviewedAt: string | null
  approvedAt: string | null
  reason: string | null
  requestedDocumentKinds: DocKind[]
  resubmissionCount: number
  /** The server setting employer.verification.slaHours. Never hard-code 24. */
  slaHours: number
  /** submittedAt + slaHours, while a round is PENDING. Null otherwise. */
  decisionTargetAt: string | null
}

export interface EmployerState {
  id: string
  company: {
    name: string
    industry: string
    size: CompanySize
    website: string | null
    officeLocation: string
    authorisedPerson: { name: string; designation: string }
  }
  contact: { email: string; mobile: string }
  documents: EmployerDocument[]
  /** Always COMPANY_PROOF, PHOTO_ID, WORK_EMAIL — then REQUESTED when a reviewer asked. */
  requirements: Requirement[]
  verification: EmployerVerification
  /** The one boolean access routes on. */
  verified: boolean
  message: string | null
  /** @deprecated Read `missingRequirements`; kept for older builds. */
  missingDocumentKinds: DocKind[]
  missingRequirements: Array<'COMPANY_PROOF' | 'PHOTO_ID' | 'REQUESTED'>
  status: 'ACTIVE' | 'SUSPENDED'
}

/** A daily allowance. NOT a paywall — employers pay nothing; see employerLimits. */
export interface QuotaState {
  limit: number
  used: number
  remaining: number
  resetAt: string
}

export type EmployerMe = EmployerState & {
  limits: { cards: QuotaState; videoPlays: QuotaState }
  notifications: NotificationRow[]
  unreadNotifications: number
}

export const getEmployerMe = () => api.get<EmployerMe>('/employers/me')

// ── Registration (EM-02, EM-03) ──────────────────────────────────────────────
export interface RegisterOtpResult {
  sent: true
  email?: { resendAfterSeconds: number; delivered: boolean }
  mobile?: { resendAfterSeconds: number }
}

/**
 * Sends a code to each channel given — both on the first send, one for a row's
 * own resend. A 429 carries `details.retryAfterSeconds`; see `retryAfterSeconds`.
 */
export const sendRegisterCodes = (body: { email?: string; mobile?: string }) =>
  api.post<RegisterOtpResult>('/employers/register/otp', body, { anonymous: true })

export interface CodeProof {
  channel: CodeChannel
  /** Server-signed, 30 minutes, bound to the channel and its normalised value. */
  proof: string
  expiresAt: string
}

/**
 * Consumes one channel's code and returns its proof. A wrong or expired code is
 * a 400 with `fields.code`, and `details.attemptsLeft` when the server knows it.
 */
export const verifyRegisterCode = (
  body:
    | { channel: 'EMAIL'; email: string; code: string }
    | { channel: 'MOBILE'; mobile: string; code: string },
) => api.post<CodeProof>('/employers/register/verify', body, { anonymous: true })

export interface RegisterEmployerInput {
  companyName: string
  /** A master-data industry NAME, not its slug. */
  industry: string
  companySize: CompanySize
  /** '' is allowed and means none. */
  website?: string
  officeLocation: string
  authorisedPerson: { name: string; designation: string }
  email: string
  mobile: string
  password: string
  /** Per channel, a proof OR a code. The proof must match the same email / mobile. */
  emailProof?: string
  emailCode?: string
  mobileProof?: string
  mobileCode?: string
}

/**
 * What EM-02 hands EM-03: the form, before either channel is proven.
 *
 * It carries the password, so it travels ONLY in memory — as the EmployerVerify
 * route's params — and is never written to storage. The verify screen resets
 * the stack once the account exists, which drops it from navigation state too.
 */
export type EmployerRegistrationDraft = Omit<RegisterEmployerInput, 'emailProof' | 'emailCode' | 'mobileProof' | 'mobileCode'>

/*
  Who is signed in, changing hands inside one app session. The employer state is
  cached by react-query (lib/employer/useEmployer) so a screen change does not
  flash a loading state — which means a sign-in or a new account has to move
  that cache aside, or the first frame of the new session shows the previous
  company. `employerSession()` is a counter the cache key carries; these two
  calls bump it.
*/
const sessionListeners = new Set<() => void>()
let session = 0

/** Called whenever this app signs an employer in. Returns the unsubscribe. */
export function onEmployerSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

/** A number that changes every time an employer session starts on this phone. */
export const employerSession = () => session

const sessionChanged = () => {
  session += 1
  sessionListeners.forEach((l) => l())
}

export interface RegisterEmployerResult {
  accessToken: string
  refreshToken: string
  user: { id: string; role: 'EMPLOYER'; name: string }
  employer: { id: string; verificationStatus: 'PENDING' }
  verified: false
}

/**
 * Creates the account and signs it in. The tokens are stored here rather than
 * at the call site, so no screen can create an account and forget to keep the
 * session it was handed. A 409 names which of email or mobile already has one.
 */
export async function registerEmployer(body: RegisterEmployerInput): Promise<RegisterEmployerResult> {
  const res = await api.post<RegisterEmployerResult>('/employers/register', body, { anonymous: true })
  await tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
  sessionChanged()
  return res
}

/**
 * Email and password sign-in, then who signed in. The route is shared with
 * interviewers and students, so the ROLE is read back from /auth/me and handed
 * to the caller: a student who signs in on the employer screen is sent to their
 * own home, not dropped into an employer shell that 403s on every call.
 */
export async function signInWithPassword(email: string, password: string): Promise<Me> {
  const res = await api.post<{ accessToken: string; refreshToken: string }>(
    '/auth/login/password',
    { email, password },
    { anonymous: true },
  )
  await tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken })
  sessionChanged()
  return api.get<Me>('/auth/me')
}

/**
 * `retryAfterSeconds` off a 429, when the server sent one. The OTP senders put
 * it in `meta` (docs/API.md); `details` is read as well in case that moves.
 */
export function retryAfterSeconds(e: unknown): number | null {
  if (!(e instanceof ApiClientError) || e.code !== ErrorCode.RATE_LIMITED) return null
  const n = Number(e.meta?.retryAfterSeconds ?? e.details?.retryAfterSeconds)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** `details.attemptsLeft` off a wrong-code 400, when the server knows it. */
export function attemptsLeft(e: unknown): number | null {
  if (!(e instanceof ApiClientError)) return null
  const n = Number(e.details?.attemptsLeft)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// ── Documents (EM-05, EM-06) ─────────────────────────────────────────────────
export type DocumentsResult = EmployerState & { submittedAt?: string | null }

/**
 * Attaches uploaded keys. Each one replaces the same kind and goes back to
 * SUBMITTED; the review round starts on its own once nothing is missing. An
 * approved account gets a 409.
 */
export const attachEmployerDocuments = (documents: { kind: DocKind; key: string }[]) =>
  api.post<DocumentsResult>('/employers/me/documents', { documents })

/** Explicit resubmission, for a round the attach did not start by itself. */
export const submitEmployerVerification = () => api.post<EmployerState>('/employers/me/submit')

// ── Upload (EM-05) ───────────────────────────────────────────────────────────
/** The ceiling, as the server's EMPLOYER_DOCUMENT rule states it. */
export const EMPLOYER_UPLOAD = {
  contentTypes: ['application/pdf', 'image/jpeg', 'image/png'] as readonly string[],
  maxBytes: 10 * 1024 * 1024,
  /** Said on the slot before the picker ever opens. */
  constraint: 'PDF, JPG or PNG · up to 10 MB',
  accept: 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png',
}

interface Presigned {
  key: string
  url: string
  method: 'PUT'
  headers: Record<string, string>
  expiresAt: string
  purpose: 'EMPLOYER_DOCUMENT'
  maxBytes: number
}

export const signEmployerUpload = (file: { type: string; size: number; name?: string }) =>
  api.post<Presigned>('/employers/me/uploads', {
    purpose: 'EMPLOYER_DOCUMENT',
    contentType: file.type,
    sizeBytes: file.size,
    fileName: file.name,
  })

/**
 * Why an upload stopped, as a fault the slot can NAME. There is no generic
 * "upload failed" branch on purpose:
 *
 *   type       the file is not a PDF, JPG or PNG
 *   size       over 10 MB — `sizeBytes` is the real number, for the sentence
 *   network    the connection dropped — `fraction` is how far it got
 *   refused    the server, storage or the phone's picker said no — `message` is theirs
 *   cancelled  the person pressed Cancel; not a failure, draw nothing
 *
 * An unreadable scan is NOT here: nothing on the phone can tell, and it
 * arrives later as the reviewer's reason on a rejected row.
 */
export type UploadFault = 'type' | 'size' | 'network' | 'refused' | 'cancelled'

export class EmployerUploadError extends Error {
  constructor(
    readonly fault: UploadFault,
    message: string,
    readonly fileName: string,
    readonly sizeBytes: number,
    /** 0–1, how much had gone when it stopped. */
    readonly fraction = 0,
  ) {
    super(message)
    this.name = 'EmployerUploadError'
  }
}

/**
 * A file the person chose, as the app holds it. The phone's stand-in for the
 * web's `File`: `uri` is a file:// (iOS) or content:// (Android) address the
 * bytes are read from at upload time.
 */
export interface PickedFile {
  uri: string
  name: string
  /** The MIME type the picker reported, or '' when it did not say. */
  type: string
  /** Bytes. Always known — measured from the file when the picker did not say. */
  size: number
}

const EXTENSION_OK = /\.(pdf|jpe?g|png)$/i

/**
 * Some Android pickers hand over an empty `type` for a perfectly good PDF, so
 * an empty type falls back to the extension rather than refusing a real scan.
 * The resolved type is what gets signed, and storage enforces it.
 */
export function resolveContentType(file: { type: string; name: string }): string | null {
  if (EMPLOYER_UPLOAD.contentTypes.includes(file.type)) return file.type
  if (file.type && file.type !== 'application/octet-stream') return null
  if (!EXTENSION_OK.test(file.name)) return null
  const ext = file.name.split('.').pop()!.toLowerCase()
  return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg'
}

/** '14.2 MB' — one decimal, the real number, never rounded down under the limit. */
export const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

/**
 * Checks a file against the rule WITHOUT sending anything. Returns the fault,
 * or null when the file may go. The slot calls this before presigning, so a
 * 14 MB scan is refused in the hand rather than after a round trip.
 */
export function checkEmployerFile(file: { name: string; type: string; size: number }): EmployerUploadError | null {
  if (!resolveContentType(file)) {
    return new EmployerUploadError('type', `${file.name} is not a PDF, JPG or PNG.`, file.name, file.size)
  }
  if (file.size > EMPLOYER_UPLOAD.maxBytes) {
    return new EmployerUploadError(
      'size',
      `${file.name} is ${megabytes(file.size)}, over the 10 MB limit.`,
      file.name,
      file.size,
    )
  }
  return null
}

type PickerModule = typeof import('@react-native-documents/picker')

/*
  The picker is required when it is used, not imported at the top. Its native
  module is looked up eagerly on import, so a build whose pods have not been
  installed yet would crash at launch for every screen — instead only the
  "Choose a file" press fails, and it fails with a sentence.
*/
function loadPicker(): PickerModule | null {
  try {
    return require('@react-native-documents/picker') as PickerModule
  } catch {
    return null
  }
}

/** What the system picker is asked to show. Android wants MIME types, iOS wants UTIs. */
const PICK_TYPES = Platform.select({
  ios: ['com.adobe.pdf', 'public.jpeg', 'public.png'],
  default: ['application/pdf', 'image/jpeg', 'image/png'],
})

const fileNameFrom = (uri: string) => decodeURIComponent(uri.split('/').pop() || '') || 'document'

/**
 * Opens the system picker for one document. Resolves null when the person
 * backs out — that is not an error and nothing should be drawn for it.
 *
 * The picker is asked for PDF, JPG and PNG only, but some Android document
 * providers ignore the request; whatever comes back is returned as picked and
 * `checkEmployerFile` names the fault, so a .docx still reads as "not a PDF,
 * JPG or PNG" rather than as a silent no-op.
 */
export async function pickEmployerDocument(): Promise<PickedFile | null> {
  const picker = loadPicker()
  if (!picker) {
    throw new EmployerUploadError('refused', 'The file picker could not open on this phone.', '', 0)
  }
  let picked: Awaited<ReturnType<PickerModule['pick']>>[number]
  try {
    ;[picked] = await picker.pick({ type: PICK_TYPES, mode: 'import', allowMultiSelection: false })
  } catch (e) {
    if (picker.isErrorWithCode(e) && e.code === picker.errorCodes.OPERATION_CANCELED) return null
    throw new EmployerUploadError('refused', 'The file picker could not open on this phone.', '', 0)
  }

  const name = picked.name || fileNameFrom(picked.uri)
  let size = picked.size ?? null
  if (size == null) {
    try {
      size = (await (await fetch(picked.uri)).blob()).size
    } catch {
      size = 0
    }
  }
  return { uri: picked.uri, name, type: picked.type ?? '', size }
}

/**
 * Validate, presign, then send the bytes straight to storage with a
 * determinate progress callback. Resolves with the key to attach.
 *
 * XHR rather than fetch: it is still the only way to read upload progress, and
 * the only way to abort mid-flight without leaving the bytes going out over
 * somebody's mobile data. Every failure rejects with an EmployerUploadError
 * whose `fault` names what went wrong.
 */
export async function uploadEmployerDocument(
  file: PickedFile,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const cancelled = () => new EmployerUploadError('cancelled', 'Cancelled.', file.name, file.size)

  const refused = checkEmployerFile(file)
  if (refused) throw refused

  // Read the bytes first. S3 signs Content-Length, so the size presigned has to
  // be the size of what is sent, not what the picker believed.
  let body: Blob
  try {
    body = await (await fetch(file.uri)).blob()
  } catch {
    throw new EmployerUploadError('refused', `${file.name} could not be read from this phone.`, file.name, file.size)
  }
  const sized = body.size > 0 && body.size !== file.size ? { ...file, size: body.size } : file
  const resized = checkEmployerFile(sized)
  if (resized) throw resized
  if (opts.signal?.aborted) throw cancelled()

  const contentType = resolveContentType(sized)!
  let presigned: Presigned
  try {
    presigned = await signEmployerUpload({ type: contentType, size: sized.size, name: sized.name })
  } catch (e) {
    if (opts.signal?.aborted) throw cancelled()
    if (e instanceof ApiClientError) {
      throw new EmployerUploadError('refused', e.message, sized.name, sized.size)
    }
    // fetch rejects with a TypeError when there is no network at all.
    throw new EmployerUploadError('network', 'The connection dropped before the upload started and nothing was saved.', sized.name, sized.size)
  }

  await new Promise<void>((resolve, reject) => {
    let sent = 0
    const fail = (fault: UploadFault, message: string) =>
      reject(new EmployerUploadError(fault, message, sized.name, sized.size, sent))

    const xhr = new XMLHttpRequest()
    xhr.open(presigned.method, presigned.url)
    let typed = false
    for (const [k, v] of Object.entries(presigned.headers)) {
      // The platform sets Content-Length from the body itself.
      if (k.toLowerCase() === 'content-length') continue
      if (k.toLowerCase() === 'content-type') typed = true
      xhr.setRequestHeader(k, v)
    }
    // A Blob read from a uri carries no type of its own on every platform.
    if (!typed) xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      sent = e.loaded / e.total
      opts.onProgress?.(sent)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      // A signed URL is refused with 403 once it has expired — a slow line on
      // a big scan is the usual way to get there.
      fail(
        'refused',
        xhr.status === 403
          ? `The upload link expired before ${sized.name} finished.`
          : `Storage did not accept ${sized.name} (error ${xhr.status}).`,
      )
    }
    xhr.onerror = () => fail('network', `The connection dropped at ${Math.round(sent * 100)}% and nothing was saved.`)
    xhr.ontimeout = xhr.onerror
    // abort() fires neither onload nor onerror, so without this the promise
    // never settles and the slot sits at its last percentage for ever.
    xhr.onabort = () => fail('cancelled', 'Cancelled.')
    if (opts.signal) {
      if (opts.signal.aborted) return fail('cancelled', 'Cancelled.')
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(body)
  })

  return presigned.key
}
