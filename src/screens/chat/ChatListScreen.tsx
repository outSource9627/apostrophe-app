import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConnections, getThreads, pinThread, searchMessages,
  type ConnectionRow, type ThreadDto,
} from '../../lib/api/chat'
import { listInterviews } from '../../lib/api/interviews'
import { fmtClock, fmtDayMon, fmtHours, fmtRelDayInline, fmtRowStamp, originLabel } from '../../lib/chat/format'
import { useChatSocketEvents } from '../../lib/chat/socket'
import { useChatSearch } from '../../lib/chat/search'
import { useChatConfig } from '../../lib/chat/config'
import { borderWidth, color, fontFamilyNative as FF, height, space } from '../../theme'
import { PopoverMenu, type MenuAnchor } from '../../components/ui'
import { StateBlock } from '../../components/tab/kit'
import { ChatListFrame, ChatPlate, ChatRow, type ChatListStatus } from '../../components/chat'

/**
 * ST-43 — the three thread kinds in one list (docs/chat-redesign-mockups.html,
 * A), titled the way the server names its counterparty (the COMPANY for an
 * employer, "Your Interviewer" while masked, the real name once revealed,
 * "Apostrophe Support"). A read-only interviewer thread is NOT archived — it
 * stays live, greyed. No presence anywhere. The employer context line and the
 * archived reasons live on the Connection, and an interview's time on the
 * interview, so the list joins all three. A long press pins a thread (or
 * unpins it): pinned threads sit on top, newest pin first, marked with a pin;
 * the pin is saved on the server, never seen by the other side. The search
 * filters by name and finds messages by their words.
 */
