import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiClientError } from '../../lib/api'
import { cancelInterview, type CancelOutcome, type StudentInterview } from '../../lib/api/interviews'
import { bookingRef, fmtShortDate, fmtTime, weekdayLong } from '../../lib/interviews/slots'
import { color, space } from '../../theme'
import { AppBar, Banner, Body, Button, Card, Display, Divider, Eyebrow, Figure, Meta, StatusPill } from '../../components/ui'
import { Field, Input } from '../../components/ui'

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
  const mut = useMutation({
    mutationFn: () => cancelInterview(id, reason.trim()),
    onSuccess: setOutcome,
  })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Interview" onBack={onBack} />{child}</View>
  )
  if (iv.isPending || cfg.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (iv.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load this interview.</Body></View>)

  const data = iv.data!
  const amountPaise = cfg.data!.tiers.find((t) => t.tier === data.tier)?.amountPaise
  const amount = amountPaise != null ? `₹${Math.round(amountPaise / 100).toLocaleString('en-IN')}` : null
  const hoursToSlot = (new Date(data.slotStart).getTime() - now) / 3_600_000
  const refundable = hoursToSlot > 12
  const wk = weekdayLong(data.slotStart), t = fmtTime(data.slotStart)
  const err = mut.error instanceof ApiClientError ? mut.error.message : mut.isError ? 'Could not cancel. Try again.' : null

  if (outcome) {
    const gotRefund = outcome.outcomeOwed === 'FULL_REFUND'
    return frame(
      <ScrollView contentContainerStyle={styles.body}>
        <StatusPill tone="neutral" label="Cancelled" />
        <Display level="sm">{wk} {t} is cancelled.</Display>
        <View style={{ gap: space.sm }}>
          <View style={styles.figureRow}>
            <Figure value={gotRefund && amount ? amount : '₹0'} />
            <Body size="sm" tone="muted">{gotRefund ? 'owed back in full' : 'back — this was inside twelve hours'}</Body>
          </View>
          <Meta style={{ color: color.textSubtle }}>Booking #{bookingRef(data.id)} · cancelled {fmtShortDate(new Date(now).toISOString())}</Meta>
        </View>
        {outcome.entitlementRestored && (
          <Banner tone="neutral">Your interview is unused again. Book whenever you are ready.</Banner>
        )}
        <View style={{ marginTop: 'auto', paddingBottom: insets.bottom }}>
          <Button variant="primary" size="lg" full label="Book another interview" onPress={onBooked} />
        </View>
      </ScrollView>,
    )
  }

  return frame(
    <ScrollView contentContainerStyle={styles.body}>
      <View style={{ gap: space.sm }}>
        <Eyebrow>
          {refundable
            ? `${fmtShortDate(data.slotStart)} · ${t} · ${data.tier}`
            : `${fmtShortDate(data.slotStart)} · ${t} · in ${Math.max(1, Math.round(hoursToSlot))} hours`}
        </Eyebrow>
        <Display level="lg">Cancel this interview.</Display>
      </View>

      {refundable ? (
        <Card>
          <Eyebrow tone="muted">If you cancel now</Eyebrow>
          <View style={[styles.figureRow, { marginTop: space.sm }]}>
            {amount ? <Figure value={amount} /> : null}
            <Body size="sm" tone="muted">owed back in full</Body>
          </View>
          <Divider style={styles.hr} />
          <Body size="sm">Your interview comes back unused. You can book again straight away.</Body>
          <Body size="sm" style={{ marginTop: space.sm }}>{wk} {t} goes back to the interviewers.</Body>
        </Card>
      ) : (
        <>
          <Card style={styles.dangerCard}>
            <Eyebrow tone="danger">If you cancel now</Eyebrow>
            <View style={[styles.figureRow, { marginTop: space.sm }]}>
              <Figure value="₹0" />
              <Body size="sm">back</Body>
            </View>
            <Body size="sm" style={{ marginTop: space.sm }}>You are inside twelve hours of the start, so the {amount ?? 'fee'} is forfeit and your interview is spent. Your interviewer has held this slot since you booked it.</Body>
          </Card>
          <Card raised>
            <Eyebrow tone="muted">Your one free move</Eyebrow>
            <Display level="sm" style={{ marginTop: space.sm }}>Move it instead. It costs nothing.</Display>
            <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>We will put you in another slot and your {amount ?? 'fee'} stays where it is.</Body>
            <View style={{ marginTop: space.md }}>
              <Button variant="primary" size="lg" full label="Move my interview instead" onPress={() => onReschedule(id)} />
            </View>
            <Body size="xs" tone="subtle" style={{ marginTop: space.sm }}>Inside twelve hours an admin confirms the new slot. You will hear the same day.</Body>
          </Card>
        </>
      )}

      <Field label="Why are you cancelling?" helper="One line, for our records — it is how a refund gets settled.">
        <Input value={reason} onChangeText={setReason} placeholder="Something came up…" multiline maxLength={500} />
      </Field>
      {err ? <Banner tone="danger">{err}</Banner> : null}

      <View style={styles.footBlock}>
        <Divider />
        <Body size="sm" tone={refundable ? 'default' : 'muted'}>
          {refundable
            ? `Confirm and ${wk} ${t} is cancelled. ${amount ? `${amount} is owed back the way you paid it, ` : ''}and your interview is yours to use again.`
            : `Confirm and ${wk} ${t} is cancelled, nothing comes back, and the interview you paid for is gone.`}
        </Body>
        <Button
          variant="destructive"
          size={refundable ? 'block' : 'md'}
          full
          busy={mut.isPending}
          disabled={reason.trim().length < 3}
          reason={reason.trim().length < 3 ? (refundable ? 'Add a line above so we can settle your refund.' : 'Add a line above so an admin can see why.') : undefined}
          label={refundable ? (amount ? `Cancel and refund ${amount}` : 'Cancel interview') : 'Cancel anyway — no refund'}
          onPress={() => mut.mutate()}
        />
        {refundable && <Button variant="text" size="md" label="Keep this interview" onPress={onKeep} />}
      </View>
    </ScrollView>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  hr: { marginVertical: space.md },
  dangerCard: { borderColor: color.dangerBorder, backgroundColor: color.dangerSoft, padding: space.lg },
  footBlock: { gap: space.md },
})
