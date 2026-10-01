import { useCallback } from 'react'
import { StatusBar } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

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
      StatusBar.setBarStyle('light-content')
      return () => StatusBar.setBarStyle('dark-content')
    }, [enabled]),
  )
}
