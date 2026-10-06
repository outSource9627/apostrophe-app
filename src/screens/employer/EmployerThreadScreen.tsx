import React, { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, height, opacity, space, spaceHalf } from '../../theme'
import { Button, Input, text } from '../../components/ui'
import { Icon, type IconName } from '../../components/ui/Icon'
import { EmChip, EmDialog, EmError, EmSheet } from '../../components/employer/em'
import {
  ChatHeader, ChatPlate, Composer, ReadOnlyFoot, ReconnectingStrip, RoundButton, Transcript,
} from '../../components/chat'
import { BlockDialog, REPORT_REASONS } from './EmployerConnectionsScreen'
import { ApiClientError } from '../../lib/api'
import {
  actOnEmployerConnection, getEmployerConnections, getEmployerThread, markEmployerThreadRead, reportEmployerThread, sendEmployerMessage,
  type EmployerConnectionRow, type ReportReason,
} from '../../lib/api/employerChat'
import { useChatThread, type ChatThreadSource } from '../../lib/chat/useChatThread'
import { useChatConfig } from '../../lib/chat/config'
import { employerConnectionLine, firstWord, fmtDayMon, refusalCopy } from '../../lib/chat/format'
import { useCandidateDocument } from '../../lib/employer/useCandidateDocument'
import type { RootStackParamList } from '../../../App'

const SOURCE: ChatThreadSource = { getPage: getEmployerThread, rest: { send: sendEmployerMessage, markRead: markEmployerThreadRead } }

/**
 * EM-26 · a conversation (Employer Android), drawn with the shared chat pieces
 * (docs/chat-redesign-mockups.html, A): the header (face, name, how you are
 * connected, the résumé when there is one, the menu), the bubbles with their
 * receipts, files as cards and photos as pictures, the typing dots, and the
 * composer — "+" (a picture or a document, the server's limits in its menu),
 * the message, send. EM-26b is read-only: a lock, the reason and what it means
 * take the composer's place. Scrolling up reads further back. There are no
 * calls. ST-35: while the connection is active and the candidate has a résumé,
 * the header and the menu carry it (the connection row brings it with the
 * contact details). The socket is shared with the student app; its REST
 * fallback is the employer's.
 */
