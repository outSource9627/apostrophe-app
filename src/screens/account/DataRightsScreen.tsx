import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Linking } from 'react-native'
import {
  cancelDeletion, getDataExports, getDeletion, getMe, requestDataExport, requestDeletion,
  type DataExportRow, type DeletionRequest, type Me,
} from '../../lib/api/account'
import { fmtISODate, fmtStampFull } from '../../lib/chat/format'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { Sheet, StatusPill } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { Btn, DetailHeader, Skel, StateBlock } from '../../components/tab/kit'

const fmtDate = (iso: string) => fmtStampFull(iso).replace(/,.*$/, '')
const fmtSize = (b?: number) => (b ? (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`) : '')

/**
 * ST-50 — two distinct offers. Export is a BACKGROUND job (no spinner resolving in
 * place). Deletion states the mixed outcome HONESTLY with NO green tick on a
 * pending deletion, NO typed-DELETE ceremony, NO retention offer. No crimson
 * anywhere on this board. Option A of docs/student-receipts-privacy-mockup.html:
 * one page, Export then Delete, the explanation first and the control beneath it.
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

  const bar = <DetailHeader title="Your data" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.loading}><Skel w="100%" h={96} /><Skel w="100%" h={96} /><Skel w="100%" h={96} /></View>)
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load your data settings." body="Nothing was changed. Try again in a moment." />)

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
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Export</Text>
          {pendingExport ? (
            <View style={styles.card}>
              <View style={styles.pillRow}><StatusPill tone="neutral" label="PREPARING" /></View>
              <Text style={[styles.p, styles.gapTop]}>We&rsquo;re building your file. We&rsquo;ll email you when it&rsquo;s ready — you don&rsquo;t need to keep this open.</Text>
            </View>
          ) : readyExport ? (
            <View style={styles.card}>
              <View style={styles.pillRow}><StatusPill tone="info" label="READY" /></View>
              <View style={styles.fileRow}>
                <Text style={styles.fileName}>{`apostrophe-export-${fmtISODate(readyExport.readyAt ?? readyExport.requestedAt)}.zip`}</Text>
                <Text style={styles.meta}>{fmtSize(readyExport.sizeBytes)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Download"
                accessibilityState={{ disabled: !readyExport.url }}
                disabled={!readyExport.url}
                onPress={() => readyExport.url && Linking.openURL(readyExport.url)}
                style={({ pressed }) => [styles.dl, !readyExport.url && styles.dlOff, pressed && styles.pressed]}
              >
                <Icon name="download" size={18} tint={readyExport.url ? color.text : color.textSubtle} />
                <Text style={[styles.dlText, !readyExport.url && styles.dlTextOff]}>Download</Text>
              </Pressable>
              {!!readyExport.url && <Text style={[styles.meta, styles.gapTop]}>This link is short-lived — request a fresh export if it stops working.</Text>}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.h}>Take a copy with you.</Text>
              <Text style={[styles.p, styles.gapTop]}>We build the file in the background and email you a link when it&rsquo;s ready. It&rsquo;s JSON you can open anywhere, plus the documents you uploaded.</Text>
              <Btn variant="outline" busy={exportMut.isPending} label="Request my export" onPress={() => exportMut.mutate()} style={styles.gapTopLg} />
              <Text style={[styles.meta, styles.gapTop]}>Usually ready within 24 hours</Text>
            </View>
          )}
        </View>

        {/* Delete */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Delete my account</Text>
          {pendingDeletion ? (
            <PendingDeletion request={pendingDeletion} busy={cancelMut.isPending} onCancel={() => cancelMut.mutate()} />
          ) : (
            <View style={[styles.card, styles.gap14]}>
              <Text style={[styles.h, styles.hDel]}>Deleting is permanent. We finish it within thirty days.</Text>
              <Split label="Immediately" body="Your profile leaves every employer feed. Nobody new can find you." />
              <Split label="Within thirty days" body="Both recordings are purged — the raw interview and the edited video resume." />
              <Split label="Kept by law" body="Payment and invoice records stay for as long as Indian tax law requires. Your name, email and mobile are replaced with a reference number inside them." />
              <DestrBtn label="Delete my account" onPress={() => setConfirmOpen(true)} />
              <Text style={styles.meta}>We&rsquo;ll ask you to confirm once. You can cancel any time in the next thirty days.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete my account?">
        <Text style={[styles.pDark, styles.gapTop]}>Your profile leaves every feed now, and both recordings are purged within thirty days. You can cancel any time in the next thirty days.</Text>
        <View style={styles.sheetActions}>
          <DestrBtn label="Delete my account" busy={busy}
            onPress={() => { const c = me.email ?? me.mobile ?? me.name; if (c) deleteMut.mutate(c) }} />
          <Btn variant="quiet" label="Keep my account" onPress={() => setConfirmOpen(false)} />
        </View>
      </Sheet>
    </View>
  )
}

/** Option A's destructive button: white, a danger hairline and danger text. */
function DestrBtn({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.destr, (pressed || busy) && styles.pressed]}
    >
      <Text style={styles.destrText}>{label}</Text>
    </Pressable>
  )
}

function PendingDeletion({ request, busy, onCancel }: { request: DeletionRequest; busy: boolean; onCancel: () => void }) {
  return (
    <View style={styles.gap18}>
      <View style={styles.pendCard}>
        <View style={styles.pillRow}><StatusPill tone="warning" label="DELETION PENDING" /></View>
        <Text style={[styles.h, styles.hPend]}>{`We’re deleting your account by ${fmtDate(request.dueAt)}.`}</Text>
        <Text style={[styles.meta, styles.gapTop6]}>{`Requested ${fmtStampFull(request.requestedAt)}`}</Text>
      </View>
      <View style={styles.listGroup}>
        <Text style={styles.eyebrow}>Done</Text>
        <MixedItem done text={`Your profile left every employer feed on ${fmtStampFull(request.requestedAt)}.`} />
        <MixedItem done text="Your open chats are archived." />
      </View>
      <View style={styles.listGroup}>
        <Text style={styles.eyebrow}>Still to happen</Text>
        <MixedItem text={`Both recordings are purged by ${fmtDate(request.dueAt)}.`} />
        <MixedItem text="Payment records are kept, with your name, email and mobile replaced." />
      </View>
      <Btn variant="outline" busy={busy} label="Cancel this request" onPress={onCancel} />
      <Text style={styles.meta}>{`Cancel before ${fmtDate(request.dueAt)} and nothing is lost.`}</Text>
    </View>
  )
}

function MixedItem({ done, text }: { done?: boolean; text: string }) {
  return (
    <View style={styles.mixed}>
      <View style={[styles.dot, done && styles.dotDone]} />
      <Text style={styles.mixedText}>{text}</Text>
    </View>
  )
}

function Split({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.split}>
      <Text style={styles.splitLabel}>{label}</Text>
      <Text style={styles.splitBody}>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  loading: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 24, paddingBottom: 28 },
  section: { gap: 12 },
  eyebrow: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 1.54, textTransform: 'uppercase', color: color.textMuted },
  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 20, padding: 16 },
  pillRow: { flexDirection: 'row' },
  h: { fontFamily: FF.bodyBold, fontSize: 22, lineHeight: 25, letterSpacing: -0.66, color: color.text },
  hDel: { fontSize: 20, lineHeight: 23, letterSpacing: -0.6 },
  hPend: { fontSize: 20, lineHeight: 23, letterSpacing: -0.6, marginTop: 10 },
  p: { fontFamily: FF.body, fontSize: 14, lineHeight: 21, color: color.textMuted },
  pDark: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 22, color: color.text },
  meta: { fontFamily: FF.monoMedium, fontSize: 11.5, letterSpacing: 0.46, color: color.textSubtle },
  gapTop: { marginTop: 10 },
  gapTop6: { marginTop: 6 },
  gap14: { gap: 14 },
  gap18: { gap: 18 },
  gapTopLg: { marginTop: 14 },
  fileRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  fileName: { fontFamily: FF.monoMedium, fontSize: 11.5, letterSpacing: 0.46, color: color.text },
  dl: {
    alignSelf: 'flex-start', marginTop: 12, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong,
  },
  dlOff: { backgroundColor: color.surfaceMuted, borderColor: color.surfaceMuted },
  dlText: { fontFamily: FF.bodyBold, fontSize: 14, color: color.text },
  dlTextOff: { color: color.textSubtle },
  destr: {
    height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.dangerBorder,
  },
  destrText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.danger },
  sheetActions: { marginTop: 20, gap: 8 },
  pressed: { opacity: 0.85 },
  pendCard: { backgroundColor: color.dangerSoft, borderWidth: borderWidth.thin, borderColor: color.dangerBorder, borderRadius: 20, padding: 16 },
  listGroup: { gap: 10 },
  mixed: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: color.borderStrong },
  dotDone: { backgroundColor: color.successFill },
  mixedText: { flex: 1, fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.text },
  split: { flexDirection: 'row', gap: 12 },
  splitLabel: { width: 96, paddingTop: 3, fontFamily: FF.monoMedium, fontSize: 10.5, letterSpacing: 1.05, textTransform: 'uppercase', color: color.textMuted },
  splitBody: { flex: 1, fontFamily: FF.body, fontSize: 14.5, lineHeight: 21, color: color.text },
})
