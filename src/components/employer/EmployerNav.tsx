import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, radius, space, fontFamilyNative } from '../../theme'

export type EmployerNavKey = 'feed' | 'shortlist' | 'interests' | 'jobs' | 'chat'

const ITEMS: { key: EmployerNavKey; label: string; icon: string }[] = [
  { key: 'feed', label: 'Feed', icon: '▤' },
  { key: 'shortlist', label: 'Shortlist', icon: '🔖' },
  { key: 'interests', label: 'Interests', icon: '♥' },
  { key: 'jobs', label: 'Jobs', icon: '💼' },
  { key: 'chat', label: 'Chats', icon: '💬' },
]

export function EmployerNav({
  current = 'feed',
  onSelect,
  badges,
}: {
  current?: EmployerNavKey
  onSelect?: (key: EmployerNavKey) => void
  badges?: Partial<Record<EmployerNavKey, number>>
}) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {ITEMS.map((item) => {
        const active = item.key === current
        const badge = badges?.[item.key]

        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.7}
            onPress={() => onSelect?.(item.key)}
            style={styles.tab}
          >
            <View style={styles.iconBox}>
              <Text style={[styles.icon, active && styles.iconActive]}>{item.icon}</Text>
              {badge != null && badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: color.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: 8,
    paddingHorizontal: space.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  iconBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 24,
  },
  icon: {
    fontSize: 18,
    color: color.textSubtle,
  },
  iconActive: {
    color: color.accent,
  },
  label: {
    fontFamily: fontFamilyNative.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: color.textSubtle,
  },
  labelActive: {
    fontWeight: '600',
    color: color.accent,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: color.accent,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.pill,
    minWidth: 16,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
})
