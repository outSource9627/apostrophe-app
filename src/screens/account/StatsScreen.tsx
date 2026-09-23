import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getAudience } from '../../lib/api/account'
import { fmtStampFull } from '../../lib/chat/format'
import { color, space, radius } from '../../theme'
import { AppBar, Body, Button, Card, Display, Figure, Meta } from '../../components/ui'

/**
 * ST-48 — two numbers and a sentence. HOW MANY employers shortlisted you, never
 * WHICH (rule 3): no chart, sparkline, timeline, ring, streak, badge, company
 * name or avatar. When both numbers are zero they drain to grey and an honest
 * "it's early" card appears — the numbers are real, not missing.
 */
export function StatsScreen({ onBack, onVideoResume, onVisibility }: {
  onBack: () => void; onVideoResume: () => void; onVisibility: () => void
}) {
  const insets = useSafeAreaInsets()
  const [now] = useState(() => Date.now())
  const q = useQuery({ queryKey: ['audience'], queryFn: () => getAudience() })

  const bar = <AppBar onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your stats.</Body></View>)

  const a = q.data!
  const empty = a.shortlistCount === 0 && a.profileViews === 0

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">Your stats</Display>

        <Card style={styles.cells}>
          <View style={styles.cell}>
            <Figure value={a.shortlistCount} style={empty ? { color: color.textSubtle } : undefined} />
            <Body size="base">employers shortlisted you</Body>
          </View>
          <View style={styles.cell}>
            <Figure value={a.profileViews} style={empty ? { color: color.textSubtle } : undefined} />
            <Body size="base">people opened your profile</Body>
          </View>
        </Card>

        <Meta style={{ color: color.textSubtle }}>{`Last 30 days · to ${fmtStampFull(now)}`}</Meta>

        <View style={styles.well}>
          <Body size="sm" tone="muted">Shortlists are anonymous by design. You see how many employers shortlisted you, never which ones — and they aren&rsquo;t told you saw the number.</Body>
        </View>

        {empty && (
          <Card style={styles.cardInner}>
            <Display level="xs">It&rsquo;s early.</Display>
            <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>Your video went live recently. Employers usually reach a new profile within a week or two of it joining the feed.</Body>
            <View style={{ marginTop: space.md }}><Button variant="primary" size="lg" label="Add another video" onPress={onVideoResume} /></View>
            <Pressable onPress={onVisibility} style={{ marginTop: space.md }}><Body size="sm" weight="medium" style={{ color: color.textMuted }}>Check who can see you</Body></Pressable>
          </Card>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space['2xl'], paddingBottom: space['4xl'] },
  cells: { flexDirection: 'row', gap: space.lg, padding: space.lg },
  cell: { flex: 1, gap: space.sm },
  cardInner: { padding: space.xl },
  well: { borderRadius: radius.md, backgroundColor: color.surfaceMuted, padding: space.lg },
})
