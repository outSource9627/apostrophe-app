import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { getPaymentStatus } from '../../lib/api/payments'
import { color, space, borderWidth } from '../../theme'
import { AppBar, Body, Button, Display, Eyebrow, Meta } from '../../components/ui'

/**
 * ST-08 — the wait while the webhook settles. The money is safe and the account
 * is being set up; this polls /status for up to 90 seconds. There is NO error
 * dressing on the still-pending state — nothing has gone wrong, the webhook is
 * slow — it states the money is not lost and hands over a reference.
 *
 * SUCCESS here is the ONLY confirmation the client trusts (the gateway callback
 * proves nothing). On SUCCESS `me` is invalidated so the app flips to paid.
 */
const POLL_MS = 2500
const TIMEOUT_MS = 90_000

export function ConfirmingScreen({
  paymentId, onDone, onFailed,
}: { paymentId: string; onDone: () => void; onFailed: (paymentId: string, reason: string | null) => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)
  const started = useRef(Date.now())
  const payRef = `PAY-${paymentId.slice(-7).toUpperCase()}`

  useEffect(() => {
    let live = true
    const tick = async () => {
      if (!live) return
      try {
        const s = await getPaymentStatus(paymentId)
        if (!live) return
        if (s.status === 'SUCCESS') { qc.invalidateQueries({ queryKey: ['me'] }); onDone(); return }
        if (s.status === 'FAILED') { onFailed(paymentId, s.failureReason); return }
      } catch { /* transient — keep polling */ }
      if (Date.now() - started.current > TIMEOUT_MS) { setPending(true); return }
      setTimeout(tick, POLL_MS)
    }
    tick()
    return () => { live = false }
  }, [paymentId, onDone, onFailed, qc])

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <AppBar title="" />
      <View style={styles.body}>
        <Eyebrow>{pending ? 'Still working' : 'One-time'}</Eyebrow>
        <Display level="lg" style={{ marginTop: space.sm }}>
          {pending ? 'This is taking a little longer.' : 'Confirming with your bank.'}
        </Display>
        <Body tone="muted" style={{ marginTop: space.md }}>
          {pending
            ? 'Your money is not lost. The confirmation is just slow to reach us — you can wait here, or reach support with the reference below and we will settle it.'
            : 'Your money is safe and your account is being set up. This usually takes a few seconds.'}
        </Body>
        <View style={styles.refRow}>
          <Meta style={{ color: color.textSubtle }}>Reference · {payRef}</Meta>
        </View>
        {pending && (
          <View style={{ marginTop: space.xl, gap: space.md }}>
            <Button variant="outline" size="block" full label="I'll wait" onPress={() => { started.current = Date.now(); setPending(false) }} />
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  body: { flex: 1, padding: space.xl, justifyContent: 'center' },
  refRow: { marginTop: space.xl, borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: space.md },
})
