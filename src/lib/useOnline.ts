import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'

/**
 * Whether the device currently believes it has a usable network — the app half
 * of the web hook, driven by NetInfo instead of `navigator.onLine`.
 *
 * `isInternetReachable` is a floor, not a guarantee: true means an interface is
 * up and reachability probes pass, not that a given request will succeed. So
 * this drives the wizard's chrome, and a failed write still falls back to the
 * queue on its own — both signals are needed and neither is sufficient. It
 * starts optimistic (online) so the offline chrome never flashes on a good
 * connection before the first NetInfo event lands.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // reachable is null while unknown — treat unknown as online, and only the
      // explicit false as offline, so a slow first probe does not show offline.
      const reachable = state.isInternetReachable
      setOnline(Boolean(state.isConnected) && reachable !== false)
    })
    return () => unsub()
  }, [])

  return online
}
