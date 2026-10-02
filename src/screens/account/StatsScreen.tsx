import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getAudience } from '../../lib/api/account'
import { fmtStampFull } from '../../lib/chat/format'
import { color, fontFamilyNative as FF } from '../../theme'
import { InkPill } from '../../components/ui'
import { DetailHeader, Panel, Skel, StateBlock } from '../../components/tab/kit'

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

  const bar = <DetailHeader title="Your stats" onBack={onBack} />
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) {
    return frame(
      <View style={styles.skels}>
        <View style={styles.cells}><View style={styles.cell}><Skel w="100%" h={130} /></View><View style={styles.cell}><Skel w="100%" h={130} /></View></View>
        <Skel w="100%" h={80} />
      </View>,
    )
  }
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load your stats." body="Try again in a moment." action="Try again" onAction={() => { void q.refetch() }} />)

  const a = q.data!
  const empty = a.shortlistCount === 0 && a.profileViews === 0
  const live = (a as { published?: boolean }).published !== false

  return frame(
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={[styles.pad, styles.cells]}>
        <Stat value={a.shortlistCount} label="employers shortlisted you" dim={empty} />
        <Stat value={a.profileViews} label="profile views" dim={empty} />
      </View>
      {/* Both are running totals on the profile, not a window — say so rather than imply one. */}
      <Text style={styles.foot}>{`All time · as of ${fmtStampFull(now)}`}</Text>

      <View style={styles.well}>
        <Text style={styles.wellLabel}>ANONYMOUS BY DESIGN</Text>
        <Text style={styles.wellText}>You see how many employers shortlisted you, never which ones — and they aren&rsquo;t told you saw the number.</Text>
      </View>

      {empty && (
        <View style={styles.ink}>
          <InkPill label={live ? 'It’s early' : 'Not live yet'} />
          <Text style={styles.inkTitle}>{live ? 'Employers are only just finding you.' : 'Nobody can see you yet.'}</Text>
          <Text style={styles.inkBody}>
            {live
              ? 'A new profile usually gets its first views within a week or two of joining the feed.'
              : 'Your profile joins the employer feed when your interview film is published.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onVideoResume} style={({ pressed }) => [styles.inkBtn, pressed && styles.pressed]}>
            <Text style={styles.inkBtnText}>{live ? 'Add another video' : 'See your profile'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onVisibility} hitSlop={8} style={styles.inkLink}>
            <Text style={styles.inkLinkText}>Check who can see you →</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>,
  )
}

function Stat({ value, label, dim }: { value: number; label: string; dim: boolean }) {
  return (
    <Panel style={styles.cell}>
      <Text style={[styles.figure, dim && styles.figureDim]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Panel>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  skels: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  body: { paddingTop: 6, paddingBottom: 40 },
  pad: {},
  cells: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  cell: { flex: 1, padding: 18, gap: 6, borderRadius: 20 },
  figure: { fontFamily: FF.bodyBold, fontSize: 64, lineHeight: 64, letterSpacing: -3.2, color: color.text },
  figureDim: { color: color.textSubtle },
  statLabel: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 20, color: color.textMuted },
  foot: { fontFamily: FF.body, fontSize: 13, lineHeight: 19, color: color.textSubtle, paddingHorizontal: 24, paddingTop: 10 },
  well: { marginHorizontal: 20, marginTop: 14, backgroundColor: color.surfaceMuted, borderRadius: 14, padding: 14, gap: 4 },
  wellLabel: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 1.54, color: color.textMuted },
  wellText: { fontFamily: FF.body, fontSize: 14, lineHeight: 20, color: color.textMuted },
  ink: { marginHorizontal: 20, marginTop: 14, backgroundColor: color.ink, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 20, gap: 12, alignItems: 'flex-start' },
  inkTitle: { fontFamily: FF.bodyBold, fontSize: 24, lineHeight: 26, letterSpacing: -0.84, color: color.textOnInk },
  inkBody: { fontFamily: FF.body, fontSize: 14.5, lineHeight: 22, color: color.textOnInkMuted },
  inkBtn: { height: 46, minWidth: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  inkBtnText: { fontFamily: FF.bodyBold, fontSize: 15, color: color.ink },
  pressed: { opacity: 0.7 },
  inkLink: { minHeight: 44, justifyContent: 'center' },
  inkLinkText: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.textOnInkMuted },
})
