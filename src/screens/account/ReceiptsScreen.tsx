import React from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { listPayments, type PaymentRow } from '../../lib/api/payments'
import { openSupport } from '../../lib/support'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { StatusPill } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { DetailHeader, Skel, StateBlock } from '../../components/tab/kit'

const TIER_NAME: Record<string, string> = { T1: 'Class 12', T2: 'Graduation', T3: 'Post Graduation', T4: 'PhD' }
const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDate = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + (5 * 60 + 30) * 60000)
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/**
 * ST-25 / ST-26 — every settled payment and its GST receipt. Only money that
 * moved is listed (abandoned and declined orders are not charges). A receipt
 * number can exist before its PDF does; then the row says so and offers
 * support, rather than a download that would fail. Option A of
 * docs/student-receipts-privacy-mockup.html: one card per payment, the GST
 * breakdown always open.
 */
export function ReceiptsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['payments'], queryFn: listPayments })

  const frame = (c: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <DetailHeader title="Receipts" onBack={onBack} />
      {c}
    </View>
  )

  if (q.isPending) return frame(<View style={styles.body}>{[0, 1, 2].map((i) => <Skel key={i} w="100%" h={96} />)}</View>)
  if (q.isError) return frame(
    <StateBlock
      icon="alert"
      title="Could not load your receipts."
      body="Nothing about your payments has changed. Try again."
      action="Try again"
      onAction={() => { void q.refetch() }}
    />,
  )

  const rows = q.data!.payments
  if (rows.length === 0) return frame(
    <StateBlock icon="file" title="No payments yet." body="When you buy an interview, its receipt appears here." />,
  )

  return frame(
    <ScrollView
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
    >
      {rows.map((p) => <Row key={p.id} p={p} />)}
      <Text style={styles.note}>Receipts are GST invoices issued for each successful payment.</Text>
    </ScrollView>,
  )
}

function Row({ p }: { p: PaymentRow }) {
  const r = p.receipt
  const refunded = p.status === 'REFUNDED'
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.grow}>
          <Text style={styles.title}>{`${p.tier} · ${TIER_NAME[p.tier] ?? p.tier} interview`}</Text>
          <Text style={styles.sub}>{fmtDate(p.paidAt ?? p.createdAt)}{p.method ? ` · ${p.method.toUpperCase()}` : ''}</Text>
        </View>
        <Text style={styles.amt}>{rupees(p.amountPaise)}</Text>
      </View>

      <View style={styles.pills}>
        <StatusPill tone={refunded ? 'neutral' : 'success'} label={refunded ? 'Refunded' : 'Paid'} />
        {r && <Text style={styles.number}>{r.number}</Text>}
      </View>

      {r ? (
        <View style={styles.breakdown}>
          <Line k="Interview" v={rupees(r.breakdown.basePaise)} />
          <Line k={`GST ${r.breakdown.ratePct}%`} v={rupees(r.breakdown.gstPaise)} />
          <View style={styles.rule} />
          <Line k="Total" v={rupees(r.breakdown.totalPaise)} strong />
        </View>
      ) : (
        <Text style={styles.pending}>The receipt for this payment is being issued.</Text>
      )}

      {r?.url ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Download receipt (PDF)"
          onPress={() => { void Linking.openURL(r.url!) }}
          style={({ pressed }) => [styles.dl, pressed && styles.pressed]}
        >
          <Icon name="download" size={18} tint={color.text} />
          <Text style={styles.dlText}>Download receipt (PDF)</Text>
        </Pressable>
      ) : r ? (
        <Pressable accessibilityRole="button" onPress={() => { void openSupport(`Receipt ${r.number}`) }} hitSlop={10}>
          <Text style={styles.link}>Need the PDF? Email support</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineK, strong && styles.lineKStrong]}>{k}</Text>
      <Text style={styles.lineV}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 14 },
  card: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 20, padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  title: { fontFamily: FF.bodySemiBold, fontSize: 16, letterSpacing: -0.24, color: color.text },
  sub: { fontFamily: FF.body, fontSize: 13.5, color: color.textMuted, marginTop: 2 },
  amt: { fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.6, color: color.text },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { fontFamily: FF.monoMedium, fontSize: 11.5, letterSpacing: 0.46, color: color.textSubtle },
  breakdown: { backgroundColor: color.surfaceMuted, borderRadius: 12, padding: 12, gap: 7 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  lineK: { fontFamily: FF.body, fontSize: 14, color: color.textMuted },
  lineKStrong: { fontFamily: FF.bodySemiBold, color: color.text },
  lineV: { fontFamily: FF.monoMedium, fontSize: 14, color: color.text },
  rule: { height: borderWidth.thin, backgroundColor: color.border },
  pending: { fontFamily: FF.body, fontSize: 13.5, lineHeight: 20, color: color.textMuted },
  dl: {
    height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16,
    backgroundColor: color.surface, borderWidth: borderWidth.medium, borderColor: color.borderStrong,
  },
  dlText: { fontFamily: FF.bodyBold, fontSize: 14, color: color.text },
  link: { fontFamily: FF.bodySemiBold, fontSize: 14, color: color.accent },
  note: { fontFamily: FF.body, fontSize: 13, lineHeight: 19, color: color.textMuted, paddingHorizontal: 4, paddingTop: 4 },
  pressed: { opacity: 0.7 },
})
