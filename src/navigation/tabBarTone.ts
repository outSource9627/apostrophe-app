import { useEffect, useSyncExternalStore } from 'react'
import { useIsFocused, useRoute } from '@react-navigation/native'

/**
 * Which route, if any, wants the bottom bar drawn dark.
 *
 * The two video feeds do while a card is up (docs/tinder-feed-mockups.html:
 * the black bar under the black deck). Every other screen — and a feed that is
 * showing an empty, error or limit state — keeps the light bar.
 *
 * Keyed by route name, so a screen pushed over the feed gets the light bar back
 * on its first frame instead of waiting for the feed's blur effect.
 */
let darkRoute: string | null = null
const listeners = new Set<() => void>()

function set(next: string | null) {
  if (next === darkRoute) return
  darkRoute = next
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** True when the route on screen asked for the dark bar. */
export function useTabBarDark(routeName?: string) {
  const r = useSyncExternalStore(subscribe, () => darkRoute)
  return !!routeName && r === routeName
}

/** Ask for the dark bar while `on` and this screen is focused. */
export function useDarkTabBar(on: boolean) {
  const route = useRoute()
  const focused = useIsFocused()
  useEffect(() => {
    if (on && focused) set(route.name)
    else if (darkRoute === route.name) set(null)
  }, [on, focused, route.name])
  useEffect(() => () => {
    if (darkRoute === route.name) set(null)
  }, [route.name])
}
