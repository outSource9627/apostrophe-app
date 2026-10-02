import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getInterview, type StudentInterview } from '../../lib/api/interviews'
import { color, fontFamilyNative as FF } from '../../theme'
import { Icon } from '../../components/ui/Icon'
import { Btn, Panel, Skel, StateBlock } from '../../components/tab/kit'
import { Big, Disc, Eyebrow, FlowFooter, FlowHeader, KV, Lead, Rule, Sub } from '../../components/tab/flow'

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

  const bar = <FlowHeader title="Top-up" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.body}><Skel w="50%" h={12} /><Skel w="80%" h={28} /><Skel w="100%" h={120} /></View>)
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load your interview." body="Nothing is owed until this loads. Try again." />)

  if (!topup || topup.status === 'SETTLED' || topup.status === 'WAIVED') {
    return frame(
      <>
        <View style={[styles.body, styles.grow]}>
          <Disc tone="ok"><Icon name="check" size={26} tint={color.successFill} weight={2.2} /></Disc>
          <Eyebrow tone="ok">NOTHING OWED</Eyebrow>
          <Lead>You&rsquo;re all set.</Lead>
          <Sub>Nothing is owed on this interview. If an interviewer ever confirms a higher qualification than you paid for, the small difference would show here and hold your video resume until it&rsquo;s settled.</Sub>
        </View>
        <FlowFooter>
          <Btn variant="outline" label="Back to my interviews" onPress={onBack} />
        </FlowFooter>
      </>,
    )
  }

  return frame(
    <>
      <ScrollView contentContainerStyle={[styles.body, { gap: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8 }}>
          <Eyebrow tone="accent">Top-up · publication held</Eyebrow>
          <Lead>A little more is owed.</Lead>
          <Sub>Your interviewer confirmed a higher qualification than the tier you paid for. Settle the difference and your video resume publishes right away.</Sub>
        </View>
        <Panel style={styles.card}>
          <KV k="You paid for" v={topup.claimedTier} />
          <KV k="Confirmed as" v={topup.confirmedTier} />
          <Rule />
          <View style={styles.kv}>
            <Text style={styles.owed}>Difference owed</Text>
            <Big>{rupees(topup.differencePaise)}</Big>
          </View>
        </Panel>
      </ScrollView>
      <FlowFooter>
        <Btn busy={topup.status === 'PAYING'} label={`Pay the difference · ${rupees(topup.differencePaise)}`} onPress={onPay} />
        <Text style={styles.note}>Your video resume publishes the moment this is settled.</Text>
      </FlowFooter>
    </>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  grow: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 14, paddingBottom: 20 },
  card: { padding: 18, gap: 12 },
  kv: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 },
  owed: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  note: { fontFamily: FF.body, fontSize: 12, color: color.textMuted, textAlign: 'center' },
})
