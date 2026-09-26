import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button, StickyFooter, text } from './ui'
import { color, space } from '../theme'

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
  const rupees = amountPaise != null ? `₹${Math.round(amountPaise / 100).toLocaleString('en-IN')}` : null

  return (
    <StickyFooter>
      <View style={styles.row}>
        <View style={styles.priceRow}>
          {!!rupees && <Text style={text.displaySm}>{rupees}</Text>}
          <Text style={[text.uiXs, styles.detail]}>
            {['one-time', tierLabel].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {!!durationMin && <Text style={[text.uiXs, styles.aside]}>{durationMin}-min interview</Text>}
      </View>
      <Button variant="primary" size="lg" full label="Pay and book my interview" onPress={onPay} />
    </StickyFooter>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  detail: { color: color.textMuted },
  aside: { color: color.textSubtle },
})
