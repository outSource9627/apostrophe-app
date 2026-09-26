import React, { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import {
  actOnConnection, getConnections, getThread, markThreadRead, reportThread,
  type ConnectionRow, type MessageDto, type ReportReason, type ThreadDto,
} from '../../lib/api/chat'
import { ApiClientError } from '../../lib/api'
import { ChatSendError, useThreadSocket } from '../../lib/chat/socket'
import { fmtClock, fmtDayDivider, fmtDayMon, fmtStampZone, newClientMessageId, originLabel, refusalCopy } from '../../lib/chat/format'
import { color, space, borderWidth, height } from '../../theme'
import { Body, EmptyState, Meta, text, Skeleton } from '../../components/ui'
import {
  BlockSheet, Bubble, ClosesLine, Composer, CounterpartyPlate, DayDivider,
  MaskInfoLine, MenuSheet, ReadOnlyFoot, ReconnectingStrip, RecordingPill, ReportSheet, SystemLine, TypingDots,
} from './parts'

const OPENS_HOURS_BEFORE = 24
const SYSTEM_TEXT: Record<string, string> = {
  THREAD_OPENED: 'This chat opened for your interview',
  THREAD_WITHDRAWN: 'This conversation has been archived.',
  THREAD_BLOCKED: 'This conversation has been archived.',
  THREAD_EXPIRED: 'This chat is now read-only.',
  IDENTITY_REVEALED: 'Your session started',
}

/**
 * The thread — ST-44 (employer, live), ST-44-closed (withdrawn), ST-45
 * (interviewer, masked) and ST-45-revealed (name shown, recording), one screen
 * driven by `thread.state` + kind + `counterparty.masked`. Sending is the only
 * thing state gates; the transcript reads in every state. The composer is REMOVED
 * (never a dead send arrow) when read-only or archived. Report and Block live in
 * the header menu. A phone number in a message is drawn plainly (CH-12).
 */
export function ThreadScreen({ id, onBack, onSupport }: { id: string; onBack: () => void; onSupport: () => void }) {
  const insets = useSafeAreaInsets()
  const [now] = useState(() => Date.now())
  const [thread, setThread] = useState<ThreadDto | null>(null)
  const [conn, setConn] = useState<ConnectionRow | null>(null)
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [peerTyping, setPeerTyping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollDown = useCallback(() => { requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false })) }, [])

  const load = useCallback(() => {
    void getThread(id, { limit: 50 })
      .then((page) => {
        setThread(page.thread)
        setMessages([...page.rows].reverse())
        scrollDown()
        if (page.thread.kind === 'STUDENT_EMPLOYER' && page.thread.connectionId) {
          void Promise.all([getConnections('ACTIVE'), getConnections('CLOSED'), getConnections('BLOCKED')])
            .then(([a, c, b]) => setConn([...a.rows, ...c.rows, ...b.rows].find((r) => r.id === page.thread.connectionId) ?? null))
            .catch(() => {})
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'This conversation is not available.'))
  }, [id, scrollDown])
  useEffect(load, [load])

  const upsert = useCallback((m: MessageDto) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id)
      if (i === -1) return [...prev, m]
      const next = [...prev]; next[i] = m; return next
    })
    scrollDown()
  }, [scrollDown])

  const sock = useThreadSocket(id, {
    onMessage: (m) => { upsert(m); sock.markRead() },
    onRead: () => setMessages((prev) => prev.map((m) => (m.mine && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m))),
    onTyping: (t) => {
      setPeerTyping(t.typing)
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current)
      if (t.typing) peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 4000)
    },
  })

  useEffect(() => { if (thread) { sock.markRead(); void markThreadRead(id).catch(() => {}) } }, [thread, id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    const body = text.trim()
    if (!body || busy) return
    const clientMessageId = newClientMessageId()
    const optimistic: MessageDto = { id: clientMessageId, mine: true, kind: 'TEXT', systemKind: null, body, attachment: null, deliveredAt: null, readAt: null, createdAt: new Date().toISOString() }
    setMessages((prev) => [...prev, optimistic]); setText(''); setSendError(null); scrollDown()
    sock.setTyping(false); setBusy(true)
    try {
      const { message } = await sock.send({ body, clientMessageId })
      setMessages((prev) => prev.map((m) => (m.id === clientMessageId ? message : m)))
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== clientMessageId)); setText(body)
      const reason = e instanceof ChatSendError ? e.reason : e instanceof ApiClientError && typeof e.meta?.reason === 'string' ? e.meta.reason : undefined
      setSendError(reason ? refusalCopy(reason as never) : e instanceof Error ? e.message : 'That did not send.')
    } finally { setBusy(false) }
  }

  function onType(v: string) {
    setText(v); sock.setTyping(true)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => sock.setTyping(false), 2500)
  }

  async function submitReport(reason: ReportReason, note: string) {
    try { await reportThread(id, reason, note || undefined) } catch { /* already reported is fine */ }
    setReportOpen(false)
  }
  async function confirmBlock() {
    if (!thread?.connectionId) return
    setBusy(true)
    try { await actOnConnection(thread.connectionId, 'BLOCK') } catch { /* refetch reflects truth */ } finally { setBusy(false); setBlockOpen(false); load() }
  }

  if (error) return <View style={[styles.page, { paddingTop: insets.top }]}><Header onBack={onBack} /><View style={styles.centre}><Body tone="muted">{error}</Body></View></View>
  if (!thread) return <View style={[styles.page, { paddingTop: insets.top }]}><Header onBack={onBack} /><View style={styles.loading}><Skeleton lines={3} /></View></View>

  const isInterviewer = thread.kind === 'STUDENT_INTERVIEWER'
  const isEmployer = thread.kind === 'STUDENT_EMPLOYER'
  const masked = isInterviewer && thread.counterparty.masked
  const open = thread.state.open
  const recording = Boolean(isInterviewer && !thread.counterparty.masked && open)
  const slotStartIso = thread.opensAt ? new Date(+new Date(thread.opensAt) + OPENS_HOURS_BEFORE * 3_600_000).toISOString() : null
  const notYetOpen = thread.state.refusal === 'THREAD_NOT_OPEN'

  const subtitle = (() => {
    if (thread.kind === 'USER_ADMIN') return 'Support'
    if (isInterviewer) {
      if (thread.state.readOnly && !open) return slotStartIso ? `Interview ${fmtDayMon(slotStartIso)} · read-only` : 'Read-only'
      if (recording) return 'Your interviewer'
      if (slotStartIso) {
        const diff = Math.round((+new Date(slotStartIso) - now) / 86_400_000)
        const rel = diff <= 0 ? 'Today' : diff === 1 ? 'Tomorrow' : fmtDayMon(slotStartIso)
        return `${rel}, ${fmtClock(slotStartIso)}`
      }
      return 'Your interview'
    }
    if (thread.state.archived && conn) return `${conn.status === 'BLOCKED' ? 'Blocked' : 'Withdrawn'}${conn.closedAt ? ` ${fmtDayMon(conn.closedAt)}` : ''}`
    if (conn) return `${originLabel(conn.origin)} · since ${fmtDayMon(conn.openedAt)}`
    return 'Connected'
  })()

  const groups = groupByDay(messages, now)
  const closesText = isInterviewer && thread.readOnlyAt && (open || recording)
    ? `Closes ${fmtStampZone(thread.readOnlyAt)} · 48 hours after your interview` : null

  const foot = open ? (
    <Composer value={text} busy={busy} error={sendError} onChange={onType} onSend={submit} />
  ) : notYetOpen ? (
    <ReadOnlyFoot title={refusalCopy('THREAD_NOT_OPEN')}
      body={thread.opensAt ? `It opens ${fmtStampZone(thread.opensAt)} — a day before your interview. There is no composer because there is no thread yet, and no name because none has been sent.` : 'This chat opens closer to your interview.'} />
  ) : isInterviewer ? (
    <ReadOnlyFoot title="Interviewer chats stay open for 48 hours after the session."
      body="Everything above stays and remains searchable. Your written feedback and your film arrive on your profile, not here." />
  ) : thread.state.archived ? (
    <ReadOnlyFoot title={thread.archivedReason === 'BLOCKED' ? 'This connection was blocked.' : `This connection was withdrawn${conn?.closedAt ? ` on ${fmtDayMon(conn.closedAt)}` : ''}.`}
      body={thread.archivedReason === 'BLOCKED' ? 'Neither side can write here again. Everything above stays, and the row stays in your Connections.' : 'Neither side can write here again. Everything above stays, and the row stays in your Connections. Blocking is still open to you from the menu.'} />
  ) : (
    <ReadOnlyFoot title={refusalCopy(thread.state.refusal)} body="Everything above stays and remains searchable." />
  )

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top}>
      <Header onBack={onBack} plate={<CounterpartyPlate thread={thread} size={36} />} title={thread.counterparty.name} subtitle={subtitle}
        right={recording ? <RecordingPill /> : <Pressable accessibilityLabel="More" hitSlop={8} onPress={() => setMenuOpen(true)} style={styles.headerBtn}><Dots /></Pressable>} />
      {!sock.connected && open && <ReconnectingStrip />}
      {masked && open && <MaskInfoLine />}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.transcript} onContentSizeChange={scrollDown}>
        {groups.length === 0 && !peerTyping ? (
          <EmptyState title="No messages yet" body="Nothing has been sent in this conversation yet." />
        ) : (
          <>
            {groups.map((g) => (
              <View key={g.key} style={{ gap: space.md }}>
                <DayDivider label={g.label} />
                {g.items.map((m) => (m.kind === 'SYSTEM'
                  ? m.systemKind === 'IDENTITY_REVEALED'
                    ? <SystemLine key={m.id} media={<CounterpartyPlate thread={thread} size={44} />} text={`Your session started · your interviewer is ${thread.counterparty.name}`} time={fmtClock(m.createdAt)} />
                    : <SystemLine key={m.id} text={SYSTEM_TEXT[m.systemKind ?? ''] ?? 'Update'} time={fmtClock(m.createdAt)} />
                  : <Bubble key={m.id} msg={m} now={now} />))}
              </View>
            ))}
            {peerTyping && <View style={{ paddingTop: space.xs }}><TypingDots /></View>}
          </>
        )}
      </ScrollView>

      {!!closesText && <ClosesLine text={closesText} />}
      <View style={{ paddingBottom: open ? insets.bottom : insets.bottom }}>{foot}</View>

      <MenuSheet open={menuOpen} name={thread.counterparty.name}
        canBlock={Boolean(isEmployer && thread.connectionId && thread.archivedReason !== 'BLOCKED')} isInterviewer={isInterviewer}
        onClose={() => setMenuOpen(false)}
        onReport={() => { setMenuOpen(false); setReportOpen(true) }}
        onBlock={() => { setMenuOpen(false); setBlockOpen(true) }}
        onSupport={() => { setMenuOpen(false); onSupport() }} />
      <ReportSheet open={reportOpen} name={thread.counterparty.name} onClose={() => setReportOpen(false)} onSubmit={submitReport} />
      <BlockSheet open={blockOpen} name={thread.counterparty.name} busy={busy} onConfirm={confirmBlock} onClose={() => setBlockOpen(false)} />
    </KeyboardAvoidingView>
  )
}

