import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { borderWidth, color, radius, space } from '../../theme'
import { EmployerShell } from '../../components/employer/EmployerShell'
import {
  Banner,
  Body,
  Button,
  Display,
  ErrorState,
  Eyebrow,
  IconButton,
  Input,
  Meta,
  Skeleton,
  StatusPill,
} from '../../components/ui'
import {
  getEmployerThread,
  sendEmployerMessage,
  markEmployerThreadRead,
  reportEmployerThread,
  actOnEmployerConnection,
  type ThreadDto,
  type MessageDto,
} from '../../lib/api/employerChat'
import type { RootStackParamList } from '../../../App'

function formatMessageTime(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

function formatDayDivider(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (isToday) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return 'Yesterday'

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

/** The header's overflow glyph — no icon set exists yet, so this is drawn inline the same way every other screen's small glyphs are (see e.g. chat/ThreadScreen's Dots). */
function Dots() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color.textMuted} strokeWidth={1.5}>
      <Circle cx={12} cy={5} r={1} />
      <Circle cx={12} cy={12} r={1} />
      <Circle cx={12} cy={19} r={1} />
    </Svg>
  )
}

export function EmployerThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, 'EmployerThread'>>()
  const { id } = route.params

  const [thread, setThread] = useState<ThreadDto | null>(null)
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollViewRef = useRef<any>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const page = await getEmployerThread(id, { limit: 50 })
      setThread(page.thread)
      setMessages([...page.rows].reverse())
      void markEmployerThreadRead(id).catch(() => {})
    } catch (err) {
      console.error('Failed to load thread', err)
      setError(err instanceof Error ? err : new Error('We could not load this conversation.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const body = text.trim()
    try {
      setSending(true)
      setText('')
      const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const res = await sendEmployerMessage(id, { body, clientMessageId })
      setMessages((prev) => [...prev, res.message])
      setTimeout(() => scrollViewRef.current?.scrollToEnd?.({ animated: true }), 100)
    } catch (err) {
      console.error('Failed to send message', err)
    } finally {
      setSending(false)
    }
  }

  const handleReport = () => {
    Alert.alert(
      'Report conversation',
      'Report this conversation to Apostrophe moderation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: async () => {
            try {
              await reportEmployerThread(id, 'HARASSMENT')
              Alert.alert('Reported', 'Thank you. Our moderation team will review this transcript.')
            } catch (err) {
              console.error('Failed to report thread', err)
            }
          },
        },
      ],
    )
  }

  const handleBlock = () => {
    if (!thread?.connectionId) return
    Alert.alert(
      'Block candidate',
      'They will be permanently removed from your candidate feed and cannot appear in searches again. The chat is archived read-only. This cannot be undone from here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block candidate',
          style: 'destructive',
          onPress: async () => {
            try {
              await actOnEmployerConnection(thread.connectionId!, 'BLOCK')
              load()
            } catch (err) {
              console.error('Failed to block connection', err)
            }
          },
        },
      ],
    )
  }

  const isReadOnly = Boolean(
    thread?.state.readOnly || thread?.state.archived || thread?.archivedReason,
  )
  const isSupport = thread?.kind === 'USER_ADMIN'
  const name = isSupport ? 'Apostrophe Support' : thread?.counterparty.name || 'Candidate'

  return (
    <EmployerShell
      back={{ label: 'CHATS', onPress: () => navigation.goBack() }}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Title Bar */}
        <View style={styles.titleBar}>
          <View style={styles.titleLeft}>
            <Display level="xs" numberOfLines={1} style={styles.grow}>{name}</Display>
            {isSupport && <StatusPill tone="info" label="Support" />}
            {isReadOnly && (
              <StatusPill
                tone={thread?.archivedReason === 'BLOCKED' ? 'danger' : 'neutral'}
                label={thread?.archivedReason === 'BLOCKED' ? 'Blocked' : 'Read-only'}
              />
            )}
          </View>
          <IconButton
            tone="outline"
            label="More options"
            onPress={() => {
              Alert.alert('Options', undefined, [
                { text: 'Report', onPress: handleReport },
                ...(!isReadOnly && thread?.connectionId
                  ? [{ text: 'Block', style: 'destructive' as const, onPress: handleBlock }]
                  : []),
                { text: 'Cancel', style: 'cancel' },
              ])
            }}
          >
            <Dots />
          </IconButton>
        </View>

        {/* Transcript Area */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messageScroll}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd?.({ animated: false })}
        >
          {loading ? (
            <Skeleton lines={4} />
          ) : error ? (
            <ErrorState
              title="We could not load this conversation."
              body={error.message}
              action={<Button variant="outline" size="sm" label="Try again" onPress={() => load()} />}
            />
          ) : (
            messages.map((msg, idx) => {
              const prev = messages[idx - 1]
              const showDay =
                !prev ||
                new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString()

              return (
                <View key={msg.id} style={styles.messageGroup}>
                  {showDay && (
                    <View style={styles.dayDivider}>
                      <Meta style={styles.dayText}>{formatDayDivider(msg.createdAt)}</Meta>
                    </View>
                  )}

                  {msg.kind === 'SYSTEM' ? (
                    <View style={styles.systemBox}>
                      <Meta style={styles.systemText}>
                        {msg.body || 'Chat event'} · {formatMessageTime(msg.createdAt)}
                      </Meta>
                    </View>
                  ) : (
                    <View style={[styles.bubbleWrap, msg.mine ? styles.mineWrap : styles.peerWrap]}>
                      <View style={[styles.bubble, msg.mine ? styles.mineBubble : styles.peerBubble]}>
                        {msg.body ? (
                          <Body size="md" tone={msg.mine ? 'inverse' : 'default'}>
                            {msg.body}
                          </Body>
                        ) : null}

                        {msg.attachment && (
                          <View style={msg.mine ? styles.attachmentBoxMine : styles.attachmentBoxPeer}>
                            <Body size="xs" weight="medium" tone={msg.mine ? 'inverse' : 'default'}>
                              {`📄 ${msg.attachment.fileName || 'Attachment'}`}
                            </Body>
                          </View>
                        )}
                      </View>

                      <View style={styles.receiptRow}>
                        <Eyebrow>{formatMessageTime(msg.createdAt)}</Eyebrow>
                        {msg.mine && (
                          <Eyebrow>{msg.readAt ? ' · Read' : msg.deliveredAt ? ' · Delivered' : ' · Sent'}</Eyebrow>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>

        {/* Bottom Composer or Read-Only Banner */}
        {isReadOnly ? (
          <View style={styles.readOnlyFooter}>
            <Eyebrow tone="muted">Read-only · conversation archived</Eyebrow>
            <Banner tone={thread?.archivedReason === 'BLOCKED' ? 'danger' : 'neutral'} title={
              thread?.archivedReason === 'BLOCKED'
                ? `${name} was blocked by you.`
                : 'This conversation has been archived.'
            }>
              You can’t send messages here any more. The conversation stays readable for both of you, and nothing was deleted.
            </Banner>
          </View>
        ) : (
          <View style={styles.composerBar}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder="Write a message…"
              multiline
              style={styles.composerInput}
            />
            <Button
              variant="primary"
              size="sm"
              label="Send"
              disabled={!text.trim() || sending}
              busy={sending}
              onPress={handleSend}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </EmployerShell>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grow: {
    flex: 1,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: color.border,
    backgroundColor: color.background,
  },
  titleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  messageScroll: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  messageGroup: {
    gap: space.xs,
  },
  dayDivider: {
    alignItems: 'center',
    marginVertical: space.xs,
  },
  dayText: {
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: space.sm,
    paddingVertical: space['2xs'],
    borderRadius: radius.pill,
  },
  systemBox: {
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  systemText: {
    textAlign: 'center',
  },
  bubbleWrap: {
    maxWidth: '82%',
    gap: space['2xs'],
  },
  mineWrap: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  peerWrap: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
  },
  mineBubble: {
    backgroundColor: color.ink,
    borderBottomRightRadius: radius.sm,
  },
  peerBubble: {
    backgroundColor: color.surfaceMuted,
    borderBottomLeftRadius: radius.sm,
  },
  attachmentBoxMine: {
    marginTop: space.xs,
    padding: space.sm,
    backgroundColor: color.inkRaised,
    borderRadius: radius.sm,
  },
  attachmentBoxPeer: {
    marginTop: space.xs,
    padding: space.sm,
    backgroundColor: color.surfaceSunken,
    borderRadius: radius.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  readOnlyFooter: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    padding: space.md,
    gap: space.sm,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
  },
})
