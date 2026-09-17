import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotificationsRead, type NotificationRow } from '../../lib/api/account'
import { fmtClock, fmtDayDivider, fmtDayMonthYear } from '../../lib/chat/format'
import { color, space, borderWidth, radius } from '../../theme'
import { AppBar, Body, Display, Eyebrow, Meta } from '../../components/ui'

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
    <AppBar onBack={onBack}
      action={unread ? <Body size="sm" weight="medium" style={{ color: color.accent }} onPress={() => markAll.mutate()}>Mark all read</Body> : undefined} />
  )
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your notifications.</Body></View>)

  function open(n: NotificationRow) {
    if (!n.read) void markNotificationsRead([n.id]).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {})
    const t = routeFor(n)
    onNavigate(t.screen, t.params)
  }

  const groups = groupByDay(rows!, now)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <Display level="lg">Notifications</Display>

        {rows!.length === 0 ? (
          <View style={styles.emptyCard}>
            <Display level="xs">Nothing yet.</Display>
            <Body size="sm" tone="muted" style={{ marginTop: space.xs }}>When an employer is interested, or your interview moves, it lands here.</Body>
          </View>
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.key} style={{ gap: space.xs }}>
                <Eyebrow>{g.label}</Eyebrow>
                {g.items.map((n) => (
                  <Pressable key={n.id} onPress={() => open(n)} style={styles.row}>
                    <View style={styles.gutter}>{!n.read && <View style={styles.dot} />}</View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={styles.rowTop}>
                        <Body size="base" weight={n.read ? 'regular' : 'semibold'} tone={n.read ? 'muted' : 'default'} style={{ flex: 1 }}>{n.title}</Body>
                        <Meta style={{ color: color.textSubtle }}>{fmtClock(n.createdAt)}</Meta>
                      </View>
                      {!!n.body && <Body size="sm" tone="muted">{n.body}</Body>}
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
            <Meta style={{ color: color.textSubtle }}>{`Notifications are kept for ninety days · nothing before ${fmtDayMonthYear(now - 90 * 86_400_000)}`}</Meta>
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
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space['2xl'], paddingBottom: space['4xl'] },
  emptyCard: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  gutter: { width: 8, alignItems: 'center', paddingTop: 7 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: color.ink },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
})
