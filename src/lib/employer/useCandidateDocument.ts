import { useCallback, useRef, useState } from 'react'
import { Linking } from 'react-native'
import { ApiClientError } from '../api'
import { fetchCandidateDocument } from '../api/employerFeed'

/**
 * ST-35 — open one of a candidate's documents: the CV action on a list row
 * (applicants, shortlist, connections), the Résumé in a chat or on an
 * applicant. A 15-minute signed link from
 * GET /employers/candidates/:id/documents/:docId (spends no quota), handed to
 * the phone, which opens it in the browser or its PDF viewer. One route for
 * every surface; the server decides whether this employer may.
 *
 * `opening` is the document being fetched, so its button can show it is
 * working; one opens at a time. `open` resolves with the sentence to show when
 * it failed (the server's own, when it gave one), or null — the screen puts it
 * where it already shows its notices.
 */
export function useCandidateDocument() {
  const [opening, setOpening] = useState<string | null>(null)
  const busy = useRef(false)

  const open = useCallback(async (candidateId: string, docId: string): Promise<string | null> => {
    if (busy.current) return null
    busy.current = true
    setOpening(docId)
    try {
      const r = await fetchCandidateDocument(candidateId, docId)
      await Linking.openURL(r.url)
      return null
    } catch (e) {
      return e instanceof ApiClientError ? e.message : 'The document did not open. Try again.'
    } finally {
      busy.current = false
      setOpening(null)
    }
  }, [])

  return { opening, open }
}
