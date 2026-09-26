import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, radius, space, spaceHalf, trackingNative } from '../../theme'
import { Button, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmChip, EmError, EmIconButton, EmSheet, initialsOf } from '../../components/employer/em'
import { BlockDialog, REPORT_REASONS } from './EmployerConnectionsScreen'
import { ApiClientError } from '../../lib/api'
import { getConfig } from '../../lib/api/config'
import {
  getEmployerConnections, getEmployerThread, markEmployerThreadRead, reportEmployerThread, sendEmployerMessage,
  type EmployerConnectionRow, type MessageDto, type ReportReason, type ThreadDto,
} from '../../lib/api/employerChat'
import { ChatSendError, useThreadSocket, type ThreadRest } from '../../lib/chat/socket'
import { fmtClock, fmtDayDivider, fmtDayMon, newClientMessageId, refusalCopy } from '../../lib/chat/format'
import { pickChatDocument, pickChatImage, uploadChatAttachment, type ChatFile } from '../../lib/chat/upload'
import type { RootStackParamList } from '../../../App'

const REST: ThreadRest = { send: sendEmployerMessage, markRead: markEmployerThreadRead }
const TYPING_IDLE_MS = 3000

const mb = (bytes?: number) => (bytes ? `${Math.round(bytes / 1048576)} MB` : null)

/**
 * EM-26 · a conversation (Employer Android): the 64 header (face, name, how you
 * are connected, the menu), the bubbles with their receipts, files as cards,
 * "… is typing", and the composer — attach (a picture or a document, the
 * server's limits under it), the message, send. EM-26b is read-only: the
 * transcript dims and a lock line takes the composer's place. There are no
 * calls. The socket is shared with the student app; its REST fallback is the
 * employer's.
 */