function groupByDay(messages: MessageDto[], now: number) {
  const out: { key: string; label: string; items: MessageDto[] }[] = []
  for (const m of messages) {
    const label = fmtDayDivider(m.createdAt, now)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(m)
    else out.push({ key: `${label}-${m.id}`, label, items: [m] })
  }
  return out
}

function Dots() {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth={1.5}><Circle cx={12} cy={5} r={1} /><Circle cx={12} cy={12} r={1} /><Circle cx={12} cy={19} r={1} /></Svg>
}

function Header({ onBack, plate, title, subtitle, right }: {
  onBack: () => void; plate?: React.ReactNode; title?: string; subtitle?: string; right?: React.ReactNode
}) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={styles.headerBtn}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="m15 18-6-6 6-6" /></Svg>
      </Pressable>
      {plate}
      {!!title && (
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={text.uiLgSemi} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Meta style={{ color: color.textSubtle }} numberOfLines={1}>{subtitle}</Meta>}
        </View>
      )}
      {!title && <View style={{ flex: 1 }} />}
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, backgroundColor: color.surface, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border, height: height['chat-head'] - space.sm },
  headerBtn: { width: height.tap, height: height.tap, alignItems: 'center', justifyContent: 'center' },
  transcript: { padding: space.xl, gap: space.md, flexGrow: 1, justifyContent: 'flex-end' },
})
