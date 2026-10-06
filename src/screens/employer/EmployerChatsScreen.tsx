import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { height, space } from '../../theme'
import { Button, PopoverMenu, type MenuAnchor } from '../../components/ui'
import { EmployerShell } from '../../components/employer'
import { EmEmpty, EmError } from '../../components/employer/em'
import { TextLink } from '../../components/tab/kit'
import { ChatListFrame, ChatPlate, ChatRow, type ChatListStatus } from '../../components/chat'
import {
  getEmployerConnections, getEmployerThreads, pinEmployerThread, searchEmployerMessages,
  type EmployerConnectionRow, type ThreadDto,
} from '../../lib/api/employerChat'
import { useChatSocketEvents } from '../../lib/chat/socket'
import { useChatSearch } from '../../lib/chat/search'
import { employerConnectionLine, fmtRowStamp } from '../../lib/chat/format'
import type { RootStackParamList } from '../../../App'

/**
 * EM-25 · Chats (Employer Android), drawn as the shared chat list
 * (docs/chat-redesign-mockups.html, A). The large title links to Connections;
 * the search finds a person by name and a message by its words (whole words,
 * two characters or more — the server's search). Rows: the face, the name, the
 * time, the last line (heavier while unread), the violet count, and how you are
 * connected. A read-only chat stays in the list, greyed. EM-25b is the empty
 * list. New messages move a row to the top live, over the socket. A long press
 * pins a chat (or unpins it): pinned chats sit above the rest, newest pin
 * first, marked with a pin; saved on the server, never shown to the candidate.
 */
export function EmployerChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const [now, setNow] = useState(() => Date.now())
  const [threads, setThreads] = useState<ThreadDto[] | null>(null)
  const [conns, setConns] = useState<Map<string, EmployerConnectionRow>>(() => new Map())
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [menu, setMenu] = useState<{ t: ThreadDto; anchor: MenuAnchor } | null>(null)
  const [pinFailed, setPinFailed] = useState(false)
  const search = useChatSearch(searchEmployerMessages)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [live, archived] = await Promise.all([
        getEmployerThreads({ archived: false, perPage: 50 }),
        getEmployerThreads({ archived: true, perPage: 50 }),
      ])
      setThreads([...live.rows, ...archived.rows])
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your conversations.')
    }
    // How each chat came to be — the row's context line. A failure only drops those lines.
    getEmployerConnections({ statuses: ['ACTIVE', 'CLOSED', 'BLOCKED'], perPage: 100 })
      .then((r) => setConns(new Map(r.rows.map((c) => [c.id, c]))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  // A message anywhere bumps its row, and its count while the thread is not open.
  const connected = useChatSocketEvents({
    onMessage: (p) =>
      setThreads((prev) => {
        if (!prev) return prev
        const i = prev.findIndex((t) => t.id === p.threadId)
        if (i === -1) {
          load()
          return prev
        }
        const t = prev[i]
        const next = {
          ...t,
          lastMessageAt: p.message.createdAt,
          lastMessagePreview: p.message.body ?? (p.message.attachment ? 'Attachment' : t.lastMessagePreview),
          unread: p.message.mine ? t.unread : t.unread + 1,
        }
        return [next, ...prev.filter((_, j) => j !== i)]
      }),
  })

  const sorted = useMemo(() => {
    const list = [...(threads ?? [])]
    list.sort((a, b) =>
      (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? '') ||
      Number(readOnlyOf(a)) - Number(readOnlyOf(b)) ||
      (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
    return list
  }, [threads])
  const shown = search.term ? sorted.filter((t) => nameOf(t).toLowerCase().includes(search.term)) : sorted
  const open = (id: string) => navigation.navigate('EmployerThread', { id })

  // Optimistic: the row moves at once; a failure puts it back and says so.
  async function togglePin(t: ThreadDto) {
    const pinnedAt = t.pinnedAt ? null : new Date().toISOString()
    const set = (value: string | null) => setThreads((prev) => prev?.map((r) => (r.id === t.id ? { ...r, pinnedAt: value } : r)) ?? prev)
    setPinFailed(false)
    set(pinnedAt)
    try {
      await pinEmployerThread(t.id, !!pinnedAt)
    } catch {
      set(t.pinnedAt)
      setPinFailed(true)
    }
  }

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const status: ChatListStatus = threads ? (threads.length ? 'ready' : 'empty') : error ? 'error' : 'loading'
  const rows = shown.map((t) => {
    const readOnly = readOnlyOf(t)
    const conn = t.connectionId ? conns.get(t.connectionId) : undefined
    return (
      <ChatRow
        key={t.id}
        plate={<ChatPlate thread={t} size={height['control-sm']} muted={readOnly} />}
        name={nameOf(t)}
        pinned={!!t.pinnedAt}
        time={t.lastMessageAt ? fmtRowStamp(t.lastMessageAt, now) : null}
        unread={t.unread}
        preview={readOnly
          ? `Read-only · ${t.archivedReason === 'BLOCKED' ? 'blocked' : t.archivedReason === 'WITHDRAWN' ? 'connection withdrawn' : 'archived'}`
          : t.lastMessagePreview || 'No messages yet'}
        context={t.kind === 'USER_ADMIN' ? 'Support' : conn ? employerConnectionLine(conn) : null}
        muted={readOnly}
        onPress={() => open(t.id)}
        onMenu={(anchor) => setMenu({ t, anchor })}
        menuLabel={t.pinnedAt ? 'Unpin chat' : 'Pin chat'}
      />
    )
  })

  return (
    <EmployerShell bar={false} scroll={false}>
      <ChatListFrame
        title="Chats"
        titleRight={<TextLink label="Connections" onPress={() => navigation.navigate('EmployerConnections')} />}
        connected={connected}
        status={status}
        errorView={(
          <View style={styles.pad}>
            <EmError title="Couldn’t load your chats." body={error ?? undefined} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
          </View>
        )}
        emptyView={(
          <View style={styles.pad}>
            <EmEmpty
              icon="chat"
              title="No conversations yet."
              body="A chat opens when a candidate accepts your Interest, or applies after you shortlisted them."
              action={<Button variant="primary" size="pair" label="Browse candidates" onPress={() => navigation.navigate('EmployerFeed')} />}
            />
          </View>
        )}
        query={search.query}
        onQuery={search.setQuery}
        hits={search.hits}
        nameOf={(id) => {
          const t = threads?.find((x) => x.id === id)
          return t ? nameOf(t) : 'Conversation'
        }}
        onOpenHit={open}
        notice={pinFailed ? 'That pin didn’t save. Try again.' : null}
        rows={rows}
        hint="Long-press a chat to pin it"
        refreshing={refreshing}
        onRefresh={refresh}
      />
      <PopoverMenu
        anchor={menu?.anchor ?? null}
        onClose={() => setMenu(null)}
        items={menu ? [{ key: 'pin', label: menu.t.pinnedAt ? 'Unpin chat' : 'Pin chat', icon: 'pushpin', onPress: () => { togglePin(menu.t) } }] : []}
      />
    </EmployerShell>
  )
}

const nameOf = (t: ThreadDto) => (t.kind === 'USER_ADMIN' ? 'Apostrophe Support' : t.counterparty.name || 'Candidate')
const readOnlyOf = (t: ThreadDto) => t.state.archived || !!t.archivedReason

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.lg, paddingTop: space.xl },
})