export function EmployerThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'EmployerThread'>>()
  const insets = useSafeAreaInsets()
  const { id } = route.params
  const [now] = useState(() => Date.now())

  const [thread, setThread] = useState<ThreadDto | null>(null)
  const [conn, setConn] = useState<EmployerConnectionRow | null>(null)
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [peerTyping, setPeerTyping] = useState(false)
  const [menu, setMenu] = useState(false)
  const [attachMenu, setAttachMenu] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const [limits, setLimits] = useState<{ image?: number; doc?: number }>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason | null>(null)

  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const down = useCallback(() => requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false })), [])

  useEffect(() => {
    getConfig()
      .then((c) => setLimits({ image: c.uploads?.CHAT_IMAGE?.maxBytes, doc: c.uploads?.CHAT_DOCUMENT?.maxBytes }))
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    setError(null)
    getEmployerThread(id, { limit: 50 })
      .then((page) => {
        setThread(page.thread)
        setMessages([...page.rows].reverse())
        down()
        markEmployerThreadRead(id).catch(() => {})
        if (page.thread.connectionId) {
          getEmployerConnections({ statuses: ['ACTIVE', 'CLOSED', 'BLOCKED'], perPage: 100 })
            .then((r) => setConn(r.rows.find((x) => x.id === page.thread.connectionId) ?? null))
            .catch(() => {})
        }
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

  const socket = useThreadSocket(
    thread ? id : null,
    {
      onMessage: (m) => {
        upsert(m)
        if (!m.mine) {
          setPeerTyping(false)
          socket.markRead()
        }
      },
      onRead: (r) => setMessages((prev) => prev.map((m) => (m.mine && !m.readAt ? { ...m, readAt: r.at } : m))),
      onTyping: (t) => {
        setPeerTyping(t.typing)
        if (peerTimer.current) clearTimeout(peerTimer.current)
        if (t.typing) peerTimer.current = setTimeout(() => setPeerTyping(false), TYPING_IDLE_MS * 2)
      },
    },
    REST,
  )

  const onDraft = (v: string) => {
    setDraft(v)
    socket.setTyping(true)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => socket.setTyping(false), TYPING_IDLE_MS)
  }

  async function send(attachment?: ChatFile) {
    const body = draft.trim()
    if ((!body && !attachment) || busy) return
    setBusy(true)
    setSendError(null)
    try {
      let att
      if (attachment) {
        setUploading(0)
        att = await uploadChatAttachment(attachment, (f) => setUploading(Math.round(f * 100)))
      }
      const res = await socket.send({ body: attachment ? undefined : body, attachment: att, clientMessageId: newClientMessageId() })
      if (!attachment) setDraft('')
      socket.setTyping(false)
      upsert(res.message)
    } catch (e) {
      setSendError(e instanceof ChatSendError || e instanceof ApiClientError || e instanceof Error ? e.message : 'Not sent. Try again.')
      if (e instanceof ChatSendError && e.reason) load()
    } finally {
      setBusy(false)
      setUploading(null)
    }
  }

  async function attach(kind: 'image' | 'document') {
    setAttachMenu(false)
    setSendError(null)
    try {
      const file = kind === 'image' ? await pickChatImage() : await pickChatDocument()
      if (!file) return
      const max = kind === 'image' ? limits.image : limits.doc
      if (max && file.size > max) return setSendError(`${file.name} is over ${mb(max)}. Choose a smaller file.`)
      await send(file)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'The file did not attach.')
    }
  }

  async function report() {
    if (!reportReason) return
    setReportOpen(false)
    try {
      await reportEmployerThread(id, reportReason)
      setNotice('Reported. Apostrophe’s moderation team will review this conversation.')
    } catch (e) {
      setNotice(e instanceof ApiClientError && e.meta?.reason === 'ALREADY_REPORTED' ? 'You have already reported this conversation.' : e instanceof Error ? e.message : 'Not reported. Try again.')
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

  if (!thread) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Header onBack={() => navigation.goBack()} name="Conversation" />
        {error ? (
          <View style={styles.pad}>
            <EmError title="This conversation didn’t load." body={error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={load} />} />
          </View>
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </View>
    )
  }

  const support = thread.kind === 'USER_ADMIN'
  const name = support ? 'Apostrophe Support' : thread.counterparty.name || 'Candidate'
  const readOnly = thread.state.readOnly || thread.state.archived || !!thread.archivedReason || !thread.state.open
  const sub = support
    ? 'SUPPORT'
    : thread.archivedReason === 'WITHDRAWN' && conn?.closedAt
      ? `WITHDRAWN ${fmtDayMon(conn.closedAt).toUpperCase()} · ARCHIVED`
      : thread.archivedReason === 'BLOCKED'
        ? 'BLOCKED · ARCHIVED'
        : conn
          ? `CONNECTED · VIA ${conn.origin === 'INTEREST' ? 'INTEREST' : 'APPLICATION'}`
          : 'CONNECTED'
  const lockLine =
    thread.archivedReason === 'WITHDRAWN'
      ? `Connection withdrawn${conn?.closedByMe ? ' by you' : ''}. Read-only.`
      : thread.archivedReason === 'BLOCKED'
        ? 'Blocked. Read-only.'
        : thread.archivedReason === 'EXPIRED'
          ? 'This chat has ended. Read-only.'
          : refusalCopy(thread.state.refusal)
  const imageMb = mb(limits.image)
  const docMb = mb(limits.doc)

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        onBack={() => navigation.goBack()}
        name={name}
        sub={sub}
        support={support}
        muted={readOnly}
        photo={thread.counterparty.photoUrl}
        right={!support ? <EmIconButton name="more" label="More" size={height.avatar} onPress={() => setMenu(true)} /> : undefined}
      />

      <ScrollView ref={scroll} style={styles.grow} contentContainerStyle={[styles.transcript, readOnly && styles.dim]} onContentSizeChange={down}>
        {groups.map((g) => (
          <View key={g.day} style={styles.group}>
            <Text style={[text.metaSm, styles.day]}>{g.day.toUpperCase()}</Text>
            {g.rows.map((m) => <Message key={m.id} m={m} />)}
          </View>
        ))}
        {peerTyping && !readOnly && (
          <View style={styles.typing}><Text style={[text.uiXs, styles.muted]}>{`${name.split(' ')[0]} is typing…`}</Text></View>
        )}
      </ScrollView>

      {!!notice && <Text style={[text.uiXs, styles.notice]}>{notice}</Text>}

      {readOnly ? (
        <View style={[styles.lock, { paddingBottom: space.lg + insets.bottom }]}>
          <Icon name="lock" size={space.lg - 1} tint={color.textMuted} weight={2} />
          <Text style={[text.uiSm, styles.muted]}>{lockLine}</Text>
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: space.sm + insets.bottom }]}>
          {!!sendError && <Text style={[text.uiXs, styles.danger, styles.composerNote]}>{sendError}</Text>}
          {uploading !== null && <Text style={[text.metaSm, styles.muted, styles.composerNote]}>{`UPLOADING · ${uploading}%`}</Text>}
          <View style={styles.composeRow}>
            <EmIconButton name="clip" label="Attach a file" bordered="soft" disabled={busy} onPress={() => setAttachMenu(true)} />
            <TextInput
              value={draft}
              onChangeText={onDraft}
              placeholder="Message"
              placeholderTextColor={color.textSubtle}
              multiline
              style={[text.uiBase, styles.input]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!draft.trim() || busy}
              onPress={() => { send() }}
              style={({ pressed }) => [styles.send, draft.trim() ? styles.sendOn : styles.sendOff, pressed && styles.pressed]}
            >
              {busy && uploading === null ? <ActivityIndicator color={color.textInverse} /> : (
                <Icon name="send" size={spaceHalf['4.5']} tint={draft.trim() ? color.textInverse : color.textSubtle} weight={2} />
              )}
            </Pressable>
          </View>
          <Text style={[text.metaXs, styles.subtle, styles.mono, styles.limits]}>
            {`JPG/PNG${imageMb ? ` ≤${imageMb}` : ''} · PDF/DOC/DOCX${docMb ? ` ≤${docMb}` : ''}`}
          </Text>
        </View>
      )}

      <EmSheet open={attachMenu} onClose={() => setAttachMenu(false)} title="Attach" scroll={false}>
        <View style={styles.menu}>
          <MenuRow icon="image" label="Photo" onPress={() => { attach('image') }} />
          <MenuRow icon="file" label="Document" onPress={() => { attach('document') }} />
        </View>
      </EmSheet>

      <EmSheet open={menu} onClose={() => setMenu(false)} scroll={false}>
        <View style={styles.menu}>
          {!!conn && (
            <MenuRow icon="eye" label="View profile" onPress={() => { setMenu(false); navigation.navigate('CandidateProfile', { id: conn.counterparty.id }) }} />
          )}
          <MenuRow icon="flag" label="Report conversation" onPress={() => { setMenu(false); setReportReason(null); setReportOpen(true) }} />
          {!!conn && conn.status !== 'BLOCKED' && (
            <MenuRow icon="ban" label="Block and report" danger onPress={() => { setMenu(false); setBlockOpen(true) }} />
          )}
        </View>
      </EmSheet>

      <EmSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Report ${name}`}
        sub={`The conversation is kept as evidence. ${name.split(' ')[0]} is not told you reported it.`}
        foot={
          <View style={[styles.reportFoot, { paddingBottom: space.md + insets.bottom }]}>
            <Button variant="primary" size="lg" full label="Send report" disabled={!reportReason} onPress={() => { report() }} />
          </View>
        }
      >
        <View style={styles.reasons}>
          {REPORT_REASONS.map((r) => <EmChip key={r.value} label={r.label} on={reportReason === r.value} onPress={() => setReportReason(r.value)} />)}
        </View>
      </EmSheet>

      {conn && (
        <BlockDialog
          open={blockOpen}
          connection={conn}
          onClose={() => setBlockOpen(false)}
          onDone={() => {
            setBlockOpen(false)
            load()
          }}
        />
      )}
    </KeyboardAvoidingView>
  )
}

function Header({
  onBack, name, sub, support, muted, photo, right,
}: { onBack: () => void; name: string; sub?: string; support?: boolean; muted?: boolean; photo?: string | null; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <EmIconButton name="arrowL" label="Back" iconSize={height.glyph - 2} onPress={onBack} />
      <View style={[styles.face, support ? styles.faceSupport : muted ? styles.faceMuted : styles.facePerson]}>
        {photo && !support ? <Image source={{ uri: photo }} style={styles.faceImg} /> : (
          <Text style={[text.uiSmSemi, { color: muted && !support ? color.textMuted : color.textInverse }]}>{support ? '’' : initialsOf(name)}</Text>
        )}
      </View>
      <View style={styles.grow}>
        <Text style={text.uiLeadSemi} numberOfLines={1}>{name}</Text>
        {!!sub && <Text style={[text.metaXs, styles.muted, styles.mono]} numberOfLines={1}>{sub}</Text>}
      </View>
      {right}
    </View>
  )
}

function Message({ m }: { m: MessageDto }) {
  if (m.kind === 'SYSTEM') {
    return <Text style={[text.metaSm, styles.system]}>{(m.body || 'Chat event').toUpperCase()}</Text>
  }
  const receipt = m.mine ? (m.readAt ? 'Read' : m.deliveredAt ? 'Delivered' : 'Sent') : null
  const meta = [fmtClock(m.createdAt), receipt].filter(Boolean).join(' · ')
  return (
    <View style={[styles.msg, m.mine ? styles.msgMine : styles.msgPeer]}>
      {m.attachment ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${m.attachment.fileName || 'attachment'}`}
          disabled={!m.attachment.url}
          onPress={() => m.attachment?.url && Linking.openURL(m.attachment.url).catch(() => {})}
          style={({ pressed }) => [styles.file, pressed && styles.pressed]}
        >
          <Icon name={m.attachment.kind === 'IMAGE' ? 'image' : 'file'} size={space.xl} tint={m.attachment.kind === 'IMAGE' ? color.accent : color.danger} />
          <View style={styles.grow}>
            <Text style={text.uiSmMedium} numberOfLines={1}>{m.attachment.fileName || (m.attachment.kind === 'IMAGE' ? 'Photo' : 'Document')}</Text>
            <Text style={[text.metaXs, styles.subtle]}>{`${m.attachment.kind === 'IMAGE' ? 'IMAGE' : 'DOCUMENT'} · ${Math.max(1, Math.round(m.attachment.sizeBytes / 1024))} KB`}</Text>
          </View>
        </Pressable>
      ) : null}
      {!!m.body && (
        <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubblePeer]}>
          <Text style={[text.uiMd, { color: m.mine ? color.textInverse : color.text }]}>{m.body}</Text>
        </View>
      )}
      <View style={styles.meta}>
        {m.mine && m.readAt && <Icon name="ticks" size={space.md} tint={color.accent} weight={2} />}
        <Text style={[text.metaXs, m.mine && m.readAt ? styles.accent : styles.subtle]}>{meta.toUpperCase()}</Text>
      </View>
    </View>
  )
}

