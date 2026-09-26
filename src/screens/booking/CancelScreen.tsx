import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { cancelInterview, type CancelOutcome, type StudentInterview } from '../../lib/api/interviews'
import { bookingRef, fmtShortDate, fmtTime, weekdayLong } from '../../lib/interviews/slots'
import { color, space, spaceHalf, trackingNative } from '../../theme'
import { Banner, Button, Card, ErrorState, Field, InkButton, InkCard, InkPill, Input, ScreenHeader, Skeleton, StickyFooter, text } from '../../components/ui'
import { hoursPhrase, useBookingRules } from '../../lib/interviews/rules'

interface Config { tiers: { tier: string; amountPaise: number }[] }

/**
 * ST-28 / ST-28-nonrefundable — the money is stated FIRST, above the button,
 * never in a red modal and never first on the success screen. Refundable vs
 * forfeit is decided by time-to-slot, as the server decides it. The reason
 * field is not on the board but `/cancel` requires one (3–500 chars) — a human
 * settles the refund from it — so it sits quietly below the outcome.
 */
export function CancelScreen({
  id, onBack, onKeep, onReschedule, onBooked,
}: {
  id: string; onBack: () => void; onKeep: () => void; onReschedule: (id: string) => void; onBooked: () => void
}) {
  const insets = useSafeAreaInsets()
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<CancelOutcome | null>(null)
  const [now] = useState(() => Date.now())

  const iv = useQuery({ queryKey: ['interview', id], queryFn: () => api.get<StudentInterview>(`/interviews/${id}`) })
  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })
  const booking = useBookingRules()
  const mut = useMutation({
    mutationFn: () => cancelInterview(id, reason.trim()),
    onSuccess: setOutcome,
  })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><ScreenHeader title="Cancel interview" onBack={onBack} />{child}</View>
  )
  if (iv.isPending || cfg.isPending || booking.pending) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (iv.isError || !booking.rules) return frame(
    <View style={styles.centre}>
      <ErrorState
        title="Could not load this interview."
        body={booking.error ?? 'Nothing was cancelled. Try again.'}
        action={<Button variant="outline" size="sm" label="Try again" onPress={() => { void iv.refetch(); booking.retry() }} />}
      />
    </View>,
  )

  const rules = booking.rules
  const data = iv.data!
  const amountPaise = cfg.data?.tiers.find((t) => t.tier === data.tier)?.amountPaise
  const amount = amountPaise != null ? `₹${Math.round(amountPaise / 100).toLocaleString('en-IN')}` : null
  const hoursToSlot = (new Date(data.slotStart).getTime() - now) / 3_600_000
  const windowHours = rules.freeCancellationHours
  // Null when the backend does not say the window: the outcome is then the server's to state.
  const refundable = windowHours == null ? null : hoursToSlot > windowHours
  const windowText = windowHours == null ? 'the free-cancellation window' : hoursPhrase(windowHours)
  const wk = weekdayLong(data.slotStart), t = fmtTime(data.slotStart)
  const err = mut.error instanceof ApiClientError ? mut.error.message : mut.isError ? 'Could not cancel. Nothing has changed — try again.' : null
  const short = reason.trim().length < 3

  if (outcome) {
    const gotRefund = outcome.outcomeOwed === 'FULL_REFUND'
    return frame(
      <>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Text style={[text.metaMd, styles.eyebrow]}>{`CANCELLED · ${bookingRef(data.id)}`}</Text>
            <Text style={text.displayLead}>{wk} {t} is cancelled.</Text>
          </View>
          <Card style={styles.money}>
            <Text style={text.displayMd}>{gotRefund && amount ? amount : '₹0'}</Text>
            <Text style={[text.uiMd, styles.muted]}>{gotRefund ? 'owed back in full, the way you paid' : `back — this was inside ${windowText}`}</Text>
          </Card>
          {outcome.entitlementRestored && (
            <Banner tone="neutral">Your interview is unused again. Book whenever you are ready.</Banner>
          )}
          <Text style={[text.uiXs, styles.subtle]}>{`Cancelled ${fmtShortDate(new Date(now).toISOString())}`}</Text>
        </ScrollView>
        <StickyFooter inset={false}>
          <Button variant="primary" size="lg" full label="Book another interview" onPress={onBooked} />
        </StickyFooter>
      </>,
    )
  }

  return frame(
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={[text.metaMd, styles.eyebrow]}>
            {`${fmtShortDate(data.slotStart)} · ${t} · ${refundable === false ? `IN ${Math.max(1, Math.round(hoursToSlot))} HOURS` : data.tier}`.toUpperCase()}
          </Text>
          <Text style={text.displayLead}>Cancel this interview.</Text>
        </View>

        {refundable === true && (
          <Card style={styles.money}>
            <Text style={[text.metaSm, styles.eyebrow]}>IF YOU CANCEL NOW</Text>
            <View style={styles.figureRow}>
              {amount ? <Text style={[text.displayMd, styles.good]}>{amount}</Text> : null}
              <Text style={[text.uiMd, styles.muted]}>owed back in full</Text>
            </View>
            <Text style={text.uiMd}>Your interview comes back unused. You can book again straight away. {wk} {t} goes back to the interviewers.</Text>
          </Card>
        )}

        {refundable === false && (
          <>
            <Card style={[styles.money, styles.danger]}>
              <Text style={[text.metaSm, styles.dangerText]}>IF YOU CANCEL NOW</Text>
              <View style={styles.figureRow}>
                <Text style={text.displayMd}>₹0</Text>
                <Text style={[text.uiMd, styles.muted]}>back</Text>
              </View>
              <Text style={text.uiMd}>{`You are inside ${windowText} of the start, so the ${amount ?? 'fee'} is forfeit and your interview is spent.`}</Text>
            </Card>
            <InkCard>
              <InkPill label="Your one free move" />
              <Text style={[text.displaySm, styles.onInk]}>Move it instead. It costs nothing.</Text>
              <Text style={[text.uiSm, styles.onInkMuted]}>{`We put you in another slot and your ${amount ?? 'fee'} stays where it is. Inside ${hoursPhrase(rules.rescheduleCutoffHours)} an admin confirms the new slot, the same day.`}</Text>
              <InkButton label="Move my interview instead" onPress={() => onReschedule(id)} />
            </InkCard>
          </>
        )}

        {refundable === null && (
          <Card style={styles.money}>
            <Text style={[text.metaSm, styles.eyebrow]}>IF YOU CANCEL NOW</Text>
            <Text style={text.uiMd}>{`Cancelling ahead of ${windowText} refunds ${amount ?? 'the fee'} in full; inside it, nothing comes back. We confirm which applies when you cancel.`}</Text>
          </Card>
        )}

        <Field label="Why are you cancelling?" helper="One line, for our records — it is how a refund gets settled.">
          <Input value={reason} onChangeText={setReason} placeholder="Something came up…" multiline maxLength={500} />
        </Field>
        {err ? <Banner tone="danger">{err}</Banner> : null}
      </ScrollView>

      <StickyFooter inset={false}>
        <Text style={[text.uiXs, styles.muted]}>
          {refundable === false
            ? `Confirm and ${wk} ${t} is cancelled, nothing comes back, and the interview you paid for is gone.`
            : `Confirm and ${wk} ${t} is cancelled.${refundable && amount ? ` ${amount} is owed back the way you paid it.` : ''}`}
        </Text>
        <View style={styles.footRow}>
          {refundable !== false && (
            <View style={styles.keep}><Button variant="outline" size="lg" full label="Keep it" onPress={onKeep} /></View>
          )}
          <View style={styles.grow}>
            <Button
              variant="destructive"
              size="lg"
              full
              busy={mut.isPending}
              disabled={short}
              label={refundable === true && amount ? `Cancel · refund ${amount}` : refundable === false ? 'Cancel — no refund' : 'Cancel interview'}
              onPress={() => mut.mutate()}
            />
          </View>
        </View>
        {short && <Text style={[text.uiXs, styles.subtle]}>Add a line above so we can see why.</Text>}
      </StickyFooter>
    </>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md, paddingBottom: space.xl },
  head: { gap: space.sm, paddingHorizontal: space.xs, paddingBottom: space.xs },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  good: { color: color.success },
  money: { padding: space.lg, gap: space.sm },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  danger: { borderColor: color.dangerBorder, backgroundColor: color.dangerSoft },
  dangerText: { color: color.danger, letterSpacing: trackingNative.eyebrow },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
  footRow: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  keep: { width: '34%' },
  grow: { flex: 1 },
})
