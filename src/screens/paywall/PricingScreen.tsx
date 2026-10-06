import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { borderWidth, color, fontFamilyNative as FF, radius } from '../../theme'
import { Btn, Skel, StateBlock } from '../../components/tab/kit'
import { Big, Eyebrow, FlowFooter, FlowHeader } from '../../components/tab/flow'

interface Me { paid: boolean; qualification?: string; unusedCount?: number }
interface Config { tiers: { tier: string; amountPaise: number; durationMin: number }[]; qualifications: { value: string; tier: string }[] }

const TIER_NAME: Record<string, string> = { T1: 'Class 12', T2: 'Graduation', T3: 'Post Graduation', T4: 'PhD' }
const rupees = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`

/**
 * ST-06 — four tiers, the student's own marked, one Pay action. Their
 * registered qualification decides the tier and they cannot switch rows to pay
 * less. The price is a live server value, never baked in.
 */
export function PricingScreen({ onBack, onPay, onBook }: { onBack: () => void; onPay: () => void; onBook?: () => void }) {
  const insets = useSafeAreaInsets()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/students/me') })
  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><FlowHeader title="Buy an interview" onBack={onBack} />{child}</View>
  )
  if (me.isPending || cfg.isPending) return frame(<View style={styles.body}><Skel w="70%" h={12} /><Skel w="100%" h={72} /><Skel w="100%" h={72} /><Skel w="100%" h={72} /></View>)
  if (me.isError || cfg.isError) return frame(
    <StateBlock
      icon="alert"
      title="Could not load pricing."
      body="Nothing was charged. Check your connection and try again."
      action="Try again"
      onAction={() => { me.refetch(); cfg.refetch() }}
    />,
  )

  const myTier = cfg.data!.qualifications.find((q) => q.value === me.data!.qualification)?.tier
  const mine = cfg.data!.tiers.find((t) => t.tier === myTier)
  // Same rule as the web: a student needs a credit when they have never paid, or
  // have used every interview they bought. A paid student holding a credit has
  // nothing to pay for, so the action points at booking instead.
  const needsCredit = !me.data!.paid || (me.data!.unusedCount ?? 0) === 0

  return frame(
    <>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Eyebrow style={styles.eyebrow}>Your tier is set by your highest qualification</Eyebrow>

        {cfg.data!.tiers.map((t) => {
          const on = t.tier === myTier
          return (
            <View key={t.tier} style={[styles.tier, on ? styles.tierOn : styles.tierOff]}>
              <View style={[styles.radio, on ? styles.radioOn : styles.radioOff]}>
                {on && <View style={styles.radioDot} />}
              </View>
              <View style={styles.tierText}>
                <View style={styles.tierTitle}>
                  <Text style={styles.tierName}>{t.tier} · {TIER_NAME[t.tier] ?? t.tier}</Text>
                  {on && (
                    <View style={styles.yours}>
                      <Text style={styles.yoursText}>Yours</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tierNote}>{t.durationMin}-minute interview</Text>
              </View>
              <Big>{rupees(t.amountPaise)}</Big>
            </View>
          )
        })}

        {mine && (
          <View style={styles.sum}>
            <Text style={styles.sumLabel}>Interview credit</Text>
            <Text style={styles.sumValue}>{rupees(mine.amountPaise)}</Text>
          </View>
        )}
      </ScrollView>

      <FlowFooter>
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total</Text>
          {mine ? <Big>{rupees(mine.amountPaise)}</Big> : <Big>—</Big>}
        </View>
        {needsCredit ? (
          <>
            <Btn label="Pay and book my interview" onPress={onPay} />
            <Text style={styles.secured}>Secured by Razorpay · UPI, cards, netbanking</Text>
          </>
        ) : (
          <>
            <Btn label="Book an interview" onPress={onBook} disabled={!onBook} />
            <Text style={styles.secured}>You already have an interview to book — nothing to pay.</Text>
          </>
        )}
      </FlowFooter>
    </>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 10 },
  eyebrow: { marginTop: 4 },
  tier: {
    minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, backgroundColor: color.surface,
  },
  tierOn: { borderWidth: borderWidth.medium, borderColor: color.accent, paddingHorizontal: 15, paddingVertical: 11 },
  tierOff: { borderWidth: borderWidth.thin, borderColor: color.border },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: borderWidth.medium, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.accent },
  radioOff: { borderColor: color.borderStrong },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.accent },
  tierText: { flex: 1, gap: 2 },
  tierTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  tierNote: { fontFamily: FF.body, fontSize: 12.5, lineHeight: 17.5, color: color.textMuted },
  yours: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: color.accentSoft },
  yoursText: { fontFamily: FF.bodyMedium, fontSize: 12, color: color.accentText },
  sum: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 6 },
  sumLabel: { fontFamily: FF.body, fontSize: 15, color: color.textMuted },
  sumValue: { fontFamily: FF.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'], color: color.text },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: FF.bodySemiBold, fontSize: 15, color: color.text },
  secured: { fontFamily: FF.body, fontSize: 12, color: color.textMuted, textAlign: 'center' },
})
