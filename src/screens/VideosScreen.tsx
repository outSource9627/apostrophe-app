import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { api } from '../lib/api'
import { color, space, radius, fontSize, fontWeight, fontFamilyNative } from '../theme'

interface SelfVideo {
  id: string
  slot: number
  kind: string
  title: string | null
  durationSec: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
}
interface Profile { hiddenFromFeed: boolean }
interface Config { limits: { selfVideoMaxCount: number; selfVideoMaxSeconds: number } }

const STATUS: Record<SelfVideo['status'], { text: string; fg: string; bg: string }> = {
  APPROVED: { text: 'Live on your profile', fg: color.success, bg: color.successSoft },
  PENDING: { text: 'Waiting for review', fg: color.warning, bg: color.warningSoft },
  REJECTED: { text: 'Not published', fg: color.danger, bg: color.dangerSoft },
}

/**
 * SP-03/SP-04 — the student's own short videos, and SP-12/SP-13 feed visibility.
 *
 * A list rather than a grid: on a phone each clip gets a full row and a real tap
 * target. The verified interview is set apart at the top because SP-05 means it
 * always leads — these sit behind it, marked as self-recorded.
 */
export function VideosScreen({ onRecord }: { onRecord: () => void }) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const videos = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.get<{ videos: SelfVideo[] }>('/students/me/videos'),
  })
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/students/me/profile'),
  })
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.get<Config>('/config') })

  const setVisibility = useMutation({
    mutationFn: (hiddenFromFeed: boolean) =>
      api.patch('/students/me/profile', { hiddenFromFeed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/students/me/videos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos'] }),
  })

  if (videos.isPending || profile.isPending || config.isPending) {
    return (
      <View style={[styles.page, styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.textSubtle} />
      </View>
    )
  }

  const list = videos.data?.videos ?? []
  const max = config.data?.limits.selfVideoMaxCount ?? 3
  const seconds = config.data?.limits.selfVideoMaxSeconds ?? 90
  const visible = !profile.data?.hiddenFromFeed

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>YOUR OWN RECORDINGS · {list.length} OF {max}</Text>
        <Text style={styles.headline}>Say a bit more.</Text>
        <Text style={styles.lede}>
          {seconds} seconds each. Marked as self-recorded — your verified interview still leads.
        </Text>

        <View style={styles.verified}>
          <View style={styles.verifiedThumb}>
            <Svg width={19} height={19} viewBox="0 0 24 24">
              <Path d="M9 7.5 17 12l-8 4.5V7.5Z" fill={color.textInverse} />
            </Svg>
          </View>
          <View style={styles.rowBody}>
            <View style={[styles.pill, { backgroundColor: color.accent }]}>
              <Text style={[styles.pillText, { color: color.textInverse }]}>Verified interview</Text>
            </View>
            <Text style={styles.verifiedTitle}>Your interview</Text>
            <Text style={styles.verifiedMeta}>Leads your card</Text>
          </View>
        </View>

        {list.map((v) => {
          const s = STATUS[v.status]
          return (
            <View key={v.id} style={styles.row}>
              <View style={styles.thumb}>
                <Svg width={19} height={19} viewBox="0 0 24 24">
                  <Path d="M9 7.5 17 12l-8 4.5V7.5Z" fill={color.textSubtle} />
                </Svg>
              </View>
              <View style={styles.rowBody}>
                <View style={[styles.pill, { backgroundColor: s.bg }]}>
                  <Text style={[styles.pillText, { color: s.fg }]}>{s.text}</Text>
                </View>
                <Text style={styles.rowTitle}>{v.title ?? v.kind}</Text>
                <Text style={styles.rowMeta}>{v.durationSec ? `${v.durationSec}s` : ''}</Text>
                {v.status === 'REJECTED' && !!v.rejectionReason && (
                  <Text style={styles.reason}>{v.rejectionReason}</Text>
                )}
                <Pressable onPress={() => remove.mutate(v.id)} style={styles.deleteTarget}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )
        })}

        {list.length < max && (
          <Pressable onPress={onRecord} style={styles.emptySlot}>
            <View style={styles.plus}>
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={color.textSubtle} strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
            </View>
            <View>
              <Text style={styles.slotTitle}>{max - list.length === 1 ? 'One slot left' : `${max - list.length} slots left`}</Text>
              <Text style={styles.rowMeta}>Record now, or pick a file</Text>
            </View>
          </Pressable>
        )}

        {/* SP-12 / SP-13 */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Appear in employer searches</Text>
            <Text style={styles.toggleBody}>Nothing is deleted when this is off.</Text>
          </View>
          <Switch
            value={visible}
            onValueChange={(next) => setVisibility.mutate(!next)}
            trackColor={{ false: color.borderStrong, true: color.success }}
            thumbColor={color.surface}
          />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: space.lg + 4, paddingTop: space.sm },
  eyebrow: { fontSize: 11, letterSpacing: 1.8, color: color.textSubtle },
  headline: { marginTop: 11, fontFamily: fontFamilyNative.display, fontSize: 30, color: color.text },
  lede: { marginTop: space.sm, fontSize: 13.5, lineHeight: 21, color: color.textMuted },
  verified: {
    flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: color.ink,
    borderRadius: radius.md + 4, padding: space.md, marginTop: space.xl,
  },
  verifiedThumb: {
    width: 58, height: 84, borderRadius: 7, backgroundColor: '#1E2429',
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedTitle: { marginTop: space.sm, fontFamily: fontFamilyNative.display, fontSize: 17, color: color.textInverse },
  verifiedMeta: { marginTop: 2, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  row: {
    flexDirection: 'row', gap: 13, alignItems: 'flex-start', borderWidth: 1, borderColor: color.border,
    borderRadius: radius.md + 4, padding: space.md, marginTop: 11,
  },
  thumb: {
    width: 58, height: 84, borderRadius: 7, backgroundColor: color.surfaceSunken,
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: fontWeight.medium },
  rowTitle: { marginTop: space.sm, fontSize: 14.5, fontWeight: fontWeight.medium, color: color.text },
  rowMeta: { marginTop: 2, fontSize: 12, color: color.textSubtle },
  reason: { marginTop: space.sm, fontSize: 12.5, lineHeight: 18, color: color.danger },
  deleteTarget: { marginTop: space.sm, height: 44, justifyContent: 'center' },
  delete: { fontSize: fontSize.sm, color: color.textSubtle },
  emptySlot: {
    flexDirection: 'row', gap: 13, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed',
    borderColor: color.borderStrong, borderRadius: radius.md + 4, padding: space.md, marginTop: 11,
  },
  plus: {
    width: 58, height: 84, borderRadius: 7, backgroundColor: color.surface,
    borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center',
  },
  slotTitle: { fontSize: 14.5, fontWeight: fontWeight.medium, color: color.textMuted },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg,
    marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: color.border,
  },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: 14.5, fontWeight: fontWeight.medium, color: color.text },
  toggleBody: { marginTop: 3, fontSize: 12.5, lineHeight: 18, color: color.textMuted },
})
