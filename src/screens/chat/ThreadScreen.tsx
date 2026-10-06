import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  actOnConnection, getConnections, getThread, markThreadRead, reportThread, sendMessage,
  type ConnectionRow, type MessageDto, type ReportReason,
} from '../../lib/api/chat'
import { getInterview } from '../../lib/api/interviews'
import { useChatThread, type ChatThreadSource } from '../../lib/chat/useChatThread'
import { useChatConfig } from '../../lib/chat/config'
import {
  firstWord, fmtClock, fmtDayMon, fmtHours, fmtRelDay, fmtRelDayInline, fmtStampZone, originLabel, refusalCopy,
} from '../../lib/chat/format'
import { color, height, space } from '../../theme'
import { Body, Skeleton } from '../../components/ui'
import {
  ChatHeader, ChatPlate, ClosesLine, Composer, MaskInfo, ReadOnlyFoot, ReconnectingStrip, RecordingPill, RoundButton,
  SystemLine, Transcript,
} from '../../components/chat'
import { BlockSheet, MenuSheet, ReportSheet } from './parts'

const SOURCE: ChatThreadSource = { getPage: getThread, rest: { send: sendMessage, markRead: markThreadRead } }

/**
 * The thread — ST-44 (employer, live), ST-44-closed (withdrawn), ST-45
 * (interviewer, masked) and ST-45-revealed (name shown, recording), one screen
 * driven by `thread.state` + kind + `counterparty.masked`, drawn with the
 * shared chat pieces (docs/chat-redesign-mockups.html, A). Sending is the only
 * thing state gates; the transcript reads in every state, and scrolling up
 * reads further back. The composer is REMOVED (never a dead send arrow) when
 * read-only or archived. Report and Block live in the header menu, which stays
 * reachable while the session records. A phone number in a message is drawn
 * plainly (CH-12). The open / read-only hours are the admin's (`/config`); the
 * slot time is the interview's own.
 */
