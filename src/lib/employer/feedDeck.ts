import { useSyncExternalStore } from 'react'
import { ApiClientError } from '../api'
import { employerSession, onEmployerSessionChange } from '../api/employer'
import { fetchCandidateFeed, fetchCardMedia, type CandidateCard, type QuotaView } from '../api/employerFeed'

/**
 * The candidate deck, once for the app — Home's "Today's feed" films and the
 * Feed screen read the SAME cards.
 *
 * WHY ONE DECK: the server charges a card from the day's allowance every time
 * it DELIVERS one (employerLimits.consumeQuota), with no de-duplication. Were
 * Home and Feed to read the deck separately, the employer would pay twice for
 * the same people. Here a card is fetched once, Home shows the next few, and
 * the Feed picks up exactly where they are.
 *
 * The deck is dropped when another employer signs in, when the IST day turns,
 * and when the filters change (the Feed calls `resetDeck`).
 *
 * `i` is the card on top. A swipe or a skip moves it on; a failed swipe or an
 * undo puts a card back at `i`.
 */
export interface DeckState {
  items: CandidateCard[]
  i: number
  more: boolean
  loading: boolean
  error: string | null
  /** The day's cards are spent. */
  cardLimit: boolean
  /** The server says the account is not verified. */
  gated: boolean
  quota: QuotaView | null
  /** True once a first page was asked for, so Home and Feed do not both ask. */
  started: boolean
}

const EMPTY: DeckState = { items: [], i: 0, more: false, loading: false, error: null, cardLimit: false, gated: false, quota: null, started: false }

let state: DeckState = EMPTY
let cursor: string | null = null
let request = 0
let day = istDay()
let session = employerSession()
const listeners = new Set<() => void>()

function istDay(): string {
  // IST is UTC+5:30 with no daylight saving: shift and take the date.
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
}

function set(patch: Partial<DeckState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

/** Forget the deck (filters changed, a new day, another employer). */
export function resetDeck() {
  request++
  cursor = null
  state = EMPTY
  listeners.forEach((l) => l())
}

onEmployerSessionChange(() => {
  session = employerSession()
  resetDeck()
})

function freshen() {
  const today = istDay()
  if (today !== day || session !== employerSession()) {
    day = today
    session = employerSession()
    resetDeck()
  }
}

/**
 * One page. `reset` starts from page one. Not verified, or the day's cards
 * spent, is a state — not an error.
 */
export async function loadDeck(reset: boolean, limit: number): Promise<void> {
  freshen()
  const mine = ++request
  set({ loading: true, error: null, started: true })
  try {
    const res = await fetchCandidateFeed({ cursor: reset ? undefined : cursor ?? undefined, limit })
    if (mine !== request) return
    const list = res.items ?? res.cards ?? []
    const items = reset ? list : [...state.items, ...list.filter((c) => !state.items.some((p) => p.id === c.id))]
    cursor = res.nextCursor ?? null
    set({ items, i: reset ? 0 : state.i, more: Boolean(res.nextCursor), quota: res.quota ?? state.quota, cardLimit: false, gated: false })
  } catch (e) {
    if (mine !== request) return
    if (e instanceof ApiClientError && e.isUnverified) set({ gated: true })
    else if (e instanceof ApiClientError && (e.code === 'RATE_LIMITED' || e.meta?.reason === 'CARD_LIMIT_REACHED')) set({ cardLimit: true })
    else set({ error: e instanceof Error ? e.message : 'Could not load the candidate feed.' })
  } finally {
    if (mine === request) set({ loading: false })
  }
}

/** Ask for the first page unless one was already asked for today. */
export function ensureDeck(limit: number) {
  freshen()
  if (!state.started && !state.loading) loadDeck(true, limit)
}

/** The top card was swiped or skipped. */
export function advanceDeck() {
  set({ i: state.i + 1 })
}

/** Put a card back on top (a failed swipe, an undo, Back after a skip). */
export function restoreCard(card: CandidateCard) {
  const items = [...state.items]
  let i = state.i
  const at = items.findIndex((c) => c.id === card.id)
  if (at >= 0) {
    items.splice(at, 1)
    if (at < i) i -= 1
  }
  items.splice(i, 0, card)
  set({ items, i })
}

/**
 * A decision made somewhere else (the profile page's Pass or Shortlist): the
 * card leaves the deck so the Feed does not offer it again.
 */
export function dropCard(id: string) {
  const at = state.items.findIndex((c) => c.id === id)
  if (at < 0) return
  const items = state.items.filter((c) => c.id !== id)
  set({ items, i: at < state.i ? state.i - 1 : state.i })
}

/** Change one card in place (Interest sent, a fresh film address). */
export function patchCards(fn: (c: CandidateCard) => CandidateCard) {
  set({ items: state.items.map(fn) })
}

/** How often a lapsed film may ask for fresh links, and how many cards one ask covers. */
const MEDIA_EVERY_MS = 30_000
const MEDIA_MAX = 40
let mediaAt = 0

/**
 * A signed film address lapsed: re-sign the cards in hand — the one on top and
 * the ones after it — through POST /employers/feed/media, which charges NOTHING
 * (the server only re-signs cards it dealt this employer today). Reading a feed
 * page again for fresh links would charge every card on it a second time.
 * At most every half minute, however many films fail together.
 */
export async function refreshDeckMedia(ids?: string[]): Promise<void> {
  if (Date.now() - mediaAt < MEDIA_EVERY_MS) return
  const want = (ids ?? state.items.slice(state.i).map((c) => c.id)).slice(0, MEDIA_MAX)
  if (!want.length) return
  mediaAt = Date.now()
  try {
    const { items } = await fetchCardMedia(want)
    const fresh = new Map(items.map((m) => [m.id, m]))
    patchCards((c) => {
      const m = fresh.get(c.id)
      return m ? { ...c, streamUrl: m.streamUrl, posterUrl: m.posterUrl, photoUrl: m.photoUrl ?? c.photoUrl } : c
    })
  } catch {
    /* the poster stays; the next lapse asks again */
  }
}

/** The day's cards ran out mid-swipe. */
export function markCardLimit() {
  set({ cardLimit: true })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useFeedDeck(): DeckState {
  return useSyncExternalStore(subscribe, () => state)
}

/** The cards waiting after the one on top — what Home shows as "Up next". */
export const upcoming = (s: DeckState, n: number) => s.items.slice(s.i, s.i + n)
