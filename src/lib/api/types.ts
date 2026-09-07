/**
 * The API envelope, mirrored from the platform core (src/server/http/api.ts).
 * When @apostrophe/contracts is published this file is replaced by that import;
 * until then it is the one hand-maintained copy and must stay in step.
 */
export const ErrorCode = {
  VALIDATION: 'VALIDATION',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  UNVERIFIED: 'UNVERIFIED',
  INTERNAL: 'INTERNAL',
} as const
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

export type ApiEnvelope<T> = { data: T } | { error: ApiErrorBody }

export type ApiErrorBody = {
  code: ErrorCodeValue
  message: string
  fields?: Record<string, string>
  requestId?: string
}

export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCodeValue,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }

  /** ST-12/ST-13 — the caller should route to the paywall, not show an error. */
  get isPaywall() {
    return this.code === ErrorCode.PAYMENT_REQUIRED
  }
  /** EM-20/EM-21 — route to the verification prompt. */
  get isUnverified() {
    return this.code === ErrorCode.UNVERIFIED
  }
}
