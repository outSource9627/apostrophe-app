import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getInterview, type StudentInterview } from '../../lib/api/interviews'
import { color, space } from '../../theme'
import { AppBar, Body, Button, Card, Display, Divider, Eyebrow, Figure, Meta } from '../../components/ui'

/**
 * ST-34 — top-up required. When the interviewer confirms a higher qualification
 * tier than was paid, the rupee difference is owed and publication is held until
 * it is paid. BACKEND GAP: no endpoint yet reports the confirmed tier / difference
 * or accepts the top-up, so this shows the honest resting state (nothing owed)
 * and renders the full raised state the moment a `topup` descriptor arrives.
 */
interface TopUp { claimedTier: string; confirmedTier: string; differencePaise: number; status: 'RAISED' | 'PAYING' | 'SETTLED' | 'WAIVED' }
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function TopUpScreen({ id, onBack, onPay }: { id: string; onBack: () => void; onPay: () => void }) {
  const insets = useSafeAreaInsets()
  const q = useQuery({ queryKey: ['interview', id], queryFn: () => getInterview(id) })
  const topup = (q.data as (StudentInterview & { topup?: TopUp }) | undefined)?.topup ?? null

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Body tone="muted">Loading…</Body></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your interview.</Body></View>)

  if (!topup || topup.status === 'SETTLED' || topup.status === 'WAIVED') {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        {bar}
        <View style={[styles.body, { flex: 1, justifyContent: 'center' }]}>
          <Eyebrow>Top-up</Eyebrow>
          <Display level="lg">You&rsquo;re all set.</Display>
          <Body size="base" tone="muted">Nothing is owed on this interview. If an interviewer ever confirms a higher qualification than you paid for, the small difference would show here and hold your video resume until it&rsquo;s settled.</Body>
          <View style={{ marginTop: space.md }}><Button variant="outline" size="md" label="Back to my interviews" onPress={onBack} /></View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <View style={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>Top-up · publication held</Eyebrow>
          <Display level="lg">A little more is owed.</Display>
          <Body size="base" tone="muted">Your interviewer confirmed a higher qualification than the tier you paid for. Settle the difference and your video resume publishes right away.</Body>
        </View>
        <Card>
          <KV k="You paid for" v={topup.claimedTier} />
          <KV k="Confirmed as" v={topup.confirmedTier} />
          <Divider />
          <View style={styles.kv}>
            <Body size="base" style={{ color: color.text }}>Difference owed</Body>
            <Figure value={rupees(topup.differencePaise)} />
          </View>
        </Card>
        <View style={{ gap: space.sm }}>
          <Button variant="primary" size="block" full busy={topup.status === 'PAYING'} label="Pay the difference" onPress={onPay} />
          <Meta style={{ color: color.textSubtle }}>Your video resume publishes the moment this is settled.</Meta>
        </View>
      </View>
    </View>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Body size="base" style={{ color: color.text }}>{k}</Body>
      <Body size="base" tone="muted">{v}</Body>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.lg },
})
