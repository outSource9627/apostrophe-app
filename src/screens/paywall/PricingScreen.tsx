import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Body, Button, Display, Eyebrow, Figure, Meta, StatusPill } from '../../components/ui'

interface Me { paid: boolean; qualification?: string }
interface Config { tiers: { tier: string; amountPaise: number; durationMin: number }[]; qualifications: { value: string; tier: string }[] }

const TIER_NAME: Record<string, string> = { T1: 'Class 12', T2: 'Graduation', T3: 'Post Graduation', T4: 'PhD' }
const rupees = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`

/**
 * ST-06 — four tiers, the student's own marked, one Pay action. Their
 * registered qualification decides the tier and they cannot switch rows to pay
 * less. The price is a live server value, never baked in.
 */
export function PricingScreen({ onBack, onPay }: { onBack: () => void; onPay: () => void }) {
  const insets = useSafeAreaInsets()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/students/me') })
  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  const frame = (child: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}><AppBar title="Home" onBack={onBack} />{child}</View>
  )
  if (me.isPending || cfg.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (me.isError || cfg.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load pricing.</Body></View>)

  const myTier = cfg.data!.qualifications.find((q) => q.value === me.data!.qualification)?.tier
  const mine = cfg.data!.tiers.find((t) => t.tier === myTier)

  return frame(
    <>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>One-time</Eyebrow>
          <Display level="lg">A real interview, on video.</Display>
          <Body tone="muted">The fee buys a live interview with a real person, the video resume it becomes, and written feedback.</Body>
        </View>

        <View style={{ gap: space.sm }}>
          {cfg.data!.tiers.map((t) => {
            const on = t.tier === myTier
            return (
              <View key={t.tier} style={[styles.tier, on && styles.tierOn]}>
                <View style={{ gap: 2 }}>
                  <Body weight="semibold" size="lg">{TIER_NAME[t.tier] ?? t.tier}</Body>
                  <Meta style={{ color: color.textSubtle }}>{t.durationMin} MIN INTERVIEW</Meta>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                  <Figure value={rupees(t.amountPaise)} />
                  {on ? <StatusPill tone="accent" label="Your tier" /> : null}
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.footEcho}>
          <Meta style={{ color: color.textSubtle }}>{myTier} · {TIER_NAME[myTier ?? ''] ?? ''}</Meta>
          {mine ? <Body weight="semibold">{rupees(mine.amountPaise)} · {mine.durationMin} min</Body> : null}
        </View>
        <Button variant="primary" size="lg" full label="Pay and book my interview" onPress={onPay} disabled={me.data!.paid} reason={me.data!.paid ? 'You have already paid.' : undefined} />
      </View>
    </>,
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space['4xl'] },
  tier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, backgroundColor: color.surface, padding: space.lg },
  tierOn: { borderColor: color.ink },
  foot: { borderTopWidth: borderWidth.thin, borderTopColor: color.border, paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md },
  footEcho: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
})
