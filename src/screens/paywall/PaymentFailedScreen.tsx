import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ApiClientError } from '../../lib/api'
import { createOrder, mockSettle } from '../../lib/api/payments'
import { color, space } from '../../theme'
import { AppBar, Banner, Button, Display, Eyebrow } from '../../components/ui'

/**
 * ST-09 — payment failed. The reason is quoted in the gateway's own words, not
 * rewritten. Retry is the one primary action, and it opens a FRESH order (after
 * a failure the server hands back a new paymentId; the old order is never
 * reopened). A secondary route back to pricing.
 */
export function PaymentFailedScreen({
  reason, onConfirming, onPricing,
}: { reason: string | null; onConfirming: (paymentId: string) => void; onPricing: () => void }) {
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function retry() {
    setBusy(true); setError(null)
    try {
      // A fresh order — after a failure the server returns a new paymentId; the
      // old order is never reopened.
      const order = await createOrder()
      if (order.orderId && order.keyId) {
        try {
          const RazorpayCheckout = require('react-native-razorpay').default
          await RazorpayCheckout.open({
            key: order.keyId, order_id: order.orderId, amount: order.amountPaise,
            currency: 'INR', name: 'Apostrophe', theme: { color: '#B01E24' },
          })
          onConfirming(order.paymentId); return
        } catch (sdkErr) {
          const code = (sdkErr as { code?: number })?.code
          if (code === 2) { setBusy(false); return } // user cancelled
          // Never settle a real, configured payment client-side (see Checkout).
          if (!__DEV__) {
            setBusy(false)
            setError(code === 0 ? 'The payment could not reach the gateway. Check your connection and try again.' : 'The payment did not go through. Try again.')
            return
          }
        }
      } else if (!__DEV__) {
        setBusy(false); setError('Checkout is unavailable right now. Please try again shortly.'); return
      }
      // DEV ONLY — see CheckoutScreen.
      await mockSettle(order.paymentId)
      onConfirming(order.paymentId)
    } catch (e) {
      setBusy(false)
      setError(e instanceof ApiClientError ? e.message : 'Could not retry. Try again.')
    }
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="" onBack={onPricing} />
      <View style={styles.body}>
        <Eyebrow tone="danger">Payment failed</Eyebrow>
        <Display level="lg" style={{ marginTop: space.sm }}>That didn&apos;t go through.</Display>
        <Banner tone="danger" style={styles.reasonCard}>
          {reason ? `"${reason}"` : 'The gateway declined the payment. No money was taken.'}
        </Banner>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <View style={{ marginTop: space.xl, gap: space.md }}>
          <Button variant="primary" size="lg" full busy={busy} label="Try again" onPress={retry} />
          <Button variant="text" size="md" label="Back to pricing" onPress={onPricing} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  body: { flex: 1, padding: space.xl, justifyContent: 'center' },
  reasonCard: { marginTop: space.lg },
})
