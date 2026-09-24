import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { borderWidth, color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, ErrorState, ScreenHeader, Skeleton, StickyFooter, text } from '../../components/ui'

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
    <View style={[styles.page, { paddingTop: insets.top }]}><ScreenHeader title="Buy an interview" onBack={onBack} />{child}</View>
  )
  if (me.isPending || cfg.isPending) return frame(<View style={styles.body}><Skeleton lines={4} /></View>)
  if (me.isError || cfg.isError) return frame(
    <View style={styles.centre}>
      <ErrorState
        title="Could not load pricing."
        body="Nothing was charged. Check your connection and try again."
        action={<Button variant="outline" size="sm" label="Try again" onPress={() => { me.refetch(); cfg.refetch() }} />}
      />
    </View>,
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
        <Text style={[text.metaMd, styles.eyebrow]}>YOUR TIER IS SET BY YOUR HIGHEST QUALIFICATION</Text>

        {cfg.data!.tiers.map((t) => {
          const on = t.tier === myTier
          return (
            <View key={t.tier} style={[styles.tier, on ? styles.tierOn : styles.tierOff]}>
              <View style={[styles.radio, on ? styles.radioOn : styles.radioOff]}>
                {on && <View style={styles.radioDot} />}
              </View>
              <View style={styles.tierText}>
                <View style={styles.tierTitle}>
                  <Text style={text.uiBaseSemi}>{t.tier} · {TIER_NAME[t.tier] ?? t.tier}</Text>
                  {on && (
                    <View style={styles.yours}>
                      <Text style={[text.metaXs, styles.yoursText]}>YOURS</Text>
                    </View>
                  )}
                </View>
                <Text style={[text.uiXs, styles.tierNote]}>{t.durationMin}-minute interview</Text>
              </View>
              <Text style={text.displaySm}>{rupees(t.amountPaise)}</Text>
            </View>
          )
        })}

        {mine && (
          <View style={styles.sum}>
            <Text style={[text.uiMd, styles.tierNote]}>Interview credit</Text>
            <Text style={[text.metaMd, styles.sumValue]}>{rupees(mine.amountPaise)}</Text>
          </View>
        )}
      </ScrollView>

      <StickyFooter>
        <View style={styles.total}>
          <Text style={text.uiMdSemi}>Total</Text>
          <Text style={text.displaySm}>{mine ? rupees(mine.amountPaise) : '—'}</Text>
        </View>
        {needsCredit ? (
          <>
            <Button variant="primary" size="lg" full label="Pay and book my interview" onPress={onPay} />
            <Text style={[text.metaXs, styles.secured]}>Secured by Razorpay · UPI, cards, netbanking</Text>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            full
            label="Book an interview"
            onPress={onBook}
            reason="You already have an interview to book — nothing to pay."
          />
        )}
      </StickyFooter>
    </>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.xl, gap: spaceHalf['3.5'] },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow, marginTop: space.xs },
  tier: {
    minHeight: height['tier-row'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceHalf['3.5'],
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.panel,
    backgroundColor: color.surface,
  },
  tierOn: { borderWidth: borderWidth.medium, borderColor: color.accent },
  tierOff: { borderWidth: borderWidth.thin, borderColor: color.border },
  radio: { width: height['radio'], height: height['radio'], borderRadius: radius.pill, borderWidth: borderWidth.accent, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.accent },
  radioOff: { borderColor: color.borderStrong },
  radioDot: { width: height['status-dot'], height: height['status-dot'], borderRadius: radius.pill, backgroundColor: color.accent },
  tierText: { flex: 1, gap: space['2xs'] },
  tierTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tierNote: { color: color.textMuted },
  yours: { paddingHorizontal: spaceHalf['1.5'], paddingVertical: space['2xs'], borderRadius: radius.pill, backgroundColor: color.accentSoft },
  yoursText: { color: color.accentText },
  sum: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs, paddingTop: spaceHalf['1.5'] },
  sumValue: { color: color.text },
  total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  secured: { color: color.textMuted, textAlign: 'center', textTransform: 'none' },
})
