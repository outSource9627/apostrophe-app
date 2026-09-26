import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Linking } from 'react-native'
import {
  cancelDeletion, getDataExports, getDeletion, getMe, requestDataExport, requestDeletion,
  type DataExportRow, type DeletionRequest, type Me,
} from '../../lib/api/account'
import { fmtISODate, fmtStampFull } from '../../lib/chat/format'
import { color, height, space } from '../../theme'
import { Body, Button, Card, Display, Eyebrow, Meta, Sheet, StatusDot, StatusPill, Skeleton, ScreenHeader, ErrorState } from '../../components/ui'

const fmtDate = (iso: string) => fmtStampFull(iso).replace(/,.*$/, '')
const fmtSize = (b?: number) => (b ? (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`) : '')

/**
 * ST-50 — two distinct offers. Export is a BACKGROUND job (no spinner resolving in
 * place). Deletion states the mixed outcome HONESTLY with NO green tick on a
 * pending deletion, NO typed-DELETE ceremony, NO retention offer. No crimson
 * anywhere on this board.
 */
export function DataRightsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const q = useQuery({
    queryKey: ['data-rights'],
    queryFn: async (): Promise<{ me: Me; exports: DataExportRow[]; deletion: DeletionRequest | null }> => {
      const [me, ex, del] = await Promise.all([getMe(), getDataExports(), getDeletion()])
      return { me, exports: ex.rows, deletion: del }
    },
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['data-rights'] })
  const exportMut = useMutation({ mutationFn: () => requestDataExport(), onSettled: invalidate })
  const deleteMut = useMutation({ mutationFn: (confirm: string) => requestDeletion(confirm), onSettled: () => { setConfirmOpen(false); invalidate() } })
  const cancelMut = useMutation({ mutationFn: () => cancelDeletion(), onSettled: invalidate })

  const bar = <ScreenHeader title="Your data" subtitle="Export a copy, or delete your account" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your data settings." body="Nothing was changed. Try again in a moment." /></View>)

  const { me, exports, deletion } = q.data!
  const pendingExport = exports.find((e) => e.status === 'PENDING')
  const readyExport = exports.find((e) => e.status === 'READY')
  const pendingDeletion = deletion && deletion.status === 'PENDING' ? deletion : null
  const busy = exportMut.isPending || deleteMut.isPending || cancelMut.isPending

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Export */}
        <View style={{ gap: space.md }}>
          <Eyebrow>Export</Eyebrow>
          {pendingExport ? (
            <Card style={styles.cardPad}>
              <StatusPill tone="neutral" label="PREPARING" />
              <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>We&rsquo;re building your file. We&rsquo;ll email you when it&rsquo;s ready — you don&rsquo;t need to keep this open.</Body>
            </Card>
          ) : readyExport ? (
            <Card style={styles.cardPad}>
              <StatusPill tone="info" label="READY" />
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm }}>
                <Meta style={{ color: color.text }}>{`apostrophe-export-${fmtISODate(readyExport.readyAt ?? readyExport.requestedAt)}.zip`}</Meta>
                <Meta style={{ color: color.textSubtle }}>{fmtSize(readyExport.sizeBytes)}</Meta>
              </View>
              <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
                <Button variant="secondary" size="md" disabled={!readyExport.url} label="Download" onPress={() => readyExport.url && Linking.openURL(readyExport.url)} />
              </View>
              {!!readyExport.url && <Meta style={{ color: color.textSubtle, marginTop: space.sm }}>This link is short-lived — request a fresh export if it stops working.</Meta>}
            </Card>
          ) : (
            <Card style={styles.cardPad}>
              <Display level="xs">Take a copy with you.</Display>
              <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>We build the file in the background and email you a link when it&rsquo;s ready. It&rsquo;s JSON you can open anywhere, plus the documents you uploaded.</Body>
              <View style={{ marginTop: space.md }}><Button variant="secondary" size="block" full busy={exportMut.isPending} label="Request my export" onPress={() => exportMut.mutate()} /></View>
              <Meta style={{ color: color.textSubtle, marginTop: space.sm }}>Usually ready within 24 hours</Meta>
            </Card>
          )}
        </View>

        {/* Delete */}
        <View style={{ gap: space.md }}>
          <Eyebrow>Delete my account</Eyebrow>
          {pendingDeletion ? (
            <PendingDeletion request={pendingDeletion} busy={cancelMut.isPending} onCancel={() => cancelMut.mutate()} />
          ) : (
            <Card style={[styles.cardPad, { gap: space.md }]}>
              <Display level="xs">Deleting is permanent. We finish it within thirty days.</Display>
              <Split label="Immediately" body="Your profile leaves every employer feed. Nobody new can find you." />
              <Split label="Within thirty days" body="Both recordings are purged — the raw interview and the edited video resume." />
              <Split label="Kept by law" body="Payment and invoice records stay for as long as Indian tax law requires. Your name, email and mobile are replaced with a reference number inside them." />
              <Button variant="destructive" size="block" full label="Delete my account" onPress={() => setConfirmOpen(true)} />
              <Meta style={{ color: color.textSubtle }}>We&rsquo;ll ask you to confirm once. You can cancel any time in the next thirty days.</Meta>
            </Card>
          )}
        </View>
      </ScrollView>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete my account?">
        <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>Your profile leaves every feed now, and both recordings are purged within thirty days. You can cancel any time in the next thirty days.</Body>
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Button variant="destructive" size="block" full busy={busy} label="Delete my account"
            onPress={() => { const c = me.email ?? me.mobile ?? me.name; if (c) deleteMut.mutate(c) }} />
          <Button variant="quiet" size="block" full label="Keep my account" onPress={() => setConfirmOpen(false)} />
        </View>
      </Sheet>
    </View>
  )
}

function PendingDeletion({ request, busy, onCancel }: { request: DeletionRequest; busy: boolean; onCancel: () => void }) {
  return (
    <View style={{ gap: space.lg }}>
      <Card style={styles.pendingCardPad}>
        <StatusPill tone="warning" label="DELETION PENDING" />
        <Display level="xs" style={{ marginTop: space.sm }}>{`We’re deleting your account by ${fmtDate(request.dueAt)}.`}</Display>
        <Meta style={{ color: color.textSubtle, marginTop: space.xs }}>{`Requested ${fmtStampFull(request.requestedAt)}`}</Meta>
      </Card>
      <View style={{ gap: space.sm }}>
        <Eyebrow>Done</Eyebrow>
        <MixedItem done text={`Your profile left every employer feed on ${fmtStampFull(request.requestedAt)}.`} />
        <MixedItem done text="Your open chats are archived." />
      </View>
      <View style={{ gap: space.sm }}>
        <Eyebrow>Still to happen</Eyebrow>
        <MixedItem text={`Both recordings are purged by ${fmtDate(request.dueAt)}.`} />
        <MixedItem text="Payment records are kept, with your name, email and mobile replaced." />
      </View>
      <Button variant="outline" size="block" full busy={busy} label="Cancel this request" onPress={onCancel} />
      <Meta style={{ color: color.textSubtle }}>{`Cancel before ${fmtDate(request.dueAt)} and nothing is lost.`}</Meta>
    </View>
  )
}

function MixedItem({ done, text }: { done?: boolean; text: string }) {
  return (
    <View style={styles.mixed}>
      <StatusDot tone={done ? 'success' : 'neutral'} style={styles.mixedDot} />
      <Body size="sm" style={{ flex: 1, color: color.text }}>{text}</Body>
    </View>
  )
}

function Split({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.split}>
      <View style={{ width: height['label-col-lg'], paddingTop: space['2xs'] }}><Eyebrow>{label}</Eyebrow></View>
      <Body size="sm" style={{ flex: 1, color: color.text }}>{body}</Body>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.xl, paddingBottom: space.xl },
  cardPad: { padding: space.lg },
  pendingCardPad: { backgroundColor: color.dangerSoft, borderColor: color.dangerBorder, padding: space.lg },
  mixed: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  mixedDot: { marginTop: space['2xs'] },
  split: { flexDirection: 'row', gap: space.md },
})
