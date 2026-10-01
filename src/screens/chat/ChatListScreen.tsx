import React, { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConnections, getThreads,
  type ConnectionRow, type ThreadDto,
} from '../../lib/api/chat'
import { fmtClock, fmtDayMon, fmtRowStamp, originLabel } from '../../lib/chat/format'
import { useChatSocketEvents } from '../../lib/chat/socket'
import { borderWidth, color, fontFamilyNative as FF, opacity, radius } from '../../theme'
import { CompactBar, GroupLabel, LargeTitle, SkeletonRows, StateBlock, useCollapsingTitle } from '../../components/tab/kit'
import { CounterpartyPlate } from './parts'

const OPENS_HOURS_BEFORE = 24

/**
 * ST-43 — the three thread kinds in one list, as the signed-off mockup draws it
 * (docs/interviews-profile-chat-final.html), titled the way the server names its
 * counterparty (the COMPANY for an employer, "Your Interviewer" while masked, the
 * real name once revealed, "Apostrophe Support"). A read-only interviewer thread
 * is NOT archived — it stays live. Unread is a mono chip, never a red dot or a
 * coloured row fill. No presence anywhere. The employer context line and the
 * archived reasons live on the Connection, so the list joins the two.
 */
export function ChatListScreen({ onOpenThread }: {
  onBack?: () => void; onInterests?: () => void; onOpenThread: (threadId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const [now] = useState(() => Date.now())
  const title = useCollapsingTitle()

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

  const strip = !connected ? <ReconnectingStrip /> : null
  const frame = (c: React.ReactNode) => (
    <View style={[s.page, { paddingTop: insets.top }]}>
      {strip}
      <LargeTitle title="Chats" />
      {c}
    </View>
  )
  if (q.isPending) return frame(<View style={s.pad}><SkeletonRows count={5} /></View>)
  if (q.isError) return frame(<StateBlock icon="alert" title="Could not load your chats." body="Nothing has changed. Try again in a moment." action="Try again" onAction={() => { void q.refetch() }} />)

  const { live, archived, conns } = q.data!
  const unreadTotal = live.reduce((n, t) => n + t.unread, 0)

  return (
    <View style={[s.page, { paddingTop: insets.top }]}>
      <CompactBar title="Chats" opacity={title.barOpacity} />
      {strip}
      <Animated.ScrollView onScroll={title.onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
        <LargeTitle title="Chats">
          {unreadTotal > 0 && <Text style={s.unread}>{`${unreadTotal} UNREAD`}</Text>}
        </LargeTitle>

        {live.length === 0 && archived.length === 0 ? (
          <View style={s.pad}>
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No chats yet.</Text>
              <Text style={s.emptyBody}>A chat opens when you accept an Interest, and one opens with your interviewer the day before your interview. Support is always here.</Text>
            </View>
          </View>
        ) : (
          <View style={s.pad}>
            <View>{live.map((t, i) => <ThreadRow key={t.id} t={t} conn={t.connectionId ? conns.get(t.connectionId) : undefined} now={now} first={i === 0} muted={t.kind === 'STUDENT_INTERVIEWER' && t.state.readOnly && !t.state.open} onOpen={() => onOpenThread(t.id)} />)}</View>
            {archived.length > 0 && (
              <>
                <View style={s.archHead}>
                  <GroupLabel>Archived</GroupLabel>
                  <View style={s.rule} />
                  <Text style={s.archCount}>{String(archived.length)}</Text>
                </View>
                <View>{archived.map((t, i) => <ThreadRow key={t.id} t={t} conn={t.connectionId ? conns.get(t.connectionId) : undefined} now={now} first={i === 0} muted onOpen={() => onOpenThread(t.id)} />)}</View>
              </>
            )}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  )
}

/** Shown above the title while the socket is down: nothing is lost, a sent message goes out on reconnect. */
function ReconnectingStrip() {
  const v = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]))
    a.start()
    return () => a.stop()
  }, [v])
  return (
    <View accessibilityRole="alert" style={s.strip}>
      <Animated.View style={[s.stripDot, { opacity: v }]} />
      <Text style={s.stripText}>Reconnecting · a sent message will go out when you are back</Text>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.counterparty.name}${unread ? `, ${t.unread} unread` : ''}`}
      onPress={onOpen}
      style={({ pressed }) => [s.row, first ? null : s.rowBorder, pressed && s.pressed]}
    >
      <CounterpartyPlate thread={t} size={48} />
      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text style={[s.name, unread && s.nameUnread, muted && s.nameMuted]} numberOfLines={1}>{t.counterparty.name}</Text>
          {!!t.lastMessageAt && <Text style={s.stamp}>{fmtRowStamp(t.lastMessageAt, now)}</Text>}
        </View>
        <Text style={s.ctx} numberOfLines={2}>{contextLine(t, conn, now).toUpperCase()}</Text>
        <View style={s.rowBottom}>
          <Text style={[s.preview, unread && s.previewUnread]} numberOfLines={1}>{t.lastMessagePreview ?? ' '}</Text>
          {unread && <View style={s.chip}><Text style={s.chipText}>{String(t.unread)}</Text></View>}
        </View>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingBottom: 130 },
  pad: { paddingHorizontal: 20 },
  pressed: { opacity: opacity.pressed },
  unread: { fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 1.54, color: color.textMuted, marginTop: 8 },

  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 20,
    backgroundColor: color.warningSoft, borderBottomWidth: borderWidth.thin, borderBottomColor: color.warningEdge,
  },
  stripDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.warningFill },
  stripText: { flex: 1, fontFamily: FF.monoMedium, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: color.warning },

  emptyCard: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, padding: 16, marginTop: 6 },
  emptyTitle: { fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.4, color: color.text },
  emptyBody: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.textMuted, marginTop: 8 },

  archHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  rule: { flex: 1, height: borderWidth.thin, backgroundColor: color.border },
  archCount: { fontFamily: FF.monoMedium, fontSize: 11, color: color.textSubtle },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, minHeight: 88 },
  rowBorder: { borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: FF.bodySemiBold, fontSize: 17, letterSpacing: -0.17, color: color.text },
  nameUnread: { fontFamily: FF.bodyBold },
  nameMuted: { color: color.textMuted },
  stamp: { fontFamily: FF.monoMedium, fontSize: 11, color: color.textSubtle },
  ctx: { fontFamily: FF.monoMedium, fontSize: 10.5, lineHeight: 15, letterSpacing: 0.63, color: color.textSubtle, marginTop: 3 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  preview: { flex: 1, fontFamily: FF.body, fontSize: 14.5, color: color.textMuted },
  previewUnread: { fontFamily: FF.bodyMedium, color: color.text },
  chip: { minWidth: 22, height: 22, borderRadius: radius.pill, paddingHorizontal: 7, backgroundColor: color.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FF.monoMedium, fontSize: 11, color: color.text },
})
