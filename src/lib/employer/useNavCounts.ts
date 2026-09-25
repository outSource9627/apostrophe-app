import { useSyncExternalStore } from 'react'
import { AppState, type NativeEventSubscription } from 'react-native'
import { getEmployerThreads } from '../api/employerChat'

/**
 * The unread count the Chats item carries in the employer nav: the sum of
 * `unread` over the live threads GET /employers/messages returns.
 *
 * One module store however many bars are mounted (the top bar and the bottom
 * bar both read it). It reads on mount, when the app returns to the foreground, and
 * every minute while mounted; a failed read keeps the last count rather than
 * blanking a badge because one request dropped. Notifications need no request
 * here — GET /employers/me already carries `unreadNotifications`.
 */
const REFRESH_MS = 60_000

let count = 0
let started = false
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

async function read() {
  try {
    const { rows } = await getEmployerThreads({ archived: false, perPage: 50 })
    const next = rows.reduce((sum, t) => sum + (t.unread || 0), 0)
    if (next !== count) {
      count = next
      listeners.forEach((l) => l())
    }
  } catch {
    /* keep the last count */
  }
}

const onWake = () => {
  if (AppState.currentState === 'active') void read()
}
let appSub: NativeEventSubscription | null = null

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!started) {
    started = true
    void read()
    timer = setInterval(onWake, REFRESH_MS)
    appSub = AppState.addEventListener('change', onWake)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      appSub?.remove()
      appSub = null
      timer = null
      started = false
    }
  }
}

/** Unread chat messages across live threads. `enabled` false (an unverified account) makes no request and reads 0. */
export function useChatUnread(enabled: boolean): number {
  const n = useSyncExternalStore(enabled ? subscribe : () => () => {}, () => count, () => 0)
  return enabled ? n : 0
}
