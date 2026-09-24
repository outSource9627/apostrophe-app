import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getAudience } from '../../lib/api/account'
import { fmtStampFull } from '../../lib/chat/format'
import { color, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Card, ErrorState, InkButton, InkCard, InkPill, ScreenHeader, Skeleton, text } from '../../components/ui'

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

  const bar = <ScreenHeader title="Your stats" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your stats." body="Try again in a moment." /></View>)

  const a = q.data!
  const empty = a.shortlistCount === 0 && a.profileViews === 0
  const live = (a as { published?: boolean }).published !== false

  return frame(
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.cells}>
        <Stat value={a.shortlistCount} label="employers shortlisted you" dim={empty} />
        <Stat value={a.profileViews} label="profile views" dim={empty} />
      </View>
      {/* Both are running totals on the profile, not a window — say so rather than imply one. */}
      <Text style={[text.uiXs, styles.subtle, styles.pad]}>{`All time · as of ${fmtStampFull(now)}`}</Text>

      <View style={styles.well}>
        <Text style={[text.metaSm, styles.eyebrow]}>ANONYMOUS BY DESIGN</Text>
        <Text style={[text.uiSm, styles.muted]}>You see how many employers shortlisted you, never which ones — and they aren&rsquo;t told you saw the number.</Text>
      </View>

      {empty && (
        <InkCard>
          <InkPill label={live ? 'It’s early' : 'Not live yet'} />
          <Text style={[text.displaySm, styles.onInk]}>{live ? 'Employers are only just finding you.' : 'Nobody can see you yet.'}</Text>
          <Text style={[text.uiSm, styles.onInkMuted]}>
            {live
              ? 'A new profile usually gets its first views within a week or two of joining the feed.'
              : 'Your profile joins the employer feed when your interview film is published.'}
          </Text>
          <InkButton label={live ? 'Add another video' : 'See your profile'} onPress={onVideoResume} />
          <Pressable accessibilityRole="button" onPress={onVisibility} hitSlop={space.sm}>
            <Text style={[text.uiSmSemi, styles.onInkMuted]}>Check who can see you →</Text>
          </Pressable>
        </InkCard>
      )}
    </ScrollView>,
  )
}

function Stat({ value, label, dim }: { value: number; label: string; dim: boolean }) {
  return (
    <Card style={styles.cell}>
      <Text style={[text.displayScore, styles.figure, dim && styles.subtle]}>{value}</Text>
      <Text style={[text.uiSm, styles.muted]}>{label}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md, paddingBottom: space.xl },
  cells: { flexDirection: 'row', gap: spaceHalf['2.5'] },
  cell: { flex: 1, padding: space.lg, gap: space.xs },
  figure: { color: color.text },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  pad: { paddingHorizontal: space.xs },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow },
  well: { borderRadius: radius.tile, backgroundColor: color.surfaceMuted, padding: space.md, gap: space.xs },
  onInk: { color: color.textOnInk },
  onInkMuted: { color: color.textOnInkMuted },
})
