import { useEffect, useRef, useState } from 'react'
import type { MessageSearchHit } from '../api/chat'

/** The server's floor (contracts/chat messageSearchQuery: q ≥ 2 characters) and a typing pause. */
export const SEARCH_MIN = 2
const DEBOUNCE_MS = 300

/**
 * "Search people and messages" on every chat list: the list filters by name as
 * you type (the screen does that), and the words go to CH-09 — whole words,
 * two characters or more, attachments and system lines never match. `hits` is
 * null until there is something to search for, [] when nothing matched or the
 * search failed.
 */
export function useChatSearch(search: (q: string, params: { limit?: number }) => Promise<{ rows: MessageSearchHit[] }>) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<MessageSearchHit[] | null>(null)
  const fn = useRef(search)
  fn.current = search

  useEffect(() => {
    const term = query.trim()
    if (term.length < SEARCH_MIN) {
      setHits(null)
      return
    }
    let alive = true
    const t = setTimeout(() => {
      fn.current(term, { limit: 20 })
        .then((r) => alive && setHits(r.rows))
        .catch(() => alive && setHits([]))
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query])

  return { query, setQuery, hits, term: query.trim().toLowerCase() }
}
