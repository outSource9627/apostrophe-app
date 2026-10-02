import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { borderWidth, color, height, radius, space } from '../../theme'
import { Icon } from '../ui/Icon'

/**
 * The round Chat button in a tab screen's top-right: the same look as the
 * feeds' round top buttons (FeedTopButton, light). Chat has no tab of its own,
 * so every tab screen carries this and it opens the chat list.
 */
export function ChatButton({ onPress, unread }: { onPress: () => void; unread?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? 'Chats, unread' : 'Chats'}
      onPress={onPress}
      hitSlop={space.xs}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Icon name="chat" size={space.lg + 2} tint={color.text} />
      {!!unread && <View style={styles.dot} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: height['feed-top'], height: height['feed-top'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface,
  },
  pressed: { opacity: 0.7 },
  dot: {
    position: 'absolute', top: 0, right: 0, width: space.sm + space['2xs'], height: space.sm + space['2xs'], borderRadius: radius.pill,
    backgroundColor: color.accent, borderWidth: borderWidth.accent, borderColor: color.background,
  },
})
