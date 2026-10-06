import { useEffect, useState } from 'react'
import { getConfig } from '../api/config'

/**
 * The chat numbers an admin sets, read off `/config` — the app twin of
 * apostrophe-user's lib/chat/config.ts:
 *
 *   opensHoursBefore / readOnlyHoursAfter   interviewer chats (`chat.*`)
 *   imageMaxBytes / documentMaxBytes        an attachment's size limit
 *                                           (`uploads.CHAT_IMAGE` / `CHAT_DOCUMENT`)
 *
 * A number is null when the backend does not send it (an older one) or the
 * config could not be read. The copy then states the rule without the number:
 * it never falls back to what an admin last happened to set. The server
 * enforces every limit either way.
 */
export interface ChatConfig {
  opensHoursBefore: number | null
  readOnlyHoursAfter: number | null
  imageMaxBytes: number | null
  documentMaxBytes: number | null
}

const NONE: ChatConfig = { opensHoursBefore: null, readOnlyHoursAfter: null, imageMaxBytes: null, documentMaxBytes: null }

// Typed `unknown` on purpose: a live block can be present without the field.
const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

/** Fetched once per app run (getConfig caches), shared with every other reader. */
export function useChatConfig(): ChatConfig {
  const [config, setConfig] = useState<ChatConfig>(NONE)
  useEffect(() => {
    let alive = true
    getConfig()
      .then((c) => {
        if (!alive) return
        setConfig({
          opensHoursBefore: positive(c.chat?.opensHoursBefore),
          readOnlyHoursAfter: positive(c.chat?.readOnlyHoursAfter),
          imageMaxBytes: positive(c.uploads?.CHAT_IMAGE?.maxBytes),
          documentMaxBytes: positive(c.uploads?.CHAT_DOCUMENT?.maxBytes),
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return config
}
