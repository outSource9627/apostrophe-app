import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon } from '../../components/ui/Icon'
import { EmError, EmIconButton, initialsOf } from '../../components/employer/em'
import { ApiClientError } from '../../lib/api'
import type { MessageDto, ThreadDto } from '../../lib/api/chat'
import { getInterviewerThread, markInterviewerThreadRead, sendInterviewerMessage } from '../../lib/api/interviewer'
import { ChatSendError, useThreadSocket, type ThreadRest } from '../../lib/chat/socket'
import { fmtClock, fmtDayDivider, fmtRowStamp, newClientMessageId, refusalCopy } from '../../lib/chat/format'
import type { RootStackParamList } from '../../../App'

const REST: ThreadRest = { send: sendInterviewerMessage, markRead: markInterviewerThreadRead }
const TYPING_IDLE_MS = 3000

/**
 * A conversation with a candidate (no artboard — the employer thread's shape
 * on the interviewer's endpoints). Bubbles with receipts, "… is typing", and a
 * text composer (the interviewer API takes no attachments); before the chat
 * opens, or once it is read-only, a lock line replaces the composer with the
 * server's own reason.
 */
export function InterviewerThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewerThread'>>()
  const { id } = route.params
  const insets = useSafeAreaInsets()
  const [now] = useState(() => Date.now())
  const [thread, setThread] = useState<ThreadDto | null>(null)
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [peerTyping, setPeerTyping] = useState(false)
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const down = useCallback(() => requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false })), [])

  const load = useCallback(() => {
    setError(null)
    getInterviewerThread(id)
      .then((page) => {
        setThread(page.thread)
        setMessages([...page.rows].reverse())
        down()
        markInterviewerThreadRead(id).catch(() => {})
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'This conversation is not available.'))
  }, [id, down])
  useEffect(() => {
    load()
  }, [load])

  const upsert = useCallback((m: MessageDto) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id)
      if (i === -1) return [...prev, m]
      const next = [...prev]
      next[i] = m
      return next
    })
    down()
  }, [down])

  const socket = useThreadSocket(thread ? id : null, {
    onMessage: (m) => {
      upsert(m)
      if (!m.mine) {
        setPeerTyping(false)
        socket.markRead()
      }
    },
    onRead: (r) => setMessages((prev) => prev.map((m) => (m.mine && !m.readAt ? { ...m, readAt: r.at } : m))),
    onTyping: (t) => setPeerTyping(t.typing),
  }, REST)

  async function send() {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setSendError(null)
    try {
      const r = await socket.send({ body, clientMessageId: newClientMessageId() })
      setDraft('')
      socket.setTyping(false)
      upsert(r.message)
    } catch (e) {
      setSendError(e instanceof ChatSendError || e instanceof ApiClientError || e instanceof Error ? e.message : 'Not sent. Try again.')
      if (e instanceof ChatSendError && e.reason) load()
    } finally {
      setBusy(false)
    }
  }

  const groups = useMemo(() => {
    const out: { day: string; rows: MessageDto[] }[] = []
    for (const m of messages) {
      const day = fmtDayDivider(m.createdAt, now)
      const last = out[out.length - 1]
      if (last && last.day === day) last.rows.push(m)
      else out.push({ day, rows: [m] })
    }
    return out
  }, [messages, now])

  const name = thread ? (thread.kind === 'USER_ADMIN' ? 'Apostrophe Support' : thread.counterparty.name || 'Candidate') : 'Conversation'
  const canSend = !!thread && thread.state.open && !thread.state.readOnly && !thread.state.archived
  const lock = !thread ? '' : !thread.state.open && thread.opensAt && !thread.state.readOnly
    ? `This chat opens ${fmtRowStamp(thread.opensAt, now)}.`
    : refusalCopy(thread.state.refusal)

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <EmIconButton name="arrowL" label="Back" iconSize={height.glyph - 2} onPress={() => navigation.goBack()} />
        <View style={styles.face}><Text style={[text.uiSmSemi, styles.onInk]}>{thread?.kind === 'USER_ADMIN' ? '’' : initialsOf(name)}</Text></View>
        <View style={styles.grow}>
          <Text style={text.uiLeadSemi} numberOfLines={1}>{name}</Text>
          <Text style={[text.metaXs, styles.muted, styles.mono]}>{canSend ? 'OPEN' : thread?.state.readOnly || thread?.state.archived ? 'READ-ONLY' : 'NOT OPEN YET'}</Text>
        </View>
      </View>
      {!thread ? (
        error ? <View style={styles.pad}><EmError title="This conversation didn’t load." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={load} />} /></View> : <ActivityIndicator color={color.textSubtle} style={styles.loading} />
      ) : (
        <>
          <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={[styles.transcript, !canSend && styles.dim]} onContentSizeChange={down}>
            {groups.map((g) => (
              <View key={g.day} style={styles.group}>
                <Text style={[text.metaSm, styles.day]}>{g.day.toUpperCase()}</Text>
                {g.rows.map((m) =>
                  m.kind === 'SYSTEM' ? (
                    <Text key={m.id} style={[text.metaSm, styles.system]}>{(m.body || 'Chat event').toUpperCase()}</Text>
                  ) : (
                    <View key={m.id} style={[styles.msg, m.mine ? styles.mine : styles.peer]}>
                      {!!m.body && (
                        <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubblePeer]}>
                          <Text style={[text.uiMd, { color: m.mine ? color.textInverse : color.text }]}>{m.body}</Text>
                        </View>
                      )}
                      <Text style={[text.metaXs, m.mine && m.readAt ? styles.accent : styles.subtle]}>
                        {[fmtClock(m.createdAt), m.mine ? (m.readAt ? 'Read' : m.deliveredAt ? 'Delivered' : 'Sent') : null].filter(Boolean).join(' · ').toUpperCase()}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            ))}
            {peerTyping && canSend && <View style={styles.typing}><Text style={[text.uiXs, styles.muted]}>{`${name.split(' ')[0]} is typing…`}</Text></View>}
          </ScrollView>
          {canSend ? (
            <View style={[styles.composer, { paddingBottom: space.sm + insets.bottom }]}>
              {!!sendError && <Text style={[text.uiXs, styles.danger]}>{sendError}</Text>}
              <View style={styles.composeRow}>
                <TextInput
                  value={draft}
                  onChangeText={(v) => {
                    setDraft(v)
                    socket.setTyping(true)
                    if (typingTimer.current) clearTimeout(typingTimer.current)
                    typingTimer.current = setTimeout(() => socket.setTyping(false), TYPING_IDLE_MS)
                  }}
                  placeholder="Message"
                  placeholderTextColor={color.textSubtle}
                  multiline
                  style={[text.uiBase, styles.input]}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!draft.trim() || busy} onPress={() => { send() }} style={({ pressed }) => [styles.send, draft.trim() ? styles.sendOn : styles.sendOff, pressed && styles.pressed]}>
                  {busy ? <ActivityIndicator color={color.textInverse} /> : <Icon name="send" size={spaceHalf['4.5']} tint={draft.trim() ? color.textInverse : color.textSubtle} weight={2} />}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.lock, { paddingBottom: space.lg + insets.bottom }]}>
              <Icon name="lock" size={space.lg - 1} tint={color.textMuted} weight={2} />
              <Text style={[text.uiSm, styles.muted, styles.flex]}>{lock}</Text>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surfaceMuted },
  flex: { flex: 1 },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pad: { flex: 1, padding: space.lg },
  loading: { paddingVertical: space['3xl'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  accent: { color: color.accent },
  danger: { color: color.danger },
  onInk: { color: color.textInverse },
  mono: { letterSpacing: trackingNative.eyebrow },
  dim: { opacity: opacity.disabled + 0.25 },
  header: { height: height['chat-head'] - space.xs, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], paddingLeft: space.xs, paddingRight: space.md, backgroundColor: color.surface, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  face: { width: height['chip-lg'], height: height['chip-lg'], borderRadius: radius.pill, backgroundColor: color.accentBright, alignItems: 'center', justifyContent: 'center' },
  transcript: { padding: spaceHalf['3.5'], gap: spaceHalf['2.5'], flexGrow: 1, justifyContent: 'flex-end' },
  group: { gap: spaceHalf['2.5'] },
  day: { alignSelf: 'center', color: color.textSubtle, letterSpacing: trackingNative.eyebrow, paddingVertical: space.xs },
  system: { alignSelf: 'center', textAlign: 'center', color: color.textMuted, letterSpacing: trackingNative.eyebrow, paddingHorizontal: space.lg },
  msg: { gap: space['2xs'] + 1, maxWidth: height['bubble-max'] - space.sm },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  peer: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingVertical: spaceHalf['2.5'], paddingHorizontal: spaceHalf['3.5'] },
  bubbleMine: { backgroundColor: color.accent, borderTopLeftRadius: spaceHalf['4.5'], borderTopRightRadius: spaceHalf['4.5'], borderBottomLeftRadius: spaceHalf['4.5'], borderBottomRightRadius: space.xs },
  bubblePeer: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderTopLeftRadius: spaceHalf['4.5'], borderTopRightRadius: spaceHalf['4.5'], borderBottomRightRadius: spaceHalf['4.5'], borderBottomLeftRadius: space.xs },
  typing: { alignSelf: 'flex-start', paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  composer: { paddingTop: space.sm, paddingHorizontal: spaceHalf['2.5'], gap: space.xs, backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spaceHalf['1.5'] },
  input: { flex: 1, minHeight: height.tap, maxHeight: height.tap * 3, borderRadius: spaceHalf['4.5'] + space['2xs'], borderWidth: borderWidth.thin, borderColor: color.borderStrong, paddingHorizontal: space.lg, paddingTop: spaceHalf['2.5'] + 1, paddingBottom: spaceHalf['2.5'] + 1, color: color.text },
  send: { width: height.tap, height: height.tap, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: color.accent },
  sendOff: { backgroundColor: color.surfaceMuted },
  lock: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingHorizontal: space.lg, backgroundColor: color.surfaceMuted, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
})
