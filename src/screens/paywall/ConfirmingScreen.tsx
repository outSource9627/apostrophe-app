import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { getPaymentStatus } from '../../lib/api/payments'
import { borderWidth, color, height, radius, space } from '../../theme'
import { openSupport } from '../../lib/support'
import { Body, Button, Eyebrow, Meta, ScreenHeader, StickyFooter, text } from '../../components/ui'

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
      <ScreenHeader />
      <View style={styles.body}>
        {pending ? (
          <View style={[styles.disc, styles.discWarn]}><Text style={[text.displayLead, styles.warn]}>!</Text></View>
        ) : (
          <View style={styles.disc}><ActivityIndicator color={color.accent} /></View>
        )}
        <Eyebrow tone="accent">{pending ? 'Still working' : 'Payment submitted'}</Eyebrow>
        <Text style={[text.displayLead, styles.title]}>
          {pending ? 'This is taking a little longer.' : 'Confirming with your bank.'}
        </Text>
        <Body tone="muted" style={styles.copy}>
          {pending
            ? 'Your money is not lost. The confirmation is just slow to reach us — keep waiting here, or email support with the reference below and we will settle it.'
            : 'Your money is safe and your account is being set up. This usually takes a few seconds.'}
        </Body>
        <View style={styles.refRow}>
          <Meta style={{ color: color.textSubtle }}>Reference · {payRef}</Meta>
          {!pending && <Meta style={{ color: color.textSubtle }}>{`Checking · ${mmss}`}</Meta>}
        </View>
      </View>
      {pending && (
        <StickyFooter>
          <Button variant="primary" size="lg" full label="Keep waiting" onPress={() => { setPending(false); setElapsed(0); setRound((r) => r + 1) }} />
          <Button variant="outline" size="md" full label="Email support" onPress={() => { void openSupport(`Payment ${payRef}`) }} />
        </StickyFooter>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { flex: 1, padding: space.xl, justifyContent: 'center' },
  refRow: { marginTop: space.xl, borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingTop: space.md, flexDirection: 'row', justifyContent: 'space-between' },
  disc: { width: height.fab, height: height.fab, borderRadius: radius.pill, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  discWarn: { backgroundColor: color.warningSoft },
  warn: { color: color.warning },
  title: { marginTop: space.sm },
  copy: { marginTop: space.md },
})
