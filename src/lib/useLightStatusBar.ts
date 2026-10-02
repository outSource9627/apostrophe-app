import { useCallback } from 'react'
import { StatusBar } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

/**
 * How many focused screens want light icons right now. Moving between two such
 * screens (Home → the job feed) focuses the new one BEFORE the old one blurs,
 * so a plain "set dark on blur" would land last and leave dark icons on a dark
 * screen. Counting means the old screen's blur only puts dark icons back when
 * no one else still wants light ones.
 */
let lightRequests = 0

/**
 * A screen whose top is dark or violet (the Home header, the full-screen job
 * feed) wants light status-bar icons while it is focused. The app default is
 * dark icons on a paper ground, so this puts that back on blur. Pass `false`
 * for a moment when the top is light after all (the feed's empty state).
 */
export function useLightStatusBar(enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined
      lightRequests += 1
      StatusBar.setBarStyle('light-content')
      return () => {
        lightRequests = Math.max(0, lightRequests - 1)
        StatusBar.setBarStyle(lightRequests > 0 ? 'light-content' : 'dark-content')
      }
    }, [enabled]),
  )
}
