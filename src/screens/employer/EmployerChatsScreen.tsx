import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmployerShell } from '../../components/employer'
import { EmEmpty, EmError, initialsOf } from '../../components/employer/em'
import { getEmployerThreads, searchEmployerMessages, type MessageSearchHit, type ThreadDto } from '../../lib/api/employerChat'
import { useChatSocketEvents } from '../../lib/chat/socket'
import { fmtClock, fmtDayMon, fmtRowStamp } from '../../lib/chat/format'
import type { RootStackParamList } from '../../../App'

const SEARCH_MIN = 2
const SEARCH_DEBOUNCE_MS = 300

/**
 * EM-25 · Chats (Employer Android). The bar counts what is unread and links to
 * Connections; the search finds a person by name and a message by its words
 * (whole words, two characters or more — the server's search). Rows: the face,
 * the name, the time, the last line (heavier while unread) and the violet
 * count. A read-only chat stays in the list, dimmed. EM-25b is the empty list.
 * New messages move a row to the top live, over the socket.
 */
export function EmployerChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const [now, setNow] = useState(() => Date.now())
  const [threads, setThreads] = useState<ThreadDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<MessageSearchHit[] | null>(null)

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
  }, [])

  useEffect(() => {
    if (focused) load()
  }, [focused, load])

  // A message anywhere bumps its row, and its count while the thread is not open.
  useChatSocketEvents({
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

  // Message search, debounced; the list itself filters by name as you type.
  useEffect(() => {
    const term = q.trim()
    if (term.length < SEARCH_MIN) {
      setHits(null)
      return
    }
    let alive = true
    const t = setTimeout(() => {
      searchEmployerMessages(term, { limit: 20 })
        .then((r) => alive && setHits(r.rows))
        .catch(() => alive && setHits([]))
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  const sorted = useMemo(() => {
    const list = [...(threads ?? [])]
    const readOnly = (t: ThreadDto) => t.state.archived || !!t.archivedReason
    list.sort((a, b) => Number(readOnly(a)) - Number(readOnly(b)) || (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
    const term = q.trim().toLowerCase()
    return term ? list.filter((t) => nameOf(t).toLowerCase().includes(term)) : list
  }, [threads, q])
  const byId = useMemo(() => new Map((threads ?? []).map((t) => [t.id, t])), [threads])
  const unread = (threads ?? []).reduce((n, t) => n + (t.unread || 0), 0)
  const open = (id: string) => navigation.navigate('EmployerThread', { id })

  let body: React.ReactNode
  if (threads === null && !error) {
    body = <ActivityIndicator color={color.textSubtle} style={styles.loading} />
  } else if (error && !threads) {
    body = (
      <View style={styles.pad}>
        <EmError title="Couldn’t load your chats." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} />
      </View>
    )
  } else if ((threads?.length ?? 0) === 0) {
    body = (
      <View style={[styles.pad, styles.center]}>
        <EmEmpty
          icon="chat"
          title="No conversations yet."
          body="A chat opens when a candidate accepts your Interest, or applies after you shortlisted them."
          action={<Button variant="primary" size="pair" label="Browse candidates" onPress={() => navigation.navigate('EmployerFeed')} />}
        />
      </View>
    )
  } else {
    body = (
      <FlatList
        data={sorted}
        keyExtractor={(t) => t.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={color.textSubtle}
            onRefresh={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.search}>
              <Icon name="search" size={spaceHalf['4.5']} tint={color.textSubtle} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search people and messages"
                placeholderTextColor={color.textSubtle}
                autoCorrect={false}
                returnKeyType="search"
                style={[text.uiBase, styles.searchInput]}
              />
              {!!q && (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={space.sm}>
                  <Icon name="x" size={space.lg} tint={color.textMuted} />
                </Pressable>
              )}
            </View>
            {hits && hits.length > 0 && (
              <View style={styles.hits}>
                <Text style={[text.metaSm, styles.subtle, styles.mono]}>MESSAGES</Text>
                {hits.map((h) => (
                  <Pressable key={h.id} accessibilityRole="button" onPress={() => open(h.threadId)} style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
                    <Text style={text.uiSmSemi} numberOfLines={1}>{byId.get(h.threadId) ? nameOf(byId.get(h.threadId)!) : 'Conversation'}</Text>
                    <Text style={[text.uiSm, styles.muted]} numberOfLines={2}>{`${h.mine ? 'You: ' : ''}${h.body ?? ''}`}</Text>
                    <Text style={[text.metaXs, styles.subtle]}>{`${fmtDayMon(h.createdAt)} · ${fmtClock(h.createdAt)}`.toUpperCase()}</Text>
                  </Pressable>
                ))}
                {sorted.length > 0 && <Text style={[text.metaSm, styles.subtle, styles.mono]}>CONVERSATIONS</Text>}
              </View>
            )}
          </>
        }
        ListEmptyComponent={<Text style={[text.uiMd, styles.muted, styles.none]}>{hits?.length ? '' : 'No one by that name.'}</Text>}
        renderItem={({ item }) => <ThreadRow t={item} now={now} onPress={() => open(item.id)} />}
      />
    )
  }

  return (
    <EmployerShell
      title="Chats"
      sub={threads ? (unread ? `${unread} UNREAD` : `${threads.length} ${threads.length === 1 ? 'CONVERSATION' : 'CONVERSATIONS'}`) : undefined}
      scroll={false}
      right={<Button variant="text" size="sm" label="Connections" onPress={() => navigation.navigate('EmployerConnections')} />}
    >
      {body}
    </EmployerShell>
  )
}

const nameOf = (t: ThreadDto) => (t.kind === 'USER_ADMIN' ? 'Apostrophe Support' : t.counterparty.name || 'Candidate')

function ThreadRow({ t, now, onPress }: { t: ThreadDto; now: number; onPress: () => void }) {
  const support = t.kind === 'USER_ADMIN'
  const readOnly = t.state.archived || !!t.archivedReason
  const name = nameOf(t)
  const unread = t.unread > 0
  const preview = readOnly
    ? `Read-only · ${t.archivedReason === 'BLOCKED' ? 'blocked' : t.archivedReason === 'WITHDRAWN' ? 'connection withdrawn' : 'archived'}`
    : t.lastMessagePreview || 'No messages yet'
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name}${unread ? `, ${t.unread} unread` : ''}`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.face, support ? styles.faceSupport : readOnly ? styles.faceMuted : styles.facePerson]}>
        {t.counterparty.photoUrl && !support ? <Image source={{ uri: t.counterparty.photoUrl }} style={styles.faceImg} /> : (
          <Text style={[text.uiBaseSemi, { color: readOnly && !support ? color.textMuted : color.textInverse }]}>{support ? '’' : initialsOf(name)}</Text>
        )}
      </View>
      <View style={styles.grow}>
        <View style={styles.line}>
          <Text style={[text.uiBaseSemi, styles.grow, readOnly && styles.subtle]} numberOfLines={1}>{name}</Text>
          {!!t.lastMessageAt && <Text style={[text.metaSm, styles.subtle]}>{fmtRowStamp(t.lastMessageAt, now).toUpperCase()}</Text>}
        </View>
        <View style={styles.line}>
          <Text style={[unread ? text.uiSmMedium : text.uiSm, styles.grow, { color: unread ? color.text : color.textMuted }]} numberOfLines={1}>{preview}</Text>
          {unread && <View style={styles.count}><Text style={[text.uiXsSemi, styles.countText]}>{t.unread}</Text></View>}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] + 1 },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  mono: { letterSpacing: trackingNative.eyebrow },
  pad: { flex: 1, paddingHorizontal: space.lg },
  center: { justifyContent: 'center' },
  loading: { paddingVertical: space['3xl'] },
  none: { paddingVertical: space.xl, textAlign: 'center' },
  list: { paddingHorizontal: space.sm, paddingBottom: space.lg },
  search: { marginHorizontal: space.sm, marginBottom: space.sm, height: height.tap, borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: color.borderStrong, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingHorizontal: spaceHalf['3.5'] },
  searchInput: { flex: 1, paddingVertical: 0, color: color.text },
  hits: { paddingHorizontal: space.sm, gap: space.sm, paddingBottom: space.sm },
  hit: { gap: space['2xs'] + 1, paddingVertical: spaceHalf['2.5'], borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: borderWidth.thin, borderBottomColor: color.borderSoft },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  face: { width: height.control, height: height.control, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  facePerson: { backgroundColor: color.accentBright },
  faceSupport: { backgroundColor: color.accent },
  faceMuted: { backgroundColor: color.border },
  faceImg: { width: '100%', height: '100%' },
  count: { minWidth: spaceHalf['4.5'], height: spaceHalf['4.5'], paddingHorizontal: space.xs + 1, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  countText: { color: color.textInverse },
})
