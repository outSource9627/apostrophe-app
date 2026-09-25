import { useEffect, useState } from 'react'
import { getConfig } from '../api/config'
import { INTEREST_MESSAGE_MAX_LENGTH } from '../api/employerInterests'

/** What the server says about the shortlist's notes and the CSV, beside `config.employer`. */
interface ShortlistBlock {
  shortlist?: {
    notesMaxLength?: number
    tagsMax?: number
    tagMaxLength?: number
    exportColumns?: string[]
  }
}

/** The shortlist's own fallback when the config carries no note limit — the server's contract value. */
const NOTE_MAX_FALLBACK = 2000
const TAGS_MAX_FALLBACK = 20
const TAG_MAX_LENGTH_FALLBACK = 40

export interface ShortlistConfig {
  /** Days an unanswered Interest stays open. Absent: the copy leaves the number out. */
  interestExpiryDays?: number
  /** Days between two Interests to one candidate. Absent: the copy leaves the sentence out. */
  interestCooldownDays?: number
  messageMax: number
  noteMax: number
  tagsMax: number
  tagMax: number
  /** The CSV's column names, as the server writes them. Empty when the config does not list them. */
  exportColumns: string[]
}

const DEFAULTS: ShortlistConfig = {
  messageMax: INTEREST_MESSAGE_MAX_LENGTH,
  noteMax: NOTE_MAX_FALLBACK,
  tagsMax: TAGS_MAX_FALLBACK,
  tagMax: TAG_MAX_LENGTH_FALLBACK,
  exportColumns: [],
}

/**
 * The admin-controlled numbers the shortlist, Send Interest and Interests
 * screens print. Read from /config once; until it lands (or if it fails) the
 * limits are the server's contract values and the day counts are absent, which
 * the copy handles by leaving the number — or the sentence — out.
 */
export function useShortlistConfig(): ShortlistConfig {
  const [cfg, setCfg] = useState<ShortlistConfig>(DEFAULTS)

  useEffect(() => {
    let live = true
    getConfig()
      .then((c) => {
        if (!live) return
        const e = c.employer
        const s = (e as ShortlistBlock | undefined)?.shortlist
        setCfg({
          interestExpiryDays: e?.interestExpiryDays,
          interestCooldownDays: e?.interestCooldownDays,
          messageMax: e?.interestMessageMaxChars ?? DEFAULTS.messageMax,
          noteMax: e?.shortlistNoteMaxChars ?? s?.notesMaxLength ?? DEFAULTS.noteMax,
          tagsMax: s?.tagsMax ?? DEFAULTS.tagsMax,
          tagMax: s?.tagMaxLength ?? DEFAULTS.tagMax,
          exportColumns: s?.exportColumns ?? [],
        })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  return cfg
}
