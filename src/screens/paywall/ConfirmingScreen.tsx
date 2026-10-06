import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { getPaymentStatus } from '../../lib/api/payments'
import { borderWidth, color, fontFamilyNative as FF, fontSize } from '../../theme'
import { openSupport } from '../../lib/support'
import { Btn } from '../../components/tab/kit'
import { Disc, Eyebrow, FlowFooter, FlowHeader, Lead, Sub } from '../../components/tab/flow'

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
  // Bumped by "I'll wait": a new round restarts the poll and its 90-second clock.
  const [round, setRound] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const payRef = `PAY-${paymentId.slice(-7).toUpperCase()}`

  // The callbacks are recreated on every parent render; the poll reads the latest
  // through refs so a navigation elsewhere never restarts it.
  const done = useRef(onDone); done.current = onDone
  const failed = useRef(onFailed); failed.current = onFailed

  useEffect(() => {
    let live = true
    const started = Date.now()
    const clock = setInterval(() => live && setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    const tick = async () => {
      if (!live) return
      try {
        const s = await getPaymentStatus(paymentId)
        if (!live) return
        if (s.status === 'SUCCESS') { live = false; void qc.invalidateQueries({ queryKey: ['me'] }); done.current(); return }
        if (s.status === 'FAILED') { live = false; failed.current(paymentId, s.failureReason); return }
      } catch { /* transient — keep polling */ }
      if (!live) return
      if (Date.now() - started > TIMEOUT_MS) { setPending(true); return }
      setTimeout(tick, POLL_MS)
    }
    void tick()
    return () => { live = false; clearInterval(clock) }
  }, [paymentId, qc, round])

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <FlowHeader />
      <View style={styles.body}>
        {pending ? (
          <Disc tone="warn"><Text style={styles.bang}>!</Text></Disc>
        ) : (
          <Disc tone="accent"><ActivityIndicator color={color.accent} /></Disc>
        )}
        <Eyebrow tone={pending ? 'warn' : 'accent'}>{pending ? 'Still working' : 'Payment submitted'}</Eyebrow>
        <Lead>{pending ? 'This is taking a little longer.' : 'Confirming with your bank.'}</Lead>
        <Sub>
          {pending
            ? 'Your money is not lost. The confirmation is just slow to reach us — keep waiting here, or email support with the reference below and we will settle it.'
            : 'Your money is safe and your account is being set up. This usually takes a few seconds.'}
        </Sub>
        <View style={styles.refRow}>
          <Text style={styles.ref}>Reference · {payRef}</Text>
          {!pending && <Text style={styles.ref}>{`Checking · ${mmss}`}</Text>}
        </View>
      </View>
      {pending && (
        <FlowFooter>
          <Btn label="Keep waiting" onPress={() => { setPending(false); setElapsed(0); setRound((r) => r + 1) }} />
          <Btn variant="outline" label="Email support" onPress={() => { void openSupport(`Payment ${payRef}`) }} />
        </FlowFooter>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 60, gap: 14 },
  bang: { fontFamily: FF.bodyBold, fontSize: 26, color: color.warning },
  refRow: { marginTop: 10, borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  ref: { fontFamily: FF.bodyMedium, fontSize: fontSize['meta-md'], fontVariant: ['tabular-nums'], color: color.textSubtle },
})
