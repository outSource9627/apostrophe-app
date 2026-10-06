import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { height, space } from '../../theme'
import { Button } from '../../components/ui'
import { InterviewerShell } from '../../components/interviewer/InterviewerShell'
import { EmEmpty, EmError } from '../../components/employer/em'
import { ChatListFrame, ChatPlate, ChatRow, type ChatListStatus } from '../../components/chat'
import { searchInterviewerMessages, type ThreadDto } from '../../lib/api/chat'
import { listInterviewerInterviews, listInterviewerThreads } from '../../lib/api/interviewer'
import { useChatSocketEvents } from '../../lib/chat/socket'
import { useChatSearch } from '../../lib/chat/search'
import { useChatConfig } from '../../lib/chat/config'
import { fmtClock, fmtDayMon, fmtHours, fmtRelDayInline, fmtRowStamp } from '../../lib/chat/format'
import type { RootStackParamList } from '../../../App'

/**
 * Messages — the interviewer's chats, drawn as the shared chat list
 * (docs/chat-redesign-mockups.html, A). The platform's chat contract
 * (`/interviewers/me/messages`): one thread per interview, opening before it
 * and turning read-only after it by the admin's `config.chat` windows (the
 * rule sits at the foot of the list, in those numbers). Rows: the candidate,
 * the time, the last line, the unread count and the interview's time; a thread
 * not yet open or already read-only says so. The search finds a candidate by
 * name and a message by its words. No pinning on this side, by the owner's
 * choice. New messages bump the list live over the socket.
 */
export function InterviewerChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const focused = useIsFocused()
  const cfg = useChatConfig()
  const [threads, setThreads] = useState<ThreadDto[] | null>(null)
  const [slots, setSlots] = useState<Map<string, string>>(() => new Map())
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const search = useChatSearch(searchInterviewerMessages)

  const load = useCallback(async () => {
    setError(null)
    try {
      setThreads((await listInterviewerThreads()).rows)
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your messages.')
    }
    // Each thread's interview time, for its context line. A failure only drops those lines.
    listInterviewerInterviews()
      .then((ivs) => setSlots(new Map(ivs.map((iv) => [iv.id, iv.slotStart]))))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (focused) load()
  }, [focused, load])
  const connected = useChatSocketEvents({ onMessage: () => { load() } })

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const opens = cfg.opensHoursBefore
  const closes = cfg.readOnlyHoursAfter
  const rule = opens != null && closes != null
    ? `A chat opens ${fmtHours(opens)} before each interview and turns read-only ${fmtHours(closes)} after it.`
    : 'A chat opens before each interview and turns read-only after it.'

  const all = threads ?? []
  const shown = search.term ? all.filter((t) => nameOf(t).toLowerCase().includes(search.term)) : all
  const status: ChatListStatus = threads ? (threads.length ? 'ready' : 'empty') : error ? 'error' : 'loading'

  const rows = shown.map((t) => {
    const support = t.kind === 'USER_ADMIN'
    const readOnly = t.state.readOnly || t.state.archived
    const notYet = !t.state.open && !readOnly
    const opensLine = notYet && t.opensAt ? `Opens ${fmtRowStamp(t.opensAt, now)}` : null
    const slot = t.interviewId ? slots.get(t.interviewId) : undefined
    const context = support
      ? 'Support'
      : slot
        ? readOnly ? `Interview ${fmtDayMon(slot)} · read-only` : `Interview ${fmtRelDayInline(slot, now)}, ${fmtClock(slot)}`
        : readOnly ? 'Read-only' : null
    return (
      <ChatRow
        key={t.id}
        plate={<ChatPlate thread={t} size={height['control-sm']} muted={readOnly && !support} />}
        name={nameOf(t)}
        time={t.lastMessageAt ? fmtRowStamp(t.lastMessageAt, now) : opensLine}
        unread={t.unread}
        preview={opensLine ?? (readOnly ? 'Read-only' : t.lastMessagePreview || 'No messages yet')}
        context={context}
        muted={readOnly && !support}
        onPress={() => navigation.navigate('InterviewerThread', { id: t.id })}
      />
    )
  })

  return (
    <InterviewerShell bar="none" scroll={false}>
      <ChatListFrame
        title="Messages"
        onBack={() => navigation.goBack()}
        connected={connected}
        status={status}
        errorView={<View style={styles.pad}><EmError title="Couldn’t load your messages." body={error ?? undefined} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { load() }} />} /></View>}
        emptyView={<View style={styles.pad}><EmEmpty icon="chat" title="No conversations yet." body={rule} /></View>}
        query={search.query}
        onQuery={search.setQuery}
        hits={search.hits}
        nameOf={(id) => {
          const t = all.find((x) => x.id === id)
          return t ? nameOf(t) : 'Conversation'
        }}
        onOpenHit={(id) => navigation.navigate('InterviewerThread', { id })}
        rows={rows}
        hint={rule}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </InterviewerShell>
  )
}

const nameOf = (t: ThreadDto) => (t.kind === 'USER_ADMIN' ? 'Apostrophe Support' : t.counterparty.name || 'Candidate')

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.lg, paddingTop: space.xl },
})
