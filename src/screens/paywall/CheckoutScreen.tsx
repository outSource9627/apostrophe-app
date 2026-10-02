import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { createOrder, mockSettle, settleInDev } from '../../lib/api/payments'
import { color, fontFamilyNative as FF } from '../../theme'
import { Banner } from '../../components/ui'
import { Btn, Panel, Skel, StateBlock } from '../../components/tab/kit'
import { Eyebrow, FlowFooter, FlowHeader, KV, Rule } from '../../components/tab/flow'

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
    <View style={[styles.page, { paddingTop: insets.top }]}><FlowHeader title="Checkout" onBack={onBack} />{child}</View>
  )
  if (me.isPending || cfg.isPending) return frame(<View style={styles.body}><Skel w="40%" h={12} /><Skel w="70%" h={24} /><Skel w="100%" h={140} /></View>)
  if (me.isError || cfg.isError) return frame(
    <StateBlock
      icon="alert"
      title="Could not load your order."
      body="Check your connection and try again."
      action="Try again"
      onAction={() => { me.refetch(); cfg.refetch() }}
    />,
  )

  return frame(
    <>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: 8 }}>
          <Eyebrow tone="accent">Your order</Eyebrow>
          <Text style={styles.h24}>One interview.</Text>
        </View>
        <Panel style={styles.summary}>
          <KV k="Tier" v={tier ? `${tier} · ${TIER_NAME[tier]}` : '—'} />
          <KV k="Length" v={price ? `${price.durationMin} minutes` : '—'} />
          <Rule />
          <KV k="Amount" v={price ? rupees(price.amountPaise) : '—'} big />
        </Panel>
        <Text style={styles.note}>Pay by UPI, card, net banking or wallet — the gateway offers them next. One-time; nothing recurring.</Text>
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </ScrollView>
      <FlowFooter>
        <Btn busy={busy} label="Pay now" onPress={pay} />
        <Text style={styles.secured}>Secured by Razorpay · UPI, cards, netbanking</Text>
      </FlowFooter>
    </>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 20 },
  h24: { fontFamily: FF.bodySemiBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.48, color: color.text },
  summary: { padding: 18, gap: 12 },
  note: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
  secured: { fontFamily: FF.body, fontSize: 12, color: color.textMuted, textAlign: 'center' },
})
