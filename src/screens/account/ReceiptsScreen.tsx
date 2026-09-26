import React from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { listPayments, type PaymentRow } from '../../lib/api/payments'
import { openSupport } from '../../lib/support'
import { borderWidth, color, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, Card, EmptyState, ErrorState, ScreenHeader, Skeleton, StatusPill, text } from '../../components/ui'

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
 * support, rather than a download that would fail.
 */
export function ReceiptsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['payments'], queryFn: listPayments })

  const frame = (c: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScreenHeader title="Receipts" subtitle="Payments and invoices" onBack={onBack} />
      {c}
    </View>
  )

  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(
    <View style={styles.centre}>
      <ErrorState
        title="Could not load your receipts."
        body="Nothing about your payments has changed. Try again."
        action={<Button variant="outline" size="sm" label="Try again" onPress={() => { void q.refetch() }} />}
      />
    </View>,
  )

  const rows = q.data!.payments
  if (rows.length === 0) return frame(
    <View style={styles.centre}>
      <EmptyState title="No payments yet." body="When you buy an interview, its receipt appears here." />
    </View>,
  )

  return frame(
    <ScrollView
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
    >
      {rows.map((p) => <Row key={p.id} p={p} />)}
      <Text style={[text.uiXs, styles.muted, styles.note]}>
        Receipts are GST invoices issued for each successful payment.
      </Text>
    </ScrollView>,
  )
}

function Row({ p }: { p: PaymentRow }) {
  const r = p.receipt
  const refunded = p.status === 'REFUNDED'
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={styles.grow}>
          <Text style={text.uiBaseSemi}>{`${p.tier} · ${TIER_NAME[p.tier] ?? p.tier} interview`}</Text>
          <Text style={[text.uiXs, styles.muted]}>{fmtDate(p.paidAt ?? p.createdAt)}{p.method ? ` · ${p.method.toUpperCase()}` : ''}</Text>
        </View>
        <Text style={text.displaySm}>{rupees(p.amountPaise)}</Text>
      </View>

      <View style={styles.pills}>
        <StatusPill tone={refunded ? 'neutral' : 'success'} label={refunded ? 'Refunded' : 'Paid'} />
        {r && <Text style={[text.metaMd, styles.number]}>{r.number}</Text>}
      </View>

      {r ? (
        <View style={styles.breakdown}>
          <Line k="Interview" v={rupees(r.breakdown.basePaise)} />
          <Line k={`GST ${r.breakdown.ratePct}%`} v={rupees(r.breakdown.gstPaise)} />
          <View style={styles.rule} />
          <Line k="Total" v={rupees(r.breakdown.totalPaise)} strong />
        </View>
      ) : (
        <Text style={[text.uiXs, styles.muted]}>The receipt for this payment is being issued.</Text>
      )}

      {r?.url ? (
        <Button variant="outline" size="sm" full label="Download receipt (PDF)" onPress={() => { void Linking.openURL(r.url!) }} />
      ) : r ? (
        <Pressable accessibilityRole="button" onPress={() => { void openSupport(`Receipt ${r.number}`) }} hitSlop={space.sm}>
          <Text style={[text.uiSmSemi, styles.link]}>Need the PDF? Email support</Text>
        </Pressable>
      ) : null}
    </Card>
  )
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[strong ? text.uiMdSemi : text.uiMd, !strong && styles.muted]}>{k}</Text>
      <Text style={[text.metaMd, styles.value, strong && styles.valueStrong]}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: spaceHalf['2.5'], paddingBottom: space.xl },
  card: { padding: space.lg, gap: space.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  grow: { flex: 1, gap: space['2xs'] },
  muted: { color: color.textMuted },
  pills: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  number: { color: color.textSubtle, letterSpacing: trackingNative.meta },
  breakdown: { gap: spaceHalf['1.5'], borderRadius: radius.tile, backgroundColor: color.surfaceMuted, padding: space.md },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  value: { color: color.text, textTransform: 'none' },
  valueStrong: { fontFamily: text.uiMdSemi.fontFamily },
  rule: { height: borderWidth.thin, backgroundColor: color.border },
  link: { color: color.accent },
  note: { paddingHorizontal: space.xs, paddingTop: space.xs },
})