function MenuRow({ icon, label, danger, onPress }: { icon: IconName; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
      <Icon name={icon} size={space.lg} tint={danger ? color.danger : color.text} />
      <Text style={[text.uiBaseMedium, danger && styles.danger]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surfaceMuted },
  grow: { flex: 1, minWidth: 0, gap: space['2xs'] },
  pad: { flex: 1, padding: space.lg },
  loading: { paddingVertical: space['3xl'] },
  pressed: { opacity: opacity.pressed },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  danger: { color: color.danger },
  accent: { color: color.accent },
  mono: { letterSpacing: trackingNative.eyebrow },
  dim: { opacity: opacity.disabled + 0.25 },

  header: { height: height['chat-head'] - space.xs, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['1.5'], paddingLeft: space.xs, paddingRight: space.sm, backgroundColor: color.surface, borderBottomWidth: borderWidth.thin, borderBottomColor: color.border },
  face: { width: height['chip-lg'], height: height['chip-lg'], borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  facePerson: { backgroundColor: color.accentBright },
  faceSupport: { backgroundColor: color.accent },
  faceMuted: { backgroundColor: color.border },
  faceImg: { width: '100%', height: '100%' },

  transcript: { padding: spaceHalf['3.5'], gap: spaceHalf['2.5'], flexGrow: 1, justifyContent: 'flex-end' },
  group: { gap: spaceHalf['2.5'] },
  day: { alignSelf: 'center', color: color.textSubtle, letterSpacing: trackingNative.eyebrow, paddingVertical: space.xs },
  system: { alignSelf: 'center', textAlign: 'center', color: color.textMuted, letterSpacing: trackingNative.eyebrow, paddingHorizontal: space.lg },
  msg: { gap: space['2xs'] + 1, maxWidth: height['bubble-max'] - space.sm },
  msgMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgPeer: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingVertical: spaceHalf['2.5'], paddingHorizontal: spaceHalf['3.5'] },
  bubbleMine: { backgroundColor: color.accent, borderTopLeftRadius: spaceHalf['4.5'], borderTopRightRadius: spaceHalf['4.5'], borderBottomLeftRadius: spaceHalf['4.5'], borderBottomRightRadius: space.xs },
  bubblePeer: { backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border, borderTopLeftRadius: spaceHalf['4.5'], borderTopRightRadius: spaceHalf['4.5'], borderBottomRightRadius: spaceHalf['4.5'], borderBottomLeftRadius: space.xs },
  file: { width: height['bubble-max'] - space['4xl'] - 2, flexDirection: 'row', alignItems: 'center', gap: spaceHalf['2.5'], paddingVertical: spaceHalf['2.5'], paddingHorizontal: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  typing: { alignSelf: 'flex-start', paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.panel, backgroundColor: color.surface, borderWidth: borderWidth.thin, borderColor: color.border },
  notice: { color: color.textSecondary, paddingHorizontal: space.lg, paddingBottom: space.sm },

  lock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingTop: space.lg, paddingHorizontal: space.lg, backgroundColor: color.surfaceMuted, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  composer: { paddingTop: space.sm, paddingHorizontal: spaceHalf['2.5'], gap: space.xs, backgroundColor: color.surface, borderTopWidth: borderWidth.thin, borderTopColor: color.border },
  composerNote: { paddingHorizontal: space.xs },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spaceHalf['1.5'] },
  input: { flex: 1, minHeight: height.tap, maxHeight: height.tap * 3, borderRadius: spaceHalf['4.5'] + space['2xs'], borderWidth: borderWidth.thin, borderColor: color.borderStrong, paddingHorizontal: space.lg, paddingTop: spaceHalf['2.5'] + 1, paddingBottom: spaceHalf['2.5'] + 1, color: color.text },
  send: { width: height.tap, height: height.tap, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: color.accent },
  sendOff: { backgroundColor: color.surfaceMuted },
  limits: { paddingLeft: height.tap + spaceHalf['2.5'] },

  menu: { paddingHorizontal: space.lg, paddingBottom: space['2xl'] },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  reportFoot: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: height['control-lg'], paddingHorizontal: space.sm },
})