export function ThreadScreen({ id, onBack, onSupport }: { id: string; onBack: () => void; onSupport: () => void }) {
  const insets = useSafeAreaInsets()
  const [now] = useState(() => Date.now())
  const chat = useChatThread(id, SOURCE)
  const cfg = useChatConfig()
  const [conn, setConn] = useState<ConnectionRow | null>(null)
  const [slotStart, setSlotStart] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const thread = chat.thread

  // The employer line and the archived reasons live on the Connection (re-read after every reload, so a block shows).
  useEffect(() => {
    if (thread?.kind !== 'STUDENT_EMPLOYER' || !thread.connectionId) return
    let alive = true
    const want = thread.connectionId
    Promise.all([getConnections('ACTIVE'), getConnections('CLOSED'), getConnections('BLOCKED')])
      .then(([a, c, b]) => alive && setConn([...a.rows, ...c.rows, ...b.rows].find((r) => r.id === want) ?? null))
      .catch(() => {})
    return () => { alive = false }
  }, [thread])

  const interviewId = thread?.kind === 'STUDENT_INTERVIEWER' ? thread.interviewId : null
  useEffect(() => {
    if (!interviewId) return
    let alive = true
    getInterview(interviewId).then((iv) => alive && setSlotStart(iv.slotStart)).catch(() => {})
    return () => { alive = false }
  }, [interviewId])

  async function submitReport(reason: ReportReason, note: string) {
    try { await reportThread(id, reason, note || undefined) } catch { /* already reported is fine */ }
    setReportOpen(false)
  }
  async function confirmBlock() {
    if (!thread?.connectionId) return
    setBlockBusy(true)
    try { await actOnConnection(thread.connectionId, 'BLOCK') } catch { /* the reload reflects the truth */ } finally {
      setBlockBusy(false); setBlockOpen(false); chat.load()
    }
  }

  const frame = (body: React.ReactNode) => (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ChatHeader onBack={onBack} title="Conversation" />
      {body}
    </View>
  )
  if (!thread && chat.error) return frame(<View style={styles.centre}><Body tone="muted">{chat.error}</Body></View>)
  if (!thread) return frame(<View style={styles.loading}><Skeleton lines={3} /></View>)

  const isInterviewer = thread.kind === 'STUDENT_INTERVIEWER'
  const isEmployer = thread.kind === 'STUDENT_EMPLOYER'
  const masked = isInterviewer && thread.counterparty.masked
  const open = thread.state.open
  const recording = Boolean(isInterviewer && !thread.counterparty.masked && open)
  const notYetOpen = thread.state.refusal === 'THREAD_NOT_OPEN'
  const name = thread.counterparty.name

  const subtitle = (() => {
    if (thread.kind === 'USER_ADMIN') return 'Support'
    if (isInterviewer) {
      if (notYetOpen && thread.opensAt) return `Opens ${fmtDayMon(thread.opensAt)}${slotStart ? ` · Interview ${fmtRelDayInline(slotStart, now)} ${fmtClock(slotStart)}` : ''}`
      if (thread.state.readOnly && !open) return slotStart ? `Interview ${fmtDayMon(slotStart)} · read-only` : 'Read-only'
      if (recording) return 'Your interviewer'
      if (slotStart) return `${fmtRelDay(slotStart, now)}, ${fmtClock(slotStart)}`
      return 'Your interview'
    }
    if (thread.state.archived && conn) return `${conn.status === 'BLOCKED' ? 'Blocked' : 'Withdrawn'}${conn.closedAt ? ` ${fmtDayMon(conn.closedAt)}` : ''}`
    if (conn) return `${originLabel(conn.origin)} · since ${fmtDayMon(conn.openedAt)}`
    return 'Connected'
  })()

  const closesText = isInterviewer && thread.readOnlyAt && open
    ? `Closes ${fmtStampZone(thread.readOnlyAt)}${cfg.readOnlyHoursAfter != null ? ` · ${fmtHours(cfg.readOnlyHoursAfter)} after your interview` : ''}`
    : null
  const before = cfg.opensHoursBefore != null ? ` — ${fmtHours(cfg.opensHoursBefore)} before your interview` : ''

  // No bottom inset under the foot: the floating tab bar sits right under it and already clears the home indicator.
  const foot = open ? (
    <Composer
      value={chat.draft}
      onChange={chat.onDraft}
      onSend={chat.sendText}
      busy={chat.busy}
      placeholder={masked ? 'Message your interviewer' : thread.kind === 'USER_ADMIN' ? 'Message support' : `Message ${firstWord(name)}`}
      error={chat.sendError}
      uploading={chat.uploading}
      attach={{
        onPick: (kind) => { chat.attach(kind, kind === 'image' ? cfg.imageMaxBytes : cfg.documentMaxBytes) },
        imageMaxBytes: cfg.imageMaxBytes, documentMaxBytes: cfg.documentMaxBytes,
      }}
    />
  ) : notYetOpen ? (
    <ReadOnlyFoot title={refusalCopy('THREAD_NOT_OPEN')}
      body={thread.opensAt ? `It opens ${fmtStampZone(thread.opensAt)}${before}. There is no composer because there is no thread yet, and no name because none has been sent.` : 'This chat opens closer to your interview.'} />
  ) : isInterviewer ? (
    <ReadOnlyFoot
      title={cfg.readOnlyHoursAfter != null ? `Interviewer chats stay open for ${fmtHours(cfg.readOnlyHoursAfter)} after the session.` : refusalCopy('THREAD_READ_ONLY')}
      body="Everything above stays and remains searchable. Your written feedback and your film arrive on your profile, not here." />
  ) : thread.state.archived ? (
    <ReadOnlyFoot title={thread.archivedReason === 'BLOCKED' ? 'This connection was blocked.' : `This connection was withdrawn${conn?.closedAt ? ` on ${fmtDayMon(conn.closedAt)}` : ''}.`}
      body={thread.archivedReason === 'BLOCKED' ? 'Neither side can write here again. Everything above stays, and the row stays in your Connections.' : 'Neither side can write here again. Everything above stays, and the row stays in your Connections. Blocking is still open to you from the menu.'} />
  ) : (
    <ReadOnlyFoot title={refusalCopy(thread.state.refusal)} body="Everything above stays and remains searchable." />
  )

  // The reveal names the interviewer beside their plate; every other system line is the shared pill.
  const renderSystem = (m: MessageDto) => (m.systemKind === 'IDENTITY_REVEALED' && isInterviewer && !masked
    ? <SystemLine media={<ChatPlate thread={thread} size={height['chip-sm']} />} label={`Your session started · your interviewer is ${name}`} time={fmtClock(m.createdAt)} />
    : null)

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top}>
      <ChatHeader
        onBack={onBack}
        plate={<ChatPlate thread={thread} size={height['header-avatar']} muted={thread.state.archived} />}
        title={name}
        subtitle={subtitle}
        right={(
          <>
            {recording && <RecordingPill />}
            <RoundButton icon="more" label="More" onPress={() => setMenuOpen(true)} />
          </>
        )}
      />
      <ReconnectingStrip visible={!chat.connected && open} />
      {masked && open && (
        <MaskInfo
          title="Assigned anonymously · named when your session starts"
          body="Every student gets the interviewer they would have got anyway. We do not send their name or photo to your phone before the session, so nobody can pick or avoid one."
        />
      )}

      <Transcript
        messages={chat.messages}
        sending={chat.sending}
        threadKind={thread.kind}
        viewer="student"
        now={now}
        peerTyping={chat.peerTyping}
        hasOlder={chat.hasOlder}
        older={chat.older}
        onLoadOlder={chat.loadOlder}
        endSignal={chat.endSignal}
        renderSystem={renderSystem}
      />

      {!!closesText && <ClosesLine text={closesText} />}
      {foot}

      <MenuSheet open={menuOpen} name={name}
        canBlock={Boolean(isEmployer && thread.connectionId && thread.archivedReason !== 'BLOCKED')} isInterviewer={isInterviewer}
        onClose={() => setMenuOpen(false)}
        onReport={() => { setMenuOpen(false); setReportOpen(true) }}
        onBlock={() => { setMenuOpen(false); setBlockOpen(true) }}
        onSupport={() => { setMenuOpen(false); onSupport() }} />
      <ReportSheet open={reportOpen} name={name} onClose={() => setReportOpen(false)} onSubmit={submitReport} />
      <BlockSheet open={blockOpen} name={name} busy={blockBusy} onConfirm={confirmBlock} onClose={() => setBlockOpen(false)} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: space.xl },
})
