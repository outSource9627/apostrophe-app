import { Linking } from 'react-native'

/** The one support address, used everywhere the app sends a student to a person. */
export const SUPPORT_EMAIL = 'support@apostrophe.work'

/** Opens the phone's mail app addressed to support, with an optional subject line. */
export function openSupport(subject?: string) {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}${q}`).catch(() => undefined)
}
