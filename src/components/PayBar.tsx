import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, space, radius, fontSize, fontWeight, fontFamilyNative } from '../theme'

/**
 * ST-13 — a persistent, non-dismissible payment CTA on every screen an unpaid
 * student can reach.
 *
 * No close button and nothing persisted that could hide it: non-dismissible is
 * the requirement, and a dismissible bar is a different feature. It names the
 * price and what the price buys together — a bar that only says "Upgrade" makes
 * people guess, and guessing about money reads as a trap.
 *
 * The action is 52pt and sits above the home indicator, where the thumb is.
 */
export function PayBar({
  amountPaise,
  tierLabel,
  durationMin,
  onPay,
}: {
  amountPaise?: number
  tierLabel?: string
  durationMin?: number
  onPay: () => void
}) {
  const insets = useSafeAreaInsets()
  const rupees = amountPaise != null ? `₹${Math.round(amountPaise / 100).toLocaleString('en-IN')}` : null

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.row}>
        <View style={styles.priceRow}>
          {!!rupees && <Text style={styles.price}>{rupees}</Text>}
          <Text style={styles.detail}>
            {['one-time', tierLabel].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {!!durationMin && <Text style={styles.aside}>{durationMin}-min interview</Text>}
      </View>

      <Pressable
        onPress={onPay}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <Text style={styles.ctaLabel}>Pay and book my interview</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg + 4,
    paddingTop: space.lg - 2,
  },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  price: { fontFamily: fontFamilyNative.display, fontSize: 22, color: color.text },
  detail: { fontSize: 12.5, color: color.textMuted },
  aside: { fontSize: 12.5, color: color.textSubtle },
  cta: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: color.accentHover },
  ctaLabel: { color: color.textInverse, fontSize: fontSize.lg - 2, fontWeight: fontWeight.semibold },
})
