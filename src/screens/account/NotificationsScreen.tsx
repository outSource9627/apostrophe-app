import React, { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotificationsRead, type NotificationRow } from '../../lib/api/account'
import { fmtClock, fmtDayDivider, fmtDayMonthYear } from '../../lib/chat/format'
import { borderWidth, color, height, radius, space, spaceHalf, trackingNative } from '../../theme'
import { EmptyState, ErrorState, ScreenHeader, Skeleton, text } from '../../components/ui'

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
    <ScreenHeader
      title="Notifications"
      onBack={onBack}
      right={unread ? (
        <Pressable accessibilityRole="button" onPress={() => markAll.mutate()} hitSlop={space.sm} style={styles.markAll}>
          <Text style={[text.uiSmSemi, styles.accent]}>Mark all read</Text>
        </Pressable>
      ) : undefined}
    />
  )
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)
  if (q.isError) return frame(<View style={styles.centre}><ErrorState title="Could not load your notifications." body="Pull down or come back in a moment." /></View>)

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
          <View style={styles.empty}>
            <EmptyState title="Nothing yet." body="When an employer is interested, or your interview moves, it lands here." />
          </View>
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.key} style={styles.group}>
                <Text style={[text.metaMd, styles.eyebrow]}>{g.label.toUpperCase()}</Text>
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
                          <Text style={[n.read ? text.uiMd : text.uiMdSemi, styles.title, n.read && styles.muted]}>{n.title}</Text>
                          <Text style={[text.metaSm, styles.subtle]}>{fmtClock(n.createdAt)}</Text>
                        </View>
                        {!!n.body && <Text style={[text.uiSm, styles.muted]}>{n.body}</Text>}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Text style={[text.uiXs, styles.subtle, styles.footNote]}>{`Notifications are kept for ninety days · nothing before ${fmtDayMonthYear(now - 90 * 86_400_000)}`}</Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function routeFor(n: NotificationRow): { screen: string; params?: Record<string, unknown> } {
  const meta = n.meta ?? {}
  const threadId = typeof meta.threadId === 'string' ? meta.threadId : null
  const interviewId = typeof meta.interviewId === 'string' ? meta.interviewId : null
  if (threadId) return { screen: 'Thread', params: { id: threadId } }
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
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  loading: { padding: space.xl },
  empty: { paddingTop: space['3xl'] },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.lg, paddingBottom: space.xl },
  markAll: { height: height.tap, justifyContent: 'center', paddingRight: space.sm },
  accent: { color: color.accent },
  group: { gap: space.sm },
  eyebrow: { color: color.textMuted, letterSpacing: trackingNative.eyebrow, paddingHorizontal: space.xs },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceHalf['2.5'], paddingHorizontal: spaceHalf['3.5'], paddingVertical: space.md },
  rule: { borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  unreadRow: { backgroundColor: color.accentWash },
  pressed: { backgroundColor: color.surfaceMuted },
  gutter: { width: space.sm, alignItems: 'center', paddingTop: spaceHalf['1.5'] },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.accent },
  rowText: { flex: 1, minWidth: 0, gap: space['2xs'] },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  title: { flex: 1 },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  footNote: { paddingHorizontal: space.xs },
})
