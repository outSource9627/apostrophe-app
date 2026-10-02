import React, { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotificationsRead, type NotificationRow } from '../../lib/api/account'
import { fmtClock, fmtDayDivider, fmtDayMonthYear } from '../../lib/chat/format'
import { borderWidth, color, fontFamilyNative as FF } from '../../theme'
import { DetailHeader, GroupLabel, Skel, StateBlock } from '../../components/tab/kit'

/**
 * ST-46 — a day-grouped list kept for NINETY DAYS. Read/unread are a MARKER and
 * WEIGHT, never a coloured row fill: unread = a 7px INK dot (never crimson) +
 * semibold ink; read = no dot (gutter reserved so titles align) + muted. Each row
 * deep-links to its subject. Mark all read is the one crimson action.
 */
export function NotificationsScreen({ onBack, onNavigate }: {
  onBack: () => void; onNavigate: (screen: string, params?: Record<string, unknown>) => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [now] = useState(() => Date.now())
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => getNotifications({ perPage: 100 }) })
  const markAll = useMutation({ mutationFn: () => markNotificationsRead(), onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })

  const rows = q.data?.rows
  const unread = rows?.some((n) => !n.read) ?? false
  const bar = (
    <DetailHeader
      title="Notifications"
      onBack={onBack}
      right={unread ? (
        <Pressable accessibilityRole="button" onPress={() => markAll.mutate()} hitSlop={8} style={styles.markAll}>
          <Text style={styles.link}>Mark all read</Text>
        </Pressable>
      ) : undefined}
    />
  )
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) {
    return frame(
      <View style={styles.skels}>
        {[0, 1, 2, 3, 4].map((i) => <Skel key={i} w="100%" h={86} />)}
      </View>,
    )
  }
  if (q.isError) {
    return frame(<StateBlock icon="alert" title="Could not load your notifications." body="Pull down or come back in a moment." action="Try again" onAction={() => { void q.refetch() }} />)
  }

  function open(n: NotificationRow) {
    if (!n.read) void markNotificationsRead([n.id]).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {})
    const t = routeFor(n)
    onNavigate(t.screen, t.params)
  }

  const groups = groupByDay(rows!, now)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch().then(() => undefined)} tintColor={color.textSubtle} />}
      >
        {rows!.length === 0 ? (
          <StateBlock icon="bell" title="Nothing yet." body="When an employer is interested, or your interview moves, it lands here." />
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.key}>
                <GroupLabel style={styles.eyebrow}>{g.label}</GroupLabel>
                <View style={styles.pad}>
                  <View style={styles.card}>
                    {g.items.map((n, i) => (
                      <Pressable
                        key={n.id}
                        accessibilityRole="button"
                        onPress={() => open(n)}
                        style={({ pressed }) => [styles.row, i < g.items.length - 1 && styles.rule, !n.read && styles.unreadRow, pressed && styles.pressed]}
                      >
                        <View style={styles.gutter}>{!n.read && <View style={styles.dot} />}</View>
                        <View style={styles.rowText}>
                          <View style={styles.rowTop}>
                            <Text style={[styles.title, !n.read && styles.titleUnread]}>{n.title}</Text>
                            <Text style={styles.time}>{fmtClock(n.createdAt)}</Text>
                          </View>
                          {!!n.body && <Text style={styles.bodyText}>{n.body}</Text>}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ))}
            <Text style={styles.foot}>{`Notifications are kept for ninety days · nothing before ${fmtDayMonthYear(now - 90 * 86_400_000)}`}</Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

/** The three notifications about a video the student uploaded themselves. */
const SELF_VIDEO_KINDS = ['profile.video.approved', 'profile.video.rejected', 'profile.video.removed']

function routeFor(n: NotificationRow): { screen: string; params?: Record<string, unknown> } {
  const meta = n.meta ?? {}
  const threadId = typeof meta.threadId === 'string' ? meta.threadId : null
  const interviewId = typeof meta.interviewId === 'string' ? meta.interviewId : null
  if (threadId) return { screen: 'Thread', params: { id: threadId } }
  // RC-11 / RC-12 / RC-13 — the film went live, was taken down, or could not be made: the film screen says which.
  if (n.kind.startsWith('interview.video.')) return { screen: 'VideoResume' }
  // A video the student uploaded themselves was approved, not approved (with the reason), or taken down by an admin: the videos screen says which.
  if (SELF_VIDEO_KINDS.includes(n.kind)) return { screen: 'Videos' }
  if (interviewId) return { screen: 'InterviewDetail', params: { id: interviewId } }
  switch (n.category) {
    case 'MESSAGE': return { screen: 'Chats' }
    case 'CONNECTION': return { screen: n.kind.includes('interest') ? 'Interests' : 'Connections' }
    case 'INTERVIEW': return { screen: 'Interviews' }
    case 'APPLICATION': return { screen: 'Applications' }
    default: return { screen: 'Account' }
  }
}

function groupByDay(rows: NotificationRow[], now: number): { key: string; label: string; items: NotificationRow[] }[] {
  const out: { key: string; label: string; items: NotificationRow[] }[] = []
  for (const n of rows) {
    const label = fmtDayDivider(n.createdAt, now)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(n)
    else out.push({ key: `${label}-${n.id}`, label, items: [n] })
  }
  return out
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  skels: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  body: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  markAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  link: { fontFamily: FF.bodySemiBold, fontSize: 14.5, color: color.accent },
  eyebrow: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 },
  card: { backgroundColor: color.surface, borderRadius: 20, borderWidth: borderWidth.thin, borderColor: color.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  rule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  unreadRow: { backgroundColor: color.accentWash },
  pressed: { backgroundColor: color.surfaceMuted },
  gutter: { width: 8, paddingTop: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: FF.bodyMedium, fontSize: 16, lineHeight: 21, letterSpacing: -0.16, color: color.textMuted },
  titleUnread: { fontFamily: FF.bodySemiBold, color: color.text },
  time: { fontFamily: FF.monoMedium, fontSize: 11, color: color.textSubtle },
  bodyText: { fontFamily: FF.body, fontSize: 14, lineHeight: 19.6, color: color.textMuted },
  foot: { fontFamily: FF.body, fontSize: 13, lineHeight: 19, color: color.textSubtle, paddingHorizontal: 24, paddingTop: 14 },
})
