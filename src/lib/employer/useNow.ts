import { useSyncExternalStore } from 'react'

/**
 * The wall clock, ticking once a second, shared by everything that counts down.
 *
 * EM-03 draws two resend countdowns on one screen, each with its own timer,
 * and two intervals drift a second apart within a minute — which reads as a
 * bug on a screen whose whole point is that the rows are independent but
 * honest. One ticker, read by both, keeps them in step. It runs only while
 * something is subscribed.
 *
 * The server snapshot is 0: nothing is counting down in markup generated before
 * any device is involved, and a caller treats 0 as "no clock yet".
 */
let now = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export const useNow = () => useSyncExternalStore(subscribe, () => now, () => 0)

/** Whole seconds from `now` until `until` (epoch ms). 0 when passed, unknown, or before the clock starts. */
export function secondsUntil(until: number | null | undefined, nowMs: number): number {
  if (!until || !nowMs) return 0
  return Math.max(0, Math.ceil((until - nowMs) / 1000))
}
