import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { createOrder, mockSettle, settleInDev } from '../../lib/api/payments'
import { color, space, height } from '../../theme'
import { Banner, Body, Button, Card, Divider, ErrorState, Eyebrow, ScreenHeader, Skeleton, StickyFooter, text } from '../../components/ui'

interface Me { qualification?: string }
const TIER_NAME: Record<string, string> = { T1: 'Class 12', T2: 'Graduation', T3: 'Post Graduation', T4: 'PhD' }
const rupees = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`

/**
 * ST-07 — the order summary, then hand off to the gateway. Nothing here
 * congratulates the student: returning from checkout proves nothing, so the
 * button opens the gateway and the CONFIRMING screen (fed the paymentId) is
 * what waits for the webhook.
 *
 * The gateway is Razorpay's native SDK in production; in dev, or when Razorpay
 * is unconfigured (orderId null), it settles through the mock endpoint so the
 * flow is walkable without keys. The SDK is required lazily so an unlinked
 * native module never breaks module load or the test render.
 */
export function CheckoutScreen({ onBack, onConfirming }: { onBack: () => void; onConfirming: (paymentId: string) => void }) {
  const insets = useSafeAreaInsets()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/students/me') })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setBusy(true); setError(null)
    try {
      const order = await createOrder()
      // Razorpay configured → open the real native gateway. This is the ONLY
      // path that may settle a real payment.
      if (order.orderId && order.keyId) {
        try {
          // Lazy require: never pulled in at module load or in the test env.
          const RazorpayCheckout = require('react-native-razorpay').default
          await RazorpayCheckout.open({
            key: order.keyId,
            order_id: order.orderId,
            amount: order.amountPaise,
            currency: 'INR',
            name: 'Apostrophe',
            description: `${TIER_NAME[order.tier] ?? order.tier} interview`,
            theme: { color: color.accent },
          })
          // The gateway callback proves nothing — the webhook does. Poll /status.
          // On a laptop the webhook cannot arrive, so dev stands in for it (as web does).
          await settleInDev(order.paymentId)
          onConfirming(order.paymentId)
          return
        } catch (sdkErr) {
          // react-native-razorpay error codes: 2 = PAYMENT_CANCELED (user
          // dismissed — return quietly), 0 = NETWORK_ERROR, others = decline.
          const code = (sdkErr as { code?: number })?.code
          if (code === 2) { setBusy(false); return }
          // NEVER settle a real, configured payment client-side. A gateway
          // error is a failure the student must see — not a silent grant. The
          // mock bypass below is DEV-ONLY and unreachable here in production.
          if (!__DEV__) {
            setBusy(false)
            setError(code === 0 ? 'The payment could not reach the gateway. Check your connection and try again.' : 'The payment did not go through. Try again.')
            return
          }
        }
      } else if (!__DEV__) {
        // No order id in production means the gateway is misconfigured — do not
        // fall through to a free entitlement.
        setBusy(false)
        setError('Checkout is unavailable right now. Please try again shortly.')
        return
      }
      // DEV ONLY: settle without a live gateway so the flow is walkable before a
      // native build. `mockSettle` grants the entitlement with no webhook, so it
      // must never run in a release build — the guards above ensure that.
      await mockSettle(order.paymentId)
      onConfirming(order.paymentId)
    } catch (e) {
      setBusy(false)
      setError(e instanceof ApiClientError ? e.message : 'Could not start the payment. Try again.')
    }
  }

  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api.get<{ tiers: { tier: string; amountPaise: number; durationMin: number }[]; qualifications: { value: string; tier: string }[] }>('/config') })
  const tier = cfg.data?.qualifications.find((q) => q.value === me.data?.qualification)?.tier
  const price = cfg.data?.tiers.find((t) => t.tier === tier)

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><ScreenHeader title="Checkout" onBack={onBack} />{child}</View>
  )
  if (me.isPending || cfg.isPending) return frame(<View style={styles.body}><Skeleton lines={4} /></View>)
  if (me.isError || cfg.isError) return frame(
    <View style={styles.centre}>
      <ErrorState
        title="Could not load your order."
        body="Check your connection and try again."
        action={
          <Button
            variant="outline"
            size="sm"
            label="Try again"
            // The error state's small button is 40 tall; the slop brings its tap box to the 44 floor.
            hitSlop={(height.tap - height['control-xs']) / 2}
            onPress={() => { me.refetch(); cfg.refetch() }}
          />
        }
      />
    </View>,
  )

  return frame(
    <>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow tone="accent">Your order</Eyebrow>
          <Text style={text.displayHeading}>One interview.</Text>
        </View>
        <Card style={styles.summary}>
          <View style={styles.sumRow}><Body tone="muted">Tier</Body><Body weight="medium">{tier ? `${tier} · ${TIER_NAME[tier]}` : '—'}</Body></View>
          <View style={styles.sumRow}><Body tone="muted">Length</Body><Body weight="medium">{price ? `${price.durationMin} minutes` : '—'}</Body></View>
          <Divider />
          <View style={styles.sumRow}><Body tone="muted">Amount</Body>{price ? <Text style={text.displaySm}>{rupees(price.amountPaise)}</Text> : <Body>—</Body>}</View>
        </Card>
        <Body size="sm" tone="muted">Pay by UPI, card, net banking or wallet — the gateway offers them next. One-time; nothing recurring.</Body>
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </ScrollView>
      <StickyFooter>
        <Button variant="primary" size="lg" full busy={busy} label="Pay now" onPress={pay} />
        <Text style={[text.metaXs, styles.secured]}>Secured by Razorpay · UPI, cards, netbanking</Text>
      </StickyFooter>
    </>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingTop: space.xs, gap: space.xl },
  summary: { padding: space.lg, gap: space.md },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  secured: { color: color.textMuted, textAlign: 'center', textTransform: 'none' },
})
