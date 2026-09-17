import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * ST-13-offline — the wizard's saves while the network is gone, the app half of
 * apostrophe-user lib/profile/queue.ts.
 *
 * The web keeps this in localStorage (synchronous); AsyncStorage is a Promise,
 * so the store is async and the wizard reads it once on mount. The promise the
 * board makes — "saved on this phone and syncs the moment you are back" — is
 * only true if the draft outlives the tab, and a mid-range Android kills a
 * backgrounded JS context readily, so it must persist.
 *
 * LAST WRITE PER STEP WINS: saveStep PATCHes a whole step body, not a delta, so
 * a second queued write to a step already contains the first. Keeping both
 * would replay a stale body after a fresh one.
 */
const KEY = 'apostrophe.profile.queue'

export type StepKey = 'personal' | 'education' | 'experience' | 'skills' | 'preferences' | 'documents'

export interface QueuedWrite {
  step: StepKey
  draft: Record<string, unknown>
  at: string
}

export async function readQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : []
  } catch {
    return []
  }
}

async function write(queue: QueuedWrite[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(queue))
  } catch {
    /* No cache available. The in-memory draft still carries the session. */
  }
}

/** Queue this step's body, replacing any earlier one. Returns the new depth. */
export async function enqueue(step: StepKey, draft: Record<string, unknown>): Promise<number> {
  const queue = (await readQueue()).filter((q) => q.step !== step)
  queue.push({ step, draft, at: new Date().toISOString() })
  await write(queue)
  return queue.length
}

export async function peek(step: StepKey): Promise<QueuedWrite | undefined> {
  return (await readQueue()).find((q) => q.step === step)
}

export async function dequeue(step: StepKey): Promise<number> {
  const queue = (await readQueue()).filter((q) => q.step !== step)
  await write(queue)
  return queue.length
}

export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY)
  } catch {
    /* Nothing to clear. */
  }
}

/** 'saved 4:12 pm' — the board's format, in IST wall-clock (fixed +5:30). */
export function clockTime(at: Date | string): string {
  const d = new Date(new Date(at).getTime() + (5 * 60 + 30) * 60000)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