export function ChatListScreen({ onOpenThread }: {
  onBack?: () => void; onInterests?: () => void; onOpenThread: (threadId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const hours = useChatConfig()
  const [now, setNow] = useState(() => Date.now())
  const [menu, setMenu] = useState<{ t: ThreadDto; anchor: MenuAnchor } | null>(null)
  const [pinFailed, setPinFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const search = useChatSearch(searchMessages)

  const q = useQuery({
    queryKey: ['threads'],
    queryFn: async () => {
      const [l, a, ac, cl, bl] = await Promise.all([
        getThreads({ archived: false, perPage: 50 }), getThreads({ archived: true, perPage: 50 }),
        getConnections('ACTIVE'), getConnections('CLOSED'), getConnections('BLOCKED'),
      ])
      const conns = new Map<string, ConnectionRow>()
      for (const r of [...ac.rows, ...cl.rows, ...bl.rows]) conns.set(r.id, r)
      // An interviewer thread's line names the interview's time — the interview's own slot, never a guess from opensAt.
      const slots = new Map<string, string>()
      if ([...l.rows, ...a.rows].some((t) => t.kind === 'STUDENT_INTERVIEWER' && t.interviewId)) {
        try {
          for (const iv of (await listInterviews()).interviews) slots.set(iv.id, iv.slotStart)
        } catch { /* the line falls back to what the thread knows */ }
      }
      return { live: l.rows, archived: a.rows, conns, slots }
    },
  })

  const connected = useChatSocketEvents({
    onMessage: () => qc.invalidateQueries({ queryKey: ['threads'] }),
    onRead: () => qc.invalidateQueries({ queryKey: ['threads'] }),
  })

  // Optimistic: the row moves at once, and the refetch settles the order either way.
  async function togglePin(t: ThreadDto) {
    const pinned = !t.pinnedAt
    setPinFailed(false)
    const flip = (rows: ThreadDto[]) => rows.map((r) => (r.id === t.id ? { ...r, pinnedAt: pinned ? new Date().toISOString() : null } : r))
    qc.setQueryData<typeof q.data>(['threads'], (d) => (d ? { ...d, live: flip(d.live), archived: flip(d.archived) } : d))
    try { await pinThread(t.id, pinned) } catch { setPinFailed(true) } finally { qc.invalidateQueries({ queryKey: ['threads'] }) }
  }

  async function refresh() {
    setRefreshing(true)
    try { await q.refetch() } finally { setNow(Date.now()); setRefreshing(false) }
  }

  const data = q.data
  // One flat list: pinned first (newest pin on top), then newest last message; archived / withdrawn / blocked sit at their natural date.
  const stamp = (iso: string | null) => (iso ? +new Date(iso) : 0)
  const all = data ? [...data.live, ...data.archived].sort((a, b) => stamp(b.pinnedAt) - stamp(a.pinnedAt) || stamp(b.lastMessageAt) - stamp(a.lastMessageAt)) : []
  const shown = search.term ? all.filter((t) => t.counterparty.name.toLowerCase().includes(search.term)) : all
  const status: ChatListStatus = data ? (all.length ? 'ready' : 'empty') : q.isError ? 'error' : 'loading'

  const rows = shown.map((t) => {
    const muted = t.state.archived || (t.kind === 'STUDENT_INTERVIEWER' && t.state.readOnly && !t.state.open)
    return (
      <ChatRow
        key={t.id}
        plate={<ChatPlate thread={t} size={height['control-sm']} muted={muted} />}
        name={t.counterparty.name}
        pinned={!!t.pinnedAt}
        time={t.lastMessageAt ? fmtRowStamp(t.lastMessageAt, now) : null}
        unread={t.unread}
        preview={t.lastMessagePreview ?? ' '}
        context={contextLine(t, t.connectionId ? data?.conns.get(t.connectionId) : undefined, t.interviewId ? data?.slots.get(t.interviewId) : undefined, now)}
        muted={muted}
        onPress={() => onOpenThread(t.id)}
        onMenu={(anchor) => setMenu({ t, anchor })}
        menuLabel={t.pinnedAt ? 'Unpin chat' : 'Pin chat'}
      />
    )
  })

  const opensWhen = hours.opensHoursBefore != null ? `${fmtHours(hours.opensHoursBefore)} before` : 'shortly before'

  return (
    <View style={[s.page, { paddingTop: insets.top }]}>
      <ChatListFrame
        title="Chats"
        connected={connected}
        status={status}
        errorView={<StateBlock icon="alert" title="Could not load your chats." body="Nothing has changed. Try again in a moment." action="Try again" onAction={() => { q.refetch() }} />}
        emptyView={(
          <View style={s.pad}>
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No chats yet.</Text>
              <Text style={s.emptyBody}>{`A chat opens when you accept an Interest, and one opens with your interviewer ${opensWhen} your interview. Support is always here.`}</Text>
            </View>
          </View>
        )}
        query={search.query}
        onQuery={search.setQuery}
        hits={search.hits}
        nameOf={(id) => all.find((t) => t.id === id)?.counterparty.name ?? 'Conversation'}
        onOpenHit={onOpenThread}
        notice={pinFailed ? 'That pin did not save. Try again.' : null}
        rows={rows}
        hint="Long-press a chat to pin it"
        refreshing={refreshing}
        onRefresh={refresh}
        bottomPad={height['tab-bar'] + space['4xl']}
      />
      <PopoverMenu
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        items={menu ? [{ key: 'pin', label: menu.t.pinnedAt ? 'Unpin chat' : 'Pin chat', icon: 'pushpin', onPress: () => { togglePin(menu.t) } }] : []}
      />
    </View>
  )
}

/** What the chat is, in a line: the connection, the interview, or support. */
function contextLine(t: ThreadDto, conn: ConnectionRow | undefined, slotStart: string | undefined, now: number): string {
  if (t.kind === 'USER_ADMIN') return 'Support · replies within one working day'
  if (t.kind === 'STUDENT_INTERVIEWER') {
    if (t.readOnlyAt && now >= +new Date(t.readOnlyAt)) {
      return slotStart ? `Interview ${fmtDayMon(slotStart)} · read-only since ${fmtDayMon(t.readOnlyAt)}` : `Read-only since ${fmtDayMon(t.readOnlyAt)}`
    }
    if (t.opensAt && now < +new Date(t.opensAt)) return `Opens ${fmtDayMon(t.opensAt)}`
    if (slotStart) return `Interview ${fmtRelDayInline(slotStart, now)}, ${fmtClock(slotStart)}`
    return 'Your interview'
  }
  if (conn) {
    if (conn.status === 'ACTIVE') return `${originLabel(conn.origin)} · connected ${fmtDayMon(conn.openedAt)}`
    if (conn.status === 'CLOSED') return `Connection withdrawn ${fmtDayMon(conn.closedAt ?? conn.openedAt)}`
    return conn.closedByMe ? `You blocked them ${fmtDayMon(conn.closedAt ?? conn.openedAt)}` : `Connection blocked ${fmtDayMon(conn.closedAt ?? conn.openedAt)}`
  }
  return 'Connected'
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  pad: { paddingHorizontal: 20 },
  emptyCard: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderRadius: 18, padding: 16, marginTop: 6 },
  emptyTitle: { fontFamily: FF.bodyBold, fontSize: 20, letterSpacing: -0.4, color: color.text },
  emptyBody: { fontFamily: FF.body, fontSize: 15, lineHeight: 22, color: color.textMuted, marginTop: 8 },
})
