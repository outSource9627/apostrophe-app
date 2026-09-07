import { ApiClientError, ErrorCode, type ApiEnvelope } from './types'
import type { TokenStore, Tokens } from './types.tokens'

type Options = {
  baseUrl: string
  tokens: TokenStore
  /** Called when refresh fails — the session is genuinely over. */
  onSignedOut?: () => void
}

type RequestInit_ = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  /** Skip the Authorization header (login, register, refresh). */
  anonymous?: boolean
}

export class ApiClient {
  private refreshing: Promise<Tokens | null> | null = null

  constructor(private readonly opts: Options) {}

  get = <T>(path: string, init: Omit<RequestInit_, 'method' | 'body'> = {}) =>
    this.request<T>(path, { ...init, method: 'GET' })
  post = <T>(path: string, body?: unknown, init: Omit<RequestInit_, 'method'> = {}) =>
    this.request<T>(path, { ...init, method: 'POST', body })
  patch = <T>(path: string, body?: unknown, init: Omit<RequestInit_, 'method'> = {}) =>
    this.request<T>(path, { ...init, method: 'PATCH', body })
  del = <T>(path: string, init: Omit<RequestInit_, 'method'> = {}) =>
    this.request<T>(path, { ...init, method: 'DELETE' })

  async request<T>(path: string, init: RequestInit_ = {}): Promise<T> {
    const res = await this.send(path, init)

    // One retry, and only for an expired access token.
    if (res.status === 401 && !init.anonymous) {
      const refreshed = await this.refreshOnce()
      if (!refreshed) {
        this.opts.onSignedOut?.()
        throw new ApiClientError(ErrorCode.UNAUTHENTICATED, 'Your session expired. Sign in again.', 401)
      }
      return this.unwrap<T>(await this.send(path, init))
    }

    return this.unwrap<T>(res)
  }

  /**
   * Concurrent 401s must produce exactly ONE refresh call.
   *
   * Without this, ten parallel requests on a stale token fire ten refreshes; nine
   * of them present an already-rotated token, and the server's reuse detection
   * (ST-07) correctly revokes the whole family — signing the user out for doing
   * nothing wrong. Everyone awaits the same in-flight promise instead.
   */
  private refreshOnce(): Promise<Tokens | null> {
    if (this.refreshing) return this.refreshing

    this.refreshing = (async () => {
      try {
        const current = await this.opts.tokens.get()
        if (!current?.refreshToken) return null

        const res = await this.send('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: current.refreshToken },
          anonymous: true,
        })
        if (!res.ok) {
          await this.opts.tokens.clear()
          return null
        }
        const json = (await res.json()) as ApiEnvelope<Tokens>
        if ('error' in json) {
          await this.opts.tokens.clear()
          return null
        }
        await this.opts.tokens.set(json.data)
        return json.data
      } catch {
        return null
      } finally {
        // Cleared in a microtask so racers that already grabbed the promise still
        // resolve from it, while the next 401 starts a fresh refresh.
        // Not queueMicrotask: React Native's typings do not declare it.
        Promise.resolve().then(() => {
          this.refreshing = null
        })
      }
    })()

    return this.refreshing
  }

  private async send(path: string, init: RequestInit_): Promise<Response> {
    const url = new URL(this.opts.baseUrl.replace(/\/$/, '') + path)
    for (const [k, v] of Object.entries(init.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }

    const headers: Record<string, string> = { accept: 'application/json' }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (!init.anonymous) {
      const tokens = await this.opts.tokens.get()
      if (tokens?.accessToken) headers.authorization = `Bearer ${tokens.accessToken}`
    }

    return fetch(url.toString(), {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    })
  }

  private async unwrap<T>(res: Response): Promise<T> {
    const requestId = res.headers.get('x-request-id') ?? undefined
    let json: ApiEnvelope<T>
    try {
      json = (await res.json()) as ApiEnvelope<T>
    } catch {
      throw new ApiClientError(ErrorCode.INTERNAL, 'The server returned an unreadable response.', res.status, undefined, requestId)
    }
    if ('error' in json) {
      throw new ApiClientError(json.error.code, json.error.message, res.status, json.error.fields, json.error.requestId ?? requestId)
    }
    return json.data
  }
}
