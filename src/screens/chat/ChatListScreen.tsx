import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConnections, getThreads,
  type ConnectionRow, type ThreadDto,
} from '../../lib/api/chat'
import { fmtClock, fmtDayMon, fmtRowStamp, originLabel } from '../../lib/chat/format'
import { useChatSocketEvents } from '../../lib/chat/socket'
import { color, space, radius, borderWidth } from '../../theme'
import { AppBar, Body, Display, Eyebrow, Meta } from '../../components/ui'
import { CounterpartyPlate, OfflineWifi } from './parts'

const OPENS_HOURS_BEFORE = 24

/**
 * ST-43 — the three thread kinds in one list, titled the way the server names its
 * counterparty (the COMPANY for an employer, "Your Interviewer" while masked, the
 * real name once revealed, "Apostrophe Support"). A read-only interviewer thread
 * is NOT archived — it stays live. Unread is a mono chip, never a red dot or a
 * coloured row fill. No presence anywhere. The employer context line and the
 * archived reasons live on the Connection, so the list joins the two.
 */
export function ChatListScreen({ onBack, onInterests, onOpenThread }: {
  onBack: () => void; onInterests: () => void; onOpenThread: (threadId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [now] = useState(() => Date.now())

  const q = useQuery({
    queryKey: ['threads'],
    queryFn: async () => {
      const [l, a, ac, cl, bl] = await Promise.all([
        getThreads({ archived: false, perPage: 50 }), getThreads({ archived: true, perPage: 50 }),
        getConnections('ACTIVE'), getConnections('CLOSED'), getConnections('BLOCKED'),
      ])
      const conns = new Map<string, ConnectionRow>()
      for (const r of [...ac.rows, ...cl.rows, ...bl.rows]) conns.set(r.id, r)
      return { live: l.rows, archived: a.rows, conns }
    },
  })

  const connected = useChatSocketEvents({
    onMessage: () => qc.invalidateQueries({ queryKey: ['threads'] }),
    onRead: () => qc.invalidateQueries({ queryKey: ['threads'] }),
  })

  const bar = (
    <AppBar title="Home" onBack={onBack}
      action={<Pressable onPress={onInterests} hitSlop={8}><Body size="sm" weight="medium" style={{ color: color.text }}>Interests</Body></Pressable>} />
  )
  const frame = (c: React.ReactNode) => <View style={[styles.page, { paddingTop: insets.top }]}>{bar}{c}</View>
  if (q.isPending) return frame(<View style={styles.centre}><Meta style={{ color: color.textMuted }}>LOADING…</Meta></View>)
  if (q.isError) return frame(<View style={styles.centre}><Body tone="muted">Could not load your chats.</Body></View>)

  const { live, archived, conns } = q.data!
  const unreadTotal = live.reduce((n, t) => n + t.unread, 0)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {bar}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Eyebrow>{unreadTotal > 0 ? `${unreadTotal} unread` : 'Chats'}</Eyebrow>
          <Display level="lg">Chats</Display>
        </View>

        {!connected && (
          <View style={styles.offline}>
            <OfflineWifi />
            <Meta style={{ color: color.warning }}>Reconnecting · a sent message will go out when you are back</Meta>
          </View>
        )}

        {live.length === 0 && archived.length === 0 ? (
          <View style={styles.emptyCard}>
            <Display level="xs">No chats yet.</Display>
            <Body size="sm" tone="muted" style={{ marginTop: space.sm }}>A chat opens when you accept an Interest, and one opens with your interviewer the day before your interview. Support is always here.</Body>
          </View>
        ) : (
          <>
            <View>{live.map((t, i) => <ThreadRow key={t.id} t={t} conn={t.connectionId ? conns.get(t.connectionId) : undefined} now={now} first={i === 0} muted={t.kind === 'STUDENT_INTERVIEWER' && t.state.readOnly && !t.state.open} onOpen={() => onOpenThread(t.id)} />)}</View>
            {archived.length > 0 && (
              <>
                <View style={styles.archHead}>
                  <Eyebrow>Archived</Eyebrow>
                  <View style={styles.rule} />
                  <Meta style={{ color: color.textSubtle }}>{String(archived.length)}</Meta>
                </View>
                <View>{archived.map((t, i) => <ThreadRow key={t.id} t={t} conn={t.connectionId ? conns.get(t.connectionId) : undefined} now={now} first={i === 0} muted onOpen={() => onOpenThread(t.id)} />)}</View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function contextLine(t: ThreadDto, conn: ConnectionRow | undefined, now: number): string {
  if (t.kind === 'USER_ADMIN') return 'Support · replies within one working day'
  if (t.kind === 'STUDENT_INTERVIEWER') {
    const slotStart = t.opensAt ? +new Date(t.opensAt) + OPENS_HOURS_BEFORE * 3_600_000 : null
    if (t.readOnlyAt && now >= +new Date(t.readOnlyAt)) return `Interview ${slotStart ? fmtDayMon(new Date(slotStart).toISOString()) : ''} · read-only since ${fmtDayMon(t.readOnlyAt)}`
    if (t.opensAt && now < +new Date(t.opensAt)) return `Opens ${fmtDayMon(t.opensAt)}`
    if (slotStart) {
      const diff = Math.round((slotStart - now) / 86_400_000)
      const rel = diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : fmtDayMon(new Date(slotStart).toISOString())
      return `Interview ${rel}, ${fmtClock(new Date(slotStart).toISOString())}`
    }
    return 'Your interview'
  }
  if (conn) {
    if (conn.status === 'ACTIVE') return `${originLabel(conn.origin)} · connected ${fmtDayMon(conn.openedAt)}`
    if (conn.status === 'CLOSED') return `Connection withdrawn ${fmtDayMon(conn.closedAt ?? conn.openedAt)}`
    return conn.closedByMe ? `You blocked them ${fmtDayMon(conn.closedAt ?? conn.openedAt)}` : `Connection blocked ${fmtDayMon(conn.closedAt ?? conn.openedAt)}`
  }
  return 'Connected'
}

function ThreadRow({ t, conn, now, first, muted, onOpen }: {
  t: ThreadDto; conn?: ConnectionRow; now: number; first?: boolean; muted?: boolean; onOpen: () => void
}) {
  const unread = t.unread > 0
  return (
    <Pressable onPress={onOpen} style={[styles.row, first ? null : styles.rowBorder]}>
      <CounterpartyPlate thread={t} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={styles.rowTop}>
          <Display level="xs" style={[{ flex: 1 }, muted ? { color: color.textMuted } : null]} numberOfLines={1}>{t.counterparty.name}</Display>
          {!!t.lastMessageAt && <Meta style={{ color: color.textSubtle }}>{fmtRowStamp(t.lastMessageAt, now)}</Meta>}
        </View>
        <Meta style={{ color: color.textSubtle }}>{contextLine(t, conn, now)}</Meta>
        <View style={styles.rowBottom}>
          <Body size="sm" weight={unread ? 'medium' : 'regular'} tone={unread ? 'default' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>{t.lastMessagePreview ?? ' '}</Body>
          {unread && <View style={styles.chip}><Meta style={{ color: color.text }}>{String(t.unread)}</Meta></View>}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.md, paddingBottom: space['4xl'] },
  offline: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.warningSoft, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  emptyCard: { borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: color.border, padding: space.lg },
  archHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  rule: { flex: 1, height: 1, backgroundColor: color.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  chip: { minWidth: 22, height: 20, borderRadius: radius.pill, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceSunken },
})
