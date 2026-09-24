import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getInterview, type StudentInterview } from '../../lib/api/interviews'
import { borderWidth, color, height, radius, space, trackingNative } from '../../theme'
import { Button, Card, ErrorState, Eyebrow, ScreenHeader, Skeleton, StickyFooter, text } from '../../components/ui'

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

  const bar = <ScreenHeader title="Top-up" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.body}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your interview." body="Nothing is owed until this loads. Try again." /></View>)

  if (!topup || topup.status === 'SETTLED' || topup.status === 'WAIVED') {
    return frame(
      <>
        <View style={[styles.body, styles.grow]}>
          <View style={[styles.disc]}><Text style={[text.displayLead, styles.tick]}>✓</Text></View>
          <View style={styles.head}>
            <Text style={[text.metaMd, styles.eyebrowOk]}>NOTHING OWED</Text>
            <Text style={text.displayLead}>You&rsquo;re all set.</Text>
            <Text style={[text.uiBase, styles.muted]}>Nothing is owed on this interview. If an interviewer ever confirms a higher qualification than you paid for, the small difference would show here and hold your video resume until it&rsquo;s settled.</Text>
          </View>
        </View>
        <StickyFooter inset={false}>
          <Button variant="outline" size="lg" full label="Back to my interviews" onPress={onBack} />
        </StickyFooter>
      </>,
    )
  }

  return frame(
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Eyebrow tone="accent">Top-up · publication held</Eyebrow>
          <Text style={text.displayLead}>A little more is owed.</Text>
          <Text style={[text.uiBase, styles.muted]}>Your interviewer confirmed a higher qualification than the tier you paid for. Settle the difference and your video resume publishes right away.</Text>
        </View>
        <Card style={styles.card}>
          <KV k="You paid for" v={topup.claimedTier} />
          <KV k="Confirmed as" v={topup.confirmedTier} />
          <View style={styles.rule} />
          <View style={styles.kv}>
            <Text style={text.uiMdSemi}>Difference owed</Text>
            <Text style={text.displaySm}>{rupees(topup.differencePaise)}</Text>
          </View>
        </Card>
      </ScrollView>
      <StickyFooter inset={false}>
        <Button variant="primary" size="lg" full busy={topup.status === 'PAYING'} label={`Pay the difference · ${rupees(topup.differencePaise)}`} onPress={onPay} />
        <Text style={[text.uiXs, styles.muted]}>Your video resume publishes the moment this is settled.</Text>
      </StickyFooter>
    </>,
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={[text.uiMd, styles.muted]}>{k}</Text>
      <Text style={text.uiMdSemi}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  grow: { flex: 1 },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.lg, paddingBottom: space.xl },
  head: { gap: space.sm, paddingHorizontal: space.xs },
  muted: { color: color.textMuted },
  disc: { width: height.fab, height: height.fab, borderRadius: radius.pill, backgroundColor: color.successSoft, alignItems: 'center', justifyContent: 'center', marginLeft: space.xs },
  tick: { color: color.successFill },
  eyebrowOk: { color: color.success, letterSpacing: trackingNative.eyebrow },
  card: { padding: space.lg, gap: space.md },
  kv: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.lg },
  rule: { height: borderWidth.thin, backgroundColor: color.border },
})
