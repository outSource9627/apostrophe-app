import { useEffect, useState } from 'react'

/**
 * A live countdown to a fixed instant, recomputed locally each second — the app
 * half of the web hook. The server sends the slot time; the client counts down.
 * Stops at zero (never negative). 'HH : MM : SS' for the booked well, 'MM : SS'
 * for the join clock.
 */
export function useCountdown(targetIso: string | null): {
  msLeft: number
  hms: string
  ms: string
  expired: boolean
} {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!targetIso) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [targetIso])

  const target = targetIso ? new Date(targetIso).getTime() : now
  const msLeft = Math.max(0, target - now)
  const total = Math.floor(msLeft / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    msLeft,
    hms: `${pad(h)} : ${pad(m)} : ${pad(s)}`,
    ms: `${pad(h * 60 + m)} : ${pad(s)}`,
    expired: msLeft === 0,
  }
}
