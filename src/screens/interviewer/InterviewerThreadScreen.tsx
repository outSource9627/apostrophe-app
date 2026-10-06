import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { color, height, space } from '../../theme'
import { Button, PopoverMenu, measureAnchor, text, type MenuAnchor, type PopoverItem } from '../../components/ui'
import { EmError } from '../../components/employer/em'
import {
  ChatHeader, ChatPlate, Composer, MaskInfo, ReadOnlyFoot, ReconnectingStrip, RoundButton, Transcript,
} from '../../components/chat'
import { ReportSheet } from '../chat/parts'
import { ApiClientError } from '../../lib/api'
import { getInterviewerThreadPage, reportThread, type ReportReason } from '../../lib/api/chat'
import { getInterviewerInterview, markInterviewerThreadRead, sendInterviewerMessage, type InterviewerInterviewDto } from '../../lib/api/interviewer'
import { useChatThread, type ChatThreadSource } from '../../lib/chat/useChatThread'
import { useChatConfig } from '../../lib/chat/config'
import { firstWord, fmtClock, fmtDayMon, fmtHours, fmtRelDayInline, fmtRowStamp, refusalCopy } from '../../lib/chat/format'
import type { RootStackParamList } from '../../../App'

const SOURCE: ChatThreadSource = { getPage: getInterviewerThreadPage, rest: { send: sendInterviewerMessage, markRead: markInterviewerThreadRead } }

/**
 * A conversation with a candidate, drawn with the shared chat pieces
 * (docs/chat-redesign-mockups.html, A) on the interviewer's endpoints: the
 * header (the candidate, the interview's time, the menu — View interview and
 * Report), a note that the student sees "Your Interviewer" until the session
 * begins, the bubbles with their receipts, the typing dots, and a text
 * composer (the interviewer's chat takes no files; a file the student sends is
 * shown). Before the chat opens, or once it is read-only, a lock, the reason
 * and the admin's window take the composer's place. Scrolling up reads
 * further back.
 */
export function InterviewerThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewerThread'>>()
  const { id } = route.params
  const insets = useSafeAreaInsets()
  const [now] = useState(() => Date.now())
  const chat = useChatThread(id, SOURCE)
  const cfg = useChatConfig()
  const [interview, setInterview] = useState<InterviewerInterviewDto | null>(null)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const moreRef = useRef<React.ComponentRef<typeof View>>(null)
  const thread = chat.thread

  const interviewId = thread?.interviewId ?? null
  useEffect(() => {
    if (!interviewId) return
    let alive = true
    getInterviewerInterview(interviewId).then((iv) => alive && setInterview(iv)).catch(() => {})
    return () => { alive = false }
  }, [interviewId])

  async function submitReport(reason: ReportReason, note: string) {
    setReportOpen(false)
    try {
      await reportThread(id, reason, note || undefined)
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
          <View style={styles.pad}><EmError title="This conversation didn’t load." body={chat.error} action={<Button variant="secondary" size="pair" icon="refresh" label="Try again" onPress={() => { chat.load() }} />} /></View>
        ) : (
          <ActivityIndicator color={color.textSubtle} style={styles.loading} />
        )}
      </View>
    )
  }

  const support = thread.kind === 'USER_ADMIN'
  const name = support ? 'Apostrophe Support' : thread.counterparty.name || 'Candidate'
  const readOnly = thread.state.readOnly || thread.state.archived
  const canSend = thread.state.open && !readOnly
  const notYet = !thread.state.open && !readOnly
  const slot = interview?.slotStart ?? null

  const sub = support
    ? 'Support'
    : slot
      ? readOnly ? `Interview ${fmtDayMon(slot)} · read-only` : `Interview ${fmtRelDayInline(slot, now)}, ${fmtClock(slot)}`
      : readOnly ? 'Read-only' : notYet ? 'Not open yet' : null

  // The student reads "Your Interviewer" until the session starts (SC-16) — said only when the interview confirms it has not.
  const stillMasked = !support && !readOnly && !!interview && !interview.sessionStartedAt

  const items: PopoverItem[] = []
  if (thread.interviewId) items.push({ key: 'interview', label: 'View interview', icon: 'cal', onPress: () => navigation.navigate('InterviewerDetail', { id: thread.interviewId! }) })
  if (!support && !readOnly) items.push({ key: 'report', label: 'Report this chat', icon: 'flag', onPress: () => setReportOpen(true) })

  const foot = canSend ? (
    <Composer
      value={chat.draft}
      onChange={chat.onDraft}
      onSend={chat.sendText}
      busy={chat.busy}
      placeholder={support ? 'Message support' : `Message ${firstWord(name)}`}
      error={chat.sendError}
      bottomInset={insets.bottom}
    />
  ) : notYet && thread.opensAt ? (
    <ReadOnlyFoot
      title={`This chat opens ${fmtRowStamp(thread.opensAt, now)}.`}
      body={cfg.opensHoursBefore != null ? `Chats open ${fmtHours(cfg.opensHoursBefore)} before the interview.` : null}
      bottomInset={insets.bottom}
    />
  ) : (
    <ReadOnlyFoot
      title={refusalCopy(thread.state.refusal)}
      body={cfg.readOnlyHoursAfter != null
        ? `Chats close ${fmtHours(cfg.readOnlyHoursAfter)} after the interview ends. Everything above stays.`
        : 'Everything above stays and can still be read.'}
      bottomInset={insets.bottom}
    />
  )

  return (
    <KeyboardAvoidingView style={[styles.page, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ChatHeader
        onBack={() => navigation.goBack()}
        plate={<ChatPlate thread={thread} size={height['header-avatar']} muted={readOnly && !support} />}
        title={name}
        subtitle={sub}
        right={items.length > 0 ? (
          <RoundButton ref={moreRef} icon="more" label="More" onPress={() => { measureAnchor(moreRef.current).then((a) => a && setMenu(a)) }} />
        ) : undefined}
      />
      <ReconnectingStrip visible={!chat.connected && canSend} />
      {stillMasked && <MaskInfo title="The student sees “Your Interviewer”" body="Your name and photo stay hidden until the session begins." />}

      <Transcript
        messages={chat.messages}
        sending={chat.sending}
        threadKind={thread.kind}
        viewer="interviewer"
        now={now}
        peerTyping={chat.peerTyping && canSend}
        hasOlder={chat.hasOlder}
        older={chat.older}
        onLoadOlder={chat.loadOlder}
        endSignal={chat.endSignal}
      />

      {!!notice && <Text style={[text.uiXs, styles.notice]}>{notice}</Text>}
      {foot}

      <PopoverMenu anchor={menu} items={items} onClose={() => setMenu(null)} />
      <ReportSheet open={reportOpen} name={name} onClose={() => setReportOpen(false)} onSubmit={submitReport} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  pad: { flex: 1, padding: space.lg },
  loading: { paddingVertical: space['3xl'] },
  notice: { color: color.textSecondary, paddingHorizontal: space.lg, paddingBottom: space.sm },
})