export function EmployerThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'EmployerThread'>>()
  const insets = useSafeAreaInsets()
  const { id } = route.params
  const [now] = useState(() => Date.now())
  const chat = useChatThread(id, SOURCE)
  const cfg = useChatConfig()
  const docs = useCandidateDocument()

  const [conn, setConn] = useState<EmployerConnectionRow | null>(null)
  const [menu, setMenu] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason | null>(null)
  const thread = chat.thread

  // How you are connected, the résumé and the archived reasons live on the Connection (re-read after every reload).
  useEffect(() => {
    if (!thread?.connectionId) return
    let alive = true
    const want = thread.connectionId
    getEmployerConnections({ statuses: ['ACTIVE', 'CLOSED', 'BLOCKED'], perPage: 100 })
      .then((r) => alive && setConn(r.rows.find((x) => x.id === want) ?? null))
      .catch(() => {})
    return () => { alive = false }
  }, [thread])

  async function openResume() {
    if (!conn?.resume) return
    setNotice(null)
    const failed = await docs.open(conn.counterparty.id, conn.resume.id)
    if (failed) setNotice(failed)
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

  if (!thread) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <ChatHeader onBack={() => navigation.goBack()} title="Conversation" />
        {chat.error ? (
          <View style={styles.pad}>
            <EmError title="This conversation didn’t load." body={chat.error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { chat.load() }} />} />
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
  const sub = support ? 'Support' : conn ? employerConnectionLine(conn) : readOnly ? 'Read-only' : 'Connected'
  const resume = !support ? conn?.resume ?? null : null
  const archivedFoot = thread.archivedReason === 'WITHDRAWN' || thread.archivedReason === 'BLOCKED' || thread.archivedReason === 'EXPIRED'
  const footTitle =
    thread.archivedReason === 'WITHDRAWN'
      ? `This connection was withdrawn${conn?.closedAt ? ` on ${fmtDayMon(conn.closedAt)}` : ''}.`
      : thread.archivedReason === 'BLOCKED'
        ? 'This connection was blocked.'
        : thread.archivedReason === 'EXPIRED'
          ? 'This chat has ended.'
          : refusalCopy(thread.state.refusal)

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ChatHeader
        onBack={() => navigation.goBack()}
        plate={<ChatPlate thread={thread} size={height['header-avatar']} muted={readOnly && !support} />}
        title={name}
        subtitle={sub}
        right={!support ? (
          <>
            {!!resume && (
              <RoundButton
                icon="file"
                label={`Download ${name}’s résumé`}
                bordered
                iconSize={spaceHalf['4.5']}
                disabled={docs.opening === resume.id}
                onPress={() => { openResume() }}
              />
            )}
            <RoundButton icon="more" label="More" onPress={() => setMenu(true)} />
          </>
        ) : undefined}
      />
      <ReconnectingStrip visible={!chat.connected && !readOnly} />

      <Transcript
        messages={chat.messages}
        sending={chat.sending}
        threadKind={thread.kind}
        viewer="employer"
        now={now}
        peerTyping={chat.peerTyping && !readOnly}
        hasOlder={chat.hasOlder}
        older={chat.older}
        onLoadOlder={chat.loadOlder}
        endSignal={chat.endSignal}
      />

      {!!notice && <Text style={[text.uiXs, styles.notice]}>{notice}</Text>}

      {readOnly ? (
        <ReadOnlyFoot
          title={footTitle}
          body={archivedFoot ? 'The chat is read-only for both of you. Nothing was deleted.' : 'Everything above stays.'}
          bottomInset={insets.bottom}
        />
      ) : (
        <Composer
          value={chat.draft}
          onChange={chat.onDraft}
          onSend={chat.sendText}
          busy={chat.busy}
          placeholder={support ? 'Message support' : `Message ${firstWord(name)}`}
          error={chat.sendError}
          uploading={chat.uploading}
          attach={{
            onPick: (kind) => { chat.attach(kind, kind === 'image' ? cfg.imageMaxBytes : cfg.documentMaxBytes) },
            imageMaxBytes: cfg.imageMaxBytes, documentMaxBytes: cfg.documentMaxBytes,
          }}
          bottomInset={insets.bottom}
        />
      )}

      <EmSheet open={menu} onClose={() => setMenu(false)} scroll={false}>
        <View style={styles.menu}>
          {!!conn && (
            <MenuRow icon="eye" label="View profile" onPress={() => { setMenu(false); navigation.navigate('CandidateProfile', { id: conn.counterparty.id }) }} />
          )}
          {!!resume && <MenuRow icon="file" label="Résumé" onPress={() => { setMenu(false); openResume() }} />}
          {conn?.status === 'ACTIVE' && (
            <MenuRow icon="out" label="Withdraw connection" onPress={() => { setMenu(false); setWithdrawOpen(true) }} />
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
        sub={`The conversation is kept as evidence. ${firstWord(name)} is not told you reported it.`}
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
            chat.load()
          }}
        />
      )}
      {conn && (
        <WithdrawDialog
          open={withdrawOpen}
          connection={conn}
          onClose={() => setWithdrawOpen(false)}
          onDone={() => {
            setWithdrawOpen(false)
            chat.load()
          }}
        />
      )}
    </KeyboardAvoidingView>
  )
}

/**
 * Withdraw, from inside the chat — the same dialog, copy and optional reason as
 * the Connections screen's row menu (EM-24): the chat turns read-only for both.
 */
function WithdrawDialog({ open, connection, onClose, onDone }: { open: boolean; connection: EmployerConnectionRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])
  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await actOnEmployerConnection(connection.id, 'WITHDRAW', reason.trim() || undefined)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not withdrawn. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <EmDialog
      open={open}
      onClose={onClose}
      title={`Withdraw from ${connection.counterparty.name || 'this connection'}?`}
      body="The chat becomes read-only for both of you. Nothing is deleted."
      actions={
        <>
          <Button variant="ghost" size="md" label="Cancel" disabled={busy} onPress={onClose} />
          <Button variant="secondary" size="md" label="Withdraw" busy={busy} disabled={busy} onPress={() => { confirm() }} />
        </>
      }
    >
      <Input value={reason} onChangeText={setReason} placeholder="Reason (optional)" />
      {!!error && <Text style={[text.uiSm, styles.danger]}>{error}</Text>}
    </EmDialog>
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
  page: { flex: 1, backgroundColor: color.background },
  pad: { flex: 1, padding: space.lg },
  loading: { paddingVertical: space['3xl'] },
  pressed: { opacity: opacity.pressed },
  danger: { color: color.danger },
  notice: { color: color.textSecondary, paddingHorizontal: space.lg, paddingBottom: space.sm },

  menu: { paddingHorizontal: space.lg, paddingBottom: space['2xl'] },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceHalf['1.5'] },
  reportFoot: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: borderWidth.thin, borderTopColor: color.border, backgroundColor: color.surface },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: height['control-lg'], paddingHorizontal: space.sm },
})
