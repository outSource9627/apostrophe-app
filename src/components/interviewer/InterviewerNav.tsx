import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, fontFamilyNative, space } from '../../theme'

export type InterviewerNavKey = 'home' | 'interviews' | 'availability' | 'wallet' | 'account'

const ITEMS: { key: InterviewerNavKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'interviews', label: 'Interviews', icon: '📹' },
  { key: 'availability', label: 'Availability', icon: '📅' },
  { key: 'wallet', label: 'Wallet', icon: '💳' },
  { key: 'account', label: 'Account', icon: '👤' },
]

export function InterviewerNav({
  current = 'home',
  onSelect,
  badges,
}: {
  current?: InterviewerNavKey
  onSelect?: (key: InterviewerNavKey) => void
  badges?: Partial<Record<InterviewerNavKey, number>>
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
    backgroundColor: color.surface,
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
    color: color.textSubtle,
  },
  labelActive: {
    color: color.accent,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: color.accent,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamilyNative.mono,
    fontSize: 9,
    fontWeight: '700',
    color: color.surface,
  },
})
